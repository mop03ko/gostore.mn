<?php
declare(strict_types=1);
require __DIR__.'/taoworld-catalog.php';
$_SERVER['REMOTE_ADDR']='192.0.2.56';settings(['api_daily_limit'=>2000]);
$query=['q'=>'progressive','page'=>1,'limit'=>50];$before=count($calls);
$r=supplier_search($query+['preview'=>1],true);
check($r['partial']===true&&count($r['products'])===20&&count($calls)===$before+1,'Preview must return after one upstream page');
$r=supplier_search($query,true);check(!$r['partial']&&count($r['products'])===50&&count($calls)===$before+3,'Completion must reuse the first 20 items');
$r2=supplier_search(array_replace($query,['page'=>2]),true);check($r2['products'][0]['id']==='tb-700000000050','Progressive completion changed 50-item page offsets');
$before=count($calls);$short=true;$r=supplier_search(['q'=>'progressive short','page'=>1,'limit'=>50,'preview'=>1],true);$short=false;
check(!$r['partial']&&!$r['more']&&count($r['products'])===3&&count($calls)===$before+1,'Short preview must finish without continuation');
$paths=[];for($n=1;$n<=3;$n++)$paths[]=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',['keyword'=>'progressive','language'=>'en','page_no'=>(string)$n,'page_size'=>'20']).'.json';
$age=function(int $seconds)use($paths):void{foreach($paths as $path){$c=supplier_snapshot_read($path);$c['time']=time()-$seconds;supplier_snapshot_write($path,$c);}};
$age(1805);$before=count($calls);$budget=supplier_budget_status()['used'];$locks=[];
foreach($paths as $path){$lock=fopen($path.'.lock','c');flock($lock,LOCK_EX);$locks[]=$lock;}
$start=microtime(true);$r=supplier_search($query,true);
check(microtime(true)-$start<.5&&$r['stale']&&$r['revalidate']&&$r['cache_ttl']===0&&count($r['products'])===50,'Stale list must be immediate and explicitly require refresh');
check(count($calls)===$before&&supplier_budget_status()['used']===$budget,'Stale display spent API quota');
foreach($locks as $lock){flock($lock,LOCK_UN);fclose($lock);}
$r=supplier_search($query+['refresh'=>1],true);check(!$r['stale']&&!$r['revalidate']&&count($calls)===$before+3,'Revalidation failed to replace expired pages');
$before=count($calls);supplier_search($query+['refresh'=>1],true);check(count($calls)===$before,'Concurrent/repeated revalidation must reuse newly refreshed pages');
$age(1805);$old=supplier_snapshot_read($paths[0]);$error=true;denied(fn()=>supplier_search($query+['refresh'=>1],true),502);
check(supplier_snapshot_read($paths[0])===$old,'Failed refresh changed the cached data or its age');
check(supplier_search($query,true)['stale'],'Failed background read hid the old list');
denied(fn()=>supplier_search($query,false),502); // Non-display callers cannot use stale lists.
$age(3601);denied(fn()=>supplier_search($query,true),502);
$age(-10);denied(fn()=>supplier_search($query,true),502);$error=false;
denied(fn()=>supplier_search($query+['preview'=>2],true),400);
denied(fn()=>supplier_search($query+['refresh'=>2],true),400);
echo "PASS progressive API: one-page preview, 50-item completion/offsets, short results, lock-free bounded stale display, zero stale-read quota, explicit revalidation, fresh reuse, failed refresh retention, hard expiry and non-display rejection.\n";
