<?php
declare(strict_types=1);

function sendsms_settings(): array {
    $file=__DIR__.'/sendsms.env';$values=[];
    if(is_file($file)&&filesize($file)<4096){
        foreach(file($file,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) as $line){
            if(preg_match('/^(SENDSMS_(?:API_KEY|API_TOKEN|ENABLED|ORDER_EVENTS|OTP_ENABLED|TYPE))=([A-Za-z0-9_.-]+)$/D',trim($line),$m))$values[$m[1]]=$m[2];
        }
    }
    $get=static function(string $key,string $default='')use($values):string{$v=getenv($key);return $v===false?($values[$key]??$default):$v;};
    return ['key'=>$get('SENDSMS_API_KEY'),'token'=>$get('SENDSMS_API_TOKEN'),'enabled'=>$get('SENDSMS_ENABLED')==='1','orders'=>$get('SENDSMS_ORDER_EVENTS')==='1','otp'=>$get('SENDSMS_OTP_ENABLED')==='1','type'=>$get('SENDSMS_TYPE','standard')];
}
function sendsms_enabled(string $feature): bool {
    $s=sendsms_settings();return $s['enabled']&&$s['key']!==''&&$s['token']!==''&&($s[$feature]??false)===true;
}
function sendsms_phone(string $phone): string {
    $phone=preg_replace('/[ ()-]/','',trim($phone));
    if(preg_match('/^(?:\+?976)?([0-9]{8})$/D',$phone,$m))return $m[1];
    fail('Монголын 8 оронтой утасны дугаараа оруулна уу.');
}
function sendsms_payload(string $phone,string $message): array {
    $s=sendsms_settings();$phone=sendsms_phone($phone);
    $max=preg_match('/[^\x20-\x7E]/',$message)?70:160;
    if(!mb_check_encoding($message,'UTF-8')||trim($message)===''||mb_strlen($message,'UTF-8')>$max||preg_match('/[\x00-\x1F\x7F]/',$message))fail('SMS текстийн урт эсвэл тэмдэгт буруу.');
    if(!$s['enabled']||$s['key']===''||$s['token']===''||!in_array($s['type'],['standard','premium'],true))fail('SMS үйлчилгээ түр боломжгүй байна.',503);
    return ['apiKey'=>$s['key'],'apiToken'=>$s['token'],'phone'=>$phone,'message'=>$message,'type'=>$s['type']];
}
class SendSmsUncertain extends RuntimeException {}
class SendSmsRejected extends RuntimeException {}
// Accepted means queued, never delivered. The provider owns delivery retries.
function sendsms_send(string $phone,string $message): array {
    $body=sendsms_payload($phone,$message);
    if(!function_exists('sendsms_http'))require_once __DIR__.'/sendsms-http.php';
    $r=sendsms_http($body);
    if(($r['status']??null)!==1||($r['data']['queued']??null)!==1)throw new SendSmsUncertain('SMS acceptance unconfirmed');
    return ['queued'=>1,'type'=>$body['type'],'cost'=>is_numeric($r['data']['totalCost']??null)?(int)$r['data']['totalCost']:null];
}
