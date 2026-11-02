<?php
declare(strict_types=1);
require_once __DIR__.'/warehouse-fcm.php';

function warehouse_notice_schema(PDO $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS warehouse_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,location TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES orders(id),created TEXT NOT NULL,read_at TEXT,UNIQUE(location,order_id));
        CREATE INDEX IF NOT EXISTS warehouse_notifications_location ON warehouse_notifications(location,id);
        CREATE TABLE IF NOT EXISTS warehouse_push_devices (id TEXT PRIMARY KEY,location TEXT NOT NULL,account_version TEXT NOT NULL,session_hash TEXT NOT NULL,endpoint TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,start_id INTEGER NOT NULL,queued_id INTEGER NOT NULL,sent_id INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL,last_error TEXT NOT NULL DEFAULT "");');
}
function warehouse_notice_eligible(array $o): bool {
    return in_array($o['status']??'', ['confirmed','shipping','erenhot','erenhot_ready','erenhot_dispatched','zamyn_uud','ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery'],true);
}
function warehouse_notice_record(array $o,?array $old): void {
    if(!function_exists('warehouse_order_location')||!warehouse_notice_eligible($o))return;
    warehouse_notice_schema(db());
    foreach(['erenhot'=>'Эрээн','ulaanbaatar'=>'Улаанбаатар'] as $role=>$city){
        if(!in_array($city,$o['route']??[],true))continue;
        $location=warehouse_order_location($o,$role);
        if($old&&warehouse_notice_eligible($old)&&warehouse_order_location($old,$role)===$location&&in_array($city,$old['route']??[],true))continue;
        $s=db()->prepare('INSERT OR IGNORE INTO warehouse_notifications (location,order_id,created) VALUES (?,?,?)');$s->execute([$location,$o['id'],gmdate('c')]);
        if(!$s->rowCount())continue;
        $id=(int)db()->lastInsertId();
        db()->prepare('UPDATE warehouse_push_devices SET queued_id=?,attempts=0,next_attempt=0 WHERE location=?')->execute([$id,$location]);
        warehouse_push_schedule();
    }
}
function warehouse_notice_list(string $location,int $after=0): array {
    warehouse_notice_schema(db());
    $s=db()->prepare('SELECT n.*,o.data FROM warehouse_notifications n JOIN orders o ON o.id=n.order_id WHERE n.location=? AND n.id>? ORDER BY n.id DESC LIMIT 100');$s->execute([$location,$after]);$rows=[];$unread=0;
    foreach($s as $r){$o=json_decode($r['data'],true);
        if(!warehouse_order_visible($o,$location)||!warehouse_notice_eligible($o))continue;
        unset($r['data']);$r['id']=(int)$r['id'];$rows[]=$r;if(!$r['read_at'])$unread++;
    }
    return ['notifications'=>$rows,'unread'=>$unread,'location'=>$location,'language'=>warehouse_role($location)==='erenhot'?'zh':'mn'];
}
function warehouse_push_b64(string $s): string {return rtrim(strtr(base64_encode($s),'+/','-_'),'=');}
function warehouse_push_keys(): array {
    $path=config()['data_dir'].'/warehouse-vapid.json';
    $lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Push key lock unavailable');
    try{
        if(is_file($path))return json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
        $options=['private_key_type'=>OPENSSL_KEYTYPE_EC,'curve_name'=>'prime256v1','config'=>__DIR__.'/warehouse-push-openssl.cnf'];$key=openssl_pkey_new($options);
        if(!$key||!openssl_pkey_export($key,$private,null,$options))throw new RuntimeException('Push key generation failed');
        $details=openssl_pkey_get_details($key);$public=warehouse_push_b64("\x04".str_pad($details['ec']['x'],32,"\0",STR_PAD_LEFT).str_pad($details['ec']['y'],32,"\0",STR_PAD_LEFT));
        $value=['public'=>$public,'private'=>$private];$tmp=$path.'.'.bin2hex(random_bytes(6));
        if(file_put_contents($tmp,json_encode($value,JSON_THROW_ON_ERROR))===false)throw new RuntimeException('Push key write failed');
        chmod($tmp,0600);if(!rename($tmp,$path))throw new RuntimeException('Push key publish failed');return $value;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function warehouse_push_endpoint(string $endpoint): string {
    $p=parse_url($endpoint);$host=strtolower($p['host']??'');
    $allowed=in_array($host,['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'],true)||str_ends_with($host,'.notify.windows.com');
    if(strlen($endpoint)>2048||preg_match('/[\x00-\x20\x7f]/',$endpoint)||!$allowed||($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['pass'])||isset($p['fragment'])||isset($p['port'])||empty($p['path']))fail('Push хаяг буруу.',422);
    return 'https://'.$host;
}
// RFC 8292 ES256: OpenSSL signs DER; JWT carries fixed-width r || s.
function warehouse_push_authorization(string $endpoint,array $keys): string {
    $aud=warehouse_push_endpoint($endpoint);
    $jwt=warehouse_push_b64('{"typ":"JWT","alg":"ES256"}').'.'.warehouse_push_b64(json_encode(['aud'=>$aud,'exp'=>time()+3600,'sub'=>'https://gostore.mn/help'],JSON_THROW_ON_ERROR));
    if(!openssl_sign($jwt,$der,$keys['private'],OPENSSL_ALGO_SHA256))throw new RuntimeException('Push signature failed');
    if(ord($der[0])!==48||ord($der[2])!==2)throw new RuntimeException('Invalid ECDSA signature');
    $length=ord($der[3]);$r=ltrim(substr($der,4,$length),"\0");$offset=4+$length;
    if(ord($der[$offset])!==2)throw new RuntimeException('Invalid ECDSA signature');
    $s=ltrim(substr($der,$offset+2,ord($der[$offset+1])),"\0");
    if(strlen($r)>32||strlen($s)>32)throw new RuntimeException('Invalid ECDSA signature');
    $jwt.='.'.warehouse_push_b64(str_pad($r,32,"\0",STR_PAD_LEFT).str_pad($s,32,"\0",STR_PAD_LEFT));
    return 'vapid t='.$jwt.', k='.$keys['public'];
}
function warehouse_push_device_active(array $device): bool {
    $defs=warehouse_definitions();if(!isset($defs[$device['location']])||!$defs[$device['location']]['active']||$device['expires']<time())return false;
    $a=warehouse_account($device['location']);return $a['enabled']&&hash_equals($a['version'],$device['account_version']);
}
function warehouse_push_subscribe(array $b,string $location): array {
    warehouse_notice_schema(db());
    limit_attempts('warehouse-push:'.$location,30,3600);
    $endpoint=str_field($b,'endpoint',2048);warehouse_push_endpoint($endpoint);$keys=warehouse_push_keys();
    if(($b['public_key']??'')!==$keys['public'])fail('Push түлхүүр шинэчлэгдсэн. Дахин идэвхжүүлнэ үү.',409);
    return warehouse_push_store_device($endpoint,$location);
}
function warehouse_push_store_device(string $endpoint,string $location): array {
    warehouse_notice_schema(db());
    limit_attempts('warehouse-device:'.$location,30,3600);
    $id=hash('sha256',$endpoint);$token=bin2hex(random_bytes(32));$a=warehouse_account($location);
    $s=db()->prepare('SELECT COALESCE(MAX(id),0) FROM warehouse_notifications WHERE location=?');$s->execute([$location]);$cursor=(int)$s->fetchColumn();
    $s=db()->prepare('SELECT COUNT(*) FROM warehouse_push_devices WHERE location=? AND id<>? AND endpoint<>? AND expires>?');$s->execute([$location,$id,$endpoint,time()]);if((int)$s->fetchColumn()>=20)fail('Төхөөрөмжийн дээд тоонд хүрлээ.',429);
    db()->prepare('DELETE FROM warehouse_push_devices WHERE endpoint=?')->execute([$endpoint]);
    db()->prepare('INSERT OR REPLACE INTO warehouse_push_devices (id,location,account_version,session_hash,endpoint,token_hash,start_id,queued_id,sent_id,expires) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$id,$location,$a['version'],hash('sha256',session_id()),$endpoint,hash('sha256',$token),$cursor,$cursor,$cursor,time()+90*86400]);
    return ['id'=>$id,'token'=>$token,'location'=>$location,'language'=>warehouse_role($location)==='erenhot'?'zh':'mn'];
}
function warehouse_push_revoke_session(): void {
    warehouse_notice_schema(db());
    db()->prepare('DELETE FROM warehouse_push_devices WHERE session_hash=?')->execute([hash('sha256',session_id())]);
}
function warehouse_push_authenticated_device(): array {
    warehouse_notice_schema(db());
    $header=isset($_SERVER['HTTP_X_GOSTORE_PUSH_TOKEN'])?'Bearer '.$_SERVER['HTTP_X_GOSTORE_PUSH_TOKEN']:($_SERVER['HTTP_AUTHORIZATION']??'');
    if(!preg_match('/^Bearer ([a-f0-9]{64})$/D',$header,$m))fail('Push эрх хүчингүй.',401);
    $s=db()->prepare('SELECT * FROM warehouse_push_devices WHERE token_hash=?');$s->execute([hash('sha256',$m[1])]);$device=$s->fetch();
    if(!$device||!warehouse_push_device_active($device))fail('Push эрх хүчингүй.',401);
    return $device;
}
function warehouse_push_delivery(): array {
    $device=warehouse_push_authenticated_device();
    $result=warehouse_notice_list($device['location'],(int)$device['start_id']);
    $result['notifications']=array_slice($result['notifications'],0,5);return $result;
}
function warehouse_push_revoke_token(): array {
    warehouse_notice_schema(db());$header=isset($_SERVER['HTTP_X_GOSTORE_PUSH_TOKEN'])?'Bearer '.$_SERVER['HTTP_X_GOSTORE_PUSH_TOKEN']:($_SERVER['HTTP_AUTHORIZATION']??'');
    if(!preg_match('/^Bearer ([a-f0-9]{64})$/D',$header,$m))fail('Push эрх хүчингүй.',401);
    db()->prepare('DELETE FROM warehouse_push_devices WHERE token_hash=?')->execute([hash('sha256',$m[1])]);return ['ok'=>true];
}
function warehouse_push_schedule(): void {
    static $scheduled=false;if($scheduled||getenv('GOSTORE_DISABLE_PUSH')==='1'||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')return;$scheduled=true;
    register_shutdown_function(static function(){
        if(http_response_code()>=400)return;
        if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
        if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();
        try{warehouse_push_drain(20,null,10);}catch(Throwable){error_log('GOStore warehouse push remains queued');}
    });
}
function warehouse_push_drain(int $limit=20,?callable $transport=null,int $budgetSeconds=50): int {
    if(!$transport&&(getenv('GOSTORE_DISABLE_PUSH')==='1'||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1'))return 0;
    warehouse_notice_schema(db());
    $lock=fopen(config()['data_dir'].'/warehouse-push-worker.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock)fclose($lock);return 0;}$sent=0;
    $deadline=microtime(true)+$budgetSeconds;
    try{
        $s=db()->prepare('SELECT * FROM warehouse_push_devices WHERE queued_id>sent_id AND next_attempt<=? ORDER BY next_attempt LIMIT ?');$s->bindValue(1,time(),PDO::PARAM_INT);$s->bindValue(2,$limit,PDO::PARAM_INT);$s->execute();$devices=$s->fetchAll();
        foreach($devices as $d){
            if(microtime(true)>=$deadline)break;
            if(!warehouse_push_device_active($d)){db()->prepare('DELETE FROM warehouse_push_devices WHERE id=?')->execute([$d['id']]);continue;}
            // Reassigned/cancelled orders must not alert the former warehouse.
            if(!warehouse_notice_list($d['location'],(int)$d['sent_id'])['notifications']){db()->prepare('UPDATE warehouse_push_devices SET sent_id=? WHERE id=?')->execute([$d['queued_id'],$d['id']]);continue;}
            try{
                // Wake-up only: no personal/order data is sent to a third-party push provider.
                // The service worker retrieves content from our scoped authenticated endpoint.
                if($transport){$status=$transport($d);}elseif(str_starts_with($d['endpoint'],'fcm:')){$status=warehouse_fcm_send($d);}else{
                $auth=warehouse_push_authorization($d['endpoint'],warehouse_push_keys());$curl=curl_init($d['endpoint']);
                curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>'',CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>4,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>['Authorization: '.$auth,'TTL: 86400','Urgency: high','Topic: gostore-new-orders','Content-Length: 0']]);
                curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);}
            }catch(Throwable){$status=0;}
            if(in_array($status,[404,410],true)){db()->prepare('DELETE FROM warehouse_push_devices WHERE id=?')->execute([$d['id']]);continue;}
            if($status>=200&&$status<300){db()->prepare('UPDATE warehouse_push_devices SET sent_id=?,attempts=0,next_attempt=0,last_error="" WHERE id=?')->execute([$d['queued_id'],$d['id']]);$sent++;}
            else{$attempt=(int)$d['attempts']+1;db()->prepare('UPDATE warehouse_push_devices SET attempts=?,next_attempt=?,last_error=? WHERE id=?')->execute([$attempt,time()+min(3600,30*(2**min($attempt,7))),'HTTP '.$status,$d['id']]);}
        }
        db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['warehouse_push_worker_last',(string)time()]);return $sent;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
