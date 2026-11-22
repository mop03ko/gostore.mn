<?php
declare(strict_types=1);
require_once __DIR__.'/taoworld-domestic.php';

// Indicative per-item delivery to the configured Erenhot destination, never international freight.
// No SKU, quantity or cart inference; checkout still renders the exact selected basket.
function discovery_free_products(array $products,array $reference): array {
    if(($reference['status']??'')!=='available')return [];
    return array_values(array_map(static fn($p)=>$p+['domestic_shipping_reference_fen'=>0],array_filter($products,
        static fn($p)=>isset($reference['item_fees_fen'][$p['id']])&&$reference['item_fees_fen'][$p['id']]===0)));
}
const DISCOVERY_FREE_TTL=1200;
const DISCOVERY_FREE_REFRESH=720;
function discovery_free_response(array $record): array {
    require_once __DIR__.'/catalog-card-prices.php';
    $data=$record['data'];
    $products=[];
    foreach($data['products'] as $p){
        try{$p=tw_catalog_verified_card($p);}catch(ApiError){continue;}
        if($p['sellable']??true)$products[]=$p;
    }
    $data['products']=$products;
    catalog_queue_card_prices(array_slice($products,0,6));
    return tw_catalog_response($data,$record['time'],DISCOVERY_FREE_TTL);
}
function discovery_free_shipping(bool $warm=false): array {
    tw_catalog_require_ready();$receiver=tw_domestic_receiver();
    $file=tw_catalog_dir().'/discovery-free-'.hash('sha256',tw_json([$receiver,tw_account()])).'.json';
    $cached=supplier_snapshot_read($file);
    $ttl=$warm?DISCOVERY_FREE_REFRESH:DISCOVERY_FREE_TTL;
    if(tw_catalog_fresh($cached,$ttl))return discovery_free_response($cached);
    $lock=supplier_acquire_lock([$file.'.lock'],microtime(true)+1);
    if(!$lock)return ['products'=>[],'status'=>'busy','scope'=>'china_to_erenhot','cache_ttl'=>0];
    try{
        $cached=supplier_snapshot_read($file);if(tw_catalog_fresh($cached,$ttl))return discovery_free_response($cached);
        // Use the mixed storefront feed; recommendations require a real viewed item.
        $started=time();$products=array_slice(tw_catalog_search(['q'=>'__all__','page'=>1,'limit'=>50],true)['products'],0,20);
        $reference=$products?tw_domestic_reference(array_map(static fn($p)=>['id'=>$p['id']],$products),$receiver,false):['status'=>'unavailable'];
        $data=['products'=>discovery_free_products($products,$reference),'status'=>$reference['status'],'scope'=>'china_to_erenhot','checked_at'=>gmdate('c',$started),'indicative'=>true];
        $record=['time'=>$started,'data'=>$data];supplier_snapshot_write($file,$record);
        return discovery_free_response($record);
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
