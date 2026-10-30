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
try{taoworld_http('/purchase/order/create',[]);throw new RuntimeException('Purchase endpoint not blocked');}catch(ApiError $e){if($e->getCode()!==403)throw $e;}
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
try{taoworld_http('/auth/token/create',['code'=>'synthetic']);throw new RuntimeException('Test network bypass');}catch(ApiError $e){if($e->getCode()!==503)throw $e;}
echo "PASS: official HMAC vector, parameter ordering, sign exclusion, purchase denial and test network guard.\n";
