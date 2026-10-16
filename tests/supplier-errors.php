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
