<?php
declare(strict_types=1);

const SUPPLIER_SNAPSHOT_INTERVAL = 7200;
const SUPPLIER_SNAPSHOT_STALE_MAX = 604800;
function supplier_snapshot_interval(): int {
    // Allow for the original page plus its optional English-title request.
    $daily=max(1,(int)floor(shipping_settings()['api_daily_limit']/2));
    return max(SUPPLIER_SNAPSHOT_INTERVAL,(int)ceil(count(supplier_warm_queries())*2*86400/$daily));
}
function supplier_snapshot_dir(): string {
    $dir=config()['data_dir'].'/supplier-snapshots';
    if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('Snapshot directory unavailable');
    return $dir;
}
function supplier_snapshot_write(string $file,array $data): void {
    $json=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    $tmp=tempnam(dirname($file),'snapshot-');if($tmp===false)throw new RuntimeException('Snapshot temporary file unavailable');
    try{if(file_put_contents($tmp,$json,LOCK_EX)===false)throw new RuntimeException('Snapshot write failed');chmod($tmp,0600);if(!rename($tmp,$file))throw new RuntimeException('Snapshot publish failed');}
    finally{if(is_file($tmp))unlink($tmp);}
}
function supplier_snapshot_read(string $file): ?array {
    if(!is_file($file)||filesize($file)>12000000)return null;
    $data=json_decode(file_get_contents($file),true);
    return is_array($data)?$data:null;
}
function supplier_snapshot_valid(?array $data): bool {
    if(($data['version']??null)!==1||($data['product_policy']??null)!==PRODUCT_POLICY_VERSION||!is_int($data['generated_at']??null)||!is_int($data['next_refresh_at']??null))return false;
    foreach(supplier_warm_queries() as $q){$r=$data['records'][$q]??null;if(!is_array($r)||!is_array($r['products']??null)||!isset($r['fetched'],$r['cache_expires'],$r['more']))return false;}
    return true;
}
function supplier_snapshot_current(): ?array {
    $dir=supplier_snapshot_dir();
    foreach(['current.json','previous.json'] as $name){$data=supplier_snapshot_read($dir.'/'.$name);if(supplier_snapshot_valid($data))return $data;}
    return null;
}
function supplier_snapshot_search(string $q,int $page,string $sort): ?array {
    if(empty(shipping_settings()['catalog_snapshot_enabled'])||$page!==1||$sort!=='default'||!in_array($q,supplier_warm_queries(),true))return null;
    $snapshot=supplier_snapshot_current();$record=$snapshot['records'][$q]??null;
    if(!$record||(int)$record['cache_expires']<=time()-SUPPLIER_SNAPSHOT_STALE_MAX)return null;
    $record['stale']=(int)$record['cache_expires']<=time();
    $record['cache_ttl']=$record['stale']?0:max(0,(int)$record['cache_expires']-time());
    // Currency settings can change independently of the supplier snapshot.
    $shipping=shipping_public();$products=[];
    foreach($record['products'] as $p){try{$products[]=supplier_card_price($p,(int)$record['cache_expires']);}catch(ApiError){}}
    $record['products']=$products;
    $record['shipping']=$shipping;return $record;
}
// Round-robin cached departments so the landing page is not a single bag search.
function supplier_snapshot_all(int $page,string $sort,array $range=[],int $limit=12): array {
    $snapshot=supplier_snapshot_current();$records=[];
    foreach(supplier_warm_queries() as $q){
        $record=$snapshot['records'][$q]??null;
        if(!$record||(int)$record['cache_expires']<=time()-SUPPLIER_SNAPSHOT_STALE_MAX){
            $file=config()['data_dir'].'/supplier-cache/'.supplier_cache_key('/v1/taobao/search',['language'=>supplier_language(),'item_title'=>$q,'page'=>1,'limit'=>12,'sort'=>'default']).'.json';
            $cache=supplier_snapshot_read($file);
            $record=is_array($cache)&&($cache['expires']??0)>time()-86400?supplier_search_result($cache,1):null;
        }
        if($record)$records[]=$record;
    }
    $products=[];$seen=[];$expires=PHP_INT_MAX;$fetched=null;
    for($i=0;$i<12;$i++)foreach($records as $record){
        $p=$record['products'][$i]??null;if(!$p||isset($seen[$p['id']])||product_policy_blocked($p))continue;
        try{$p=supplier_card_price($p,(int)$record['cache_expires']);}catch(ApiError){continue;}
        $seen[$p['id']]=true;$p['_position']=count($products);$products[]=$p;
        $expires=min($expires,(int)$record['cache_expires']);if($fetched===null||strcmp($record['fetched'],$fetched)<0)$fetched=$record['fetched'];
    }
    // The mixed storefront is filtered by the displayed MNT price; unknown prices are left out of a price filter.
    // Verified prices win; otherwise the approximate search price is used, and unknown prices go last.
    $price=static fn($p)=>($p['price_status']??'available')==='available'?($p['mnt']??null):($p['approx_mnt']??null);
    // The unfiltered home feed hides very cheap parts and placeholder listings below the admin's floor.
    $floor=$sort==='default'&&!$range?(int)(shipping_settings()['home_min_price_mnt']??0):0;
    if($floor>0)$products=array_values(array_filter($products,static fn($p)=>($m=$price($p))===null||$m>=$floor));
    if($range)$products=array_values(array_filter($products,static fn($p)=>($m=$price($p))!==null&&(!isset($range['price_min'])||$m>=$range['price_min'])&&(!isset($range['price_max'])||$m<=$range['price_max'])));
    // Default preserves the round-robin department mix and supplier relevance, with unavailable items last.
    if($sort==='default')usort($products,static function($a,$b){
        $aUnavailable=($a['price_status']??'')==='unavailable';$bUnavailable=($b['price_status']??'')==='unavailable';
        return ($aUnavailable<=>$bUnavailable)?:($a['_position']<=>$b['_position']);
    });
    elseif($sort!=='-updated_time')usort($products,static function($a,$b)use($sort,$price){
        if($sort==='-volume')$cmp=($b['sold_count']??0)<=>($a['sold_count']??0);
        else{$pa=$price($a);$pb=$price($b);if(($pa===null)!==($pb===null))return $pa===null?1:-1;$cmp=($pa??0)<=>($pb??0);if($sort==='-price')$cmp=-$cmp;}
        return $cmp?:$a['_position']<=>$b['_position'];
    });
    $total=count($products);$items=array_slice($products,($page-1)*$limit,$limit);foreach($items as &$p)unset($p['_position']);unset($p);
    if(!$total)$expires=0;
    return ['products'=>$items,'page'=>$page,'more'=>$page*$limit<$total,'total'=>$total,'pages'=>max(1,(int)ceil($total/$limit)),'fetched'=>$fetched,'stale'=>$expires<=time(),'cache_expires'=>$expires,'cache_ttl'=>max(0,$expires-time()),'shipping'=>shipping_public()];
}
function supplier_snapshot_run(int $maxJobs=26): array {
    if(tw_catalog_enabled())return ['status'=>'native-catalog','errors'=>0];
    $start=microtime(true);
    try{$result=supplier_snapshot_build($maxJobs);}
    catch(Throwable $e){$previous=supplier_snapshot_read(supplier_snapshot_dir().'/health.json')??[];supplier_snapshot_write(supplier_snapshot_dir().'/health.json',['last_run'=>time(),'last_success'=>$previous['last_success']??null,'status'=>'failed','error_code'=>(int)$e->getCode()]);throw $e;}
    if($result['status']!=='busy'){
        $previous=supplier_snapshot_read(supplier_snapshot_dir().'/health.json')??[];
        supplier_snapshot_write(supplier_snapshot_dir().'/health.json',['last_run'=>time(),'last_success'=>in_array($result['status'],['fresh','published'],true)?time():($previous['last_success']??null),'duration_ms'=>(int)round((microtime(true)-$start)*1000)]+$result);
    }
    return $result;
}
function supplier_snapshot_health(): array {
    $dir=supplier_snapshot_dir();$run=supplier_snapshot_read($dir.'/health.json')??[];$cron=supplier_snapshot_read($dir.'/cron.json')??[];
    $snapshot=supplier_snapshot_current();$work=supplier_snapshot_read($dir.'/work.json')??[];
    return ['budget'=>supplier_budget_status(),'refresh_interval'=>supplier_snapshot_interval(),'last_run'=>$run['last_run']??null,'last_success'=>$run['last_success']??null,'status'=>$run['status']??'unknown','duration_ms'=>$run['duration_ms']??null,'cron_last_run'=>$cron['last_run']??null,'cron_status'=>$cron['status']??'unknown','cron_overdue'=>empty($cron['last_run'])||$cron['last_run']<time()-1800,'snapshot_generated'=>$snapshot['generated_at']??null,'next_refresh'=>$snapshot['next_refresh_at']??null,'building_categories'=>count($work['records']??[]),'errors'=>count($work['errors']??[])];
}
function supplier_snapshot_build(int $maxJobs=26): array {
    if(empty(shipping_settings()['catalog_snapshot_enabled'])||!supplier_ready())return ['status'=>'disabled'];
    $dir=supplier_snapshot_dir();$lock=fopen($dir.'/worker.lock','c');if(!$lock)return ['status'=>'unavailable'];
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return ['status'=>'busy'];}
    try{
        $current=supplier_snapshot_current();
        if($current&&($current['title_language']??'')==='en'&&$current['next_refresh_at']>time())return ['status'=>'fresh','next_refresh_at'=>$current['next_refresh_at']];
        $state=supplier_snapshot_read($dir.'/work.json')??[];
        if(($state['title_language']??'')!=='en'||($state['product_policy']??null)!==PRODUCT_POLICY_VERSION)$state=[];
        if(($state['retry_at']??0)>time())return ['status'=>'cooldown','retry_at'=>$state['retry_at']];
        $interval=supplier_snapshot_interval();$queries=supplier_warm_queries();$records=[];
        foreach($queries as $q){$r=$state['records'][$q]??null;if(is_array($r)&&is_array($r['products']??null)&&(strtotime((string)($r['fetched']??''))?:0)>time()-$interval)$records[$q]=$r;}
        $state=['title_language'=>'en','product_policy'=>PRODUCT_POLICY_VERSION,'started_at'=>$state['started_at']??time(),'records'=>$records,'errors'=>[],'retry_at'=>0];$jobs=0;
        foreach($queries as $q){
            if(isset($state['records'][$q]))continue;if($jobs++>=max(1,min(26,$maxJobs)))break;
            try{
                $cache=supplier_request('/v1/taobao/search',['language'=>supplier_language(),'item_title'=>$q,'page'=>1,'limit'=>12,'sort'=>'default'],false,true,true,$interval);
                $fetched=strtotime((string)($cache['fetched']??''));
                if(!$fetched||$fetched+$interval<=time()||!empty($cache['stale']))throw new RuntimeException('Provider refresh incomplete');
                $cache['expires']=min((int)$cache['expires'],$fetched+$interval);
                $record=supplier_search_result($cache,1);unset($record['shipping']);$state['records'][$q]=$record;
            }catch(Throwable $e){$state['errors'][]=['query'=>$q,'code'=>(int)$e->getCode()];if($e->getCode()===429)break;}
            supplier_snapshot_write($dir.'/work.json',$state);
        }
        if(count($state['records'])===count($queries)){
            $snapshot=['version'=>1,'product_policy'=>PRODUCT_POLICY_VERSION,'title_language'=>'en','generated_at'=>time(),'next_refresh_at'=>min(array_map(static fn($r)=>(strtotime($r['fetched'])?:0)+$interval,$state['records'])),'records'=>$state['records']];
            if(!supplier_snapshot_valid($snapshot))throw new RuntimeException('Incomplete snapshot');
            // The current version is replaced only after the entire new catalog is ready.
            if($current)supplier_snapshot_write($dir.'/previous.json',$current);
            supplier_snapshot_write($dir.'/current.json',$snapshot);
            if(is_file($dir.'/work.json'))unlink($dir.'/work.json');
            return ['status'=>'published','categories'=>count($queries),'generated_at'=>$snapshot['generated_at'],'next_refresh_at'=>$snapshot['next_refresh_at']];
        }
        if($state['errors'])$state['retry_at']=time()+300;
        supplier_snapshot_write($dir.'/work.json',$state);
        return ['status'=>'building','completed'=>count($state['records']),'total'=>count($queries),'errors'=>count($state['errors'])];
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function supplier_snapshot_schedule(): void {
    if(tw_catalog_enabled())return;
    if(!function_exists('fastcgi_finish_request')||empty(shipping_settings()['catalog_snapshot_enabled']))return;
    $current=supplier_snapshot_current();if($current&&($current['title_language']??'')==='en'&&$current['next_refresh_at']>time())return;
    $state=supplier_snapshot_read(supplier_snapshot_dir().'/work.json');if(($state['retry_at']??0)>time())return;
    $dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))mkdir($dir,0700,true);
    $lock=fopen($dir.'/background.lock','c');if(!$lock)return;
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return;}
    register_shutdown_function(static function()use($lock){
        ignore_user_abort(true);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();fastcgi_finish_request();
        try{supplier_snapshot_run(1);}catch(Throwable $e){error_log('GOStore catalog snapshot deferred');}
        finally{flock($lock,LOCK_UN);fclose($lock);}
    });
}

