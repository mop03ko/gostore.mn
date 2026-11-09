<?php
declare(strict_types=1);
require_once __DIR__.'/inbound-details.php';

// After-sales with TaoWorld for a GOStore order's purchase: cancel before shipping, refund or
// return-and-refund requests to the Taobao seller (with messages and the return parcel), the
// domestic delivery timeline, and the supplier bill reconciliation. Every provider write is an
// explicit admin action; outcomes are re-read from TaoWorld, never assumed.
const TW_REFUND_STATUS = [0=>'Буцаалт хүсээгүй',10=>'Худалдагчийн зөвшөөрлийг хүлээж байна',20=>'Худалдагч зөвшөөрсөн, бараагаа буцааж илгээнэ',30=>'Буцаасан барааг худалдагч хүлээн авахыг хүлээж байна',100=>'Мөнгө буцаагдсан',-10=>'Худалдагч татгалзсан',-20=>'Буцаалт хаагдсан'];
const TW_REFUND_TYPES = [1=>'Зөвхөн мөнгө буцаах',2=>'Бараа буцааж, мөнгө авах'];
const TW_GOODS_STATUS = [1=>'Илгээгээгүй',2=>'Илгээсэн',3=>'Бараа ирээгүй',4=>'Бараа хүлээн авсан',5=>'Буцааж илгээсэн',6=>'Худалдагч хүлээн авсан'];
const TW_AFTERSALE_ACTIONS = ['taoworld-cancel','taoworld-refund-render','taoworld-refund-submit','taoworld-refund-refresh','taoworld-refund-cancel','taoworld-refund-messages','taoworld-refund-message','taoworld-return-render','taoworld-return-submit','taoworld-logistics','taoworld-bills'];

function tw_text(mixed $v,int $max=300): string {return is_scalar($v)?mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]/u','',strip_tags((string)$v))??''),0,$max):'';}
function tw_aftersale_order(string $id): array {
    $o=order_row($id)['order'];tw_assert_pinned($o);
    if(empty($o['purchase']['submitted_at'])||empty($o['purchase']['provider_order_ids']))fail('TaoWorld захиалга үүсээгүй байна.',409);
    return $o;
}
function tw_input_id(mixed $v,string $label): string {
    if((!is_string($v)&&!is_int($v))||!preg_match('/^\d{1,30}$/D',(string)$v))fail($label.' буруу.');return (string)$v;
}
function tw_aftersale_child(array $o,mixed $child): array {
    $cid=tw_input_id($child,'Дэд захиалгын дугаар');
    foreach($o['purchase']['children']??[] as $c)if((string)($c['sub_purchase_order_id']??'')===$cid)return $c;
    fail('Энэ захиалгад тийм TaoWorld дэд захиалга алга.',404);
}
function tw_aftersale_refund(array $o,mixed $refundId): array {
    $rid=tw_input_id($refundId,'Буцаалтын дугаар');
    foreach($o['purchase']['refunds']??[] as $r)if((string)($r['refund_id']??'')===$rid)return $r;
    fail('Энэ захиалгын буцаалт олдсонгүй.',404);
}

// Cancel is asynchronous on TaoWorld: success is always returned and the purchase query shows the result.
function tw_aftersale_cancel(string $id,string $reason): array {
    return tw_order_lock($id,static function()use($id,$reason){
        $o=tw_aftersale_order($id);$p=$o['purchase'];
        $states=array_map(fn($c)=>(string)($c['status']??''),$p['children']??[]);
        if(!$states||array_diff($states,['BULIDING','WAIT_BUYER_P','WAIT_SELLER_SEND_GOODS']))fail('Илгээгдсэн эсвэл хаагдсан захиалгыг цуцлахгүй. Буцаалт хүсэлт гаргана уу.',409);
        if((strtotime($p['cancel']['requested_at']??'')?:0)>time()-600)fail('Цуцлах хүсэлтийг саяхан илгээсэн. Төлөвийг шалгана уу.',409);
        // Stop automatic supplier payment before asking TaoWorld to cancel.
        tw_update($id,static function(&$fresh){$fresh['purchase']['auto_pay']=false;$fresh['purchase']['cancel']=['requested_at'=>gmdate('c'),'pending'=>true];});
        $results=[];
        foreach($p['provider_order_ids'] as $pid){
            try{$results[]=['purchase_id'=>tw_id($pid)]+tw_submission_result(tw_call('/purchase/order/asyn/cancel',['purchase_id'=>tw_id($pid),'cancel_reason'=>$reason,'cancel_remark'=>'GOStore '.$id]));}
            catch(Throwable $e){$results[]=['purchase_id'=>(string)$pid,'success'=>null,'code'=>'TRANSPORT_UNCERTAIN'];}
        }
        return tw_update($id,static function(&$fresh)use($reason,$results){$fresh['purchase']['cancel']=['requested_at'=>gmdate('c'),'reason'=>$reason,'results'=>$results];$fresh['purchase']['next_at']=time()+60;});
    });
}

