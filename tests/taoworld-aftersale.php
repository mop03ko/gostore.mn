<?php
declare(strict_types=1);
// TaoWorld after-sales with a fake provider: cancel before shipping (and no payment after it),
// refund requests with server-side limits, uncertain submissions recovered from the list,
// seller messages, return parcels, refund cancellation, delivery timeline and bill reconciliation.
$fixture=__DIR__.'/../tmp/tw-aftersale-'.bin2hex(random_bytes(6));mkdir($fixture.'/server',0700,true);
foreach(glob(__DIR__.'/../server/*') as $file)if(is_file($file)&&!str_contains(basename($file),'.local.')&&preg_match('/\.(php|json)$/',$file))copy($file,$fixture.'/server/'.basename($file));
file_put_contents($fixture.'/server/config.local.php','<?php return '.var_export(['data_dir'=>$fixture.'/data'],true).';');
file_put_contents($fixture.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-long-enough','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
putenv('GOSTORE_DATA_DIR='.$fixture.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
foreach(['bootstrap','shipping','warehouse','logistics','taobao-purchase','taoworld-auth','taoworld-purchase','admin-reports','taoworld-aftersale'] as $file)require_once $fixture.'/server/'.$file.'.php';
$_SERVER['REMOTE_ADDR']='127.0.0.1';
$calls=[];$childStatus='WAIT_BUYER_P';$submitFails=false;$refundStatus=10;
function aggregate(string $refundId,int $status,string $child): array {
    return ['refund_order'=>['refund_id'=>$refundId,'refund_status'=>$status,'refund_fee'=>500,'refund_type'=>1,'goods_status'=>2,'reason_desc'=>'Буруу бараа','seller_refuse_reason'=>$status===-10?'No':'','timeout_date'=>1767225600000],
        'purchase_order_line'=>['purchase_order_line_id'=>$child],'logistics'=>['receiver_address'=>['receiver'=>'Seller','phone'=>'13800000000','detail_address'=>'Hangzhou <b>1</b>'],'seller_agree_return_describe'=>'Send back please','logistics_no'=>'','logistics_company'=>['logistics_company_name'=>'']]];
}
function taoworld_http(string $path,array $params): array {
    global $calls,$childStatus,$submitFails,$refundStatus;$calls[]=[$path,$params];
    $ok=fn(array $data)=>['code'=>'0','result'=>['success'=>true,'data'=>$data]];
    switch($path){
        case '/purchase/orders/query':
            return ['code'=>'0','success'=>true,'data'=>['results_total'=>1,'purchase_orders'=>[['outer_purchase_id'=>'GSOUTER1','purchase_id'=>'2000000000001','purchase_currency'=>'CNY','purchase_amount'=>1221,'status'=>$childStatus,
                'sub_purchase_orders'=>[['sub_purchase_order_id'=>'3000000000001','item_id'=>'2048019433468296','sku_id'=>'387743580552','quantity'=>2,'status'=>$childStatus]]]]]];
        case '/purchase/order/asyn/cancel':return ['code'=>'0','success'=>true];
        case '/order/refund/render':return $ok(['refund_order_template'=>['max_refund_fee'=>['refund_fee'=>1221,'max_refund_fee'=>1221,'min_refund_fee'=>1,'can_edit_refund_fee'=>true,'fee_tips'=>'Up to 12.21'],
            'refund_type_list'=>[1,2],'goods_status_list'=>[1,2,3,4],'refund_reasons'=>[['reason_id'=>11,'reason_desc'=>'Буруу бараа <script>','tips'=>'Photo'],['reason_id'=>12,'reason_desc'=>'Гэмтэлтэй']]]]);
        case '/order/refund/submit':if($submitFails)throw new ApiError('fixture timeout',502);return $ok(['refund_order_aggregate'=>aggregate('7001',10,(string)$params['purchaseOrderLineId'])]);
        case '/order/refund/query':return $ok(['refund_order_aggregate'=>aggregate((string)$params['refundId'],$refundStatus,'3000000000001')]);
        case '/order/refund/queryList':return $ok(['total'=>1,'refund_order_aggregates'=>[aggregate('7002',20,'3000000000002')]]);
        case '/order/refund/cancel':return $ok(['cancel_success'=>true,'refund_order_aggregate'=>aggregate((string)$params['refundId'],-20,'3000000000001')]);
        case '/order/refund/query/message':return $ok(['total'=>2,'refund_messages'=>[['content'=>'Please send photos','owner_role'=>'seller','gmt_create'=>1767225600000],['content'=>'<i>Sent</i>','owner_role'=>'buyer','gmt_create'=>'2026-01-01 10:00']]]);
        case '/order/refund/submit/message':return $ok(['ok'=>true]);
        case '/order/refund/render/logistics':return $ok(['logistics_companies'=>[['logistics_company_code'=>'SF','logistics_company_name'=>'SF Express'],['logistics_company_code'=>'bad code!','logistics_company_name'=>'X']],'refund_order_aggregate'=>aggregate((string)$params['refundId'],20,'3000000000002')]);
        case '/order/refund/submit/logistics':return $ok(['refund_order_aggregate'=>aggregate((string)$params['refundId'],30,'3000000000002')]);
        case '/logistics/detail/get':return $ok(['pnm_logistics_details'=>[['mail_no'=>'sf1234567890','logistics_status'=>'DELIVERING','logistics_desc'=>'In transit','logistics_traces'=>[['time'=>'2026-11-08 10:00:00','status_desc'=>'Picked up'],['time'=>'2026-11-09 08:00:00','status_desc'=>'Arrived Erenhot']]]]]);
        case '/purchase/bills/query':return $ok(['data'=>[['outer_purchase_id'=>'GSOUTER1','purchase_pay_amount'=>'12.21','purchase_refund_amount'=>'0','pay_time'=>1767225600000,'purchase_item_title_real'=>'Labels'],['outer_purchase_id'=>'WEBSITE1','purchase_pay_amount'=>'50.00','purchase_item_title_real'=>'Bought on the website']],'total_page'=>1]);
        case '/refund/bills/query':return $ok(['data'=>[['outer_purchase_id'=>'GSOUTER1','real_refund_amount'=>'200']],'total_page'=>1]);
    }
    throw new RuntimeException('Unexpected API '.$path);
}
function check(bool $ok,string $msg): void {if(!$ok)throw new RuntimeException($msg);}
function expect(callable $fn,int $status): void {try{$fn();}catch(ApiError $e){check($e->getCode()===$status,'Wrong error '.$e->getCode().': '.$e->getMessage());return;}throw new RuntimeException('Expected rejection '.$status);}
function count_calls(string $path): int {global $calls;return count(array_filter($calls,fn($c)=>$c[0]===$path));}
taoworld_store(taoworld_token_state(['access_token'=>'fake-access','refresh_token'=>'fake-refresh','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'fixture-buyer']));
function seed(string $id,string $status,array $extra=[]): void {
    $o=['id'=>$id,'type'=>'checkout','status'=>'confirmed','paid'=>true,'amount'=>10000,'demo'=>false,'title'=>'Labels','customer'=>'Fixture','phone'=>'99112233','created'=>gmdate('c'),'items'=>[['id'=>'tb-1','qty'=>2,'name'=>'Labels']],
        'purchase'=>array_replace(['provider'=>'taoworld','state'=>'awaiting_payment','outer_purchase_id'=>'GSOUTER1','account_binding'=>tw_account(),'submitted_at'=>gmdate('c'),'tracked_at'=>gmdate('c'),'provider_order_ids'=>['2000000000001'],
            'children'=>[['purchase_id'=>'2000000000001','sub_purchase_order_id'=>'3000000000001','status'=>$status,'quantity'=>2,'parcels'=>[]],['purchase_id'=>'2000000000001','sub_purchase_order_id'=>'3000000000002','status'=>$status,'quantity'=>1,'parcels'=>[]]],
            'supplier_total_fen'=>1221,'paid_child_ids'=>$status==='WAIT_BUYER_P'?[]:['3000000000001'],'budget_fen'=>2000,'auto_pay'=>true,'checks'=>1,'next_at'=>0,'quote'=>['lines'=>[['mp_id'=>'2048019433468296','mp_sku_id'=>'387743580552','quantity'=>2]]],'pay_submitted_at'=>$status==='WAIT_BUYER_P'?null:gmdate('c')],$extra)];
    if($o['purchase']['pay_submitted_at']===null)unset($o['purchase']['pay_submitted_at']);
    db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,hash('sha256',$id),$id,tw_json($o),gmdate('c'),gmdate('c')]);
}

// Cancel before shipping: one asynchronous request per supplier order, automatic payment stops.
seed('GS-CANCEL','WAIT_BUYER_P');
$o=tw_aftersale_cancel('GS-CANCEL','Хэрэглэгч цуцалсан');
check(count_calls('/purchase/order/asyn/cancel')===1&&$calls[array_key_last($calls)][1]['purchase_id']==='2000000000001'&&$calls[array_key_last($calls)][1]['cancel_reason']==='Хэрэглэгч цуцалсан','Cancel request');
check($o['purchase']['auto_pay']===false&&$o['purchase']['cancel']['results'][0]['success']===true&&$o['purchase']['next_at']>time(),'Cancel recorded and auto-pay stopped');
expect(fn()=>tw_aftersale_cancel('GS-CANCEL','Again'),409);
expect(fn()=>tw_order_lock('GS-CANCEL',fn()=>tw_pay_locked('GS-CANCEL')),409);
check(count_calls('/purchase/order/batch/pay')===0,'No payment after a cancel request');
seed('GS-SHIPPED','WAIT_BUYER_CONFIRM_GOODS');expect(fn()=>tw_aftersale_cancel('GS-SHIPPED','Late'),409);
seed('GS-NOTSENT','WAIT_BUYER_P',['submitted_at'=>null,'provider_order_ids'=>[]]);expect(fn()=>tw_aftersale_cancel('GS-NOTSENT','x'),409);

// Refund template and validation.
seed('GS-REFUND','WAIT_SELLER_SEND_GOODS');
$t=tw_aftersale_refund_render('GS-REFUND',['child'=>'3000000000001','refund_type'=>1,'goods_status'=>2]);
check($t['fee']['max']===1221&&$t['reasons'][0]['text']==='Буруу бараа'&&$t['refund_types']===[1,2],'Template is sanitized: '.json_encode($t,JSON_UNESCAPED_UNICODE));
expect(fn()=>tw_aftersale_refund_render('GS-REFUND',['child'=>'999','refund_type'=>1,'goods_status'=>2]),404);
expect(fn()=>tw_aftersale_refund_render('GS-REFUND',['child'=>'','refund_type'=>1,'goods_status'=>2]),400);
expect(fn()=>tw_aftersale_refund_render('GS-REFUND',['child'=>'3000000000001','refund_type'=>3,'goods_status'=>2]),400);
expect(fn()=>tw_aftersale_refund_render('GS-CANCEL',['child'=>'3000000000001','refund_type'=>1,'goods_status'=>1]),409);
$base=['child'=>'3000000000001','refund_type'=>1,'goods_status'=>2,'reason_id'=>11,'description'=>'Wrong colour'];
expect(fn()=>tw_aftersale_refund_submit('GS-REFUND',$base+['refund_fee'=>5000]),409);
expect(fn()=>tw_aftersale_refund_submit('GS-REFUND',['reason_id'=>99]+$base+['refund_fee'=>500]),409);
expect(fn()=>tw_aftersale_refund_submit('GS-REFUND',['goods_status'=>6]+$base+['refund_fee'=>500]),409);
check(count_calls('/order/refund/submit')===0,'Invalid requests never reach TaoWorld');
$o=tw_aftersale_refund_submit('GS-REFUND',$base+['refund_fee'=>500]);$r=$o['purchase']['refunds'][0];
check($r['refund_id']==='7001'&&$r['status']===10&&$r['requested_fee_fen']===500&&$r['reason']==='Буруу бараа'&&$r['return_address']==='Seller · 13800000000 · Hangzhou 1','Refund stored: '.json_encode($r,JSON_UNESCAPED_UNICODE));
$sent=$calls[array_key_last($calls)];check($sent[0]==='/order/refund/submit'&&$sent[1]['refundFee']==='500'&&$sent[1]['reasonId']==='11'&&$sent[1]['purchaseOrderLineId']==='3000000000001','Submit parameters');
expect(fn()=>tw_aftersale_refund_submit('GS-REFUND',$base+['refund_fee'=>500]),409);

// An uncertain submission is kept and found again from TaoWorld's refund list.
$submitFails=true;$o=tw_aftersale_refund_submit('GS-REFUND',['child'=>'3000000000002']+$base+['refund_fee'=>300]);$submitFails=false;
$pending=array_values(array_filter($o['purchase']['refunds'],fn($r)=>$r['child']==='3000000000002'))[0];check(!isset($pending['refund_id'])&&$pending['status']===-1,'Uncertain refund kept without an id');
expect(fn()=>tw_aftersale_refund_submit('GS-REFUND',['child'=>'3000000000002']+$base+['refund_fee'=>300]),409);
$refundStatus=10;$o=tw_aftersale_refund_refresh('GS-REFUND');$refunds=array_column($o['purchase']['refunds'],null,'child');
check($refunds['3000000000002']['refund_id']==='7002'&&$refunds['3000000000002']['status']===20,'Recovered from the list');
check(count($o['purchase']['refunds'])===2,'No duplicate refund records');

// Messages, return parcel and cancellation.
$m=tw_aftersale_messages('GS-REFUND',['refund_id'=>'7001']);check(count($m['messages'])===2&&$m['messages'][0]['who']==='seller'&&$m['messages'][1]['text']==='Sent'&&str_starts_with($m['messages'][0]['time'],'2026-01-01'),'Messages: '.json_encode($m));
tw_aftersale_message('GS-REFUND',['refund_id'=>'7001','message'=>'Photos attached']);check($calls[count($calls)-2][1]['refundMessage']==='Photos attached','Message sent');
expect(fn()=>tw_aftersale_messages('GS-REFUND',['refund_id'=>'123']),404);
expect(fn()=>tw_aftersale_return_render('GS-REFUND',['refund_id'=>'7001']),409);
$rr=tw_aftersale_return_render('GS-REFUND',['refund_id'=>'7002']);check(count($rr['companies'])===1&&$rr['companies'][0]['code']==='SF'&&$rr['seller_note']==='Send back please','Return render');
expect(fn()=>tw_aftersale_return_submit('GS-REFUND',['refund_id'=>'7002','company'=>'SF','tracking'=>'x','phone'=>'13800000000']),400);
$o=tw_aftersale_return_submit('GS-REFUND',['refund_id'=>'7002','company'=>'SF','tracking'=>'sf123456789','phone'=>'+8613800000000']);
$refunds=array_column($o['purchase']['refunds'],null,'refund_id');check($refunds['7002']['return_tracking']==='SF123456789'&&$refunds['7002']['status']===30,'Return parcel recorded');
$o=tw_aftersale_refund_cancel('GS-REFUND',['refund_id'=>'7001']);$refunds=array_column($o['purchase']['refunds'],null,'refund_id');check($refunds['7001']['status']===-20&&isset($refunds['7001']['cancelled_at']),'Refund cancelled');
expect(fn()=>tw_aftersale_refund_cancel('GS-REFUND',['refund_id'=>'7001']),409);

// Delivery timeline for the admin.
$l=tw_aftersale_logistics('GS-REFUND');$parcel=$l['children'][0]['parcels'][0]??null;
check($parcel&&$parcel['mail_no']==='SF1234567890'&&$parcel['traces'][0]['status_desc']==='Arrived Erenhot','Timeline newest first: '.json_encode($l,JSON_UNESCAPED_UNICODE));

// Bills: GOStore order matched by its external id, a website purchase is listed as unlinked,
// a paid order missing from the bills is flagged.
seed('GS-MISSING','WAIT_SELLER_SEND_GOODS',['outer_purchase_id'=>'GSOUTER2']);
expect(fn()=>tw_aftersale_bills(['from'=>'2026-11-01','to'=>'2027-02-01']),400);
$today=gmdate('Y-m-d',time()+8*3600);$b=tw_aftersale_bills(['from'=>gmdate('Y-m-d',time()+8*3600-86400),'to'=>$today]);
$matched=array_column($b['orders'],null,'id');
check($b['paid_cny']===62.21&&$b['refunded_cny']===2.0,'Bill totals: '.json_encode($b));
check(count($b['unlinked'])===1&&$b['unlinked'][0]['outer']==='WEBSITE1','Website purchases are unlinked');
check(in_array('GS-MISSING',array_column($b['missing'],'id'),true),'Paid orders missing from the bills are flagged');
check(count($matched)===1&&array_key_first($matched)!==null,'One GOStore order matched');
$first=reset($matched);check($first['paid_cny']===12.21&&$first['refund_cny']===2.0&&$first['flag']==='Дүн зөрж байна','12.21 paid − 2.00 refunded differs from the expected 12.21');
check(tw_meta('taoworld_bills_last')['paid_cny']===62.21,'Last reconciliation kept for the admin');
echo "taoworld-aftersale ok\n";
