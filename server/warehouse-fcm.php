<?php
declare(strict_types=1);

function warehouse_fcm_credentials(): array {
    $path=config()['data_dir'].'/warehouse-fcm-service-account.json';
    if(!is_file($path))throw new RuntimeException('FCM not configured');
    $v=json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
    if(($v['type']??'')!=='service_account'||($v['project_id']??'')!=='gostore-warehouse'||empty($v['private_key'])||empty($v['client_email']))throw new RuntimeException('Invalid FCM configuration');
    return $v;
}
function warehouse_fcm_configured(): bool {try{warehouse_fcm_credentials();return true;}catch(Throwable){return false;}}
function warehouse_fcm_token_value(string $token): string {
    if(!preg_match('/^[A-Za-z0-9_:\-]{30,4096}$/D',$token))fail('FCM token буруу.',422);
    return $token;
}
function warehouse_fcm_subscribe(array $b,string $location): array {
    if(!warehouse_fcm_configured())fail('Android push тохиргоо бэлэн болоогүй.',503);
    $token=warehouse_fcm_token_value(str_field($b,'fcm_token',4096));
    // Reuse the same scoped device lifecycle, expiry and outbox as web push.
    return warehouse_push_store_device('fcm:'.$token,$location);
}
function warehouse_fcm_rotate(array $b): array {
    $device=warehouse_push_authenticated_device();
    if(!str_starts_with($device['endpoint'],'fcm:'))fail('Android төхөөрөмж шаардлагатай.',403);
    limit_attempts('fcm-rotate:'.$device['id'],30,3600);
    $endpoint='fcm:'.warehouse_fcm_token_value(str_field($b,'fcm_token',4096));
    db()->prepare('DELETE FROM warehouse_push_devices WHERE endpoint=? AND id<>?')->execute([$endpoint,$device['id']]);
    db()->prepare('UPDATE warehouse_push_devices SET endpoint=?,next_attempt=0,attempts=0 WHERE id=?')->execute([$endpoint,$device['id']]);
    return ['ok'=>true];
}
function warehouse_fcm_http(string $url,array $headers,string $body): array {
    $curl=curl_init($url);
    curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>5,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>$headers]);
    $raw=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
    return [$status,json_decode(is_string($raw)?$raw:'',true)??[]];
}
function warehouse_fcm_access_token(?callable $http=null): string {
    $v=warehouse_fcm_credentials();$path=config()['data_dir'].'/warehouse-fcm-oauth.json';
    $fingerprint=hash('sha256',$v['private_key']);
    $cached=is_file($path)?json_decode(file_get_contents($path),true):null;
    if(($cached['key']??'')===$fingerprint&&($cached['expires']??0)>time()+120)return $cached['token'];
    $jwt=warehouse_push_b64('{"alg":"RS256","typ":"JWT"}').'.'.warehouse_push_b64(json_encode(['iss'=>$v['client_email'],'scope'=>'https://www.googleapis.com/auth/firebase.messaging','aud'=>'https://oauth2.googleapis.com/token','iat'=>time(),'exp'=>time()+3600],JSON_THROW_ON_ERROR));
    if(!openssl_sign($jwt,$sig,$v['private_key'],OPENSSL_ALGO_SHA256))throw new RuntimeException('FCM signing failed');
    $jwt.='.'.warehouse_push_b64($sig);$http??='warehouse_fcm_http';
    [$status,$result]=$http('https://oauth2.googleapis.com/token',['Content-Type: application/x-www-form-urlencoded'],http_build_query(['grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion'=>$jwt]));
    if($status!==200||empty($result['access_token']))throw new RuntimeException('FCM authorization failed');
    $tmp=$path.'.'.bin2hex(random_bytes(6));
    if(file_put_contents($tmp,json_encode(['key'=>$fingerprint,'token'=>$result['access_token'],'expires'=>time()+min(3600,(int)($result['expires_in']??3600))],JSON_THROW_ON_ERROR))===false)throw new RuntimeException('FCM token cache failed');
    chmod($tmp,0600);if(!rename($tmp,$path))throw new RuntimeException('FCM token cache publish failed');
    return $result['access_token'];
}
function warehouse_fcm_test(): array {
    $device=warehouse_push_authenticated_device();
    if(!str_starts_with($device['endpoint'],'fcm:'))fail('Android төхөөрөмж шаардлагатай.',403);
    limit_attempts('fcm-test:'.$device['id'],3,60);
    $status=warehouse_fcm_send($device,null,false,true);
    if($status<200||$status>=300)fail('Push илгээлт амжилтгүй. Түр хүлээгээд дахин оролдоно уу.',503);
    return ['ok'=>true,'accepted'=>true];
}
function warehouse_fcm_send(array $device,?callable $http=null,bool $validateOnly=false,bool $test=false): int {
    $token=warehouse_fcm_token_value(substr($device['endpoint'],4));$http??='warehouse_fcm_http';
    // No customer, order, credentials or warehouse data leaves GOStore.
    $message=['validate_only'=>$validateOnly,'message'=>['token'=>$token,'data'=>['type'=>$test?'warehouse-test':'warehouse-orders'],'android'=>['priority'=>'HIGH','ttl'=>'86400s','collapse_key'=>$test?'warehouse-test':'warehouse-orders']]];
    [$status,$result]=$http('https://fcm.googleapis.com/v1/projects/gostore-warehouse/messages:send',['Authorization: Bearer '.warehouse_fcm_access_token($http),'Content-Type: application/json'],json_encode($message,JSON_THROW_ON_ERROR));
    foreach($result['error']['details']??[] as $detail){
        if(($detail['@type']??'')==='type.googleapis.com/google.firebase.fcm.v1.FcmError'&&($detail['errorCode']??'')==='UNREGISTERED')return 410;
    }
    // A project/config 404 is not an expired device; keep it queued.
    if($status===404)return 503;
    if($status===401)@unlink(config()['data_dir'].'/warehouse-fcm-oauth.json');
    return $status;
}