// Refund / return requests on a paid sub-order.
function tw_refund_template(array $data): array {
    $t=$data['refund_order_template']??null;if(!is_array($t))fail('TaoWorld буцаалтын загвар дутуу.',502);
    $fee=is_array($t['max_refund_fee']??null)?$t['max_refund_fee']:[];
    $reasons=[];foreach(array_slice(is_array($t['refund_reasons']??null)?$t['refund_reasons']:[],0,40) as $r)if(is_array($r)&&preg_match('/^\d{1,20}$/D',(string)($r['reason_id']??'')))$reasons[]=['id'=>(int)$r['reason_id'],'text'=>tw_text($r['reason_desc']??'',120),'tips'=>tw_text($r['tips']??'',200)];
    $ints=fn($a)=>array_values(array_filter(array_map('intval',is_array($a)?$a:[]),fn($v)=>$v>0));
    return ['reasons'=>$reasons,'refund_types'=>$ints($t['refund_type_list']??[]),'goods_statuses'=>$ints($t['goods_status_list']??[]),
        'fee'=>['default'=>(int)($fee['refund_fee']??0),'max'=>(int)($fee['max_refund_fee']??0),'min'=>(int)($fee['min_refund_fee']??0),'editable'=>($fee['can_edit_refund_fee']??false)===true,'tips'=>tw_text($fee['fee_tips']??'',200)]];
}
function tw_refund_state(array $aggregate): array {
    $r=is_array($aggregate['refund_order']??null)?$aggregate['refund_order']:[];$l=is_array($aggregate['logistics']??null)?$aggregate['logistics']:[];
    $line=is_array($aggregate['purchase_order_line']??null)?$aggregate['purchase_order_line']:[];
    $address=$l['receiver_address']??'';if(is_array($address))$address=implode(' · ',array_filter([tw_text($address['receiver']??'',60),tw_text($address['phone']??'',30),tw_text($address['detail_address']??'',200)]));
    $status=(int)($r['refund_status']??0);
    return array_filter(['refund_id'=>preg_match('/^\d{1,30}$/D',(string)($r['refund_id']??''))?(string)$r['refund_id']:null,'child'=>isset($line['purchase_order_line_id'])?(string)$line['purchase_order_line_id']:null,
        'status'=>$status,'status_text'=>TW_REFUND_STATUS[$status]??('Төлөв '.$status),'fee_fen'=>(int)($r['refund_fee']??0),'type'=>(int)($r['refund_type']??0),'goods_status'=>(int)($r['goods_status']??0),
        'reason'=>tw_text($r['reason_desc']??$r['refund_desc']??'',200),'seller_refuse'=>tw_text(trim(($r['seller_refuse_reason']??'').' '.($r['seller_refuse_reason_describe']??'')),300),
        'timeout'=>is_numeric($r['timeout_date']??null)?gmdate('c',(int)floor((float)$r['timeout_date']/1000)):null,
        'return_address'=>tw_text($address,300),'seller_note'=>tw_text($l['seller_agree_return_describe']??'',300),
        'return_tracking'=>tw_text($l['logistics_no']??'',40),'return_company'=>tw_text($l['logistics_company']['logistics_company_name']??'',60)],fn($v)=>$v!==null&&$v!=='');
}
function tw_refund_store(string $id,array $state,array $extra=[]): array {
    return tw_update($id,static function(&$o)use($state,$extra){
        $list=$o['purchase']['refunds']??[];$found=false;
        foreach($list as &$r){
            if((isset($state['refund_id'])&&($r['refund_id']??null)===$state['refund_id'])||(!isset($r['refund_id'])&&isset($state['child'])&&($r['child']??null)===$state['child'])){$r=array_replace($r,$state,$extra,['checked_at'=>gmdate('c')]);$found=true;break;}
        }unset($r);
        if(!$found)$list[]=array_replace($extra,$state,['checked_at'=>gmdate('c')]);
        $o['purchase']['refunds']=$list;
    });
}
function tw_aftersale_refund_render(string $id,array $b): array {
    $o=tw_aftersale_order($id);$c=tw_aftersale_child($o,$b['child']??null);
    if(!in_array($c['status']??'',['WAIT_SELLER_SEND_GOODS','WAIT_BUYER_CONFIRM_GOODS','TRADE_CLOSED'],true))fail('Төлбөр төлөгдсөн дэд захиалгад л буцаалт хүснэ.',409);
    $type=int_field($b,'refund_type',1,2);$goods=int_field($b,'goods_status',1,6);
    $params=['purchaseOrderLineId'=>$c['sub_purchase_order_id'],'refundType'=>(string)$type,'goodsStatus'=>(string)$goods];
    if(isset($b['reason_id']))$params['reasonId']=(string)int_field($b,'reason_id',1,PHP_INT_MAX);
    return tw_refund_template(tw_data(tw_call('/order/refund/render',$params)))+['child'=>$c['sub_purchase_order_id']];
}
function tw_aftersale_refund_submit(string $id,array $b): array {
    return tw_order_lock($id,static function()use($id,$b){
        $o=tw_aftersale_order($id);$c=tw_aftersale_child($o,$b['child']??null);$cid=(string)$c['sub_purchase_order_id'];
        foreach($o['purchase']['refunds']??[] as $r)if(($r['child']??null)===$cid&&in_array((int)($r['status']??0),[10,20,30],true))fail('Энэ дэд захиалгад нээлттэй буцаалт байна.',409);
        foreach($o['purchase']['refunds']??[] as $r)if(($r['child']??null)===$cid&&!isset($r['refund_id'])&&(strtotime($r['submitted_at']??'')?:0)>time()-900)fail('Өмнөх хүсэлтийн хариуг шалгана уу.',409);
        $template=tw_aftersale_refund_render($id,$b);$type=int_field($b,'refund_type',1,2);$goods=int_field($b,'goods_status',1,6);
        if(!in_array($type,$template['refund_types'],true)||!in_array($goods,$template['goods_statuses'],true))fail('Энэ төрлийн буцаалт хүсэх боломжгүй.',409);
        $reason=int_field($b,'reason_id',1,PHP_INT_MAX);$text='';foreach($template['reasons'] as $r)if($r['id']===$reason)$text=$r['text'];if($text==='')fail('Буцаалтын шалтгаан буруу.',409);
        $fee=int_field($b,'refund_fee',1,100000000);
        if($fee>$template['fee']['max']||$fee<$template['fee']['min']||(!$template['fee']['editable']&&$fee!==$template['fee']['default']))fail('Буцаах дүн зөвшөөрөгдөх хэмжээнээс гадуур байна.',409);
        $desc=str_field($b,'description',200,false);
        $extra=['child'=>$cid,'type'=>$type,'goods_status'=>$goods,'reason_id'=>$reason,'reason'=>$text,'requested_fee_fen'=>$fee,'description'=>$desc,'submitted_at'=>gmdate('c')];
        tw_refund_store($id,['child'=>$cid,'status'=>-1,'status_text'=>'Илгээж байна'],$extra);
        try{$data=tw_data(tw_call('/order/refund/submit',['purchaseOrderLineId'=>$cid,'refundType'=>(string)$type,'goodsStatus'=>(string)$goods,'reasonId'=>(string)$reason,'refundFee'=>(string)$fee,'refundDesc'=>$desc]));}
        catch(Throwable $e){return tw_refund_store($id,['child'=>$cid,'status'=>-1,'status_text'=>'Хариу тодорхойгүй. «Төлөв шалгах» товчоор TaoWorld-оос дахин уншина.'],$extra);}
        $state=tw_refund_state(is_array($data['refund_order_aggregate']??null)?$data['refund_order_aggregate']:[]);$state['child']=$cid;
        return tw_refund_store($id,$state,$extra);
    });
}
// Re-reads every request: known ids by id, unconfirmed ones from the purchase's refund list.
function tw_aftersale_refund_refresh(string $id): array {
    return tw_order_lock($id,static function()use($id){
        $o=tw_aftersale_order($id);$refunds=$o['purchase']['refunds']??[];if(!$refunds)fail('Энэ захиалгад буцаалт хүсээгүй.',409);
        foreach($refunds as $r){
            if(isset($r['refund_id'])){$data=tw_data(tw_call('/order/refund/query',['refundId'=>$r['refund_id']]));$o=tw_refund_store($id,tw_refund_state(is_array($data['refund_order_aggregate']??null)?$data['refund_order_aggregate']:[]));continue;}
            foreach($o['purchase']['provider_order_ids'] as $pid){
                $data=tw_data(tw_call('/order/refund/queryList',['purchaseOrderId'=>tw_id($pid),'pageNo'=>'1','pageSize'=>'50']));
                foreach(array_slice(is_array($data['refund_order_aggregates']??null)?$data['refund_order_aggregates']:[],0,50) as $a){$s=tw_refund_state(is_array($a)?$a:[]);if(($s['child']??null)===($r['child']??'')&&isset($s['refund_id']))$o=tw_refund_store($id,$s);}
            }
        }
        return order_row($id)['order'];
    });
}
function tw_aftersale_refund_cancel(string $id,array $b): array {
    return tw_order_lock($id,static function()use($id,$b){
        $o=tw_aftersale_order($id);$r=tw_aftersale_refund($o,$b['refund_id']??null);
        if(!in_array((int)($r['status']??0),[10,20,-10],true))fail('Энэ буцаалтыг цуцлах боломжгүй.',409);
        $data=tw_data(tw_call('/order/refund/cancel',['refundId'=>$r['refund_id']]));
        $state=tw_refund_state(is_array($data['refund_order_aggregate']??null)?$data['refund_order_aggregate']:[]);$state['refund_id']=$r['refund_id'];
        return tw_refund_store($id,$state,['cancelled_at'=>gmdate('c')]);
    });
}
function tw_aftersale_messages(string $id,array $b): array {
    $o=tw_aftersale_order($id);$r=tw_aftersale_refund($o,$b['refund_id']??null);
    $data=tw_data(tw_call('/order/refund/query/message',['refundId'=>$r['refund_id'],'pageNo'=>'1','pageSize'=>'30']));
    $messages=[];
    foreach(array_slice(is_array($data['refund_messages']??null)?$data['refund_messages']:[],0,30) as $m){
        if(!is_array($m))continue;$text='';$who='';$time='';
        foreach($m as $k=>$v){if(!is_scalar($v))continue;$k=strtolower((string)$k);
            if($text===''&&preg_match('/content|message|msg|desc/',$k))$text=tw_text($v,1000);
            elseif($who===''&&preg_match('/owner|role|sender|nick|user/',$k))$who=tw_text($v,60);
            elseif($time===''&&preg_match('/time|date|gmt/',$k))$time=is_numeric($v)?gmdate('c',(int)floor((float)$v/((float)$v>1e11?1000:1))):tw_text($v,40);}
        if($text!=='')$messages[]=['text'=>$text,'who'=>$who,'time'=>$time];
    }
    return ['messages'=>$messages,'total'=>(int)($data['total']??count($messages))];
}
function tw_aftersale_message(string $id,array $b): array {
    $o=tw_aftersale_order($id);$r=tw_aftersale_refund($o,$b['refund_id']??null);
    tw_data(tw_call('/order/refund/submit/message',['refundId'=>$r['refund_id'],'refundMessage'=>str_field($b,'message',500)]));
    return tw_aftersale_messages($id,$b);
}
function tw_aftersale_return_render(string $id,array $b): array {
    $o=tw_aftersale_order($id);$r=tw_aftersale_refund($o,$b['refund_id']??null);
    if((int)($r['status']??0)!==20)fail('Худалдагч буцаалтыг зөвшөөрсний дараа илгээлтээ бүртгэнэ.',409);
    $data=tw_data(tw_call('/order/refund/render/logistics',['refundId'=>$r['refund_id']]));$companies=[];
    foreach(array_slice(is_array($data['logistics_companies']??null)?$data['logistics_companies']:[],0,80) as $c){
        if(!is_array($c))continue;$code=tw_text($c['logistics_company_code']??$c['company_code']??$c['code']??'',40);$name=tw_text($c['logistics_company_name']??$c['company_name']??$c['name']??'',60);
        if($code!==''&&preg_match('/^[A-Za-z0-9_-]{1,40}$/D',$code))$companies[]=['code'=>$code,'name'=>$name?:$code];
    }
    $state=tw_refund_state(is_array($data['refund_order_aggregate']??null)?$data['refund_order_aggregate']:[]);
    return ['companies'=>$companies,'address'=>$state['return_address']??'','seller_note'=>$state['seller_note']??''];
}
function tw_aftersale_return_submit(string $id,array $b): array {
    return tw_order_lock($id,static function()use($id,$b){
        $o=tw_aftersale_order($id);$r=tw_aftersale_refund($o,$b['refund_id']??null);
        if((int)($r['status']??0)!==20)fail('Худалдагч буцаалтыг зөвшөөрсний дараа илгээлтээ бүртгэнэ.',409);
        $company=str_field($b,'company',40);if(!preg_match('/^[A-Za-z0-9_-]{1,40}$/D',$company))fail('Тээврийн компани буруу.');
        $no=strtoupper(str_field($b,'tracking',40));if(!preg_match('/^[A-Z0-9-]{6,40}$/D',$no))fail('Илгээмжийн дугаар буруу.');
        $phone=str_field($b,'phone',20);if(!preg_match('/^\+?[0-9]{7,15}$/D',$phone))fail('Утасны дугаар буруу.');
        $data=tw_data(tw_call('/order/refund/submit/logistics',['refundId'=>$r['refund_id'],'logisticsCompanyCode'=>$company,'logisticsNo'=>$no,'buyerPhone'=>$phone,'returnGoodsDesc'=>str_field($b,'description',200,false)]));
        $state=is_array($data['refund_order_aggregate']??null)?tw_refund_state($data['refund_order_aggregate']):[];$state['refund_id']=$r['refund_id'];
        return tw_refund_store($id,$state,['return_submitted_at'=>gmdate('c'),'return_tracking'=>$no]);
    });
}

