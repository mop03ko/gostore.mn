<?php
declare(strict_types=1);
// Display reads keep showing the last snapshot when TaoWorld is busy, failing or over quota.
require __DIR__.'/taoworld-catalog.php';
$_SERVER['REMOTE_ADDR']='192.0.2.91';settings(['api_daily_limit'=>5000]);
$age=function(string $file,int $seconds):void{$c=supplier_snapshot_read($file);$c['time']=time()-$seconds;supplier_snapshot_write($file,$c);};
$searchFile=fn(string $keyword,int $page=1)=>tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',['keyword'=>$keyword,'language'=>'en','page_no'=>(string)$page,'page_size'=>'20']).'.json';

// Keyword search: a two-hour-old snapshot is shown, stale and uncacheable, when the provider fails.
supplier_search(['q'=>'fallback box','page'=>1,'limit'=>12],true);$age($searchFile('fallback box'),7200);
$error=true;$r=supplier_search(['q'=>'fallback box','page'=>1,'limit'=>12],true);
check(count($r['products'])===12&&$r['stale']&&$r['revalidate']&&$r['cache_ttl']===0,'Failed refresh shows the last list, marked stale');
denied(fn()=>supplier_search(['q'=>'fallback box','page'=>1,'limit'=>12]),502);
$age($searchFile('fallback box'),90000);denied(fn()=>supplier_search(['q'=>'fallback box','page'=>1,'limit'=>12],true),502);$error=false;

// Product page: an old detail is shown with ordering disabled; checkout still refuses it.
$detailFile=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>'tb-700000000000','language'=>'en']).'.json';
supplier_detail('tb-700000000000',true);$age($detailFile,7200);
$error=true;$d=supplier_detail('tb-700000000000',true);check($d['product']['id']==='tb-700000000000'&&$d['stale']===true,'Old detail is shown stale while TaoWorld fails');
denied(fn()=>supplier_detail('tb-700000000000',false,'',true),502);$error=false;
$d=supplier_detail('tb-700000000000',true);check($d['stale']===false,'A successful refresh clears the stale flag');

// Homepage mix: one failing or locked department does not fail the page.
$home=['q'=>'__all__','page'=>1,'limit'=>50];$keywords=tw_catalog_home_order();
$r=supplier_search($home,true);check(count($r['products'])>0&&!$r['stale'],'Home feed builds normally');
foreach(array_slice($keywords,0,6) as $k)$age($searchFile($k),7200);
$error=true;$r=supplier_search($home,true);$error=false;
check(count($r['products'])>0&&$r['stale']&&$r['revalidate']&&$r['cache_ttl']===0,'Failing provider shows the last home feed, stale');
foreach(array_slice($keywords,0,3) as $k)unlink($searchFile($k));
$error=true;$r=supplier_search($home,true);$error=false;check(count($r['products'])>0&&$r['stale']&&$r['cache_ttl']===0,'Departments without any snapshot are left out');
foreach(array_slice($keywords,0,6) as $k)if(is_file($searchFile($k)))unlink($searchFile($k));
$error=true;denied(fn()=>supplier_search($home,true),502);$error=false;
// A department whose refresh is locked by another request is waited for only once, briefly.
$_SERVER['REMOTE_ADDR']='192.0.2.92';supplier_search($home,true);$age($searchFile($keywords[0]),7200);$lock=fopen($searchFile($keywords[0]).'.lock','c');flock($lock,LOCK_EX);
$start=microtime(true);$r=supplier_search($home,true);$took=microtime(true)-$start;flock($lock,LOCK_UN);fclose($lock);
check(count($r['products'])>0&&$r['stale']&&$took<3,'A locked department uses its snapshot after one short wait');
// Official store directory: failing provider or a spent daily quota keeps the last shop previews.
$_SERVER['REMOTE_ADDR']='192.0.2.93';$shopFiles=array_map(fn($s)=>tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',official_store_query($s)).'.json',official_stores_registry());
$r=official_stores_directory();check(count($r['stores'])===12&&!$r['stale']&&!$r['incomplete'],'Directory builds normally');
foreach($shopFiles as $f)$age($f,7200);
$error=true;$r=official_stores_directory();$error=false;
check(count($r['stores'])===12&&$r['stale']&&$r['revalidate']&&!$r['incomplete']&&$r['cache_ttl']===0,'Failing provider shows the last directory, stale, without a missing-shops notice');
settings(['api_daily_limit'=>1]);$before=count($calls);$r=official_stores_directory();settings(['api_daily_limit'=>5000]);
check(count($r['stores'])===12&&$r['stale']&&count($calls)===$before,'Spent daily quota shows the last directory without provider calls');
$age(reset($shopFiles),90000);$error=true;$r=official_stores_directory();$error=false;check(count($r['stores'])===11&&$r['stale']&&$r['incomplete'],'Shops older than a day are left out and reported missing');
foreach($shopFiles as $f)$age($f,90000);$error=true;denied(fn()=>official_stores_directory(),503);$error=false;
// Homepage pages after the third refresh every six hours; earlier pages keep the hourly allowance.
$_SERVER['REMOTE_ADDR']='192.0.2.94';$deep=['q'=>'__all__','page'=>4,'limit'=>50];$r=supplier_search($deep,true);check(count($r['products'])>0,'Deep page builds');
foreach(array_slice($keywords,18,6) as $k)$age($searchFile($k),7200);$before=count($calls);$r=supplier_search($deep,true);check(count($calls)===$before&&!$r['stale']&&!$r['revalidate'],'A two-hour-old deep page is reused without provider calls or revalidation');
foreach(array_slice($keywords,0,6) as $k)if(is_file($searchFile($k)))$age($searchFile($k),2400);$r=supplier_search($home,true);check($r['stale']&&$r['revalidate'],'The first page still asks for revalidation after its allowance');
foreach(array_slice($keywords,18,6) as $k)$age($searchFile($k),25000);$before=count($calls);supplier_search($deep,true);check(count($calls)===$before+6,'A deep page older than six hours is fetched again');
echo "PASS: display fallback for search, product detail, homepage departments and the official store directory when TaoWorld is busy, failing or over quota; deep homepage pages refresh every six hours; checkout and non-display reads stay strict.\n";
