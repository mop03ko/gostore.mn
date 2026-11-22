<?php
declare(strict_types=1);

const CATALOG_PRICE_QUEUE_LIMIT=32;
const CATALOG_PRICE_QUEUE_TTL=1800;
const CATALOG_PRICE_WORKER_LIMIT=4;

// Shared, bounded queue of publicly browsed cards. The web request never waits for TaoWorld.
function catalog_card_price_queue(callable $update): array {
    $file=fopen(tw_catalog_dir().'/card-price-queue.json','c+');
    if(!$file)return [];
    try{
        if(!flock($file,LOCK_EX|LOCK_NB))return [];
        $now=time();
        $stored=json_decode(stream_get_contents($file),true);
        $queue=is_array($stored)?array_filter($stored,static fn($due)=>is_int($due)&&$due>$now):[];
        [$next,$picked]=$update($queue);
        rewind($file);
        ftruncate($file,0);
        fwrite($file,json_encode($next,JSON_THROW_ON_ERROR));
        fflush($file);
        return $picked;
    }finally{fclose($file);}
}
function catalog_queue_card_prices(array $products): void {
    if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')return;
    $jobs=[];
    foreach($products as $p){
        if(($p['price_status']??'')==='unverified'&&preg_match('/^tb-\d{5,20}$/D',$p['id']??''))$jobs[$p['id']]=time()+CATALOG_PRICE_QUEUE_TTL;
    }
    if($jobs)catalog_card_price_queue(static fn($queue)=>[array_slice($queue+$jobs,0,CATALOG_PRICE_QUEUE_LIMIT,true),[]]);
}
function catalog_warm_card_prices(): array {
    $queue=catalog_card_price_queue(static fn($queue)=>[array_slice($queue,CATALOG_PRICE_WORKER_LIMIT,null,true),array_slice($queue,0,CATALOG_PRICE_WORKER_LIMIT,true)]);
    $checked=0;$deferred=0;
    foreach(array_keys($queue) as $id){
        try{
            if(tw_catalog_verified_card(['id'=>$id])['price_expires']??false)continue;
            tw_catalog_detail($id);
            $checked++;
        }catch(ApiError $e){
            $deferred++;
            if($e->getCode()===429)break;
        }
    }
    return ['checked'=>$checked,'deferred'=>$deferred];
}
