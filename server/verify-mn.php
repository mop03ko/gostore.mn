<?php
declare(strict_types=1);
// Shared hosting may not allow Apache SetEnv. Load only this named variable from
// a server-only dotenv file; server/.htaccess denies all HTTP access to this folder.
function verify_mn_environment(): string {
    $value=getenv('VERIFY_MN_API_KEY');
    if($value===false){
        $path=__DIR__.'/verify-mn.env';
        if(is_file($path)&&filesize($path)<=1024){
            $line=trim((string)file_get_contents($path));
            if(preg_match('/^VERIFY_MN_API_KEY=([A-Za-z0-9_.-]{16,256})$/D',$line,$m)){
                putenv('VERIFY_MN_API_KEY='.$m[1]);$value=getenv('VERIFY_MN_API_KEY');
            }
        }
    }
    return trim((string)$value);
}
function verify_mn_key(): string {
    $key=verify_mn_environment();
    if($key===''||preg_match('/[\r\n]/',$key))fail('Утас баталгаажуулах үйлчилгээ тохируулагдаагүй байна.',503);
    return $key;
}
function verify_mn_phone(string $phone): string {
    $phone=preg_replace('/[ ()-]/','',trim($phone));
    if(preg_match('/^(?:\+?976)?([0-9]{8})$/D',$phone,$m))return $m[1];
    fail('Монголын 8 оронтой утасны дугаараа оруулна уу.');
}
function verify_mn_expiry($value): int {
    $at=is_string($value)?strtotime($value):false;
    if($at===false)fail('Баталгаажуулалтын хариу буруу байна.',503);
    return $at;
}
function verify_mn_start(array $b): array {
    verify_mn_key();$phone=verify_mn_phone(str_field($b,'phone',30));
    limit_attempts('verify-phone-ip:'.($_SERVER['REMOTE_ADDR']??''),10,3600);
    limit_attempts('verify-phone-number:'.$phone,5,3600);
    unset($_SESSION['phone_verification'],$_SESSION['phone_verified']);
    $text='GOStore '.strtoupper(bin2hex(random_bytes(8)));
    // Polling is sufficient; no unsigned callback or carrier reply is trusted.
    $r=verify_mn_http('POST','/sessions',['phone'=>$phone,'text'=>$text]);
    $id=$r['sessionId']??null;$expires=verify_mn_expiry($r['expiresAt']??null);
    if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{1,200}$/D',$id)||($r['shortcode']??null)!=='144773'||($r['text']??null)!==$text||verify_mn_phone((string)($r['phone']??''))!==$phone||!is_string($r['displayInstruction']??null)||trim($r['displayInstruction'])===''||strlen($r['displayInstruction'])>4000||$expires<=time()||$expires>time()+310)fail('Баталгаажуулалтын хариу буруу байна.',503);
    $expires=min($expires,time()+300);$challenge=bin2hex(random_bytes(24));
    $_SESSION['phone_verification']=['challenge'=>$challenge,'session_id'=>$id,'phone'=>$phone,'expires'=>$expires,'status'=>'PENDING','checked'=>0,'customer'=>$_SESSION['customer_id']??null];
    // Build an equivalent URI from validated fields instead of accepting an arbitrary provider URL.
    return ['challenge'=>$challenge,'phone'=>$phone,'shortcode'=>'144773','text'=>$text,'smsUri'=>'sms:144773?body='.rawurlencode($text),'displayInstruction'=>$r['displayInstruction'],'expiresAt'=>gmdate('c',$expires),'remainingSeconds'=>max(0,$expires-time())];
}
function verify_mn_status(array $b): array {
    $challenge=str_field($b,'challenge',48);$s=$_SESSION['phone_verification']??null;
    if(!$s||!hash_equals($s['challenge'],$challenge)||$s['customer']!==($_SESSION['customer_id']??null))fail('Баталгаажуулалт олдсонгүй. Дахин эхлүүлнэ үү.',404);
    if($s['expires']<=time()){$s['status']='EXPIRED';unset($_SESSION['phone_verified']);}
    elseif($s['status']==='PENDING'&&$s['checked']<=time()-3){
        $_SESSION['phone_verification']['checked']=time();
        $r=verify_mn_http('GET','/sessions/'.rawurlencode($s['session_id']));
        if(($r['sessionId']??null)!==$s['session_id']||!in_array($r['sessionStatus']??null,['PENDING','VERIFIED','EXPIRED'],true))fail('Баталгаажуулалтын хариу буруу байна.',503);
        $s['expires']=min($s['expires'],verify_mn_expiry($r['expiresAt']??null));
        $s['status']=$s['expires']<=time()?'EXPIRED':$r['sessionStatus'];$s['checked']=time();
        if($s['status']==='VERIFIED')$_SESSION['phone_verified']=['phone'=>$s['phone'],'verified_at'=>gmdate('c'),'customer'=>$s['customer']];
    }
    $_SESSION['phone_verification']=$s;
    return ['sessionStatus'=>$s['status'],'phone'=>$s['phone'],'expiresAt'=>gmdate('c',$s['expires'])];
}