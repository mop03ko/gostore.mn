<?php
declare(strict_types=1);
// Network transport for OT Taobao buyer/order endpoints. Tests replace this file with a fake.
function taobao_http(string $method,string $path,array $query=[],?array $json=null,?array $form=null): array {
    if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')fail('Туршилтын орчинд Taobao захиалгын дуудлагыг хаасан.',503);
    $ch=curl_init('https://rest.otapi.net'.$path.($query?'?'.http_build_query($query):''));$raw='';
    $headers=['X-Api-Key: '.config()['otcommerce']['api_key'],'Accept: application/json'];
    $options=[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>45,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_ENCODING=>'',
        CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>2000000)return 0;$raw.=$chunk;return strlen($chunk);}];
    if($json!==null){$headers[]='Content-Type: application/json';$options[CURLOPT_POSTFIELDS]=json_encode($json,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
    elseif($form!==null)$options[CURLOPT_POSTFIELDS]=http_build_query($form);
    $options[CURLOPT_HTTPHEADER]=$headers;curl_setopt_array($ch,$options);
    $ok=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    // A transport failure is ambiguous for order creation; callers decide whether it is safe to retry.
    if($ok===false||$status===0)throw new ApiError('Taobao захиалгын сервертэй холбогдож чадсангүй.',504);
    $body=json_decode($raw,true);
    return ['status'=>$status,'body'=>is_array($body)?$body:null];
}