// Domestic delivery timeline (Taobao seller → Erenhot) for the admin order view.
function tw_aftersale_logistics(string $id): array {
    tw_aftersale_order($id);
    try{inbound_details_refresh($id,null);}catch(ApiError $e){if($e->getCode()!==409)throw $e;}
    return inbound_details_public(order_row($id)['order'])??['children'=>[]];
}

// Supplier bills for a period (Beijing/Ulaanbaatar dates) reconciled with GOStore orders.
function tw_bills_pages(string $path,array $params,string $listKey='data'): array {
    $rows=[];
    for($page=1;$page<=20;$page++){
        $data=tw_data(tw_call($path,$params+['page_no'=>(string)$page,'page_size'=>'50']));
        $batch=is_array($data[$listKey]??null)?$data[$listKey]:[];$rows=array_merge($rows,array_filter($batch,'is_array'));
        $pages=(int)($data['total_page']??0);if(!$batch||$page>=$pages)break;
        if($page===20)fail('Нэхэмжлэл хэт олон байна. Хугацааг богиносгоно уу.',409);
    }
    return $rows;
}
function tw_aftersale_bills(array $b): array {
    $from=str_field($b,'from',10);$to=str_field($b,'to',10);
    foreach([$from,$to] as $d)if(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$d)||!checkdate((int)substr($d,5,2),(int)substr($d,8,2),(int)substr($d,0,4)))fail('Огноо буруу байна.');
    $start=strtotime($from.' 00:00:00 +08:00');$end=strtotime($to.' 23:59:59 +08:00');
    if($start>$end||$end-$start>62*86400)fail('Хамгийн ихдээ 62 хоногийн нэхэмжлэл тулгана.');
    $purchases=tw_bills_pages('/purchase/bills/query',['time_type'=>'paytime','start_time'=>(string)($start*1000),'end_time'=>(string)($end*1000)]);
    $refunds=tw_bills_pages('/refund/bills/query',['start_time'=>(string)($start*1000),'end_time'=>(string)($end*1000)]);
    $orders=[];foreach(db()->query('SELECT data FROM orders')->fetchAll() as $r){$o=json_decode($r['data'],true);$outer=$o['purchase']['outer_purchase_id']??null;if($outer)$orders[$outer]=$o;}
    $money=fn($v)=>is_numeric($v)?round((float)$v,2):0.0;
    $byOrder=[];$unlinked=[];$paid=0.0;$refunded=0.0;
    foreach($purchases as $p){
        $outer=tw_text($p['outer_purchase_id']??'',80);$amount=$money($p['purchase_pay_amount']??$p['pay_amount_total']??0);$paid+=$amount;
        $line=['outer'=>$outer,'title'=>tw_text($p['purchase_item_title_real']??$p['purchase_item_title_out']??'',120),'paid_cny'=>$amount,'refund_cny'=>$money($p['purchase_refund_amount']??0),'paid_at'=>is_numeric($p['pay_time']??null)?gmdate('c',(int)floor((float)$p['pay_time']/1000)):null,'taobao_order'=>tw_text($p['po_order_id']??'',40)];
        if(isset($orders[$outer])){$id=$orders[$outer]['id'];$byOrder[$id]??=['id'=>$id,'paid_cny'=>0.0,'refund_cny'=>0.0,'lines'=>0];$byOrder[$id]['paid_cny']+=$amount;$byOrder[$id]['lines']++;}
        else $unlinked[]=$line;
    }
    foreach($refunds as $r){
        $outer=tw_text($r['outer_purchase_id']??'',80);$amount=$money(($r['real_refund_amount']??$r['purchase_refund_amount']??0))/100;$refunded+=$amount;
        if(isset($orders[$outer])){$id=$orders[$outer]['id'];$byOrder[$id]??=['id'=>$id,'paid_cny'=>0.0,'refund_cny'=>0.0,'lines'=>0];$byOrder[$id]['refund_cny']+=$amount;}
    }
    $rows=[];$flags=0;
    foreach($byOrder as $id=>$row){
        $o=order_row($id)['order'];$expected=((int)($o['purchase']['supplier_total_fen']??0))/100;$m=function_exists('admin_order_money')?admin_order_money($o):['revenue'=>null];
        $row['expected_cny']=$expected;$row['customer_paid']=$m['revenue'];$row['status']=$o['status'];$row['purchase_state']=$o['purchase']['state']??'';
        $row['flag']=abs($row['paid_cny']-$row['refund_cny']-$expected)>1&&($o['purchase']['state']??'')!=='closed'?'Дүн зөрж байна':'';if($row['flag'])$flags++;
        $row['paid_cny']=round($row['paid_cny'],2);$row['refund_cny']=round($row['refund_cny'],2);$rows[]=$row;
    }
    // Purchases GOStore paid for (supplier_paid/shipped) in the period but missing from the bills.
    $missing=[];foreach($orders as $o){$p=$o['purchase'];$at=strtotime($p['pay_submitted_at']??'')?:0;
        if($at>=$start&&$at<=$end&&!empty($p['paid_child_ids'])&&!isset($byOrder[$o['id']]))$missing[]=['id'=>$o['id'],'expected_cny'=>((int)($p['supplier_total_fen']??0))/100,'state'=>$p['state']??''];}
    $result=['from'=>$from,'to'=>$to,'paid_cny'=>round($paid,2),'refunded_cny'=>round($refunded,2),'orders'=>$rows,'unlinked'=>array_slice($unlinked,0,200),'missing'=>$missing,'flags'=>$flags+count($missing),'checked_at'=>gmdate('c')];
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['taoworld_bills_last',json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    return $result;
}

