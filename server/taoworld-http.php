<?php
declare(strict_types=1);

function taoworld_signature(string $path,array $params,string $secret): string {
    unset($params['sign']);ksort($params,SORT_STRING);$base=$path;
    foreach($params as $key=>$value){if(!is_scalar($value))fail('TaoWorld хүсэлтийн төрөл буруу.',500);$base.=$key.(string)$value;}
    return strtoupper(hash_hmac('sha256',$base,$secret));
}
// Fixed provider endpoints only; business-level success is checked by the caller.
function taoworld_http_handle(string $path,array $params,string &$raw): CurlHandle {
    if(!in_array($path,['/auth/token/create','/auth/token/refresh','/product/get','/purchase/order/render','/purchase/order/create','/purchase/orders/query','/purchase/order/batch/pay','/traffic/item/search','/traffic/item/get','/traffic/item/imgsearch','/traffic/item/batchGetSourceItemLogisticPrice','/upload/image'],true))fail('TaoWorld үйлдэл идэвхгүй.',403);
    if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')fail('Туршилтын орчинд гадаад холболт хаалттай.',503);
    $cfg=taoworld_config();taoworld_require_config();
    $params=array_merge($params,['app_key'=>$cfg['app_key'],'timestamp'=>(string)(int)floor(microtime(true)*1000),'sign_method'=>'sha256']);
    $params['sign']=taoworld_signature($path,$params,$cfg['app_secret']);
    $ch=curl_init('https://api.taobao.global/rest'.$path);$raw='';
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($params,'','&',PHP_QUERY_RFC3986),
        CURLOPT_HTTPHEADER=>['Accept: application/json','Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>30,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>2097152)return 0;$raw.=$chunk;return strlen($chunk);}]);
    return $ch;
}
function taoworld_http_response(bool $ok,int $status,string $raw): array {
    // Do not expose provider bodies: errors can echo codes, tokens or signed request data.
    if($ok===false||$status!==200)fail('TaoWorld серверийн хариу тодорхойгүй. Төлөвийг дахин шалгана уу.',502);
    $data=json_decode($raw,true,512,JSON_BIGINT_AS_STRING);
    if(!is_array($data)||(string)($data['code']??'')!=='0')fail('TaoWorld зөвшөөрөл олгосонгүй. App болон худалдан авагчийн эрхийг шалгана уу.',502);
    return $data;
}
function taoworld_http(string $path,array $params): array {
    $raw='';$ch=taoworld_http_handle($path,$params,$raw);
    try{$ok=curl_exec($ch);return taoworld_http_response($ok!==false,(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE),$raw);}
    finally{curl_close($ch);}
}
// Only independent search reads may run concurrently. Purchases/payments never enter this path.
function taoworld_http_search_batch(array $queries): array {
    if(!array_is_list($queries)||count($queries)<1||count($queries)>3)fail('TaoWorld хайлтын багц буруу.',400);
    $multi=curl_multi_init();$handles=[];$raw=[];
    try{
        foreach($queries as $i=>$params){$raw[$i]='';$handles[$i]=taoworld_http_handle('/traffic/item/search',$params,$raw[$i]);if(curl_multi_add_handle($multi,$handles[$i])!==CURLM_OK)fail('TaoWorld хайлт эхэлсэнгүй.',502);}
        do{
            $status=curl_multi_exec($multi,$running);if($status!==CURLM_OK)fail('TaoWorld хайлт дууссангүй.',502);
            if($running&&curl_multi_select($multi,0.5)===-1)usleep(10000);
        }while($running);
        $completed=[];while($info=curl_multi_info_read($multi))$completed[spl_object_id($info['handle'])]=$info['result'];
        $results=[];foreach($handles as $i=>$ch){
            try{$results[$i]=taoworld_http_response(($completed[spl_object_id($ch)]??-1)===CURLE_OK,(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE),$raw[$i]);}
            catch(ApiError $e){$results[$i]=$e;}
        }
        return $results;
    }finally{foreach($handles as $ch){curl_multi_remove_handle($multi,$ch);curl_close($ch);}curl_multi_close($multi);}
}
