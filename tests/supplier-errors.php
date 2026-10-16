<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/supplier-errors-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/shipping.php';require __DIR__.'/../server/supplier.php';
function expect_error(callable $call,int $status):void {
    try{$call();}catch(ApiError $e){if($e->getCode()===$status)return;throw $e;}
    throw new RuntimeException('Expected HTTP '.$status);
}
$path='/v1/taobao/product/679802138588';$missing='{"error":"not_found","reason":"Product not found."}';
expect_error(fn()=>supplier_response($path,true,404,$missing),404);
expect_error(fn()=>supplier_response('/v1/alibaba1688/product/123456789',true,404,$missing),404);
foreach([[false,0,''],[true,502,'<html>Gateway error</html>'],[true,401,'{"error":"unauthorized"}'],[true,404,'{}'],[true,200,'{"ErrorCode":"AccessDenied"}']] as [$ok,$status,$raw])expect_error(fn()=>supplier_response($path,$ok,$status,$raw),503);
expect_error(fn()=>supplier_response('/v1/taobao/search',true,404,$missing),503);
$result=['Item'=>['Id'=>'679802138588']];
if(supplier_response($path,true,200,json_encode(['ErrorCode'=>'Ok','Result'=>$result]))!==$result)throw new RuntimeException('Valid response changed');
$dir=config()['data_dir'].'/supplier-cache';mkdir($dir,0700,true);
$file=$dir.'/'.supplier_cache_key($path,['language'=>'mn']).'.json';
$cached=['data'=>$result,'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false];file_put_contents($file,json_encode($cached));
file_put_contents($file.'.missing',(string)(time()+300));
// Repeated browsing and order validation preserve 404 without spending API calls,
// even if an older cached price exists.
foreach([true,false] as $display)for($i=0;$i<2;$i++)expect_error(fn()=>supplier_request($path,['language'=>'mn'],$display),404);
file_put_contents($file.'.missing',(string)(time()-1));
if(supplier_request($path,['language'=>'mn'],true)['data']!==$result)throw new RuntimeException('Expired missing marker prevents recovery');
echo "PASS: provider 404 classification, transient/auth failures, negative cache, order protection and recovery.\n";
function seed_limit(string $key,int $hits):void {
    db()->prepare('INSERT OR REPLACE INTO limits (key,hits,expires) VALUES (?,?,?)')->execute([hash('sha256',$key),$hits,time()+3600]);
}
$_SERVER['REMOTE_ADDR']='192.0.2.1';
seed_limit('supplier-ip:192.0.2.1',10);
supplier_limits(false); // The old ten-per-hour restriction no longer blocks normal browsing.
seed_limit('supplier-ip:192.0.2.1',120);
$cold='/v1/taobao/product/999999999';$coldFile=$dir.'/'.supplier_cache_key($cold,['language'=>'mn']).'.json';
expect_error(fn()=>supplier_request($cold,['language'=>'mn'],true),429);
if(is_file($coldFile.'.retry'))throw new RuntimeException('One visitor blocked the shared product cache');
// Cached products remain readable even while the visitor is rate-limited.
if(supplier_request($path,['language'=>'mn'],true)['data']!==$result)throw new RuntimeException('Rate limit blocked cached product');
$_SERVER['REMOTE_ADDR']='192.0.2.2';supplier_limits(false);
seed_limit('supplier-ip-minute:192.0.2.2',30);
expect_error(fn()=>supplier_request($cold,['language'=>'mn'],true),429);
if(is_file($coldFile.'.retry'))throw new RuntimeException('Burst limit poisoned the shared cache');
$_SERVER['REMOTE_ADDR']='192.0.2.3';
seed_limit('supplier-budget:'.gmdate('Y-m-d'),shipping_settings()['api_daily_limit']);
expect_error(fn()=>supplier_request($cold,['language'=>'mn'],true),429);
if(is_file($coldFile.'.retry'))throw new RuntimeException('Daily limit disguised as a provider failure');
echo "PASS: normal browsing, per-minute/hour limits, independent visitors, cached reads and no shared cooldown on local 429.\n";
