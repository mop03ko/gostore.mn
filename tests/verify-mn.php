<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/verify-mn-'.bin2hex(random_bytes(5)));
putenv('VERIFY_MN_API_KEY=test-only-key');
require __DIR__.'/../server/bootstrap.php';
require __DIR__.'/../server/verify-mn.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function error(callable $call,int $status):void{try{$call();}catch(ApiError $e){check($e->getCode()===$status,'Wrong HTTP status');return;}throw new RuntimeException('Expected error');}
$calls=[];$response=[];
function verify_mn_http(string $method,string $path,?array $body=null):array{
    global $calls,$response;$calls[]=[$method,$path,$body];
    if($method==='POST')return ['sessionId'=>'provider-session-1','phone'=>$body['phone'],'text'=>$body['text'],'shortcode'=>'144773','displayInstruction'=>'SMS илгээнэ үү.','expiresAt'=>gmdate('c',time()+300)];
    if($response instanceof Throwable)throw $response;
    return $response;
}
$_SESSION=['customer_id'=>'c1'];$_SERVER['REMOTE_ADDR']='127.0.0.1';
check(verify_mn_phone('+976 9911-2233')==='99112233','Normalize Mongolia phone');
foreach(['+8612345678901','9911223','abcdefgh','99112233<script>'] as $p)error(fn()=>verify_mn_phone($p),400);
putenv('VERIFY_MN_API_KEY');error(fn()=>verify_mn_start(['phone'=>'99112233']),503);putenv('VERIFY_MN_API_KEY=test-only-key');
$r=verify_mn_start(['phone'=>'+976 99112233']);
check($calls[0][0]==='POST'&&$calls[0][1]==='/sessions','Create endpoint');
check(array_keys($calls[0][2])===['phone','text'],'No callback or responseSms');
check(!isset($r['sessionId'])&&!str_contains(json_encode($r),'test-only-key'),'No provider identifier/key leak');
check($r['smsUri']==='sms:144773?body='.rawurlencode($r['text']),'Safe SMS URI');
error(fn()=>verify_mn_status(['challenge'=>str_repeat('0',48)]),404);
$owner=$_SESSION;$_SESSION['customer_id']='c2';error(fn()=>verify_mn_status(['challenge'=>$r['challenge']]),404);$_SESSION=$owner;
$response=['sessionId'=>'provider-session-1','sessionStatus'=>'PENDING','callbackStatus'=>'SENT','verifiedAt'=>gmdate('c'),'expiresAt'=>gmdate('c',time()+300)];
check(verify_mn_status(['challenge'=>$r['challenge']])['sessionStatus']==='PENDING'&&!isset($_SESSION['phone_verified']),'Callback/reply not proof');
$count=count($calls);verify_mn_status(['challenge'=>$r['challenge']]);check(count($calls)===$count,'Throttle polling');
$_SESSION['phone_verification']['checked']=0;$response['sessionId']='other';error(fn()=>verify_mn_status(['challenge'=>$r['challenge']]),503);
$_SESSION['phone_verification']['checked']=0;$response['sessionId']='provider-session-1';$response['sessionStatus']='UNKNOWN';error(fn()=>verify_mn_status(['challenge'=>$r['challenge']]),503);
$_SESSION['phone_verification']['checked']=0;$response=new ApiError('temporary',503);error(fn()=>verify_mn_status(['challenge'=>$r['challenge']]),503);check(!isset($_SESSION['phone_verified']),'Network fail closed');
$_SESSION['phone_verification']['checked']=0;$response=['sessionId'=>'provider-session-1','sessionStatus'=>'VERIFIED','expiresAt'=>gmdate('c',time()+300)];
check(verify_mn_status(['challenge'=>$r['challenge']])['sessionStatus']==='VERIFIED','Explicit provider confirmation');check($_SESSION['phone_verified']['phone']==='99112233','Proof bound to phone');
$first=$r;$r=verify_mn_start(['phone'=>'88112233']);check(!isset($_SESSION['phone_verified']),'New challenge clears proof');error(fn()=>verify_mn_status(['challenge'=>$first['challenge']]),404);
$_SESSION['phone_verification']['expires']=time()-1;$count=count($calls);check(verify_mn_status(['challenge'=>$r['challenge']])['sessionStatus']==='EXPIRED'&&count($calls)===$count,'Local TTL prevents late approval');
$r=verify_mn_start(['phone'=>'88112233']);$response['expiresAt']=gmdate('c',time()-1);check(verify_mn_status(['challenge'=>$r['challenge']])['sessionStatus']==='EXPIRED','Provider expiry prevents approval');
for($i=0;$i<4;$i++)verify_mn_start(['phone'=>'99112233']);error(fn()=>verify_mn_start(['phone'=>'99112233']),429);
echo "PASS verify.mn state machine: ownership, exact confirmation, polling, expiry, errors, rate limit.\n";