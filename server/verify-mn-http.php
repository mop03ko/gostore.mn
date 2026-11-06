<?php
declare(strict_types=1);
// Fixed origin only. Never expose provider bodies or the bearer token in errors/logs.
function verify_mn_http(string $method,string $path,?array $body=null): array {
    if(getenv('GOSTORE_DISABLE_VERIFY_MN')==='1'||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')fail('Утас баталгаажуулах үйлчилгээ түр боломжгүй.',503);
    if(!function_exists('curl_init'))fail('Утас баталгаажуулах үйлчилгээ түр боломжгүй.',503);
    $headers=['Accept: application/json'];
    if($method==='POST')$headers=array_merge($headers,['Content-Type: application/json','Authorization: Bearer '.verify_mn_key()]);
    $ch=curl_init('https://api.verify.mn'.$path);$raw='';
    curl_setopt_array($ch,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>12,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>65536)return 0;$raw.=$chunk;return strlen($chunk);}]);
    if($body!==null)curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($body,JSON_THROW_ON_ERROR));
    $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    $data=json_decode($raw,true);
    if($ok===false||$status<200||$status>=300||!is_array($data))fail('Утас баталгаажуулах үйлчилгээтэй холбогдсонгүй. Дахин оролдоно уу.',503);
    return $data;
}