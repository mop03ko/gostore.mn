<?php
declare(strict_types=1);
class ApiError extends RuntimeException {}
function fail(string $message,int $status=400): never{throw new ApiError($message,$status);}
require __DIR__.'/../server/taoworld-http.php';
$p=['app_key'=>'123456','access_token'=>'test','timestamp'=>'1517820392000','sign_method'=>'sha256','order_id'=>'1234'];
// Official Alibaba development manual's published signature vector.
$expected='4190D32361CFB9581350222F345CB77F3B19F0E31D162316848A2C1FFD5FAB4A';
if(taoworld_signature('/order/get',$p,'helloworld')!==$expected)throw new RuntimeException('Official signing vector failed');
if(taoworld_signature('/order/get',array_reverse($p,true)+['sign'=>'ignored'],'helloworld')!==$expected)throw new RuntimeException('Sorting/sign exclusion failed');
try{taoworld_http('/purchase/order/cancel',[]);throw new RuntimeException('Unlisted endpoint not blocked');}catch(ApiError $e){if($e->getCode()!==403)throw $e;}
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
try{taoworld_http('/auth/token/create',['code'=>'synthetic']);throw new RuntimeException('Test network bypass');}catch(ApiError $e){if($e->getCode()!==503)throw $e;}
try{taoworld_http_search_batch([['keyword'=>'test']]);throw new RuntimeException('Batch network bypass');}catch(ApiError $e){if($e->getCode()!==503)throw $e;}
try{taoworld_http_search_batch(array_fill(0,4,[]));throw new RuntimeException('Unbounded batch');}catch(ApiError $e){if($e->getCode()!==400)throw $e;}
$decoded=taoworld_http_response(true,200,'{"code":"0","data":{"sku_id":999999999999999999999}}');if($decoded['data']['sku_id']!=='999999999999999999999')throw new RuntimeException('Long ID truncated');
foreach([[false,200,'{"code":"0"}'],[true,500,'private'],[true,200,'{"code":"Denied","message":"private"}']] as $case){try{taoworld_http_response(...$case);throw new RuntimeException('Bad transport response accepted');}catch(ApiError $e){if($e->getCode()!==502||str_contains($e->getMessage(),'private'))throw $e;}}
echo "PASS: official HMAC vector, parameter ordering, sign exclusion, endpoint allowlist and test network guard.\n";
