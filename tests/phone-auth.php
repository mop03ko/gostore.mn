<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/phone-auth-'.bin2hex(random_bytes(5)));putenv('GOSTORE_PIN_PEPPER='.str_repeat('a',64));
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/customers.php';require __DIR__.'/../server/verify-mn.php';
ini_set('session.use_cookies','0');session_start();$_SERVER['REMOTE_ADDR']='127.0.0.1';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function error(callable $call,int $status):void{try{$call();}catch(ApiError $e){check($e->getCode()===$status,'Wrong status: '.$e->getCode());return;}throw new RuntimeException('Expected HTTP '.$status);}
function proof(string $phone,string $purpose):array{
 $challenge=bin2hex(random_bytes(24));$_SESSION['phone_verification']=['challenge'=>$challenge,'phone'=>$phone,'status'=>'VERIFIED','expires'=>time()+300,'purpose'=>$purpose,'customer'=>$_SESSION['customer_id']??null,'auth_version'=>$_SESSION['customer_version']??null];
 $_SESSION['phone_verified']=['phone'=>$phone,'customer'=>$_SESSION['customer_id']??null,'verified_at'=>gmdate('c')];
 return ['phone'=>$phone,'purpose'=>$purpose,'challenge'=>$challenge,'name'=>'Тест','pin'=>'0123','pin_confirm'=>'0123'];
}
$_SESSION=[];$b=proof('99112233','register');unset($_SESSION['phone_verified']);error(fn()=>pin_auth_setup($b),403);
$b=proof('99112233','register');$_SESSION['phone_verification']['status']='PENDING';error(fn()=>pin_auth_setup($b),403);
$b=proof('99112233','register');$_SESSION['phone_verification']['expires']=time()-1;error(fn()=>pin_auth_setup($b),403);
$b=proof('99112233','verify');$b['purpose']='register';error(fn()=>pin_auth_setup($b),403);
$b=proof('99112233','register');$b['phone']='88112233';error(fn()=>pin_auth_setup($b),403);
foreach(['123','12345','12ab',1234] as $pin)error(fn()=>pin_auth_value(['pin'=>$pin]),400);
$b=proof('99112233','register');$r=pin_auth_setup($b);$id=$r['customer']['id'];$record=pin_auth_record($id);
check($r['customer']['pin_enabled']&&$r['customer']['email']===''&&!$r['customer']['email_login'],'Phone registration public shape');
check($record['phone']==='99112233'&&!password_verify('0123',$record['pin_hash'])&&password_verify(pin_auth_digest('0123'),$record['pin_hash']),'Peppered PIN hash');
check(!isset($_SESSION['phone_verified']),'Proof consumed');error(fn()=>pin_auth_setup($b),403);
$_SESSION=[];$r=pin_auth_login(['phone'=>'+976 99112233','pin'=>'0123']);check($r['customer']['id']===$id,'Leading-zero PIN login');
$old=$_SESSION;pin_auth_change(['current_pin'=>'0123','pin'=>'4567','pin_confirm'=>'4567']);$new=$_SESSION;$_SESSION=$old;check(current_customer()===null,'Change revokes other sessions');$_SESSION=$new;
error(fn()=>pin_auth_login(['phone'=>'99112233','pin'=>'0123']),401);pin_auth_login(['phone'=>'99112233','pin'=>'4567']);
// Never link an unverified legacy phone just because its profile text matches.
$now=gmdate('c');db()->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute(['legacy','legacy@example.test','Legacy','88112233','',password_hash('old-password',PASSWORD_BCRYPT),$now,$now]);
$_SESSION=[];$other=pin_auth_setup(proof('88112233','register'));check($other['customer']['id']!=='legacy','No unverified-phone account takeover');
$_SESSION=[];error(fn()=>pin_auth_setup(proof('88112233','register')),409);
// Explicit linking preserves the existing customer's ID and account data.
customer_sign_in(['id'=>'legacy','auth_version'=>1]);$linked=pin_auth_setup(proof('77112233','link'));check($linked['customer']['id']==='legacy'&&$linked['customer']['email_login'],'Legacy account linked');
error(fn()=>pin_auth_setup(proof('99112233','link')),409);
// Reset requires another phone proof and revokes every earlier authenticated session.
$legacyOld=$_SESSION;$_SESSION=[];$reset=proof('77112233','reset');$reset['pin']=$reset['pin_confirm']='9876';pin_auth_setup($reset);$_SESSION=$legacyOld;check(current_customer()===null,'Reset invalidates old tokens');$_SESSION=[];
error(fn()=>pin_auth_login(['phone'=>'77112233','pin'=>'0123']),401);check(pin_auth_login(['phone'=>'77112233','pin'=>'9876'])['customer']['id']==='legacy','SMS reset');
// A revoked account session cannot use an earlier link proof.
$stale=proof('66112233','link');db()->prepare('UPDATE customers SET auth_version=auth_version+1 WHERE id=?')->execute(['legacy']);error(fn()=>pin_auth_setup($stale),403);
$_SESSION=[];for($i=0;$i<5;$i++)error(fn()=>pin_auth_login(['phone'=>'99112233','pin'=>'0000']),401);error(fn()=>pin_auth_login(['phone'=>'99112233','pin'=>'4567']),429);
$_SESSION=[];error(fn()=>pin_auth_setup(proof('66112233','reset')),404);
echo "PASS phone auth: proof/purpose/TTL binding, replay, PIN hashing, legacy isolation/linking, reset, revocation and guessing limits.\n";