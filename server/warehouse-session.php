<?php
declare(strict_types=1);
// Device credentials restore short PHP sessions without retaining the manager's password.
const WAREHOUSE_DEVICE_COOKIE='gostore_warehouse_device';
const WAREHOUSE_DEVICE_TTL=90*86400;
function warehouse_device_schema(): void {
    static $ready=false;if($ready)return;
    db()->exec('CREATE TABLE IF NOT EXISTS warehouse_login_devices (token_hash TEXT PRIMARY KEY, location TEXT NOT NULL, account_version TEXT NOT NULL, csrf TEXT NOT NULL, session_hash TEXT NOT NULL, expires INTEGER NOT NULL, touched INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS warehouse_login_devices_expires ON warehouse_login_devices(expires);');$ready=true;
}
function warehouse_device_token(): string {
    $value=$_COOKIE[WAREHOUSE_DEVICE_COOKIE]??'';
    return is_string($value)&&preg_match('/^[a-f0-9]{64}$/D',$value)?$value:'';
}
function warehouse_device_cookie(string $value,int $expires): void {
    setcookie(WAREHOUSE_DEVICE_COOKIE,$value,['expires'=>$expires,'path'=>'/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Lax']);
    if($value==='')unset($_COOKIE[WAREHOUSE_DEVICE_COOKIE]);else $_COOKIE[WAREHOUSE_DEVICE_COOKIE]=$value;
}
function warehouse_device_forget(): void {
    warehouse_device_schema();$hash=warehouse_device_token();$hash=$hash!==''?hash('sha256',$hash):($_SESSION['warehouse_device_hash']??'');
    if($hash!=='')db()->prepare('DELETE FROM warehouse_login_devices WHERE token_hash=?')->execute([$hash]);
    unset($_SESSION['warehouse_device_hash']);warehouse_device_cookie('',time()-3600);
}
function warehouse_device_issue(): void {
    if(!warehouse_authenticated())return;
    warehouse_device_forget();$token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);$now=time();
    db()->prepare('DELETE FROM warehouse_login_devices WHERE expires<=?')->execute([$now]);
    db()->prepare('INSERT INTO warehouse_login_devices VALUES (?,?,?,?,?,?,?)')->execute([$hash,warehouse_session_location(),$_SESSION['warehouse_version'],$_SESSION['csrf'],hash('sha256',session_id()),$now+WAREHOUSE_DEVICE_TTL,$now]);
    $_SESSION['warehouse_device_hash']=$hash;warehouse_device_cookie($token,$now+WAREHOUSE_DEVICE_TTL);
}
function warehouse_device_resume(): void {
    $token=warehouse_device_token();
    if($token===''){
        if(isset($_SESSION['warehouse_device_hash'])){unset($_SESSION['warehouse_version'],$_SESSION['warehouse_location'],$_SESSION['warehouse_device_hash']);return;}
        // Existing signed-in managers are enrolled without another password prompt.
        if(warehouse_authenticated())warehouse_device_issue();
        elseif(isset($_COOKIE[WAREHOUSE_DEVICE_COOKIE]))warehouse_device_cookie('',time()-3600);
        return;
    }
    warehouse_device_schema();$hash=hash('sha256',$token);
    $s=db()->prepare('SELECT * FROM warehouse_login_devices WHERE token_hash=?');$s->execute([$hash]);$device=$s->fetch();$s->closeCursor();
    $definition=$device?(warehouse_definitions()[$device['location']]??null):null;
    $account=$definition?warehouse_account($device['location']):null;
    if(!$device||$device['expires']<=time()||empty($definition['active'])||empty($account['enabled'])||!hash_equals($account['version'],$device['account_version'])){
        warehouse_device_forget();
        unset($_SESSION['warehouse_version'],$_SESSION['warehouse_location']);
        return;
    }
    if(warehouse_authenticated()){
        if(warehouse_session_location()!==$device['location']||!hash_equals($_SESSION['warehouse_version'],$device['account_version'])){warehouse_device_issue();return;}
    }else{
        session_regenerate_id(true);
        $_SESSION['warehouse_location']=$device['location'];$_SESSION['warehouse_version']=$device['account_version'];
        // Preserve the device's CSRF value so a form left idle remains usable after PHP GC.
        $_SESSION['csrf']=$device['csrf'];
    }
    $_SESSION['warehouse_device_hash']=$hash;
    $sessionHash=hash('sha256',session_id());
    if(!hash_equals($device['session_hash'],$sessionHash)){
        // Keep logout capable of revoking this device's existing push subscription.
        warehouse_notice_schema(db());
        db()->prepare('UPDATE warehouse_push_devices SET session_hash=? WHERE session_hash=? AND location=? AND account_version=?')->execute([$sessionHash,$device['session_hash'],$device['location'],$device['account_version']]);
        db()->prepare('UPDATE warehouse_login_devices SET session_hash=? WHERE token_hash=?')->execute([$sessionHash,$hash]);
    }
    if($device['touched']<=time()-86400){
        $now=time();db()->prepare('UPDATE warehouse_login_devices SET touched=?,expires=? WHERE token_hash=?')->execute([$now,$now+WAREHOUSE_DEVICE_TTL,$hash]);warehouse_device_cookie($token,$now+WAREHOUSE_DEVICE_TTL);
    }
}
