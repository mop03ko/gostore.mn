<?php
declare(strict_types=1);

// Explicit rollout switch: enable only after testing account recovery and owner enrollment.
function admin_security_enforced(): bool {
    return getenv('GOSTORE_ADMIN_SECURITY_ENFORCED') === '1' || (config()['admin_security_enforced'] ?? false) === true;
}
function admin_security_password_record(array $u, ?int $now=null): void {
    admin_meta_put('admin_password_policy:'.$u['id'], ['hash'=>hash('sha256',$u['password_hash']), 'changed_at'=>$now??time()]);
}
function admin_security_status(array $u, ?int $now=null): array {
    $now??=time();$p=admin_meta('admin_password_policy:'.$u['id']);
    $known=isset($p['hash'],$p['changed_at']) && is_int($p['changed_at']) && $p['changed_at']>0 && $p['changed_at']<=$now
        && hash_equals(hash('sha256',$u['password_hash']),(string)$p['hash']);
    $expires=$known?$p['changed_at']+365*86400:null;
    $passwordRequired=!$known || $now >= $expires;
    $mfaRequired=empty($u['totp_secret']);
    $reauthRequired=!$mfaRequired && !hash_equals(hash('sha256',$u['totp_secret']),(string)($_SESSION['admin_mfa']??''));
    $enforced=admin_security_enforced();
    return ['enforced'=>$enforced,'password_change_required'=>$passwordRequired,'password_expires_at'=>$expires,
        'mfa_setup_required'=>$mfaRequired,'mfa_reauthentication_required'=>$reauthRequired,
        'restricted'=>$enforced && ($passwordRequired || $mfaRequired || $reauthRequired)];
}
function admin_security_guard(string $action, string $method): void {
    if(!admin_security_enforced())return;
    $u=admin_current();if(!$u)return;
    if($method==='GET' && $action==='session')return;
    if($method==='POST' && in_array($action,['logout','admin-password-change','admin-totp-setup','admin-totp-enable'],true))return;
    if(admin_security_status($u)['restricted'])fail('Админы хамгаалалтыг бүрэн тохируулна уу: нууц үгээ шинэчилж, хоёр алхмын баталгаажуулалтаар нэвтэрнэ үү.',428);
}
