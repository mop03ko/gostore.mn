<?php
declare(strict_types=1);

const SUPPLIER_SNAPSHOT_INTERVAL = 7200;
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
    if(($data['version']??null)!==1||!is_int($data['generated_at']??null)||!is_int($data['next_refresh_at']??null))return false;
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
    if(!$record||(int)$record['cache_expires']<=time()-86400)return null;
    $record['stale']=(int)$record['cache_expires']<=time();
    $record['cache_ttl']=$record['stale']?0:max(0,(int)$record['cache_expires']-time());
    // Currency settings can change independently of the supplier snapshot.
    $shipping=shipping_public();foreach($record['products'] as &$p)$p=supplier_card_price($p,(int)$record['cache_expires']);unset($p);
    $record['shipping']=$shipping;return $record;
}
// Round-robin cached departments so the landing page is not a single bag search.
function supplier_snapshot_all(int $page,string $sort): array {
    $snapshot=supplier_snapshot_current();$records=[];
    foreach(supplier_warm_queries() as $q){
        $record=$snapshot['records'][$q]??null;
        if(!$record||(int)$record['cache_expires']<=time()-86400){
            $file=config()['data_dir'].'/supplier-cache/'.supplier_cache_key('/v1/taobao/search',['language'=>'mn','item_title'=>$q,'page'=>1,'limit'=>12,'sort'=>'default']).'.json';
            $cache=supplier_snapshot_read($file);
            $record=is_array($cache)&&($cache['expires']??0)>time()-86400?supplier_search_result($cache,1):null;
        }
        if($record)$records[]=$record;
    }
    $products=[];$seen=[];$expires=PHP_INT_MAX;$fetched=null;
    for($i=0;$i<12;$i++)foreach($records as $record){
        $p=$record['products'][$i]??null;if(!$p||isset($seen[$p['id']]))continue;
        $seen[$p['id']]=true;$p=supplier_card_price($p,(int)$record['cache_expires']);$p['_position']=count($products);$products[]=$p;
        $expires=min($expires,(int)$record['cache_expires']);if($fetched===null||strcmp($record['fetched'],$fetched)<0)$fetched=$record['fetched'];
    }
    if($sort!=='default')usort($products,static function($a,$b)use($sort){
        if($sort==='-volume')$cmp=($b['sold_count']??0)<=>($a['sold_count']??0);
        else{$knownA=($a['price_status']??'')==='available';$knownB=($b['price_status']??'')==='available';if($knownA!==$knownB)return $knownA?-1:1;$cmp=($a['mnt']??0)<=>($b['mnt']??0);if($sort==='-price')$cmp=-$cmp;}
        return $cmp?:$a['_position']<=>$b['_position'];
    });
    $total=count($products);$items=array_slice($products,($page-1)*12,12);foreach($items as &$p)unset($p['_position']);unset($p);
    if(!$total)$expires=0;
    return ['products'=>$items,'page'=>$page,'more'=>$page*12<$total,'total'=>$total,'fetched'=>$fetched,'stale'=>$expires<=time(),'cache_expires'=>$expires,'cache_ttl'=>max(0,$expires-time()),'shipping'=>shipping_public()];
}
function supplier_snapshot_run(int $maxJobs=26): array {
    if(empty(shipping_settings()['catalog_snapshot_enabled'])||!supplier_ready())return ['status'=>'disabled'];
    $dir=supplier_snapshot_dir();$lock=fopen($dir.'/worker.lock','c');if(!$lock)return ['status'=>'unavailable'];
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return ['status'=>'busy'];}
    try{
        $current=supplier_snapshot_current();
        if($current&&$current['next_refresh_at']>time())return ['status'=>'fresh','next_refresh_at'=>$current['next_refresh_at']];
        $state=supplier_snapshot_read($dir.'/work.json')??[];
        if(($state['retry_at']??0)>time())return ['status'=>'cooldown','retry_at'=>$state['retry_at']];
        $queries=supplier_warm_queries();$records=[];
        foreach($queries as $q){$r=$state['records'][$q]??null;if(is_array($r)&&is_array($r['products']??null)&&($r['cache_expires']??0)>time())$records[$q]=$r;}
        $state=['started_at'=>$state['started_at']??time(),'records'=>$records,'errors'=>[],'retry_at'=>0];$jobs=0;
        foreach($queries as $q){
            if(isset($state['records'][$q]))continue;if($jobs++>=max(1,min(26,$maxJobs)))break;
            try{
                $cache=supplier_request('/v1/taobao/search',['language'=>'mn','item_title'=>$q,'page'=>1,'limit'=>12,'sort'=>'default'],false,true,true,SUPPLIER_SNAPSHOT_INTERVAL);
                $fetched=strtotime((string)($cache['fetched']??''));
                if(!$fetched||$fetched+SUPPLIER_SNAPSHOT_INTERVAL<=time()||!empty($cache['stale']))throw new RuntimeException('Provider refresh incomplete');
                $cache['expires']=min((int)$cache['expires'],$fetched+SUPPLIER_SNAPSHOT_INTERVAL);
                $record=supplier_search_result($cache,1);unset($record['shipping']);$state['records'][$q]=$record;
            }catch(Throwable $e){$state['errors'][]=['query'=>$q,'code'=>(int)$e->getCode()];if($e->getCode()===429)break;}
            supplier_snapshot_write($dir.'/work.json',$state);
        }
        if(count($state['records'])===count($queries)){
            $snapshot=['version'=>1,'generated_at'=>time(),'next_refresh_at'=>min(array_column($state['records'],'cache_expires')),'records'=>$state['records']];
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
    if(!function_exists('fastcgi_finish_request')||empty(shipping_settings()['catalog_snapshot_enabled']))return;
    $current=supplier_snapshot_current();if($current&&$current['next_refresh_at']>time())return;
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
