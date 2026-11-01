<?php
declare(strict_types=1);

// Only reviewed identities may enter the official directory. A shop name alone
// (including 官方/旗舰店) is not sufficient evidence to add another store.
function official_stores_registry(): array {
    $rows=json_decode(file_get_contents(__DIR__.'/official-stores.json'),true,512,JSON_THROW_ON_ERROR);$stores=[];
    foreach($rows as $s){if(!preg_match('/^\d{5,20}$/D',$s['id']??'')||empty($s['name'])||empty($s['verification']))throw new RuntimeException('Invalid store registry');$stores[$s['id']]=$s;}
    return $stores;
}
function official_store(string $id): array {return official_stores_registry()[$id]??throw new ApiError('Дэлгүүр олдсонгүй.',404);}
function official_store_query(array $s,int $page=1,string $sort='-price'): array {
    $sorts=['default'=>'PRICE_DESC','-price'=>'PRICE_DESC','price'=>'PRICE_ASC','-volume'=>'SALE_QTY_DESC','-updated_time'=>''];
    if(!isset($sorts[$sort]))fail('Эрэмбэ буруу.');
    $q=['shop_id'=>$s['id'],'language'=>'en','page_no'=>(string)$page,'page_size'=>'20'];if($sorts[$sort]!=='')$q['sort']=$sorts[$sort];return $q;
}
function official_store_matches(array $p,array $s,bool $detail=false): bool {
    return ($p['shop_name']??'')===$s['name']&&((!$detail&&!isset($p['shop_id']))||(string)($p['shop_id']??'')===$s['id']);
}
function official_store_cards(array $raw,array $s,int $time): array {
    $rows=array_values(array_filter($raw,fn($p)=>is_array($p)&&official_store_matches($p,$s)));$cards=tw_catalog_cards($rows,$time);
    foreach($cards as &$p){$p['official_shop_id']=$s['id'];$p['vendor_name']=$s['name'];}unset($p);return $cards;
}
// Three independent shop reads at a time; the same per-shop cache serves directory
// previews and full store pages. Successful reads survive a partial outage.
function official_stores_directory(): array {
    tw_catalog_require_ready();$registry=official_stores_registry();$cache=[];$pending=[];$failed=0;
    foreach($registry as $id=>$s){$q=official_store_query($s);$file=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',$q).'.json';$c=supplier_snapshot_read($file);
        if(tw_catalog_fresh($c,TW_CATALOG_SEARCH_TTL))$cache[$id]=$c;else $pending[$id]=['q'=>$q,'file'=>$file];}
    foreach(array_chunk($pending,3,true) as $chunk){
        $locks=[];$send=[];
        try{
            foreach($chunk as $id=>$p){$h=supplier_acquire_lock([$p['file'].'.lock'],microtime(true)+2);if(!$h){$failed++;continue;}$locks[]=$h;
                $c=supplier_snapshot_read($p['file']);if(tw_catalog_fresh($c,TW_CATALOG_SEARCH_TTL))$cache[$id]=$c;else $send[$id]=$p;}
            if(!$send)continue;
            $token=taoworld_access_token();$db=db();$db->exec('SAVEPOINT official_store_budget');
            try{foreach($send as $_)supplier_limits(false);$db->exec('RELEASE SAVEPOINT official_store_budget');}
            catch(Throwable $e){$db->exec('ROLLBACK TO SAVEPOINT official_store_budget');$db->exec('RELEASE SAVEPOINT official_store_budget');throw $e;}
            $responses=taoworld_http_search_batch(array_map(fn($p)=>$p['q']+['access_token'=>$token],array_values($send)));
            foreach(array_keys($send) as $i=>$id){try{$r=$responses[$i];if($r instanceof ApiError)throw $r;$data=tw_catalog_data($r);if(!is_array($data['data']??null))fail('Дэлгүүрийн хариу дутуу.',502);
                $cache[$id]=['time'=>time(),'data'=>$data];supplier_snapshot_write($send[$id]['file'],$cache[$id]);}catch(ApiError){$failed++;}}
        }catch(ApiError){$failed+=count($send);}
        finally{foreach($locks as $h){flock($h,LOCK_UN);fclose($h);}}
    }
    $stores=[];$time=time();foreach($registry as $id=>$s){if(!isset($cache[$id]))continue;$c=$cache[$id];$time=min($time,$c['time']);$cards=official_store_cards($c['data']['data']??[],$s,$c['time']);if(!$cards)continue;
        unset($s['verification']);$s['products']=array_slice($cards,0,4);$stores[]=$s;}
    if(!$cache&&$failed)fail('Дэлгүүрүүдийн мэдээллийг түр авч чадсангүй. Дахин оролдоно уу.',503);
    return tw_catalog_response(['stores'=>$stores,'incomplete'=>$failed>0,'coverage'=>'verified_registry','all_platform_stores'=>false,'checked_stores'=>count($cache),'registered_stores'=>count($registry)],$time,$failed?0:300);
}
function official_store_products(array $b,bool $display=false): array {
    tw_catalog_require_ready();$s=official_store(str_field($b,'shop',20));$page=int_field($b,'page',1,100);$sort=str_field($b,'sort',20,false)?:'-price';
    $q=official_store_query($s,$page,$sort);$range=supplier_price_range($b);$filters=[];$rate=shipping_settings()['cny_rate'];
    foreach(['price_min'=>'min_price','price_max'=>'max_price'] as $k=>$v)if(isset($range[$k]))$filters[]=$v.':'.(int)round($range[$k]*100/$rate);if($filters)$q['filters']=json_encode($filters,JSON_THROW_ON_ERROR);
    $c=tw_catalog_cached('/traffic/item/search',$q,false,null,$display);$rows=$c['data']['data']??null;if(!is_array($rows))fail('Дэлгүүрийн хариу дутуу.',502);
    $more=count($rows)===20&&$page<100;$products=official_store_cards($rows,$s,$c['time']);unset($s['verification']);
    $stale=!tw_catalog_fresh($c,TW_CATALOG_SEARCH_TTL);
    return tw_catalog_response(['products'=>$products,'store'=>$s,'page'=>$page,'more'=>$more,'total'=>null,'partial'=>false,'stale'=>$stale,'revalidate'=>$stale],$c['time'],TW_CATALOG_SEARCH_TTL);
}
function official_store_detail(string $id,string $shop): array {
    $s=official_store($shop);$r=supplier_detail($id,true);$p=$r['product'];
    if(($p['vendor_id']??'')!==$s['id']||($p['vendor_name']??'')!==$s['name'])fail('Бараа сонгосон дэлгүүрт хамаарахгүй байна.',409);
    $r['product']['official_shop_id']=$s['id'];return $r;
}
