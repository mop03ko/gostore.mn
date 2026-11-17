<?php
declare(strict_types=1);
$dir=__DIR__.'/../tmp/admin-security-'.bin2hex(random_bytes(8));mkdir($dir,0700,true);putenv('GOSTORE_DATA_DIR='.$dir);
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/admin-users.php';
function check(bool $ok,string $why): void{if(!$ok)throw new RuntimeException($why);}
function denied(callable $f,int $status): void{try{$f();}catch(ApiError $e){check($e->getCode()===$status,'Wrong status');return;}throw new RuntimeException('Expected refusal');}
session_start();admin_users_schema();$now=time();
$hash=password_hash('Strong-Password-2026',PASSWORD_BCRYPT);
db()->prepare('INSERT INTO admin_users (id,email,name,role,password_hash,created,updated) VALUES (?,?,?,?,?,?,?)')->execute(['test','test@example.invalid','Test','operator',$hash,gmdate('c'),gmdate('c')]);
$u=admin_staff('test');$_SESSION['admin']=true;$_SESSION['admin_user']='test';$_SESSION['admin_version']=admin_session_version($u);
putenv('GOSTORE_ADMIN_SECURITY_ENFORCED=1');
$s=admin_security_status($u);check($s['restricted']&&$s['password_change_required']&&$s['mfa_setup_required'],'Legacy account must enroll');
denied(fn()=>admin_security_guard('dashboard','GET'),428);
admin_security_guard('session','GET');admin_security_guard('admin-password-change','POST');admin_security_guard('admin-totp-setup','POST');
denied(fn()=>admin_security_guard('admin-password-change','GET'),428);
denied(fn()=>admin_security_guard('shipping-save','POST'),428);
admin_security_password_record($u,$now);check(!admin_security_status($u,$now)['password_change_required'],'Fresh password');
check(admin_security_status($u,$now+365*86400)['password_change_required'],'Exact expiry');
check(!admin_security_status($u,$now+365*86400-1)['password_change_required'],'Before expiry');
$changed=$u;$changed['password_hash']=password_hash('Another-Password-2026',PASSWORD_BCRYPT);
check(admin_security_status($changed,$now)['password_change_required'],'Unrecorded replacement must not reuse old age');
admin_security_password_record($u,$now+100);check(admin_security_status($u,$now)['password_change_required'],'Future record rejected');admin_security_password_record($u,$now);
denied(fn()=>admin_password_rules('abcdefghijklmnop','abcdefghijklmnop'),400);
denied(fn()=>admin_password_rules('abcdefghijklmnop ','abcdefghijklmnop '),400);
admin_password_rules('Strong-Password-2026','Strong-Password-2026');
$secret=totp_secret_new();$oldVersion=admin_session_version($u);admin_totp_store($u,$secret);$u=admin_staff('test');
check($oldVersion!==admin_session_version($u),'MFA enrollment invalidates prior sessions');
$_SESSION['admin_version']=admin_session_version($u);
check(admin_security_status($u)['mfa_reauthentication_required'],'A session without MFA proof is restricted');
$_SESSION['admin_mfa']=hash('sha256',$secret);
check(!admin_security_status($u)['restricted'],'Enrolled account is ready');admin_security_guard('dashboard','GET');
denied(fn()=>admin_totp_post('admin-totp-disable',[]),403);
$_GET['action']='dashboard';$_SERVER['REQUEST_METHOD']='GET';admin_required();
admin_security_password_record($u,$now-365*86400);denied(fn()=>admin_required(),428);
$_GET['action']='session';denied(fn()=>admin_required(),428); // Query-string spoof on a standalone endpoint.
putenv('GOSTORE_ADMIN_SECURITY_ENFORCED=0');check(!admin_security_status($u)['restricted'],'Staged rollout remains available');admin_required();
check(!str_contains(json_encode(admin_current_public()),$secret),'Public policy state never exposes MFA secret');
echo "admin-security: expiry, MFA binding, safe enrollment, password rules, direct guards passed\n";
