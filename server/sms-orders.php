<?php
declare(strict_types=1);
require_once __DIR__.'/sendsms.php';
function sms_orders_schema(): void {
    db()->exec('CREATE TABLE IF NOT EXISTS sms_order_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,event TEXT NOT NULL,phone TEXT NOT NULL,message TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,cost INTEGER,last_error TEXT NOT NULL DEFAULT "",UNIQUE(order_id,event));');
}
function sms_order_event(array $o,array $old): void {
    if(!sendsms_enabled('orders'))return;
    $events=[];
    if(!($old['paid']??false)&&($o['paid']??false))$events[]='paid';
    if(($old['status']??'')!=='ready_pickup'&&($o['status']??'')==='ready_pickup')$events[]='pickup';
    if(!$events||!preg_match('/^GS-[A-Z0-9]{6,20}$/D',$o['id']??''))return;
    try{$phone=sendsms_phone((string)($o['phone']??''));}catch(ApiError $e){return;}
    sms_orders_schema();
    foreach($events as $event){
        if($event==='paid')$text='GOStore '.$o['id'].': төлбөр баталгаажлаа. gostore.mn';
        else{
            $location=$o['warehouse_locations']['ulaanbaatar']??'ulaanbaatar';$branch='УБ';
            if($location!=='ulaanbaatar'){
                $q=db()->prepare('SELECT value FROM meta WHERE key=?');$q->execute(['warehouse_definition_'.$location]);$definition=json_decode($q->fetchColumn()?:'{}',true);
                $branch=['Улаанбаатар'=>'УБ','Замын-Үүд'=>'Замын-Үүд','Сайншанд'=>'Сайншанд'][$definition['city']??'']??'сонгосон';
            }
            $text='GOStore '.$o['id'].': '.$branch.' салбарт бэлэн. gostore.mn';
        }
        if(mb_strlen($text,'UTF-8')>70)continue;
        db()->prepare('INSERT OR IGNORE INTO sms_order_queue(order_id,event,phone,message,state,created,updated) VALUES (?,?,?,?,?,?,?)')->execute([$o['id'],$event,$phone,$text,'pending',time(),time()]);
    }
}
function sms_orders_drain(int $limit=20): int {
    if(!sendsms_enabled('orders'))return 0;sms_orders_schema();$db=db();$sent=0;
    // Crashed/uncertain attempts are never automatically sent again: this API has no idempotency key.
    $db->prepare('UPDATE sms_order_queue SET state="uncertain",last_error="worker_interrupted",updated=? WHERE state="sending" AND updated<?')->execute([time(),time()-300]);
    for($i=0;$i<$limit;$i++){
        $db->exec('BEGIN IMMEDIATE');
        try{$q=$db->query('SELECT * FROM sms_order_queue WHERE state="pending" ORDER BY id LIMIT 1');$row=$q->fetch();$q->closeCursor();if(!$row){$db->exec('COMMIT');break;}
            $o=order_row($row['order_id'])['order'];
            $valid=$row['event']==='paid'?($o['paid']??false):($o['status']??'')==='ready_pickup';
            $db->prepare('UPDATE sms_order_queue SET state=?,updated=? WHERE id=? AND state="pending"')->execute([$valid?'sending':'cancelled',time(),$row['id']]);$db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        if(!$valid)continue;
        $cost=null;$error='';
        try{$result=sendsms_send($row['phone'],$row['message']);$state='accepted';$cost=$result['cost'];$sent++;}
        catch(SendSmsRejected $e){$state='failed';$error='provider_rejected';}
        catch(Throwable $e){$state='uncertain';$error='acceptance_unknown';}
        $db->prepare('UPDATE sms_order_queue SET state=?,cost=?,last_error=?,updated=? WHERE id=? AND state="sending"')->execute([$state,$cost,$error,time(),$row['id']]);
    }return $sent;
}
