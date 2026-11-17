<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/sms-otp-'.bin2hex(random_bytes(6)));putenv('GOSTORE_PIN_PEPPER='.str_repeat('a',64));
foreach(['SENDSMS_ENABLED=1','SENDSMS_ORDER_EVENTS=0','SENDSMS_OTP_ENABLED=1','SENDSMS_API_KEY=fake-key','SENDSMS_API_TOKEN=fake-token','SENDSMS_TYPE=standard'] as $v)putenv($v);
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/customers.php';require __DIR__.'/../server/verify-mn.php';require __DIR__.'/../server/sms-otp.php';
ini_set('session.use_cookies','0');session_start();$_SERVER['REMOTE_ADDR']='127.0.0.1';
$sent=[];$mode='ok';
function sendsms_http(array $body):array{global $sent,$mode;$sent[]=$body;if($mode==='unknown')throw new SendSmsUncertain('timeout');if($mode==='fail')throw new SendSmsRejected('no balance');return ['status'=>1,'data'=>['queued'=>1,'totalCost'=>20]];}
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function denied(callable $f,int $status):void{try{$f();}catch(ApiError $e){check($e->getCode()===$status,'Unexpected status '.$e->getCode());return;}throw new RuntimeException('Expected rejection');}
function last_code():string{global $sent;preg_match('/kod: ([0-9]{6})/D',$sent[array_key_last($sent)]['message'],$m);return $m[1];}
$r=sms_otp_start(['phone'=>'99112233','purpose'=>'register']);$code=last_code();
check($r['delivery']==='otp'&&!str_contains(json_encode($r),$code)&&!str_contains(json_encode($_SESSION),$code),'OTP is never exposed in API or stored plaintext');
check(sms_otp_status(['challenge'=>$r['challenge']])['sessionStatus']==='PENDING'&&!isset($_SESSION['phone_verified']),'Queued is not verified');
denied(fn()=>pin_auth_setup(['phone'=>$r['phone'],'purpose'=>'register','challenge'=>$r['challenge'],'pin'=>'0123','pin_confirm'=>'0123','name'=>'Test']),403);
denied(fn()=>sms_otp_start(['phone'=>'99112233','purpose'=>'register']),429);check(count($sent)===1,'Throttle before billing');
$saved=$_SESSION;$_SESSION=[];denied(fn()=>sms_otp_status(['challenge'=>$r['challenge'],'code'=>$code]),404);$_SESSION=$saved;
denied(fn()=>sms_otp_status(['challenge'=>$r['challenge'],'code'=>$code==='000000'?'111111':'000000']),400);
check(sms_otp_status(['challenge'=>$r['challenge'],'code'=>$code])['sessionStatus']==='VERIFIED','Correct OTP');
$customer=pin_auth_setup(['phone'=>$r['phone'],'purpose'=>'register','challenge'=>$r['challenge'],'pin'=>'0123','pin_confirm'=>'0123','name'=>'Test']);
check($customer['customer']['pin_enabled']&&!isset($_SESSION['phone_verification']),'Verified proof consumed after PIN setup');
denied(fn()=>sms_otp_status(['challenge'=>$r['challenge'],'code'=>$code]),404);
$_SESSION=[];check(pin_auth_login(['phone'=>'99112233','pin'=>'0123'])['customer']['id']===$customer['customer']['id'],'PIN login after outbound OTP');
$oldSession=$_SESSION;
db()->prepare('DELETE FROM limits WHERE key=?')->execute([hash('sha256','sms-otp-phone-minute:99112233')]);
$_SESSION=[];$reset=sms_otp_start(['phone'=>'99112233','purpose'=>'reset']);sms_otp_status(['challenge'=>$reset['challenge'],'code'=>last_code()]);
pin_auth_setup(['phone'=>'99112233','purpose'=>'reset','challenge'=>$reset['challenge'],'pin'=>'4567','pin_confirm'=>'4567']);
$_SESSION=$oldSession;check(current_customer()===null,'OTP PIN reset revokes old login');
$_SESSION=[];denied(fn()=>pin_auth_login(['phone'=>'99112233','pin'=>'0123']),401);check(pin_auth_login(['phone'=>'99112233','pin'=>'4567'])['customer']['id']===$customer['customer']['id'],'New PIN login after reset');
$_SESSION=[];$r=sms_otp_start(['phone'=>'88112233','purpose'=>'reset']);$wrong=last_code()==='000000'?'111111':'000000';
for($i=0;$i<5;$i++)denied(fn()=>sms_otp_status(['challenge'=>$r['challenge'],'code'=>$wrong]),$i===4?429:400);
check(sms_otp_status(['challenge'=>$r['challenge'],'code'=>last_code()])['sessionStatus']==='EXPIRED','Five attempts lock challenge');
$r=sms_otp_start(['phone'=>'77112233','purpose'=>'verify']);$_SESSION['phone_verification']['expires']=time()-1;check(sms_otp_status(['challenge'=>$r['challenge'],'code'=>last_code()])['sessionStatus']==='EXPIRED','Expiry fails closed');
$mode='unknown';$r=sms_otp_start(['phone'=>'99112234','purpose'=>'verify']);check($r['deliveryUncertain']===true&&sms_otp_status(['challenge'=>$r['challenge']])['sessionStatus']==='PENDING','Uncertain SMS not auto-verified or resent');
check(sms_otp_status(['challenge'=>$r['challenge'],'code'=>last_code()])['sessionStatus']==='VERIFIED','A delayed code can still verify');
$mode='fail';denied(fn()=>sms_otp_start(['phone'=>'99112235']),503);check(!isset($_SESSION['phone_verification'],$_SESSION['phone_verified']),'Rejected send leaves no proof');
check((int)db()->query('SELECT count(*) FROM sms_otp_usage')->fetchColumn()===count($sent),'Every outbound attempt counted once; throttled requests excluded');
check((int)db()->query('SELECT count(*) FROM sms_otp_usage WHERE verified_at IS NOT NULL')->fetchColumn()===3,'Only correct OTPs counted verified');
check((int)db()->query('SELECT count(*) FROM sms_otp_usage WHERE state="failed"')->fetchColumn()===1,'Rejected provider attempt tracked');
check((int)db()->query('SELECT count(*) FROM sms_otp_usage WHERE state="uncertain"')->fetchColumn()===1,'Uncertain provider attempt tracked even if OTP later verified');
check(!str_contains(json_encode(db()->query('SELECT * FROM sms_otp_usage')->fetchAll()),'99112233'),'Usage stores only masked numbers');
echo "PASS SMS OTP: hashed code, 5-minute expiry, five guesses, cooldown, session binding, explicit confirmation, proof consumption, PIN setup/login, rejected and uncertain responses.\n";
