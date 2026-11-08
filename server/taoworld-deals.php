<?php
declare(strict_types=1);

// Deals index: every sellable card with a discount, coupon or promotion found in TaoWorld search
// snapshots fetched within the offer display window (homepage departments, category, keyword, brand,
// store and recommendation searches), so the deals page is not limited to the homepage sample.
// Built by server/catalog-worker.php from cached files only; it never calls TaoWorld.
const TW_DEALS_INDEX_MAX=600;
const TW_DEALS_INDEX_FRESH=3600;
const TW_DEALS_PAGE=50;
function tw_deals_index_path(): string {return tw_catalog_dir().'/deals-index.json';}
function tw_deals_has_offer(array $p,?int $now=null): bool {
    return ($p['sellable']??true)&&($p['offers']['expires']??0)>($now??time())
        &&(!empty($p['card_discount'])||!empty($p['offers']['coupon_mnt'])||!empty($p['offers']['promotions']));
}
// Larger price cuts first, then coupons, then promotion-only offers; newer lists break ties.
function tw_deals_score(array $p): int {
    $percent=(int)($p['card_discount']['percent']??$p['offers']['coupon_percent']??0);
    return $percent*10+(!empty($p['offers']['coupon_mnt'])?5:0)+(!empty($p['offers']['promotions'])?1:0);
}
function tw_deals_index_build(?int $now=null): array {
    $now??=time();$since=$now-TW_CATALOG_OFFER_DISPLAY;$found=[];$files=0;
    foreach(glob(tw_catalog_dir().'/*.json')?:[] as $file){
        if($file===tw_deals_index_path()||filemtime($file)<$since)continue;
        $c=supplier_snapshot_read($file);$rows=$c['data']['data']??null;$time=(int)($c['time']??0);
        if(!is_array($rows)||!array_is_list($rows)||$time<$since)continue;$files++;
        foreach($rows as $row){
            if(!is_array($row)||!isset($row['item_id']))continue;
            try{$card=tw_catalog_product($row,false,$time);}catch(Throwable){continue;}
            if(!tw_deals_has_offer($card,$now)||(isset($found[$card['id']])&&$found[$card['id']]['f']>=$time))continue;
            $found[$card['id']]=['f'=>$time,'p'=>$card];
        }
    }
    $items=array_values($found);
    usort($items,static fn($a,$b)=>[tw_deals_score($b['p']),$b['f']]<=>[tw_deals_score($a['p']),$a['f']]);
    $items=array_slice($items,0,TW_DEALS_INDEX_MAX);
    supplier_snapshot_write(tw_deals_index_path(),['time'=>$now,'data'=>['items'=>$items,'files'=>$files]]);
    return ['items'=>count($items),'files'=>$files];
}
// A page of the index, or null when the index is missing or older than an hour (the caller then
// falls back to the homepage sample). Offers that expired since the build are dropped.
function tw_deals_from_index(int $page): ?array {
    $c=supplier_snapshot_read(tw_deals_index_path());$time=(int)($c['time']??0);
    if(!is_array($c['data']['items']??null)||$time<time()-TW_DEALS_INDEX_FRESH)return null;
    $items=array_values(array_filter(array_column($c['data']['items'],'p'),static fn($p)=>is_array($p)&&tw_deals_has_offer($p)));
    if(!$items)return null;
    $products=array_slice($items,($page-1)*TW_DEALS_PAGE,TW_DEALS_PAGE);
    return tw_catalog_response(['products'=>$products,'page'=>$page,'total'=>count($items),'more'=>count($items)>$page*TW_DEALS_PAGE,'partial'=>false,'scope'=>'deals_index'],$time,600);
}
