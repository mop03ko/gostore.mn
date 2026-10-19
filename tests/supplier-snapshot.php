<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/snapshot-test-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/shipping.php';require __DIR__.'/../server/supplier.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
check(supplier_snapshot_run()['status']==='disabled','Disabled mode');
$settings=shipping_settings();$settings['catalog_snapshot_enabled']=true;$settings['api_daily_limit']=1200;shipping_save($settings);
$cacheDir=config()['data_dir'].'/supplier-cache';mkdir($cacheDir,0700,true);$files=[];
foreach(supplier_warm_queries() as $q){
    $key=supplier_cache_key('/v1/taobao/search',['language'=>'mn','item_title'=>$q,'page'=>1,'limit'=>12,'sort'=>'default']);
    $raw=['Id'=>'123456789','ProviderType'=>'Taobao','Title'=>$q,'IsSellAllowed'=>true,'ConfiguredItems'=>[['Id'=>'standard','Quantity'=>10,'Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY']]],'Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY']];
    $cache=['data'=>['Items'=>['Items'=>['Content'=>[$raw],'TotalCount'=>1]],'private'=>'must-not-persist'],'fetched'=>gmdate('c'),'expires'=>time()+21600,'stale'=>false];
    $files[$q]=$cacheDir.'/'.$key.'.json';supplier_snapshot_write($files[$q],$cache);
}
$dir=supplier_snapshot_dir();$lock=fopen($dir.'/worker.lock','c');flock($lock,LOCK_EX);
check(supplier_snapshot_run()['status']==='busy','Overlapping worker does not run');flock($lock,LOCK_UN);fclose($lock);
check(supplier_snapshot_run(1)['completed']===1&&!is_file($dir.'/current.json'),'Partial builds stay private');
check(supplier_snapshot_run()['status']==='published','All 25 categories published together');
$first=supplier_snapshot_read($dir.'/current.json');check(count($first['records'])===25&&$first['next_refresh_at']<=time()+7200,'Two hour interval');
check(!str_contains(file_get_contents($dir.'/current.json'),'must-not-persist'),'Only public normalized fields saved');
check(supplier_snapshot_run()['status']==='fresh','Fresh snapshot does not spend API calls');
$r=supplier_search(['q'=>'bag','page'=>1,'sort'=>'default'],true);check($r['products'][0]['mnt']===5500&&!$r['stale'],'Snapshot is used for browsing');
check(supplier_snapshot_search('bag',2,'default')===null&&supplier_snapshot_search('bag',1,'price')===null,'Page and sorting isolation');
$settings['cny_rate']=600;unset($settings['catalog_snapshot_enabled']);shipping_save($settings);check(shipping_settings()['catalog_snapshot_enabled']===true,'Unrelated admin settings preserve snapshot mode');
check(supplier_snapshot_search('bag',1,'default')['products'][0]['mnt']===6000,'Current exchange rate applied');
$first['next_refresh_at']=time()-1;supplier_snapshot_write($dir.'/current.json',$first);$before=file_get_contents($dir.'/current.json');
$last=supplier_snapshot_read($files['personal care']);$last['fetched']=gmdate('c',time()-7201);supplier_snapshot_write($files['personal care'],$last);
$result=supplier_snapshot_run();check($result['status']==='building'&&$result['completed']===24,'Failed provider leaves incomplete build');
check(file_get_contents($dir.'/current.json')===$before,'Failed refresh preserves complete current snapshot');
$last['fetched']=gmdate('c');$last['data']['Items']['Items']['Content'][0]['Title']='Updated';supplier_snapshot_write($files['personal care'],$last);
$work=supplier_snapshot_read($dir.'/work.json');$work['retry_at']=0;supplier_snapshot_write($dir.'/work.json',$work);check(supplier_snapshot_run(1)['status']==='published','Resumes unfinished category only');
check(file_get_contents($dir.'/previous.json')===$before,'Previous complete version retained as backup');
file_put_contents($dir.'/current.json','broken');check(supplier_snapshot_search('bag',1,'default')!==null,'Corruption falls back to previous version');
$backup=supplier_snapshot_read($dir.'/previous.json');foreach($backup['records'] as &$row)$row['cache_expires']=time()-1;unset($row);supplier_snapshot_write($dir.'/previous.json',$backup);
check(supplier_snapshot_search('bag',1,'default')['stale']===true&&supplier_snapshot_search('bag',1,'default')['cache_ttl']===0,'Stale backups are labelled, never fresh');
foreach($backup['records'] as &$row)$row['cache_expires']=time()-SUPPLIER_SNAPSHOT_STALE_MAX-1;unset($row);supplier_snapshot_write($dir.'/previous.json',$backup);
check(supplier_snapshot_search('bag',1,'default')===null,'Hard expiry prevents indefinitely stale browsing');
echo "PASS snapshot: 2-hour cadence, 25-category atomic publish, resume, worker lock, failure/corruption backup, no provider calls for fresh cache, current FX, isolated search keys, stale labels and hard expiry.\n";
