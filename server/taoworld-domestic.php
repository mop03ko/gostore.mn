<?php
declare(strict_types=1);
require_once __DIR__.'/taoworld-catalog.php';
require_once __DIR__.'/taoworld-purchase.php';

// Shipping is quoted to the same Erenhot destination used by procurement, never a client-supplied address.
function tw_domestic_receiver(?array $warehouse=null): array {
    $s=shipping_settings();$warehouse??=['address'=>$s['warehouse_address'],'phone'=>$s['warehouse_phone']];
    return tw_receiver(['id'=>'QUOTE','warehouse'=>$warehouse]);
}
function tw_domestic_key(array $lines,array $receiver): string {
    $items=array_map(fn($l)=>array_intersect_key($l,array_flip(['id','sku','qty','unit_cny','goods_cny'])),$lines);
    return hash('sha256',tw_json(['account'=>tw_account(),'receiver'=>$receiver,'items'=>$items]));
}
function tw_domestic_cached(?array $cached,string $key,string $account,array $receiver): ?array {
    if(!tw_catalog_fresh($cached,120))return null;$q=$cached['data'];
    if(($q['source']??'')!=='taoworld_render'||($q['key']??'')!==$key||($q['account']??'')!==$account||($q['receiver']??null)!==$receiver
        ||!is_int($q['expires_at']??null)||$q['expires_at']<=time()||$q['expires_at']>$cached['time']+120
        ||!is_int($q['shipping_fen']??null)||$q['shipping_fen']<0||!is_int($q['supplier_total_fen']??null)||$q['supplier_total_fen']<$q['shipping_fen']
        ||!is_int($q['seller_count']??null)||$q['seller_count']<1)return null;
    return $q;
}
// This API has no SKU, quantity or cart/seller aggregation inputs. Its per-item fee is reference data only.
function tw_domestic_reference(array $lines,array $receiver): array {
    $dir=tw_catalog_dir();$cooldown=$dir.'/logistics-unavailable.json';$h=fopen($cooldown.'.lock','c');
    if(!$h)return ['status'=>'unavailable'];
    try{
        if(!flock($h,LOCK_EX|LOCK_NB))return ['status'=>'busy'];
        $last=supplier_snapshot_read($cooldown);if(tw_catalog_fresh($last,600))return ['status'=>'unavailable'];
        $ids=[];foreach($lines as $line)$ids[$line['id']]=tw_catalog_resource($line['id'])['mi_id'];$fees=[];
        foreach(array_chunk($ids,10,true) as $chunk){
            $data=tw_catalog_call('/traffic/item/batchGetSourceItemLogisticPrice',['item_resource'=>'taobao','mi_id_list'=>tw_json(array_values($chunk)),
                'address_info'=>tw_json(array_intersect_key($receiver,array_flip(['country','state','city','district'])))],true);
            if(!array_is_list($data))fail('Хүргэлтийн лавлах хариу буруу.',502);
            foreach($data as $row){
                if(!is_array($row)||($row['success']??false)!==true||($row['currency']??'')!=='CNY'||($row['item_resource']??'')!=='taobao')fail('Хүргэлтийн лавлах дутуу.',502);
                $id=isset($row['item_id'])?'tb-'.tw_id($row['item_id']):array_search($row['mi_id']??null,$chunk,true);
                if(!$id||!isset($chunk[$id])||isset($fees[$id]))fail('Хүргэлтийн барааны дугаар зөрлөө.',502);
                $fees[$id]=tw_fen($row['post_fee']??null);
            }
        }
        if(count($fees)!==count($ids))fail('Хүргэлтийн лавлах дутуу.',502);
        return ['status'=>'available','item_fees_fen'=>$fees];
    }catch(ApiError){
        // Permission/temporary failures must not disable an authoritative cart render. Bound retries across carts.
        supplier_snapshot_write($cooldown,['time'=>time(),'data'=>['status'=>'unavailable']]);return ['status'=>'unavailable'];
    }finally{flock($h,LOCK_UN);fclose($h);}
}
function tw_domestic_quote(array $lines,?array $warehouse=null): array {
    tw_catalog_require_ready();$account=tw_account();$receiver=tw_domestic_receiver($warehouse);$key=tw_domestic_key($lines,$receiver);
    $file=tw_catalog_dir().'/domestic-'.$key.'.json';$cached=supplier_snapshot_read($file);
    if($quote=tw_domestic_cached($cached,$key,$account,$receiver))return $quote;
    $h=supplier_acquire_lock([$file.'.lock'],microtime(true)+2);if(!$h)throw new SupplierBusy();
    try{
        $cached=supplier_snapshot_read($file);if($quote=tw_domestic_cached($cached,$key,$account,$receiver))return $quote;$started=time();
        $reference=tw_domestic_reference($lines,$receiver);$reads=[];
        $call=static function(string $path,array $params)use(&$reads,$started):array{
            if(!in_array($path,['/product/get','/purchase/order/render'],true))fail('Хүргэлтийн тооцоонд зөвхөн унших үйлдэл зөвшөөрнө.',403);
            if($started+120<=time())fail('Хүргэлтийн тооцоо хуучирсан. Дахин шалгана уу.',409);
            $key=$path.tw_json($params);if(isset($reads[$key]))return $reads[$key];supplier_limits(false,true);return $reads[$key]=tw_call($path,$params);
        };
        $render=tw_render(['items'=>$lines],['receiver'=>$receiver],$call);
        if($render['shipping_fen']>$render['total_fen']||$render['seller_count']<1)fail('Хүргэлтийн тооцоо зөрлөө.',502);
        $goodsFen=(int)round(array_sum(array_column($lines,'goods_cny'))*100);
        if($render['total_fen']-$render['shipping_fen']>$goodsFen)fail('Нийлүүлэгчийн барааны үнэ шинэчлэгдсэн. Сагсаа дахин шалгана уу.',409);
        if($started+120<=time())fail('Хүргэлтийн тооцоо хуучирсан. Дахин шалгана уу.',409);
        if(!hash_equals($account,tw_account()))fail('TaoWorld данс өөрчлөгдсөн. Дахин шалгана уу.',409);
        $quote=['source'=>'taoworld_render','shipping_fen'=>$render['shipping_fen'],'supplier_total_fen'=>$render['total_fen'],'seller_count'=>$render['seller_count'],
            'account'=>$account,'receiver'=>$receiver,'key'=>$key,'reference'=>$reference,'expires_at'=>$started+120];
        supplier_snapshot_write($file,['time'=>$started,'data'=>$quote]);return $quote;
    }finally{flock($h,LOCK_UN);fclose($h);}
}
function tw_domestic_assert_warehouse(array $quote,array $warehouse): void {
    $domestic=$quote['domestic']??null;
    if($domestic&&($domestic['receiver']!==tw_domestic_receiver($warehouse)||!hash_equals($domestic['account'],tw_account())||$domestic['expires_at']<=time()))fail('Хүргэлтийн хаяг эсвэл тооцоо өөрчлөгдсөн. Дахин шалгана уу.',409);
}
