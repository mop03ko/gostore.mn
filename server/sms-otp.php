<?php
declare(strict_types=1);
require_once __DIR__.'/sendsms.php';
function sms_otp_start(array $b): array {
    if(!sendsms_enabled('otp'))fail('SMS код илгээх үйлчилгээ түр боломжгүй.',503);
    $purpose=$b['purpose']??'verify';if(!in_array($purpose,['verify','register','reset','link'],true))fail('Баталгаажуулалтын төрөл буруу.');
    if($purpose==='link')customer_required();$secret=pin_auth_secret();$phone=sendsms_phone(str_field($b,'phone',30));
    limit_attempts('sms-otp-phone-minute:'.$phone,1,60);
    limit_attempts('sms-otp-phone-hour:'.$phone,5,3600);
    limit_attempts('sms-otp-phone-day:'.$phone,20,86400);
    limit_attempts('sms-otp-ip:'.($_SERVER['REMOTE_ADDR']??''),10,3600);
    // A global spend guard bounds public OTP abuse (at the configured standard tariff).
    limit_attempts('sms-otp-global-day',1000,86400);
    unset($_SESSION['phone_verified'],$_SESSION['phone_verification']);
    $challenge=bin2hex(random_bytes(24));$code=str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);$expires=time()+300;
    $_SESSION['phone_verification']=['provider'=>'sendsms','challenge'=>$challenge,'phone'=>$phone,'status'=>'PENDING','purpose'=>$purpose,'expires'=>$expires,'attempts'=>0,'code_hash'=>hash_hmac('sha256',$challenge.':'.$phone.':'.$code,$secret),'customer'=>$_SESSION['customer_id']??null,'auth_version'=>$_SESSION['customer_version']??null];
    $uncertain=false;
    try{sendsms_send($phone,'GOStore kod: '.$code.'. 5 minut huchintei. Kodyg busdad buu damjuul.');}
    catch(SendSmsUncertain $e){$uncertain=true;}
    catch(Throwable $e){unset($_SESSION['phone_verification']);fail('SMS илгээх боломжгүй байна. Түр хүлээгээд дахин оролдоно уу.',503);}
    return ['delivery'=>'otp','challenge'=>$challenge,'phone'=>$phone,'displayInstruction'=>'Таны утсанд ирэх 6 оронтой кодыг оруулна уу.','remainingSeconds'=>300,'expiresAt'=>gmdate('c',$expires),'deliveryUncertain'=>$uncertain];
}
function sms_otp_status(array $b): array {
    $challenge=str_field($b,'challenge',48);$s=$_SESSION['phone_verification']??null;
    if(!$s||($s['provider']??'')!=='sendsms'||!hash_equals($s['challenge'],$challenge)||$s['customer']!==($_SESSION['customer_id']??null)||$s['auth_version']!==($_SESSION['customer_version']??null))fail('Баталгаажуулалт олдсонгүй. Дахин эхлүүлнэ үү.',404);
    if($s['expires']<=time()||($s['status']!=='VERIFIED'&&$s['attempts']>=5)){$s['status']='EXPIRED';unset($s['code_hash'],$_SESSION['phone_verified']);}
    elseif($s['status']==='PENDING'&&array_key_exists('code',$b)){
        $code=$b['code'];if(!is_string($code)||!preg_match('/^[0-9]{6}$/D',$code))fail('6 оронтой кодоо оруулна уу.');
        $s['attempts']++;
        $valid=hash_equals($s['code_hash'],hash_hmac('sha256',$challenge.':'.$s['phone'].':'.$code,pin_auth_secret()));
        if(!$valid){if($s['attempts']>=5){$s['status']='EXPIRED';unset($s['code_hash']);}$_SESSION['phone_verification']=$s;fail($s['status']==='EXPIRED'?'Оролдлогын тоо дууслаа. Дахин код авна уу.':'Код буруу байна.', $s['status']==='EXPIRED'?429:400);}
        $s['status']='VERIFIED';unset($s['code_hash']);
        $_SESSION['phone_verified']=['phone'=>$s['phone'],'customer'=>$s['customer'],'verified_at'=>gmdate('c')];
    }
    $_SESSION['phone_verification']=$s;
    return ['sessionStatus'=>$s['status'],'phone'=>$s['phone'],'expiresAt'=>gmdate('c',$s['expires'])];
}
