<?php
declare(strict_types=1);

// Durable jobs live in orders.purchase. Never submit a second create after an uncertain response.
function tw_meta(string $key): array {$q=db()->prepare('SELECT value FROM meta WHERE key=?');$q->execute([$key]);return json_decode($q->fetchColumn()?:'{}',true)?:[];}
function tw_settings(): array {return array_replace(['enabled'=>false,'auto_pay'=>false,'channel'=>'PANAMA_DG'],tw_meta('taoworld_procurement'));}
function tw_settings_public(): array {return tw_settings()+['auth'=>taoworld_public(),'worker'=>tw_meta('taoworld_worker')];}
function tw_json(array $a): string {return json_encode($a,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function tw_account(): string {
    $s=taoworld_state();if(empty($s['account_id']))fail('TaoWorld худалдан авагчийн данс тодорхойгүй.',409);
    return hash('sha256',taoworld_binding().'|'.$s['account_id']);
}
function tw_call(string $path,array $params): array {return taoworld_http($path,$params+['access_token'=>taoworld_access_token()]);}
function tw_data(array $response): array {
    $r=$response['result']??$response;
    if(($r['success']??null)!==true||!is_array($r['data']??null)){
        $code=(string)($r['error_code']??'UNKNOWN');$code=preg_match('/^[A-Za-z0-9_-]{1,64}$/D',$code)?$code:'UNKNOWN';
        fail('TaoWorld хүсэлт амжилтгүй ('.$code.').',502);
    }
    return $r['data'];
}
function tw_id(mixed $id): string {if((!is_string($id)&&!is_int($id))||!preg_match('/^[0-9]{1,30}$/D',(string)$id))fail('TaoWorld бараа/захиалгын дугаар буруу.',502);return (string)$id;}
function tw_fen(mixed $n): int {if((!is_int($n)&&!is_string($n))||!preg_match('/^[0-9]{1,9}$/D',(string)$n))fail('TaoWorld үнийн дүн буруу.',502);return (int)$n;}
function tw_money(array $m): int {if(($m['currency']??'')!=='CNY')fail('Зөвхөн CNY тооцоогоор худалдан авна.',409);return tw_fen($m['amount']??null);}
// Store only structured outcome codes; signed requests and provider messages stay private.
function tw_submission_result(array $response): array {
    $r=$response['result']??$response;$code=(string)($r['error_code']??$r['biz_error_code']??'');
    return ['success'=>is_bool($r['success']??null)?$r['success']:null,'code'=>preg_match('/^[A-Za-z0-9_-]{1,64}$/D',$code)?$code:null];
}
function tw_eligible(array $o): void {
    product_policy_order_assert($o);
    if(($o['type']??'')!=='checkout'||empty($o['paid'])||!in_array($o['status'],['confirmed','shipping'],true)||!empty($o['demo']))fail('Төлбөр төлөгдсөн, идэвхтэй сагсны захиалга шаардлагатай.',409);
    if(warehouse_order_location($o,'erenhot')!=='erenhot')fail('Энэ агуулахын TaoWorld хаягийг тусад нь тохируулна уу.',409);
    if(empty($o['items'])||count($o['items'])>30)fail('Захиалгын бараа дутуу.',409);
}
function tw_fingerprint(array $o): string {return hash('sha256',tw_json(['items'=>$o['items'],'warehouse'=>$o['warehouse']??[],'locations'=>$o['warehouse_locations']??[]]));}
function tw_receiver(array $o): array {
    $w=$o['warehouse']??[];
    if(empty($w['address'])||mb_strlen($w['address'])>200||!preg_match('/^\+?[0-9]{7,15}$/D',$w['phone']??''))fail('Эрээн агуулахын хаяг эсвэл утас буруу.',409);
    return ['name'=>$o['id'].' GOStore','country'=>'中国','state'=>'内蒙古自治区','city'=>'锡林郭勒盟','district'=>'二连浩特市','zip'=>'011100','address'=>$w['address'],'mobile_phone'=>$w['phone']];
}
function tw_order_lock(string $id,callable $fn): mixed {
    $h=fopen(taoworld_dir().'/purchase-'.hash('sha256',$id).'.lock','c');if(!$h)fail('Худалдан авалтын түгжээ нээгдсэнгүй.',503);
    try{if(!flock($h,LOCK_EX|LOCK_NB))fail('Энэ захиалгыг боловсруулж байна.',409);return $fn();}finally{flock($h,LOCK_UN);fclose($h);}
}
function tw_update(string $id,callable $fn): array {
    $db=db();$db->exec('BEGIN IMMEDIATE');try{$o=order_row($id)['order'];$fn($o);save_order($o);$db->exec('COMMIT');return $o;}catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function tw_queue(string $id,bool $auto=false): array {
    return tw_order_lock($id,static function()use($id,$auto){
        $account=tw_account();$s=tw_settings();
        return tw_update($id,static function(&$o)use($account,$s,$auto){
            tw_eligible($o);if(isset($o['purchase'])){if(($o['purchase']['provider']??'')==='taoworld')return;fail('Энэ захиалгад өөр нийлүүлэгчийн оролдлого бүртгэгдсэн.',409);}
            $budget=(int)round(((float)($o['quote']['inputs']['goods_cny']??0)+(float)($o['quote']['inputs']['domestic_cny']??0))*100);
            if($budget<1)fail('Худалдан авалтын төсөв тодорхойгүй.',409);
            $o['purchase']=['provider'=>'taoworld','state'=>'queued','outer_purchase_id'=>'GS'.bin2hex(random_bytes(16)),
                'account_binding'=>$account,'channel'=>$s['channel'],'fingerprint'=>tw_fingerprint($o),'receiver'=>tw_receiver($o),
                'budget_fen'=>$budget,'original_budget_fen'=>$budget,'auto'=>$auto,'auto_pay'=>$auto&&$s['auto_pay'],
                'queued_at'=>gmdate('c'),'next_at'=>time(),'checks'=>0,'provider_order_ids'=>[]];
        });
    });
}
function tw_after_payment(string $id): void {
    try{if(tw_settings()['enabled'])tw_queue($id,true);}catch(Throwable $e){error_log('GOStore TaoWorld queue deferred: '.get_class($e));}
}
function tw_map(array $o,?callable $call=null): array {
    $call??='tw_call';
    $lines=[];
    foreach($o['items'] as $i=>$line){
        if(!preg_match('/^tb-([0-9]{5,20})$/D',$line['id']??'',$match))fail('TaoWorld автомат худалдан авалтад Taobao бараа шаардлагатай.',409);
        // Native catalog stores the provider-issued mi_id; never construct an item URL.
        if(($line['catalog_provider']??'')==='taoworld'||(shipping_settings()['catalog_provider']??'otcommerce')==='taoworld'){
            require_once __DIR__.'/supplier.php';require_once __DIR__.'/taoworld-catalog.php';$resource=tw_catalog_resource($line['id']);
        }else $resource=['item_url'=>$line['url']??''];
        if(empty($resource['mi_id'])&&empty($resource['item_url']))fail('TaoWorld барааны холбоос дутуу.',409);
        $p=tw_data($call('/product/get',$resource));
        if(isset($p['item_id'])&&(string)$p['item_id']!==$match[1])fail('TaoWorld эх барааны дугаар зөрлөө.',409);
        product_policy_assert(['id'=>$line['id'],'name'=>$p['title']??'','description'=>$p['description']??'','category_path'=>$p['category_path']??'','variants'=>$p['sku_list']??[]],409);
        if(($p['status']??'')!=='active')fail('TaoWorld бараа худалдаанд байхгүй.',409);
        $skus=$p['sku_list']??[];$matches=array_values(array_filter($skus,fn($sku)=>(string)($sku['sku_id']??'')===(string)$line['sku']));
        // A source without a SKU is accepted only when the provider also identifies one default SKU.
        if($line['sku']==='standard'&&count($skus)===1&&in_array((string)($skus[0]['sku_id']??''),['','0'],true))$matches=$skus;
        if(count($matches)!==1)fail('Сонгосон SKU TaoWorld дээр яг таарсангүй. Өөр хувилбараар орлуулахгүй.',409);
        $sku=$matches[0];$qty=filter_var($line['qty'],FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>100000]]);
        if(!$qty||($sku['status']??'')!=='active'||!is_numeric($sku['quantity']??null)||(int)$sku['quantity']<$qty)fail('TaoWorld хувилбарын үлдэгдэл хүрэлцэхгүй.',409);
        $lines[]=['source_id'=>$line['id'],'source_sku'=>(string)$line['sku'],'mp_id'=>tw_id($p['mp_id']??null),'mp_sku_id'=>tw_id($sku['mp_skuId']??null),'quantity'=>$qty,'title'=>mb_substr($p['title']??$line['name'],0,100),'order_line_no'=>(string)($i+1)];
    }
    return $lines;
}
function tw_render(array $o,array $p,?callable $call=null): array {
    $call??='tw_call';$lines=tw_map($o,$call);$items=array_map(fn($l)=>['itemId'=>$l['mp_id'],'skuId'=>$l['mp_sku_id'],'quantity'=>$l['quantity']],$lines);
    $r=tw_data($call('/purchase/order/render',['need_supplychain_service'=>'false','recommend_similar'=>'false','render_item_List'=>tw_json($items),'warehouse_address'=>tw_json($p['receiver']),'receiver_address'=>tw_json($p['receiver'])]));
    if(!empty($r['unavailable_sku_list']))fail('TaoWorld дээр захиалах боломжгүй бараа байна.',409);
    $total=tw_money($r['total_real_pay_price']??[]);if($total<1)fail('TaoWorld нийт үнэ тодорхойгүй.',409);
    $actual=[];$shipping=0;
    foreach($r['render_item_list']??[] as $seller){$shipping+=tw_money($seller['mainland_shipping_fee']??[]);
        foreach($seller['item_price_infos']??[] as $item){$key=tw_id($item['mp_id']??$item['item_id']??null).'|'.tw_id($item['sku_id']??null);if(isset($actual[$key]))fail('TaoWorld тооцоонд давхардсан бараа байна.',502);$actual[$key]=$item;}
    }
    if(count($actual)!==count($lines))fail('TaoWorld тооцооны барааны тоо зөрлөө.',409);
    foreach($lines as &$line){$v=$actual[$line['mp_id'].'|'.$line['mp_sku_id']]??null;if(!$v||(int)($v['quantity']??0)!==$line['quantity'])fail('TaoWorld тооцооны хувилбар/тоо зөрлөө.',409);$line['price_fen']=tw_money($v['origin_price']??[]);}unset($line);
    return ['total_fen'=>$total,'shipping_fen'=>$shipping,'seller_count'=>count($r['render_item_list']??[]),'currency'=>'CNY','lines'=>$lines,'rendered_at'=>time(),'expires_at'=>time()+120];
}
function tw_assert_pinned(array $o): void {
    $p=$o['purchase']??[];if(($p['provider']??'')!=='taoworld'||!hash_equals($p['account_binding'],tw_account()))fail('TaoWorld худалдан авагчийн данс өөрчлөгдсөн. Шалгана уу.',409);
}
function tw_preview(string $id): array {
    return tw_order_lock($id,static function()use($id){
        $o=order_row($id)['order'];tw_eligible($o);$p=$o['purchase']??null;
        if($p&&($p['provider']??'')!=='taoworld')fail('Өөр нийлүүлэгчийн захиалга байна.',409);
        if($p)tw_assert_pinned($o);else $p=['receiver'=>tw_receiver($o)];
        return tw_render($o,$p);
    });
}
function tw_create_locked(string $id): array {
    $o=order_row($id)['order'];tw_assert_pinned($o);tw_eligible($o);$p=$o['purchase'];
    if(!in_array($p['state'],['queued','preflight_review'],true)||isset($p['submitted_at']))fail('Өмнөх оролдлогыг эхлээд тулган шалгана уу.',409);
    if(!hash_equals($p['fingerprint'],tw_fingerprint($o)))fail('Бараа эсвэл агуулахын хаяг өөрчлөгдсөн.',409);
    $quote=tw_render($o,$p);
    $o=tw_update($id,static function(&$fresh)use($quote){tw_eligible($fresh);$p=&$fresh['purchase'];if(!hash_equals($p['fingerprint'],tw_fingerprint($fresh)))fail('Захиалгын мэдээлэл өөрчлөгдсөн.',409);$p['quote']=$quote;
        $p['state']='queued';
        if($quote['total_fen']>$p['budget_fen']){$p['state']='preflight_review';$p['error']='TaoWorld нийт үнэ зөвшөөрсөн төсвөөс их байна. Төсвөө шалгана уу.';$p['next_at']=0;}
    });
    $p=$o['purchase'];if($p['state']==='preflight_review')return $o;
    $lines=array_map(fn($l)=>['itemId'=>$l['mp_id'],'skuId'=>$l['mp_sku_id'],'orderLineNo'=>$l['order_line_no'],'quantity'=>$l['quantity'],'price'=>$l['price_fen'],'currency'=>'CNY','title'=>$l['title']],$quote['lines']);
    $params=['outer_purchase_id'=>$p['outer_purchase_id'],'seller_order_number'=>preg_replace('/[^A-Za-z0-9]/','',$id),'order_source'=>'GOStore','purchase_amount'=>(string)$quote['total_fen'],'order_line_list'=>tw_json($lines),
        'receiver'=>tw_json($p['receiver']),'warehouse_address_info'=>tw_json($p['receiver']),'channel_order_type'=>$p['channel'],'support_partial_success'=>'false','need_sys_retry'=>'false','order_remark'=>$id];
    // Resolve/refresh credentials before recording the irreversible submission boundary.
    $token=taoworld_access_token();
    tw_update($id,static function(&$fresh)use($quote){tw_eligible($fresh);tw_assert_pinned($fresh);if(!hash_equals($fresh['purchase']['fingerprint'],tw_fingerprint($fresh))||$quote['expires_at']<=time())fail('Тооцоо хуучирсан. Дахин шалгана уу.',409);
        $fresh['purchase']['state']='submitting';$fresh['purchase']['submitted_at']=gmdate('c');$fresh['purchase']['next_at']=time()+30;unset($fresh['purchase']['error']);
    });
    try{taoworld_http('/purchase/order/create',$params+['access_token'=>$token]);$error=null;}catch(Throwable $e){$error='Үүсгэх хүсэлтийн хариу тодорхойгүй. Ижил гадаад дугаараар тулган шалгаж байна.';}
    return tw_update($id,static function(&$fresh)use($error){$fresh['purchase']['state']='reconciling';if($error)$fresh['purchase']['error']=$error;});
}
function tw_query_locked(string $id): array {
    $o=order_row($id)['order'];tw_assert_pinned($o);$p=$o['purchase'];if(empty($p['submitted_at']))fail('TaoWorld-д хүсэлт илгээгээгүй.',409);
    $parents=[];$total=null;
    for($page=1;$page<=20;$page++){
        $response=tw_call('/purchase/orders/query',['outer_purchase_id'=>$p['outer_purchase_id'],'page_no'=>(string)$page,'page_size'=>'50']);
        // Verified provider response for an unknown external id. This is never proof of failed creation.
        if(($response['success']??null)===false&&($response['error_code']??'')==='B-50-10-001'){$parents=[];break;}
        $r=tw_data($response);$batch=$r['purchase_orders']??null;if(!is_array($batch))fail('TaoWorld захиалгын жагсаалт дутуу.',502);
        $total=tw_fen($r['results_total']??null);$parents=array_merge($parents,$batch);
        if(count($parents)>=$total)break;if(!$batch||$page===20)fail('TaoWorld захиалгын жагсаалт бүрэн ирсэнгүй.',502);
    }
    if(!$parents)return tw_update($id,static function(&$o){$p=&$o['purchase'];$p['state']='review';$p['error']='TaoWorld захиалга одоогоор олдсонгүй. Дахин үүсгэхгүй, ижил дугаараар шалгана.';$p['next_at']=time()+300;$p['checks']++;});
    $children=[];$ids=[];$numbers=[];$quantities=[];$states=[];$sum=0;$paidChildren=$p['paid_child_ids']??[];
    foreach($parents as $parent){
        if(($parent['outer_purchase_id']??'')!==$p['outer_purchase_id'])fail('TaoWorld захиалгын гадаад дугаар зөрлөө.',502);
        $pid=tw_id($parent['purchase_id']??null);if(in_array($pid,$ids,true))fail('TaoWorld захиалгын дугаар давхардлаа.',502);$ids[]=$pid;
        if(($parent['purchase_currency']??'')!=='CNY')fail('TaoWorld захиалгын валют зөрлөө.',409);$sum+=tw_fen($parent['purchase_amount']??null);
        foreach($parent['sub_purchase_orders']??[] as $sub){
            $cid=tw_id($sub['sub_purchase_order_id']??null);if(isset($children[$cid]))fail('TaoWorld дэд захиалга давхардлаа.',502);
            $key=tw_id($sub['item_id']??null).'|'.tw_id($sub['sku_id']??null);$qty=tw_fen($sub['quantity']??null);$quantities[$key]=($quantities[$key]??0)+$qty;
            $status=(string)($sub['status']??'UNKNOWN');$states[]=$status;
            if(in_array($status,['WAIT_SELLER_SEND_GOODS','WAIT_BUYER_CONFIRM_GOODS'],true)&&!in_array($cid,$paidChildren,true))$paidChildren[]=$cid;
            $child=['purchase_id'=>$pid,'sub_purchase_order_id'=>$cid,'status'=>$status,'mp_id'=>(string)$sub['item_id'],'mp_sku_id'=>(string)$sub['sku_id'],'quantity'=>$qty,'taobao_order_id'=>isset($sub['purchase_order_outer_id'])?tw_id($sub['purchase_order_outer_id']):null,'parcels'=>[]];
            foreach($sub['logistic_orders']??[] as $parcel){$no=strtoupper((string)($parcel['logistic_number']??''));if(!preg_match('/^[A-Z0-9-]{6,40}$/D',$no))continue;$n=['no'=>$no,'company'=>mb_substr(strip_tags((string)($parcel['logistic_company_name']??'')),0,60)];$numbers[]=$n;$child['parcels'][]=$n;}
            $children[$cid]=$child;
        }
    }
    $expected=[];foreach($p['quote']['lines'] as $l)$expected[$l['mp_id'].'|'.$l['mp_sku_id']]=$l['quantity'];ksort($expected);ksort($quantities);
    $complete=$expected===$quantities&&count($states)>0;$all=static fn(array $allowed)=>count(array_diff($states,$allowed))===0;
    $state='review';
    if($complete){
        if($all(['TRADE_CLOSED']))$state='closed';
        elseif($all(['WAIT_BUYER_CONFIRM_GOODS']))$state='shipped';
        elseif($all(['WAIT_SELLER_SEND_GOODS','WAIT_BUYER_CONFIRM_GOODS']))$state='supplier_paid';
        elseif(!$paidChildren&&$all(['WAIT_BUYER_P'])&&$sum>0&&$sum<=$p['budget_fen'])$state='awaiting_payment';
        elseif(in_array('BULIDING',$states,true)&&$all(['BULIDING','WAIT_BUYER_P']))$state='reconciling';
    }
    return tw_update($id,static function(&$o)use($state,$ids,$children,$numbers,$complete,$sum,$paidChildren){$p=&$o['purchase'];$p['state']=$state;$p['provider_order_ids']=$ids;$p['children']=array_values($children);$p['paid_child_ids']=$paidChildren;$p['supplier_total_fen']=$sum;$p['tracked_at']=gmdate('c');$p['checks']++;$p['next_at']=$state==='closed'?0:time()+(in_array($state,['shipped','supplier_paid'],true)?1800:120);
        if($state==='review')$p['error']=$complete?'TaoWorld төлөв/үнийн зөрүү байна. Админ шалгана уу.':'TaoWorld хэсэгчилсэн захиалга байна. Дутуу барааг автоматаар дахин захиалахгүй.';else unset($p['error']);
        inbound_merge($o,$numbers,'taoworld');$o['inbound']['checked_at']=gmdate('c');$o['inbound']['status']='TaoWorld: '.$state;
    });
}
function tw_pay_locked(string $id): array {
    $o=tw_query_locked($id);tw_eligible($o);$p=$o['purchase'];
    if($p['state']!=='awaiting_payment'||isset($p['pay_submitted_at']))fail('Төлбөрийн өмнөх оролдлогыг эхлээд шалгана уу.',409);
    if(count($p['provider_order_ids'])>10)fail('10-аас олон нийлүүлэгчийн захиалгыг TaoWorld сайтад төлнө үү.',409);
    $token=taoworld_access_token();
    tw_update($id,static function(&$fresh){tw_eligible($fresh);tw_assert_pinned($fresh);$fresh['purchase']['state']='paying';$fresh['purchase']['pay_submitted_at']=gmdate('c');$fresh['purchase']['next_at']=time()+30;});
    $result=['success'=>null,'code'=>'TRANSPORT_UNCERTAIN'];
    try{$response=taoworld_http('/purchase/order/batch/pay',['purchaseOrderIdList'=>tw_json($p['provider_order_ids']),'access_token'=>$token]);$result=tw_submission_result($response);tw_data($response);}catch(Throwable $e){/* Query, never blindly repeat a payment. */}
    return tw_update($id,static function(&$fresh)use($result){$fresh['purchase']['payment_result']=$result;});
}
function tw_run_order(string $id,bool $pay=false): array {
    return tw_order_lock($id,static function()use($id,$pay){
        try{$o=order_row($id)['order'];tw_assert_pinned($o);
            if($pay)return tw_pay_locked($id);
            if(empty($o['purchase']['submitted_at']))return tw_create_locked($id);
            return tw_query_locked($id);
        }catch(Throwable $e){return tw_update($id,static function(&$o)use($e){if(($o['purchase']['provider']??'')!=='taoworld')throw $e;$p=&$o['purchase'];$p['state']=empty($p['submitted_at'])?'preflight_review':'review';$p['error']=$e instanceof ApiError?$e->getMessage():'TaoWorld боловсруулалт тасалдсан. Дахин төлөв шалгана уу.';$p['next_at']=empty($p['submitted_at'])?0:time()+300;});}
    });
}
function tw_worker(int $limit=3): array {
    $done=[];$settings=tw_settings();
    $rows=array_map(fn($r)=>json_decode($r['data'],true),db()->query('SELECT data FROM orders ORDER BY created')->fetchAll());
    usort($rows,fn($a,$b)=>($a['purchase']['next_at']??0)<=>($b['purchase']['next_at']??0));
    // Recover a missed callback-to-queue write only for payments after explicit activation.
    foreach($rows as $o){$p=$o['purchase']??null;
        if(!$p&&$settings['enabled']&&($o['paid']??false)&&(strtotime($o['paid_at']??'')?:0)>(int)($settings['enabled_at']??PHP_INT_MAX)){try{tw_queue($o['id'],true);$p=order_row($o['id'])['order']['purchase'];}catch(Throwable $e){continue;}}
        if(($p['provider']??'')!=='taoworld'||empty($p['next_at'])||$p['next_at']>time())continue;
        if(empty($p['submitted_at'])&&!empty($p['auto'])&&!$settings['enabled'])continue;
        try{$updated=tw_run_order($o['id']);$p=$updated['purchase'];if($settings['enabled']&&$settings['auto_pay']&&!empty($p['auto_pay'])&&$p['state']==='awaiting_payment'&&empty($p['pay_submitted_at']))tw_run_order($o['id'],true);$done[]=$o['id'];}catch(Throwable $e){/* Busy jobs remain durable. */}
        if(count($done)>=$limit)break;
    }
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['taoworld_worker',tw_json(['last_run'=>gmdate('c'),'processed'=>count($done)])]);return $done;
}
function tw_admin_post(string $action,array $b): never {
    admin_required();limit_attempts('taoworld-procurement:'.($_SERVER['REMOTE_ADDR']??'cli'),60,900);
    if($action==='taoworld-settings'){
        if(!is_bool($b['enabled']??null)||!is_bool($b['auto_pay']??null)||!in_array($b['channel']??'',['PANAMA_DG','PANAMA'],true))fail('TaoWorld тохиргоо буруу.');
        $s=tw_settings();if($b['enabled']){taoworld_access_token();tw_account();if((strtotime(tw_meta('taoworld_worker')['last_run']??'')?:0)<time()-300)fail('Эхлээд TaoWorld арын ажилтны 2 минутын cron хуваарийг тохируулна уу.',409);if(taobao_buyer_state()['auto_purchase']??false)fail('Эхлээд OT автомат худалдан авалтыг унтраана уу.',409);}
        $next=['enabled'=>$b['enabled'],'auto_pay'=>$b['auto_pay'],'channel'=>$b['channel'],'enabled_at'=>$b['enabled']?($s['enabled']?($s['enabled_at']??time()):time()):0];
        db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['taoworld_procurement',tw_json($next)]);json_out(['taoworld'=>tw_settings_public()]);
    }
    $id=str_field($b,'id',50);
    if($action==='taoworld-preview')json_out(['quote'=>tw_preview($id)]);
    if($action==='taoworld-queue')json_out(['order'=>tw_queue($id)]);
    if($action==='taoworld-budget'){
        $budget=int_field($b,'budget_fen',1,100000000);
        $o=tw_order_lock($id,static fn()=>tw_update($id,static function(&$o)use($budget){tw_assert_pinned($o);tw_eligible($o);if(isset($o['purchase']['submitted_at']))fail('Илгээсэн захиалгын төсвийг өөрчлөхгүй.',409);$o['purchase']['budget_fen']=$budget;$o['purchase']['state']='queued';$o['purchase']['next_at']=time();$o['purchase']['budget_approved_at']=gmdate('c');}));json_out(['order'=>$o]);
    }
    if(in_array($action,['taoworld-run','taoworld-pay'],true))json_out(['order'=>tw_run_order($id,$action==='taoworld-pay')]);
    fail('Үйлдэл олдсонгүй.',404);
}
