<?php
declare(strict_types=1);

// Instant Taobao checkout: goods, China domestic delivery and service are paid upfront;
// cargo and Ulaanbaatar delivery are collected later through the final settlement.
function checkout_items(array $b): array {
    $items=$b['items']??null;if(!is_array($items)||!array_is_list($items)||count($items)<1||count($items)>30)fail('Сагсанд 1-30 бараа байна.');
    $rate=shipping_settings()['cny_rate'];$lines=[];$seen=[];
    foreach($items as $item){
        if(!is_array($item))fail('Сагсны барааны мэдээлэл буруу байна.');
        $s=supplier_order(['product_id'=>$item['id']??'','sku'=>$item['sku']??'','qty'=>$item['qty']??null]);
        $key=$s['id'].'|'.$s['sku'];if(isset($seen[$key]))fail('Сагсанд давхардсан бараа байна.');$seen[$key]=true;
        $lines[]=['id'=>$s['id'],'provider'=>$s['provider'],'sku'=>$s['sku'],'name'=>$s['name'],'variant'=>$s['variant'],'qty'=>$s['qty'],'unit_cny'=>$s['unit_cny'],'goods_cny'=>$s['goods_cny'],'price'=>(int)ceil(round($s['unit_cny']*$rate,8)),'url'=>$s['url'],'image'=>$s['image'],'vendor_id'=>$s['vendor_id']];
    }
    return $lines;
}
function checkout_quote(array $lines): array {
    $s=shipping_settings();$goods=round(array_sum(array_column($lines,'goods_cny')),2);
    // Each seller ships separately to Erenhot; unknown sellers are counted per product.
    $vendors=count(array_unique(array_map(fn($l)=>$l['vendor_id']!==''?'v:'.$l['vendor_id']:'p:'.$l['id'],$lines)));
    $domestic=round($vendors*$s['domestic_default_cny'],2);
    $goodsMnt=(int)ceil(round($goods*$s['cny_rate'],8));
    $parts=['goods_mnt'=>$goodsMnt,'domestic_mnt'=>(int)ceil(round($domestic*$s['cny_rate'],8)),'service_mnt'=>(int)ceil(round($goodsMnt*$s['service_percent']/100,8))+(int)$s['service_fee_mnt'],'cargo_mnt'=>0];
    $total=array_sum($parts);if($total<1||$total>100000000)fail('Захиалгын дүн зөвшөөрөх хязгаараас гарсан.');
    return ['inputs'=>['goods_cny'=>$goods,'domestic_cny'=>$domestic,'vendors'=>$vendors],'rates'=>$s,'breakdown'=>$parts,'total'=>$total,'created'=>gmdate('c'),'auto'=>true,'cargo_later'=>true];
}
function checkout_public_quote(array $q): array {
    return ['breakdown'=>$q['breakdown'],'total'=>$q['total'],'vendors'=>$q['inputs']['vendors'],'goods_cny'=>$q['inputs']['goods_cny'],'cny_rate'=>$q['rates']['cny_rate'],'payment_window_hours'=>(int)$q['rates']['payment_window_hours']];
}
function checkout_preview(array $b): array {
    customer_required();limit_attempts('checkout-quote:'.($_SERVER['REMOTE_ADDR']??''),60,3600);
    $lines=checkout_items($b);return ['quote'=>checkout_public_quote(checkout_quote($lines)),'items'=>array_map(fn($l)=>array_intersect_key($l,array_flip(['id','sku','qty','unit_cny','price'])),$lines)];
}
// Fills a new order with priced items; the shared order-create path assigns the ID and saves it.
function checkout_order(array $b,array $o): array {
    $lines=checkout_items($b);$quote=checkout_quote($lines);
    if(int_field($b,'expected_total',1,100000000)!==$quote['total'])fail('Үнэ шинэчлэгдсэн байна. Шинэ дүнг шалгаад дахин баталгаажуулна уу.',409);
    $now=time();$hours=(int)$quote['rates']['payment_window_hours'];
    $o['items']=$lines;$o['quote']=$quote;$o['amount']=$quote['total'];$o['status']='quoted';
    $o['title']=mb_substr($lines[0]['name'],0,100).(count($lines)>1?' +'.(count($lines)-1).' бараа':'');
    $o['qty']=array_sum(array_column($lines,'qty'));$o['route']=['Эрээн','Замын-Үүд','Улаанбаатар'];
    $o['payment_due']=gmdate('c',$now+$hours*3600);$o['history']=[['status'=>'quoted','at'=>gmdate('c',$now)]];
    return $o;
}
function checkout_expired(array $o,?int $now=null): bool {
    return isset($o['payment_due'])&&!$o['paid']&&$o['status']==='quoted'&&strtotime($o['payment_due'])<=($now??time());
}
// An issued invoice is checked with QPay first, so a late payment is recorded instead of cancelled.
function checkout_expire_order(string $id): void {
    $o=order_row($id)['order'];if(!checkout_expired($o))return;
    if(($o['invoice']['state']??'')==='ready'){
        if(!qpay_ready())return;
        try{qpay_callback($id,$o['callback_token']);}catch(Throwable $e){error_log('GOStore checkout expiry deferred');return;}
    }elseif(isset($o['invoice']))return; // An unresolved invoice attempt needs admin review.
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];
        if(checkout_expired($o)){$o['status']='cancelled';$o['cancel_reason']='payment_timeout';$o['history'][]=['status'=>'cancelled','at'=>gmdate('c')];save_order($o);}
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function checkout_expired_or_cancelled(string $id): bool {
    $o=order_row($id)['order'];return ($o['cancel_reason']??'')==='payment_timeout'&&!$o['paid'];
}
function checkout_expire_due(bool $force=false): void {
    $db=db();$s=$db->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['checkout_expiry_run']);
    if(!$force&&(int)$s->fetchColumn()>time()-300)return;
    $db->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['checkout_expiry_run',(string)time()]);
    $s=$db->prepare("SELECT id,data FROM orders WHERE data LIKE '%\"payment_due\"%' AND data LIKE '%\"status\":\"quoted\"%' ORDER BY created LIMIT 200");$s->execute();
    foreach($s->fetchAll() as $row){$o=json_decode($row['data'],true);if(is_array($o)&&checkout_expired($o))checkout_expire_order($row['id']);}
}
