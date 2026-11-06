<?php
declare(strict_types=1);

function customer_push_schema(): void {
    db()->exec('CREATE TABLE IF NOT EXISTS customer_push_devices (token TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),auth_version INTEGER NOT NULL,session_hash TEXT NOT NULL,platform TEXT NOT NULL,cursor INTEGER NOT NULL,pending_cursor INTEGER NOT NULL DEFAULT 0,ticket TEXT NOT NULL DEFAULT "",ticket_at INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL,last_error TEXT NOT NULL DEFAULT ""); CREATE INDEX IF NOT EXISTS customer_push_owner ON customer_push_devices(customer_id);');
}
function customer_push_platforms(): array {
    $value=getenv('GOSTORE_CUSTOMER_PUSH_PLATFORMS');
    if($value===false){$path=config()['data_dir'].'/customer-push-platforms';$value=is_file($path)?file_get_contents($path):'ios,android';}
    return array_values(array_intersect(['ios','android'],array_map('trim',explode(',',(string)$value))));
}
function customer_push_enabled(?string $platform=null): bool {
    $enabled=getenv('GOSTORE_CUSTOMER_PUSH_ENABLED')==='1'||is_file(config()['data_dir'].'/customer-push-enabled');
    $platforms=customer_push_platforms();
    return $enabled&&($platform===null?count($platforms)>0:in_array($platform,$platforms,true));
}
function customer_push_token(array $b): string {
    $token=str_field($b,'token',240);
    if(!preg_match('/^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/D',$token))fail('Push token буруу.',422);
    return $token;
}
function customer_push_cursor(string $customer): int {
    $q=db()->prepare('SELECT COALESCE(MAX(n.id),0) FROM order_notifications n JOIN customer_orders co ON co.order_id=n.order_id WHERE co.customer_id=?');$q->execute([$customer]);return (int)$q->fetchColumn();
}
function customer_push_register(array $c,array $b): array {
    if(!customer_push_enabled())fail('Утасны мэдэгдлийн тохиргоо бэлэн болоогүй.',503);
    customer_push_schema();limit_attempts('customer-push:'.$c['id'],60,3600);
    $token=customer_push_token($b);$platform=str_field($b,'platform',10);if(!in_array($platform,['ios','android'],true))fail('Төхөөрөмжийн төрөл буруу.',422);
    if(!customer_push_enabled($platform))fail('Энэ төхөөрөмжийн мэдэгдлийн холболт бэлэн болоогүй.',503);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $q=$db->prepare('SELECT * FROM customer_push_devices WHERE token=?');$q->execute([$token]);$old=$q->fetch();
        if($old&&$old['customer_id']===$c['id']&&(int)$old['auth_version']===(int)$c['auth_version']){
            $db->prepare('UPDATE customer_push_devices SET session_hash=?,expires=? WHERE token=?')->execute([hash('sha256',session_id()),time()+90*86400,$token]);
        }else{
            $q=$db->prepare('SELECT COUNT(*) FROM customer_push_devices WHERE customer_id=? AND expires>?');$q->execute([$c['id'],time()]);if((int)$q->fetchColumn()>=10)fail('Төхөөрөмжийн хязгаарт хүрлээ.',409);
            $db->prepare('DELETE FROM customer_push_devices WHERE token=?')->execute([$token]);
            $db->prepare('INSERT INTO customer_push_devices (token,customer_id,auth_version,session_hash,platform,cursor,expires) VALUES (?,?,?,?,?,?,?)')->execute([$token,$c['id'],$c['auth_version'],hash('sha256',session_id()),$platform,customer_push_cursor($c['id']),time()+90*86400]);
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return ['ok'=>true];
}
function customer_push_unregister(array $c,array $b): array {
    customer_push_schema();db()->prepare('DELETE FROM customer_push_devices WHERE token=? AND customer_id=?')->execute([customer_push_token($b),$c['id']]);return ['ok'=>true];
}
function customer_push_revoke_session(): void {
    if(empty($_SESSION['customer_id']))return;
    customer_push_schema();db()->prepare('DELETE FROM customer_push_devices WHERE customer_id=? AND session_hash=?')->execute([$_SESSION['customer_id'],hash('sha256',session_id())]);
}
function customer_push_http(string $operation,array $payload): array {
    $curl=curl_init('https://exp.host/--/api/v2/push/'.$operation);$headers=['Content-Type: application/json','Accept: application/json'];
    $access=getenv('EXPO_ACCESS_TOKEN');if(is_string($access)&&$access!=='')$headers[]='Authorization: Bearer '.$access;
    curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload,JSON_THROW_ON_ERROR),CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>5,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>$headers]);
    $raw=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);return [$status,json_decode(is_string($raw)?$raw:'',true)??[]];
}
function customer_push_retry(array $d,string $error): void {
    $attempt=(int)$d['attempts']+1;
    db()->prepare('UPDATE customer_push_devices SET attempts=?,next_attempt=?,last_error=? WHERE token=?')->execute([$attempt,time()+min(21600,30*(2**min($attempt,10))),substr($error,0,80),$d['token']]);
}
function customer_push_drain(int $limit=20,?callable $http=null,int $budget=40): int {
    if(!customer_push_enabled())return 0;
    customer_push_schema();$http??='customer_push_http';$lock=fopen(config()['data_dir'].'/customer-push-worker.lock','c');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock)fclose($lock);return 0;}
    $sent=0;$start=microtime(true);
    try{
        // PIN/password changes, deleted accounts, and expired registrations cannot keep receiving pushes.
        db()->prepare('DELETE FROM customer_push_devices WHERE expires<? OR NOT EXISTS (SELECT 1 FROM customers c WHERE c.id=customer_push_devices.customer_id AND c.auth_version=customer_push_devices.auth_version)')->execute([time()]);
        $platforms=customer_push_platforms();$slots=implode(',',array_fill(0,count($platforms),'?'));
        $q=db()->prepare('SELECT d.* FROM customer_push_devices d WHERE platform IN ('.$slots.') AND next_attempt<=? AND (ticket<>"" OR EXISTS (SELECT 1 FROM order_notifications n JOIN customer_orders co ON co.order_id=n.order_id WHERE co.customer_id=d.customer_id AND n.id>d.cursor)) ORDER BY next_attempt LIMIT ?');
        $i=1;foreach($platforms as $platform)$q->bindValue($i++,$platform);$q->bindValue($i++,time(),PDO::PARAM_INT);$q->bindValue($i,$limit,PDO::PARAM_INT);$q->execute();
        foreach($q->fetchAll() as $d){
            if(microtime(true)-$start>$budget)break;
            try{
                if($d['ticket']!==''){
                    [$status,$r]=$http('getReceipts',['ids'=>[$d['ticket']]]);$receipt=$r['data'][$d['ticket']]??null;
                    if($status!==200){customer_push_retry($d,'receipt_http_'.$status);continue;}
                    if(!$receipt){
                        if(time()-(int)$d['ticket_at']>=86400){db()->prepare('UPDATE customer_push_devices SET ticket="",next_attempt=? WHERE token=?')->execute([time()+900,$d['token']]);}
                        else customer_push_retry($d,'receipt_pending');continue;
                    }
                    if(($receipt['status']??'')==='ok'){
                        db()->prepare('UPDATE customer_push_devices SET cursor=pending_cursor,ticket="",attempts=0,next_attempt=0,last_error="" WHERE token=?')->execute([$d['token']]);continue;
                    }
                    $error=$receipt['details']['error']??'receipt_error';
                    if($error==='DeviceNotRegistered'){db()->prepare('DELETE FROM customer_push_devices WHERE token=?')->execute([$d['token']]);continue;}
                    db()->prepare('UPDATE customer_push_devices SET ticket="" WHERE token=?')->execute([$d['token']]);customer_push_retry($d,$error);continue;
                }
                $cursor=customer_push_cursor($d['customer_id']);if($cursor<=(int)$d['cursor'])continue;
                // Coalesced transactional notice; no phone, order ID, price, address or PIN leaves GOStore.
                [$status,$r]=$http('send',['to'=>$d['token'],'title'=>'gostore.mn','body'=>'Таны захиалгын мэдээлэл шинэчлэгдлээ. Аппаас дэлгэрэнгүйг харна уу.','sound'=>'default','channelId'=>'orders','ttl'=>3600,'data'=>['screen'=>'notifications']]);
                $ticket=$r['data']??[];
                if($status===200&&($ticket['status']??'')==='ok'&&is_string($ticket['id']??null)&&strlen($ticket['id'])<=200){
                    db()->prepare('UPDATE customer_push_devices SET ticket=?,ticket_at=?,pending_cursor=?,next_attempt=?,attempts=0,last_error="" WHERE token=?')->execute([$ticket['id'],time(),$cursor,time()+900,$d['token']]);$sent++;
                }elseif(($ticket['details']['error']??'')==='DeviceNotRegistered'){db()->prepare('DELETE FROM customer_push_devices WHERE token=?')->execute([$d['token']]);}
                else customer_push_retry($d,$ticket['details']['error']??'send_http_'.$status);
            }catch(Throwable){customer_push_retry($d,'transport_error');}
        }
        return $sent;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function customer_push_schedule(): void {
    static $scheduled=false;if($scheduled||!customer_push_enabled()||PHP_SAPI==='cli')return;$scheduled=true;
    register_shutdown_function(function(){if(session_status()===PHP_SESSION_ACTIVE)session_write_close();if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();try{customer_push_drain(5,null,5);}catch(Throwable){error_log('GOStore customer push remains queued');}});
}
