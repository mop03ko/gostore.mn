<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/performance-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
foreach(['bootstrap','shipping','supplier'] as $f)require __DIR__.'/../server/'.$f.'.php';
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function denied(callable $f,int $status):void{try{$f();}catch(ApiError $e){check($e->getCode()===$status,'Unexpected status '.$e->getCode());return;}throw new RuntimeException('Expected rejection');}
$settings=shipping_settings();$settings['api_daily_limit']=40;shipping_save($settings);
check(supplier_snapshot_interval()===216000,'Low-budget cadence allows page and title requests');
for($i=0;$i<20;$i++)supplier_budget_take(true);
denied(fn()=>supplier_budget_take(true),429);
check(supplier_budget_status()['used']===20,'Rejected background attempts do not consume checkout budget');
for($i=0;$i<12;$i++)supplier_budget_take(false);
denied(fn()=>supplier_budget_take(false),429);
check(supplier_budget_status()['remaining']===8,'Twenty percent reserved for purchase checks');
for($i=0;$i<8;$i++)supplier_budget_take(false,true);
denied(fn()=>supplier_budget_take(false,true),429);
check(supplier_budget_status()['used']===40,'Total cap never exceeded');
$settings['api_daily_limit']=800;shipping_save($settings);check(supplier_snapshot_interval()===10800,'Live-sized budget cadence');
$dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))mkdir($dir,0700,true);
$path='/v1/taobao/product/123456789';$file=$dir.'/'.supplier_cache_key($path,['language'=>'mn']).'.json';
$raw=['Item'=>['Id'=>'123456789','ProviderType'=>'Taobao','Title'=>'Bag','IsSellAllowed'=>true,'Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY'],'ConfiguredItems'=>[['Id'=>'one','Quantity'=>5,'Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY']]]]];
$cache=['data'=>$raw,'fetched'=>gmdate('c',time()-3600),'expires'=>time()+18000,'stale'=>false];
file_put_contents($file,json_encode($cache));file_put_contents($file.'.retry',(string)(time()+300));
check(supplier_detail('tb-123456789',true)['product']['name']==='Bag','Display cache still usable');
denied(fn()=>supplier_order(['product_id'=>'tb-123456789','sku'=>'one','qty'=>1]),409);
unlink($file.'.retry');$lock=fopen(substr($file,0,-5).'.lock','c');flock($lock,LOCK_EX);
denied(fn()=>supplier_order(['product_id'=>'tb-123456789','sku'=>'one','qty'=>1]),409);flock($lock,LOCK_UN);fclose($lock);
// Network-disabled failure must not make the unexpired six-hour fallback orderable.
denied(fn()=>supplier_order(['product_id'=>'tb-123456789','sku'=>'one','qty'=>1]),409);
$cache['fetched']=gmdate('c');file_put_contents($file,json_encode($cache));unlink($file.'.retry');
$before=supplier_budget_status()['used'];check(supplier_order(['product_id'=>'tb-123456789','sku'=>'one','qty'=>1])['unit_cny']==10,'Recent quote can be reused');check(supplier_budget_status()['used']===$before,'Recent checkout consumes no new request');
$cache['fetched']=gmdate('c',time()+100);file_put_contents($file,json_encode($cache));denied(fn()=>supplier_order(['product_id'=>'tb-123456789','sku'=>'one','qty'=>1]),409);
supplier_snapshot_run();$h=supplier_snapshot_health();check($h['last_run']!==null&&$h['cron_overdue']===true&&$h['budget']['limit']===800,'Health reports worker and unconfirmed cron separately');
supplier_snapshot_write(supplier_snapshot_dir().'/cron.json',['last_run'=>time(),'status'=>'fresh']);check(!supplier_snapshot_health()['cron_overdue'],'Cron heartbeat recognized');
echo "PASS performance: atomic budget caps/reserve, rejected attempts unchanged, adaptive cadence, fresh checkout reuse, old/backoff/lock/network/future cache rejection and cron health.\n";
