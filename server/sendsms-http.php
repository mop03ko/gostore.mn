<?php
declare(strict_types=1);
// Fixed origin. Never log provider payloads, API credentials, phone numbers or OTPs.
function sendsms_http(array $body): array {
    if(getenv('GOSTORE_DISABLE_SENDSMS')==='1'||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')throw new SendSmsRejected('SMS network disabled');
    $ch=curl_init('https://api.sendsms.mn/api/user/send');$raw='';
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Accept: application/json'],CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>65536)return 0;$raw.=$chunk;return strlen($chunk);}]);
    $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($ok!==false&&in_array($status,[400,401,403,422,429],true))throw new SendSmsRejected('SMS request rejected');
    if($ok===false||$status<200||$status>=300)throw new SendSmsUncertain('SMS response unavailable');
    $data=json_decode($raw,true);if(!is_array($data))throw new SendSmsUncertain('SMS response invalid');return $data;
}
