<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/admin-users.php';
admin_users_schema();$users=[admin_owner_record()];
foreach(db()->query('SELECT * FROM admin_users WHERE active=1')->fetchAll() as $u)$users[]=$u;
$counts=['active_accounts'=>count($users),'missing_mfa'=>0,'password_rotation_required'=>0];
foreach($users as $u){$s=admin_security_status($u);$counts['missing_mfa']+=(int)$s['mfa_setup_required'];$counts['password_rotation_required']+=(int)$s['password_change_required'];}
echo json_encode(['checked_at'=>gmdate('c'),'enforced'=>admin_security_enforced(),'accounts'=>$counts,
    'account_enrollment_ready'=>$counts['missing_mfa']===0 && $counts['password_rotation_required']===0,
    'hosting_network_controls'=>'requires provider evidence','incident_response_exercise'=>'requires documented execution',
    'amazon_approval'=>'not assessed'],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL;
