<?php
declare(strict_types=1);
require_once __DIR__.'/customer-push.php';

// Admin-written messages for customers: an inbox copy per recipient (web bell, account page, app)
// and an optional phone push. Service notices use the existing order-notification opt-in; promotions
// are pushed only to customers who separately enabled promotional pushes. Recipients are fixed when
// the message is sent, so later sign-ups do not receive older broadcasts.
const CUSTOMER_MESSAGE_KINDS=['service','promo'];
const CUSTOMER_MESSAGE_AUDIENCES=['all','active','customer'];
function customer_messages_schema(): void {
    customer_push_schema();
    db()->exec('CREATE TABLE IF NOT EXISTS customer_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,audience TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,link TEXT NOT NULL DEFAULT "",recipients INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS customer_message_inbox (customer_id TEXT NOT NULL,message_id INTEGER NOT NULL REFERENCES customer_messages(id),read_at TEXT,PRIMARY KEY(customer_id,message_id));
        CREATE INDEX IF NOT EXISTS customer_message_inbox_message ON customer_message_inbox(message_id);
        CREATE TABLE IF NOT EXISTS customer_message_push (message_id INTEGER NOT NULL REFERENCES customer_messages(id),token TEXT NOT NULL,customer_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT "pending",ticket TEXT NOT NULL DEFAULT "",ticket_at INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,last_error TEXT NOT NULL DEFAULT "",PRIMARY KEY(message_id,token));
        CREATE INDEX IF NOT EXISTS customer_message_push_status ON customer_message_push(status,next_attempt);
        CREATE TABLE IF NOT EXISTS customer_message_prefs (customer_id TEXT PRIMARY KEY,promo_push INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);');
}
function customer_message_text(array $b,string $key,int $max,bool $required=true): string {
    $value=$b[$key]??'';if(!is_string($value))fail('Мэдэгдлийн талбар буруу.',422);
    $value=trim(preg_replace('/\r\n?/',"\n",$value));$value=preg_replace('/[^\P{C}\n]/u','',$value)??'';
    if($required&&$value==='')fail($key==='title'?'Гарчиг оруулна уу.':'Мэдэгдлийн текст оруулна уу.',422);
    if(mb_strlen($value)>$max)fail('Мэдэгдэл хэт урт байна ('.$max.' тэмдэгт хүртэл).',422);
    return $value;
}
// Links stay on gostore.mn: a site path, or a full gostore.mn address reduced to its path.
function customer_message_link(string $link): string {
    $link=trim($link);if($link==='')return '';
    if(preg_match('~^https://(?:www\.)?gostore\.mn(/[^\s]*)?$~iD',$link,$m))$link=$m[1]??'/';
    if(!preg_match('~^/(?!/)[^\s\\\\<>"]{0,199}$~D',$link))fail('Холбоос gostore.mn доторх хаяг байх ёстой (жишээ нь /help).',422);
    return $link;
}
function customer_message_phone_owner(string $raw): string {
    $phone=verify_mn_phone($raw);
    $q=db()->prepare('SELECT customer_id FROM customer_phone_auth WHERE phone=?');$q->execute([$phone]);$id=$q->fetchColumn();
    if(is_string($id))return $id;
    $q=db()->prepare("SELECT id FROM customers WHERE email NOT LIKE 'deleted-%@invalid.example' AND substr(replace(replace(replace(replace(phone,' ',''),'-',''),'(',''),')',''),-8)=?");$q->execute([$phone]);$ids=$q->fetchAll(PDO::FETCH_COLUMN);
    if(!$ids)fail('Энэ дугаартай хэрэглэгч олдсонгүй.',404);
    if(count($ids)>1)fail('Энэ дугаар олон бүртгэлд байна. Хэрэглэгчийг утасны баталгаажуулалттай дугаараар нь сонгоно уу.',409);
    return $ids[0];
}
// Recipient customer IDs for an audience. "Active" means at least one order not yet completed or cancelled.
function customer_message_recipients(string $audience,string $phone=''): array {
    if(!in_array($audience,CUSTOMER_MESSAGE_AUDIENCES,true))fail('Хүлээн авагч буруу.',422);
    if($audience==='customer')return [customer_message_phone_owner($phone)];
    if($audience==='all')return db()->query("SELECT id FROM customers WHERE email NOT LIKE 'deleted-%@invalid.example' ORDER BY created")->fetchAll(PDO::FETCH_COLUMN);
    $ids=[];
    foreach(db()->query("SELECT co.customer_id,o.data FROM customer_orders co JOIN orders o ON o.id=co.order_id JOIN customers c ON c.id=co.customer_id WHERE c.email NOT LIKE 'deleted-%@invalid.example'") as $r){
        $status=json_decode($r['data'],true)['status']??'new';if(!in_array($status,['completed','cancelled'],true))$ids[$r['customer_id']]=true;
    }
    return array_keys($ids);
}
// Devices that may receive this kind of push now; promotions need the separate promotional opt-in.
function customer_message_devices(array $customers,string $kind): array {
    if(!$customers||!customer_push_enabled())return [];
    $platforms=function_exists('customer_push_platforms')?customer_push_platforms():['ios','android'];if(!$platforms)return [];
    $devices=[];
    foreach(array_chunk($customers,400) as $chunk){
        $sql='SELECT d.token,d.customer_id FROM customer_push_devices d JOIN customers c ON c.id=d.customer_id AND c.auth_version=d.auth_version WHERE d.expires>? AND d.platform IN ('.implode(',',array_fill(0,count($platforms),'?')).') AND d.customer_id IN ('.implode(',',array_fill(0,count($chunk),'?')).')';
        if($kind==='promo')$sql.=' AND EXISTS (SELECT 1 FROM customer_message_prefs p WHERE p.customer_id=d.customer_id AND p.promo_push=1)';
        $q=db()->prepare($sql);$q->execute([time(),...$platforms,...$chunk]);array_push($devices,...$q->fetchAll());
    }
    return $devices;
}
function customer_message_input(array $b): array {
    $kind=str_field($b,'kind',10);if(!in_array($kind,CUSTOMER_MESSAGE_KINDS,true))fail('Мэдэгдлийн төрөл буруу.',422);
    $audience=str_field($b,'audience',10);$phone=$audience==='customer'?str_field($b,'phone',30):'';
    return ['kind'=>$kind,'audience'=>$audience,'phone'=>$phone];
}
function customer_message_preview(array $b): array {
    customer_messages_schema();$in=customer_message_input($b);$customers=customer_message_recipients($in['audience'],$in['phone']);
    return ['recipients'=>count($customers),'push_devices'=>count(customer_message_devices($customers,$in['kind'])),'push_enabled'=>customer_push_enabled()];
}
function customer_message_send(array $b): array {
    customer_messages_schema();limit_attempts('admin-message-send',30,3600);
    $request=str_field($b,'request_id',64);if(!preg_match('/^[A-Za-z0-9-]{16,64}$/D',$request))fail('Хүсэлтийн дугаар буруу.',422);
    $in=customer_message_input($b);$title=customer_message_text($b,'title',80);$body=customer_message_text($b,'body',1000);
    $link=customer_message_link(is_string($b['link']??null)?$b['link']:'');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        // A repeated submit (double click, retried request) returns the first send instead of a duplicate.
        $q=$db->prepare('SELECT * FROM customer_messages WHERE request_id=?');$q->execute([$request]);$old=$q->fetch();
        if($old){$db->exec('COMMIT');return ['message'=>customer_message_summary($old),'duplicate'=>true];}
        $customers=customer_message_recipients($in['audience'],$in['phone']);if(!$customers)fail('Энэ бүлэгт хүлээн авагч алга.',409);
        $db->prepare('INSERT INTO customer_messages (request_id,kind,audience,title,body,link,recipients,created) VALUES (?,?,?,?,?,?,?,?)')->execute([$request,$in['kind'],$in['audience'],$title,$body,$link,count($customers),gmdate('c')]);
        $id=(int)$db->lastInsertId();$inbox=$db->prepare('INSERT INTO customer_message_inbox (customer_id,message_id) VALUES (?,?)');
        foreach($customers as $c)$inbox->execute([$c,$id]);
        $push=$db->prepare('INSERT OR IGNORE INTO customer_message_push (message_id,token,customer_id) VALUES (?,?,?)');
        foreach(customer_message_devices($customers,$in['kind']) as $d)$push->execute([$id,$d['token'],$d['customer_id']]);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    customer_messages_schedule();
    $q=db()->prepare('SELECT * FROM customer_messages WHERE id=?');$q->execute([$id]);return ['message'=>customer_message_summary($q->fetch()),'duplicate'=>false];
}
function customer_message_summary(array $m): array {
    $id=(int)$m['id'];$count=static function(string $sql)use($id):int{$q=db()->prepare($sql);$q->execute([$id]);return (int)$q->fetchColumn();};
    $push=[];$q=db()->prepare('SELECT status,COUNT(*) FROM customer_message_push WHERE message_id=? GROUP BY status');$q->execute([$id]);foreach($q->fetchAll(PDO::FETCH_KEY_PAIR) as $k=>$v)$push[$k]=(int)$v;
    return ['id'=>$id,'kind'=>$m['kind'],'audience'=>$m['audience'],'title'=>$m['title'],'body'=>$m['body'],'link'=>$m['link'],'created'=>$m['created'],'recipients'=>(int)$m['recipients'],
        'read'=>$count('SELECT COUNT(*) FROM customer_message_inbox WHERE message_id=? AND read_at IS NOT NULL'),
        'push'=>['queued'=>($push['pending']??0)+($push['sent']??0),'delivered'=>$push['done']??0,'failed'=>$push['failed']??0,'skipped'=>$push['skipped']??0]];
}
function customer_messages_admin(): array {
    customer_messages_schema();
    return ['messages'=>array_map('customer_message_summary',db()->query('SELECT * FROM customer_messages ORDER BY id DESC LIMIT 30')->fetchAll()),'push_enabled'=>customer_push_enabled()];
}
// Customer side: latest 50 messages; read state is per customer.
function customer_messages_list(string $customer): array {
    customer_messages_schema();
    $q=db()->prepare('SELECT m.id,m.kind,m.title,m.body,m.link,m.created,i.read_at FROM customer_message_inbox i JOIN customer_messages m ON m.id=i.message_id WHERE i.customer_id=? ORDER BY m.id DESC LIMIT 50');$q->execute([$customer]);
    $u=db()->prepare('SELECT COUNT(*) FROM customer_message_inbox WHERE customer_id=? AND read_at IS NULL');$u->execute([$customer]);
    return ['messages'=>array_map(fn($r)=>['id'=>(int)$r['id']]+$r,$q->fetchAll()),'unread'=>(int)$u->fetchColumn()];
}
function customer_messages_read(string $customer,int $through): void {
    if($through<1)return;customer_messages_schema();
    db()->prepare('UPDATE customer_message_inbox SET read_at=? WHERE customer_id=? AND message_id<=? AND read_at IS NULL')->execute([gmdate('c'),$customer,$through]);
}
function customer_message_settings(string $customer): array {
    customer_messages_schema();$q=db()->prepare('SELECT promo_push FROM customer_message_prefs WHERE customer_id=?');$q->execute([$customer]);
    return ['promo_push'=>(int)$q->fetchColumn()===1];
}
function customer_message_settings_save(string $customer,array $b): array {
    customer_messages_schema();if(!is_bool($b['promo_push']??null))fail('Тохиргоо буруу.',422);limit_attempts('customer-message-settings:'.$customer,30,3600);
    db()->prepare('INSERT OR REPLACE INTO customer_message_prefs (customer_id,promo_push,updated) VALUES (?,?,?)')->execute([$customer,$b['promo_push']?1:0,gmdate('c')]);
    if(!$b['promo_push'])db()->prepare("UPDATE customer_message_push SET status='skipped',last_error='opted_out' WHERE customer_id=? AND status='pending' AND message_id IN (SELECT id FROM customer_messages WHERE kind='promo')")->execute([$customer]);
    return customer_message_settings($customer);
}
function customer_messages_delete_customer(string $customer): void {
    customer_messages_schema();
    foreach(['customer_message_inbox','customer_message_push','customer_message_prefs'] as $t)db()->prepare('DELETE FROM '.$t.' WHERE customer_id=?')->execute([$customer]);
}
function customer_message_retry(array $r,string $error): void {
    $attempt=(int)$r['attempts']+1;$status=$attempt>=4?'failed':'pending';
    db()->prepare('UPDATE customer_message_push SET status=?,ticket="",attempts=?,next_attempt=?,last_error=? WHERE message_id=? AND token=?')->execute([$status,$attempt,time()+60*(4**$attempt),substr($error,0,80),$r['message_id'],$r['token']]);
}
function customer_message_drop_device(array $r): void {
    db()->prepare('DELETE FROM customer_push_devices WHERE token=?')->execute([$r['token']]);
    db()->prepare("UPDATE customer_message_push SET status='failed',ticket='',last_error='DeviceNotRegistered' WHERE token=? AND status IN ('pending','sent')")->execute([$r['token']]);
}
// Sends queued pushes in Expo batches of up to 100 and checks receipts after 15 minutes. Devices
// that were revoked (logout, PIN reset, account deletion) or lost promo consent are skipped.
function customer_messages_push_drain(int $limit=300,?callable $http=null,int $budget=40): int {
    if(!customer_push_enabled())return 0;
    customer_messages_schema();$http??='customer_push_http';$lock=fopen(config()['data_dir'].'/customer-message-push.lock','c');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock)fclose($lock);return 0;}
    $sent=0;$start=microtime(true);$now=time();
    try{
        $q=db()->prepare("SELECT * FROM customer_message_push WHERE status='sent' AND ticket_at<=? LIMIT 300");$q->execute([$now-900]);$rows=$q->fetchAll();
        if($rows){
            [$status,$r]=$http('getReceipts',['ids'=>array_column($rows,'ticket')]);
            foreach($rows as $row){
                $receipt=$status===200?($r['data'][$row['ticket']]??null):null;
                if(!$receipt){if($now-(int)$row['ticket_at']>=86400)db()->prepare("UPDATE customer_message_push SET status='done',last_error='receipt_unknown' WHERE message_id=? AND token=?")->execute([$row['message_id'],$row['token']]);continue;}
                if(($receipt['status']??'')==='ok'){db()->prepare("UPDATE customer_message_push SET status='done' WHERE message_id=? AND token=?")->execute([$row['message_id'],$row['token']]);continue;}
                $error=$receipt['details']['error']??'receipt_error';if($error==='DeviceNotRegistered')customer_message_drop_device($row);else customer_message_retry($row,$error);
            }
        }
        $platforms=function_exists('customer_push_platforms')?customer_push_platforms():['ios','android'];
        $valid='EXISTS (SELECT 1 FROM customer_push_devices d JOIN customers c ON c.id=d.customer_id AND c.auth_version=d.auth_version WHERE d.token=p.token AND d.customer_id=p.customer_id AND d.expires>?'.($platforms?' AND d.platform IN ('.implode(',',array_fill(0,count($platforms),'?')).')':' AND 0').') AND (m.kind<>\'promo\' OR EXISTS (SELECT 1 FROM customer_message_prefs f WHERE f.customer_id=p.customer_id AND f.promo_push=1))';
        db()->prepare("UPDATE customer_message_push SET status='skipped',last_error='device_or_consent' WHERE status='pending' AND rowid IN (SELECT p.rowid FROM customer_message_push p JOIN customer_messages m ON m.id=p.message_id WHERE p.status='pending' AND NOT (".$valid."))")->execute([$now,...$platforms]);
        $q=db()->prepare("SELECT p.*,m.kind,m.title,m.body FROM customer_message_push p JOIN customer_messages m ON m.id=p.message_id WHERE p.status='pending' AND p.next_attempt<=? AND ".$valid.' ORDER BY p.message_id,p.rowid LIMIT '.max(1,$limit));
        $q->execute([$now,$now,...$platforms]);
        foreach(array_chunk($q->fetchAll(),100) as $batch){
            if(microtime(true)-$start>$budget)break;
            $payload=array_map(fn($row)=>['to'=>$row['token'],'title'=>$row['title'],'body'=>mb_strlen($row['body'])>170?mb_substr($row['body'],0,169).'…':$row['body'],'sound'=>'default','ttl'=>86400,'data'=>['screen'=>'notifications','message_id'=>(int)$row['message_id']]]+($row['kind']==='service'?['channelId'=>'orders']:[]),$batch);
            try{[$status,$r]=$http('send',$payload);}catch(Throwable){$status=0;$r=[];}
            $tickets=$status===200&&is_array($r['data']??null)?array_values($r['data']):[];
            foreach($batch as $i=>$row){
                $ticket=$tickets[$i]??null;
                if(is_array($ticket)&&($ticket['status']??'')==='ok'&&is_string($ticket['id']??null)&&strlen($ticket['id'])<=200){
                    db()->prepare("UPDATE customer_message_push SET status='sent',ticket=?,ticket_at=?,last_error='' WHERE message_id=? AND token=?")->execute([$ticket['id'],time(),$row['message_id'],$row['token']]);$sent++;
                }elseif(is_array($ticket)&&($ticket['details']['error']??'')==='DeviceNotRegistered')customer_message_drop_device($row);
                else customer_message_retry($row,is_array($ticket)?($ticket['details']['error']??'send_error'):'send_http_'.$status);
            }
        }
        return $sent;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function customer_messages_schedule(): void {
    static $scheduled=false;if($scheduled||!customer_push_enabled()||PHP_SAPI==='cli')return;$scheduled=true;
    register_shutdown_function(function(){if(session_status()===PHP_SESSION_ACTIVE)session_write_close();if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();try{customer_messages_push_drain(300,null,20);}catch(Throwable){error_log('GOStore customer message push remains queued');}});
}
