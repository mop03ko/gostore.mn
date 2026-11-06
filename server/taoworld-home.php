<?php
declare(strict_types=1);

// Discovery spans departments rather than treating "all" as a storage-box query.
// A stable page schedule keeps reloads predictable; native snapshots are shared
// with category searches. Fetch only six departments, three requests at a time.
function tw_catalog_home(int $page,int $limit,string $sort,array $filters,bool $display): array {
    $departments=array_values(tw_catalog_departments());$count=count($departments);
    $queries=[];$snapshots=[];$ttl=$display?TW_CATALOG_SEARCH_MAX_AGE:TW_CATALOG_SEARCH_TTL;
    for($i=0;$i<6;$i++){
        $position=($page-1)*6+$i;
        $q=['keyword'=>$departments[$position%$count],'language'=>'en','page_no'=>(string)(intdiv($position,$count)+1),'page_size'=>'20'];
        if($sort!=='')$q['sort']=$sort;if($filters)$q['filters']=json_encode($filters,JSON_THROW_ON_ERROR);
        $queries[$i]=$q;
    }
    // One department that is busy, failing or over quota must not turn the whole homepage into an
    // error: it uses its last snapshot (up to a day old) or is left out, and the list is marked stale
    // so the browser revalidates. Only a feed with no department at all fails. Lock waits share one
    // two-second deadline instead of two seconds per department.
    $deadline=microtime(true)+2;$failure=null;$degraded=false;$old=[];
    foreach(array_chunk($queries,3,true) as $batch){
        $locks=[];$pending=[];
        try{
            foreach($batch as $i=>$q){
                $file=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',$q).'.json';$c=supplier_snapshot_read($file);
                if(!tw_catalog_fresh($c,$ttl)){
                    if(tw_catalog_fresh($c,TW_CATALOG_DISPLAY_FALLBACK))$old[$i]=$c;
                    $h=supplier_acquire_lock([$file.'.lock'],$deadline);if(!$h){$failure??=new SupplierBusy();continue;}$locks[]=$h;
                    $c=supplier_snapshot_read($file);if(!tw_catalog_fresh($c,$ttl)){$pending[$i]=['query'=>$q,'file'=>$file];continue;}
                }
                $snapshots[$i]=$c;
            }
            if(!$pending)continue;
            try{
                $token=taoworld_access_token();$db=db();$db->exec('SAVEPOINT home_feed_budget');
                try{foreach($pending as $_)supplier_limits(false);$db->exec('RELEASE SAVEPOINT home_feed_budget');}
                catch(Throwable $e){$db->exec('ROLLBACK TO SAVEPOINT home_feed_budget');$db->exec('RELEASE SAVEPOINT home_feed_budget');throw $e;}
                $responses=taoworld_http_search_batch(array_map(fn($p)=>$p['query']+['access_token'=>$token],array_values($pending)));
            }catch(ApiError $e){$failure??=$e;continue;}
            foreach(array_keys($pending) as $n=>$i){try{
                $r=$responses[$n]??null;if($r instanceof ApiError)throw $r;if(!is_array($r))fail('Барааны мэдээлэл дутуу.',502);
                $data=tw_catalog_data($r);if(!is_array($data['data']??null))fail('Барааны мэдээлэл дутуу.',502);
                $snapshots[$i]=['time'=>time(),'data'=>$data];supplier_snapshot_write($pending[$i]['file'],$snapshots[$i]);
            }catch(ApiError $e){$failure??=$e;}}
        }finally{foreach($locks as $h){flock($h,LOCK_UN);fclose($h);}}
    }
    foreach(array_keys($queries) as $i)if(!isset($snapshots[$i])){$degraded=true;if(isset($old[$i]))$snapshots[$i]=$old[$i];}
    if(!$snapshots)throw $failure??new SupplierBusy();
    ksort($snapshots);$time=time();$lanes=[];$hasMore=false;
    foreach($snapshots as $c){$time=min($time,$c['time']);$raw=$c['data']['data'];$hasMore=$hasMore||count($raw)===20;$lanes[]=tw_catalog_cards($raw,$c['time']);}
    $products=[];$seen=[];
    for($row=0;$row<20;$row++)foreach($lanes as $lane){$p=$lane[$row]??null;if(!$p||isset($seen[$p['id']]))continue;$seen[$p['id']]=true;$products[]=$p;}
    // Explicit price choices order this mixed sample by its displayed price.
    if(in_array($sort,['PRICE_ASC','PRICE_DESC'],true))usort($products,static function($a,$b)use($sort){
        $a=$a['mnt']??$a['approx_mnt']??null;$b=$b['mnt']??$b['approx_mnt']??null;
        if($a===null||$b===null)return $a===null?($b===null?0:1):-1;
        return $sort==='PRICE_ASC'?$a<=>$b:$b<=>$a;
    });
    $stale=$degraded||$time<=time()-TW_CATALOG_SEARCH_TTL;
    return tw_catalog_response(['products'=>array_slice($products,0,$limit),'page'=>$page,'total'=>null,'more'=>$page<100&&($hasMore||$page*6<$count),'partial'=>false,'stale'=>$stale,'revalidate'=>$stale,'feed'=>'mixed_departments']+($degraded?['cache_ttl'=>0,'cache_expires'=>time()]:[]),$time,TW_CATALOG_SEARCH_TTL);
}
