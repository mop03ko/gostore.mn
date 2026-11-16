<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/verify-retired-'.bin2hex(random_bytes(6)));
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/verify-mn.php';require __DIR__.'/../server/verify-mn-http.php';require __DIR__.'/../server/sms-otp.php';
function rejected(callable $f,int $status):void{try{$f();}catch(ApiError $e){if($e->getCode()===$status)return;throw $e;}throw new RuntimeException('Expected rejection');}
putenv('VERIFY_MN_API_KEY=even-a-configured-key-cannot-reactivate');
if(verify_mn_environment()!==''||verify_mn_phone('+976 9911-2233')!=='99112233')throw new RuntimeException('Retired provider or phone compatibility');
rejected(fn()=>verify_mn_key(),410);rejected(fn()=>verify_mn_start(['phone'=>'99112233']),426);rejected(fn()=>verify_mn_status([]),410);
rejected(fn()=>verify_mn_http('POST','/sessions',[]),410);rejected(fn()=>verify_mn_http('GET','/sessions/old'),410);
rejected(fn()=>sms_verification_start(['phone'=>'99112233']),426);
putenv('SENDSMS_ENABLED=0');rejected(fn()=>sms_verification_start(['phone'=>'99112233','delivery'=>'otp']),503);
$_SESSION=['phone_verification'=>['provider'=>'verify-mn','challenge'=>str_repeat('a',48)]];
rejected(fn()=>sms_otp_status(['challenge'=>str_repeat('a',48)]),404);
echo "PASS retired verify.mn: no keys/transport/fallback; old clients fail before billing; old sessions cannot poll.\n";