function tw_aftersale_post(string $action,array $b): never {
    admin_required();limit_attempts('taoworld-aftersale:'.($_SERVER['REMOTE_ADDR']??'cli'),120,900);
    if($action==='taoworld-bills')json_out(tw_aftersale_bills($b));
    $id=str_field($b,'id',50);
    $public=static fn(array $o)=>['order'=>$o];
    json_out(match($action){
        'taoworld-cancel'=>$public(tw_aftersale_cancel($id,str_field($b,'reason',100))),
        'taoworld-refund-render'=>['template'=>tw_aftersale_refund_render($id,$b),'labels'=>['types'=>TW_REFUND_TYPES,'goods'=>TW_GOODS_STATUS]],
        'taoworld-refund-submit'=>$public(tw_aftersale_refund_submit($id,$b)),
        'taoworld-refund-refresh'=>$public(tw_aftersale_refund_refresh($id)),
        'taoworld-refund-cancel'=>$public(tw_aftersale_refund_cancel($id,$b)),
        'taoworld-refund-messages'=>tw_aftersale_messages($id,$b),
        'taoworld-refund-message'=>tw_aftersale_message($id,$b),
        'taoworld-return-render'=>tw_aftersale_return_render($id,$b),
        'taoworld-return-submit'=>$public(tw_aftersale_return_submit($id,$b)),
        'taoworld-logistics'=>tw_aftersale_logistics($id),
        default=>fail('Үйлдэл олдсонгүй.',404),
    });
}
