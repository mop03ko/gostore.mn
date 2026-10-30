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
function discovery_free_shipping(): array {
    tw_catalog_require_ready();$receiver=tw_domestic_receiver();
    $file=tw_catalog_dir().'/discovery-free-'.hash('sha256',tw_json([$receiver,tw_account()])).'.json';
    $cached=supplier_snapshot_read($file);
    if(tw_catalog_fresh($cached,600))return tw_catalog_response($cached['data'],$cached['time'],600);
    $lock=supplier_acquire_lock([$file.'.lock'],microtime(true)+1);
    if(!$lock)return ['products'=>[],'status'=>'busy','scope'=>'china_to_erenhot','cache_ttl'=>0];
    try{
        $cached=supplier_snapshot_read($file);if(tw_catalog_fresh($cached,600))return tw_catalog_response($cached['data'],$cached['time'],600);
        $started=time();$products=tw_catalog_recommend('tb-100000',20)['products'];
        $reference=$products?tw_domestic_reference(array_map(static fn($p)=>['id'=>$p['id']],$products),$receiver,false):['status'=>'unavailable'];
        $data=['products'=>discovery_free_products($products,$reference),'status'=>$reference['status'],'scope'=>'china_to_erenhot','checked_at'=>gmdate('c',$started),'indicative'=>true];
        supplier_snapshot_write($file,['time'=>$started,'data'=>$data]);return tw_catalog_response($data,$started,600);
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
