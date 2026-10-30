<?php
declare(strict_types=1);

function taoworld_signature(string $path,array $params,string $secret): string {
    unset($params['sign']);ksort($params,SORT_STRING);$base=$path;
    foreach($params as $key=>$value){if(!is_scalar($value))fail('TaoWorld хүсэлтийн төрөл буруу.',500);$base.=$key.(string)$value;}
    return strtoupper(hash_hmac('sha256',$base,$secret));
}
// Fixed provider endpoints only; business-level success is checked by the caller.
function taoworld_http(string $path,array $params): array {
    if(!in_array($path,['/auth/token/create','/auth/token/refresh','/product/get','/purchase/order/render','/purchase/order/create','/purchase/orders/query','/purchase/order/batch/pay'],true))fail('TaoWorld үйлдэл идэвхгүй.',403);
    if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')fail('Туршилтын орчинд гадаад холболт хаалттай.',503);
    $cfg=taoworld_config();taoworld_require_config();
    $params=array_merge($params,['app_key'=>$cfg['app_key'],'timestamp'=>(string)(int)floor(microtime(true)*1000),'sign_method'=>'sha256']);
    $params['sign']=taoworld_signature($path,$params,$cfg['app_secret']);
    $ch=curl_init('https://api.taobao.global/rest'.$path);$raw='';
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($params,'','&',PHP_QUERY_RFC3986),
        CURLOPT_HTTPHEADER=>['Accept: application/json','Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>30,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>2097152)return 0;$raw.=$chunk;return strlen($chunk);}]);
    $ok=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    // Do not expose provider bodies: errors can echo codes, tokens or signed request data.
    if($ok===false||$status!==200)fail('TaoWorld серверийн хариу тодорхойгүй. Төлөвийг дахин шалгана уу.',502);
    $data=json_decode($raw,true,512,JSON_BIGINT_AS_STRING);
    if(!is_array($data)||(string)($data['code']??'')!=='0')fail('TaoWorld зөвшөөрөл олгосонгүй. App болон худалдан авагчийн эрхийг шалгана уу.',502);
    return $data;
}
