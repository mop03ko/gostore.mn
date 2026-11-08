<?php
declare(strict_types=1);

// Deals index: products whose saved TaoWorld detail showed a real price cut (the cheapest in-stock SKU's
// promotion_price below its price) within the last 24 hours. Search results carry no original price and
// coupon prices are conditional, so neither counts (owner decision 2026-11-08). Built from cached files by
// server/catalog-worker.php every 15 minutes, or on demand when missing or old; it never calls TaoWorld.
// Product pages re-read details older than an hour and checkout re-verifies the price within 120 seconds.
const TW_DEALS_MAX_AGE=86400;
const TW_DEALS_INDEX_MAX=600;
const TW_DEALS_INDEX_FRESH=3600;
const TW_DEALS_PAGE=50;
function tw_deals_index_path(): string {return tw_catalog_dir().'/deals-index.json';}
function tw_deals_detail_path(string $id): string {return tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>$id,'language'=>'en']).'.json';}
// A compact list card (no variants, description or gallery) when the detail shows a real price cut.
// Its discount stays valid for 24 hours after the detail was fetched.
function tw_deals_card(array $data,int $time): ?array {
    try{$p=tw_catalog_product($data,true,$time,TW_DEALS_MAX_AGE);}catch(ApiError){return null;}
    if(!$p['sellable']||!$p['card_discount'])return null;
    $card=array_intersect_key($p,array_flip(['id','provider','catalog_provider','provider_label','name','original_name','image','url','min_qty','step','sellable','sold_count','sales_30_days','cny','mnt','approx_cny','approx_mnt','price_status','card_discount','shop_rating','offers']));
    return $card+['variants'=>[],'price_expires'=>$time+TW_DEALS_MAX_AGE,'verified_at'=>gmdate('c',$time)];
}
// With $ifStale, a build that another request finished while this one waited for the lock is reused.
function tw_deals_index_build(?int $now=null,bool $ifStale=false): array {
    $lock=fopen(tw_deals_index_path().'.lock','c');if(!$lock)throw new RuntimeException('Deals index lock unavailable');
    try{
        flock($lock,LOCK_EX);
        $old=supplier_snapshot_read(tw_deals_index_path());
        if($ifStale&&is_array($old['data']['items']??null)&&($old['time']??0)>=time()-TW_DEALS_INDEX_FRESH)return ['items'=>count($old['data']['items']),'files'=>(int)($old['data']['files']??0)];
        $now??=time();$since=$now-TW_DEALS_MAX_AGE;$found=[];$files=0;
        foreach(glob(tw_catalog_dir().'/*.json')?:[] as $file){
            // Cached responses are named by a SHA-256 key; only product details carry item_id and sku_list.
            if(!preg_match('/^[a-f0-9]{64}\.json$/D',basename($file))||filemtime($file)<$since)continue;
            $c=supplier_snapshot_read($file);$data=$c['data']??null;$time=$c['time']??null;
            if(!is_array($data)||!isset($data['item_id'],$data['sku_list'])||!is_int($time)||$time<$since||$time>$now)continue;$files++;
            $card=tw_deals_card($data,$time);
            if($card&&($found[$card['id']]['f']??0)<$time)$found[$card['id']]=['f'=>$time,'p'=>$card];
        }
        $items=array_values($found);
        // Biggest cut first; the more recently confirmed price breaks ties.
        usort($items,static fn($a,$b)=>[$b['p']['card_discount']['percent'],$b['f']]<=>[$a['p']['card_discount']['percent'],$a['f']]);
        $items=array_slice($items,0,TW_DEALS_INDEX_MAX);
        supplier_snapshot_write(tw_deals_index_path(),['time'=>$now,'data'=>['items'=>$items,'files'=>$files]]);
        return ['items'=>count($items),'files'=>$files];
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
// A page of deals. The index is rebuilt when missing or over an hour old (the worker normally keeps it
// fresh). A product whose detail was saved again since the build is re-checked against that detail, so an
// ended price cut disappears at once; discounts older than 24 hours are dropped.
function tw_deals_from_index(int $page): array {
    $c=supplier_snapshot_read(tw_deals_index_path());
    if(!is_array($c['data']['items']??null)||($c['time']??0)<time()-TW_DEALS_INDEX_FRESH){tw_deals_index_build(null,true);$c=supplier_snapshot_read(tw_deals_index_path());}
    $now=time();$items=[];
    foreach($c['data']['items']??[] as $item){
        $p=$item['p']??null;$f=$item['f']??null;if(!is_array($p)||!is_int($f)||!is_string($p['id']??null))continue;
        $saved=@filemtime(tw_deals_detail_path($p['id']));if($saved===false)continue;
        if($saved>$f+1){
            $d=supplier_snapshot_read(tw_deals_detail_path($p['id']));
            $p=is_int($d['time']??null)&&is_array($d['data']??null)&&'tb-'.($d['data']['item_id']??'')===$p['id']?tw_deals_card($d['data'],$d['time']):null;
            if(!$p)continue;
        }
        if(($p['card_discount']['expires']??0)>$now)$items[]=$p;
    }
    $products=array_slice($items,($page-1)*TW_DEALS_PAGE,TW_DEALS_PAGE);
    return tw_catalog_response(['products'=>$products,'page'=>$page,'total'=>count($items),'more'=>count($items)>$page*TW_DEALS_PAGE,'partial'=>false,'scope'=>'deals_index','verified_within'=>TW_DEALS_MAX_AGE],(int)($c['time']??$now),600);
}
