<?php
declare(strict_types=1);
require_once __DIR__.'/customer-push.php';

// Native iOS alerts. No session cookie, customer data or order payload is sent to Expo.
function staff_push_schema(): void {
    db()->exec('CREATE TABLE IF NOT EXISTS staff_push_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, created INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS staff_push_events_order ON staff_push_events(order_id,id);
        CREATE TABLE IF NOT EXISTS staff_push_receipts (ticket TEXT PRIMARY KEY,token TEXT NOT NULL,variant TEXT NOT NULL,owner TEXT NOT NULL,version TEXT NOT NULL,from_cursor INTEGER NOT NULL,to_cursor INTEGER NOT NULL,created INTEGER NOT NULL,next_attempt INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS staff_push_devices (token TEXT PRIMARY KEY, variant TEXT NOT NULL, owner TEXT NOT NULL, version TEXT NOT NULL, session_hash TEXT NOT NULL, device_hash TEXT NOT NULL, cursor INTEGER NOT NULL, retry_cursor INTEGER NOT NULL DEFAULT 0, retry_test INTEGER NOT NULL DEFAULT 0, ticket TEXT NOT NULL DEFAULT "", ticket_at INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0, test_at INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL, last_error TEXT NOT NULL DEFAULT "");
');
    // Compatibility repair for the initial JSON1/unixepoch triggers (SQLite 3.7 hosts).
    foreach(db()->query("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN ('staff_push_order_insert','staff_push_order_update')")->fetchAll() as $trigger){
        if(str_contains($trigger['sql'],'unixepoch')||str_contains($trigger['sql'],'json_extract'))db()->exec('DROP TRIGGER '.($trigger['name']==='staff_push_order_insert'?'staff_push_order_insert':'staff_push_order_update'));
    }
    db()->exec('CREATE TRIGGER IF NOT EXISTS staff_push_order_insert AFTER INSERT ON orders BEGIN INSERT INTO staff_push_events(order_id,created) VALUES(NEW.id,CAST(strftime("%s","now") AS INTEGER)); END;');
}
function staff_push_record(array $o,array $old): void {
    foreach(['status','paid','warehouse_locations'] as $field){
        if(($o[$field]??null)!==($old[$field]??null)){
            db()->prepare('INSERT INTO staff_push_events(order_id,created) VALUES(?,?)')->execute([$o['id'],time()]);return;
        }
    }
}
function staff_push_identity(string $variant): array {
    if($variant==='admin'){
        $u=admin_current();if(!$u)fail('Нэвтэрнэ үү.',401);
        return ['variant'=>$variant,'owner'=>$u['id'],'version'=>admin_session_version($u),'device_hash'=>''];
    }
    if($variant!=='warehouse')fail('Аппын төрөл буруу.',422);
    warehouse_required();
    if(warehouse_session_location()!=='ulaanbaatar')fail('УБ агуулахын эрх шаардлагатай.',403);
    $hash=$_SESSION['warehouse_device_hash']??'';if($hash==='')fail('Дахин нэвтэрнэ үү.',401);
    return ['variant'=>$variant,'owner'=>'ulaanbaatar','version'=>$_SESSION['warehouse_version'],'device_hash'=>$hash];
}
function staff_push_active(array $d): bool {
    if((int)$d['expires']<=time())return false;
    if($d['variant']==='admin'){
        $u=$d['owner']==='owner'?admin_owner_record():admin_staff($d['owner']);
        return $u&&!empty($u['active'])&&isset(ADMIN_ROLES[$u['role']])&&$u['password_hash']!==''&&hash_equals(admin_session_version($u),$d['version']);
    }
    if($d['variant']!=='warehouse'||$d['owner']!=='ulaanbaatar')return false;
    $definition=warehouse_definitions()['ulaanbaatar']??[];
    $account=warehouse_account_by_version('ulaanbaatar',$d['version']);
    if(empty($definition['active'])||empty($account['enabled']))return false;
    warehouse_device_schema();
    $q=db()->prepare('SELECT 1 FROM warehouse_login_devices WHERE token_hash=? AND location=? AND account_version=? AND expires>?');
    $q->execute([$d['device_hash'],$d['owner'],$d['version'],time()]);return (bool)$q->fetchColumn();
}
function staff_push_cursor(): int {return (int)db()->query('SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name="staff_push_events"),0)')->fetchColumn();}
function staff_push_revoke_session(): void {
    staff_push_schema();db()->prepare('DELETE FROM staff_push_devices WHERE variant="admin" AND session_hash=?')->execute([hash('sha256',session_id())]);
}
function staff_push_register(array $identity,array $b): array {
    staff_push_schema();$token=customer_push_token($b);limit_attempts('staff-push:'.$identity['variant'].':'.$identity['owner'],120,3600);
    $q=db()->prepare('SELECT * FROM staff_push_devices WHERE token=?');$q->execute([$token]);$old=$q->fetch();
    if($old&&$old['variant']===$identity['variant']&&$old['owner']===$identity['owner']&&hash_equals($old['version'],$identity['version'])){
        db()->prepare('UPDATE staff_push_devices SET session_hash=?,device_hash=?,expires=? WHERE token=?')->execute([hash('sha256',session_id()),$identity['device_hash'],time()+90*86400,$token]);
    }else{
        $q=db()->prepare('SELECT COUNT(*) FROM staff_push_devices WHERE variant=? AND owner=? AND expires>?');$q->execute([$identity['variant'],$identity['owner'],time()]);if((int)$q->fetchColumn()>=20)fail('Төхөөрөмжийн хязгаарт хүрлээ.',409);
        db()->prepare('INSERT OR REPLACE INTO staff_push_devices(token,variant,owner,version,session_hash,device_hash,cursor,expires) VALUES(?,?,?,?,?,?,?,?)')->execute([$token,$identity['variant'],$identity['owner'],$identity['version'],hash('sha256',session_id()),$identity['device_hash'],staff_push_cursor(),time()+90*86400]);
    }
    return ['ok'=>true];
}
function staff_push_action(array $identity,string $action,array $b): array {
    if($action==='register')return staff_push_register($identity,$b);
    staff_push_schema();$token=customer_push_token($b);
    $q=db()->prepare('SELECT * FROM staff_push_devices WHERE token=? AND variant=? AND owner=? AND version=?');$q->execute([$token,$identity['variant'],$identity['owner'],$identity['version']]);$d=$q->fetch();
    if($action==='unregister'){
        if($d)db()->prepare('DELETE FROM staff_push_devices WHERE token=?')->execute([$token]);return ['ok'=>true];
    }
    if($action!=='test')fail('Үйлдэл олдсонгүй.',404);
    if(!$d)fail('Мэдэгдлийг эхлээд идэвхжүүлнэ үү.',409);
    limit_attempts('staff-push-test:'.hash('sha256',$token),5,3600);
    db()->prepare('UPDATE staff_push_devices SET test_at=? WHERE token=?')->execute([time()+15,$token]);return ['ok'=>true,'delay_seconds'=>90];
}
function staff_push_retry(array $d,string $error): void {
    $n=(int)$d['attempts']+1;db()->prepare('UPDATE staff_push_devices SET attempts=?,next_attempt=?,last_error=? WHERE token=?')->execute([$n,time()+min(21600,30*(2**min($n,10))),substr($error,0,80),$d['token']]);
}
function staff_push_visible(array $d,array $o): bool {
    if($d['variant']==='admin')return true;
    return warehouse_order_location($o,'ulaanbaatar')==='ulaanbaatar'&&warehouse_order_visible($o,'ulaanbaatar')&&warehouse_notice_eligible($o);
}
// Receipts are independent of devices: APNs acknowledgement latency must not delay new alerts.
function staff_push_receipts(callable $http,int $limit): void {
    db()->prepare('DELETE FROM staff_push_receipts WHERE created<?')->execute([time()-86400]);
    $q=db()->prepare('SELECT * FROM staff_push_receipts WHERE next_attempt<=? ORDER BY next_attempt LIMIT ?');$q->bindValue(1,time(),PDO::PARAM_INT);$q->bindValue(2,$limit,PDO::PARAM_INT);$q->execute();$rows=$q->fetchAll();
    if(!$rows)return;
    try{[$status,$response]=$http('getReceipts',['ids'=>array_column($rows,'ticket')]);}catch(Throwable){$status=0;$response=[];}
    foreach($rows as $r){
        $q=db()->prepare('SELECT * FROM staff_push_devices WHERE token=? AND variant=? AND owner=? AND version=?');$q->execute([$r['token'],$r['variant'],$r['owner'],$r['version']]);$d=$q->fetch();
        if(!$d||!staff_push_active($d)){db()->prepare('DELETE FROM staff_push_receipts WHERE ticket=?')->execute([$r['ticket']]);continue;}
        $receipt=$response['data'][$r['ticket']]??null;
        if($status!==200||!$receipt){
            $n=(int)$r['attempts']+1;db()->prepare('UPDATE staff_push_receipts SET attempts=?,next_attempt=? WHERE ticket=?')->execute([$n,time()+min(3600,60*(2**min($n,6))),$r['ticket']]);continue;
        }
        $error=$receipt['details']['error']??(($receipt['status']??'')==='ok'?'':'receipt_error');
        if($error==='DeviceNotRegistered')db()->prepare('DELETE FROM staff_push_devices WHERE token=?')->execute([$r['token']]);
        elseif($error!==''){
            // A newer accepted generic alert already covers older changes; do not replay them.
            if((int)$d['cursor']===(int)$r['to_cursor'])db()->prepare('UPDATE staff_push_devices SET cursor=? WHERE token=?')->execute([$r['from_cursor'],$r['token']]);
            staff_push_retry($d,$error);
        }
        db()->prepare('DELETE FROM staff_push_receipts WHERE ticket=?')->execute([$r['ticket']]);
    }
}
function staff_push_drain(int $limit=20,?callable $http=null,int $budget=20): int {
    if(!$http&&(getenv('GOSTORE_DISABLE_PUSH')==='1'||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1'))return 0;
    staff_push_schema();$http??='customer_push_http';$lock=fopen(config()['data_dir'].'/staff-push-worker.lock','c');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock)fclose($lock);return 0;}
    $sent=0;$start=microtime(true);
    try{
        staff_push_receipts($http,min($limit,10));
        db()->prepare('DELETE FROM staff_push_devices WHERE expires<=?')->execute([time()]);
        $q=db()->prepare('SELECT * FROM staff_push_devices WHERE (next_attempt<=? AND cursor<?) OR (test_at>0 AND test_at<=?) ORDER BY next_attempt LIMIT ?');
        $q->bindValue(1,time(),PDO::PARAM_INT);$q->bindValue(2,staff_push_cursor(),PDO::PARAM_INT);$q->bindValue(3,time(),PDO::PARAM_INT);$q->bindValue(4,$limit,PDO::PARAM_INT);$q->execute();
        foreach($q->fetchAll() as $d){
            if(microtime(true)-$start>$budget)break;
            if(!staff_push_active($d)){db()->prepare('DELETE FROM staff_push_devices WHERE token=?')->execute([$d['token']]);continue;}
            try{
                if((int)$d['test_at']>0&&(int)$d['test_at']<=time()){
                    [$status,$r]=$http('send',['to'=>$d['token'],'title'=>$d['variant']==='admin'?'GOStore Admin':'GOStore УБ агуулах','body'=>'Туршилтын мэдэгдэл. Дуу болон түгжээтэй дэлгэцийн тохиргоогоо шалгана уу.','sound'=>'default','priority'=>'high','ttl'=>600,'data'=>['screen'=>'orders','variant'=>$d['variant']]]);
                    $t=$r['data']??[];
                    if($status===200&&($t['status']??'')==='ok'&&is_string($t['id']??null)&&strlen($t['id'])<=200){
                        db()->prepare('INSERT INTO staff_push_receipts(ticket,token,variant,owner,version,from_cursor,to_cursor,created,next_attempt) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$t['id'],$d['token'],$d['variant'],$d['owner'],$d['version'],$d['cursor'],$d['cursor'],time(),time()+900]);
                        db()->prepare('UPDATE staff_push_devices SET test_at=0 WHERE token=?')->execute([$d['token']]);$sent++;
                    }elseif(($t['details']['error']??'')==='DeviceNotRegistered')db()->prepare('DELETE FROM staff_push_devices WHERE token=?')->execute([$d['token']]);
                    else{staff_push_retry($d,$t['details']['error']??'test_http_'.$status);db()->prepare('UPDATE staff_push_devices SET test_at=next_attempt WHERE token=?')->execute([$d['token']]);}
                    continue;
                }
                $cursor=staff_push_cursor();$visible=false;
                $events=db()->prepare('SELECT DISTINCT o.data FROM staff_push_events e JOIN orders o ON o.id=e.order_id WHERE e.id>? AND e.id<=? AND e.created>?');$events->execute([$d['cursor'],$cursor,time()-86400]);
                while($row=$events->fetch()){if(staff_push_visible($d,json_decode($row['data'],true)??[])){$visible=true;break;}}$events->closeCursor();
                if(!$visible){db()->prepare('UPDATE staff_push_devices SET cursor=? WHERE token=?')->execute([$cursor,$d['token']]);continue;}
                $payload=['to'=>$d['token'],'title'=>$d['variant']==='admin'?'GOStore Admin':'GOStore УБ агуулах','body'=>'Захиалгын мэдээлэл шинэчлэгдлээ. Аппаа нээж шалгана уу.','sound'=>'default','priority'=>'high','interruptionLevel'=>'active','ttl'=>3600,'data'=>['screen'=>'orders','variant'=>$d['variant']]];
                [$status,$r]=$http('send',$payload);$ticket=$r['data']??[];
                if($status===200&&($ticket['status']??'')==='ok'&&is_string($ticket['id']??null)&&strlen($ticket['id'])<=200){
                    db()->exec('SAVEPOINT staff_push_accepted');
                    try{
                        db()->prepare('INSERT INTO staff_push_receipts(ticket,token,variant,owner,version,from_cursor,to_cursor,created,next_attempt) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$ticket['id'],$d['token'],$d['variant'],$d['owner'],$d['version'],$d['cursor'],$cursor,time(),time()+900]);
                        db()->prepare('UPDATE staff_push_devices SET cursor=?,next_attempt=0,attempts=0,last_error="" WHERE token=?')->execute([$cursor,$d['token']]);
                        db()->exec('RELEASE SAVEPOINT staff_push_accepted');$sent++;
                    }catch(Throwable $e){db()->exec('ROLLBACK TO SAVEPOINT staff_push_accepted');db()->exec('RELEASE SAVEPOINT staff_push_accepted');throw $e;}
                }elseif(($ticket['details']['error']??'')==='DeviceNotRegistered')db()->prepare('DELETE FROM staff_push_devices WHERE token=?')->execute([$d['token']]);
                else staff_push_retry($d,$ticket['details']['error']??'send_http_'.$status);
            }catch(Throwable){staff_push_retry($d,'transport_error');}
        }
        db()->prepare('DELETE FROM staff_push_events WHERE created<?')->execute([time()-7*86400]);
        db()->prepare('INSERT OR REPLACE INTO meta(key,value) VALUES("staff_push_worker_last",?)')->execute([gmdate('c')]);
        return $sent;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
