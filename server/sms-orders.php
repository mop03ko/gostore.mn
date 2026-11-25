<?php
declare(strict_types=1);
require_once __DIR__.'/sendsms.php';
require_once __DIR__.'/settlement.php';
function sms_orders_schema(): void {
    db()->exec('CREATE TABLE IF NOT EXISTS sms_order_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,event TEXT NOT NULL,phone TEXT NOT NULL,message TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,cost INTEGER,last_error TEXT NOT NULL DEFAULT "",UNIQUE(order_id,event));');
}
function sms_transport_balance_due(array $o): int {
    if(!empty($o['demo'])||!isset($o['settlement'])||!in_array($o['status']??'',['ready_pickup','ready_delivery'],true))return 0;
    return settlement_summary($o)['due'];
}
function sms_pickup_notice_ready(array $o,int $due): bool {
    return ($o['status']??'')==='ready_pickup'&&$due===0&&!in_array($o['admin_status']??'',['completed','cancelled'],true)
        &&(!isset($o['fulfillment'])||isset($o['settlement']));
}
function sms_transport_balance_text(string $id,int $due): string {
    $link='https://gostore.mn/account/orders/'.$id;
    $amount=number_format($due);
    $text='Ачаа ирлээ. Төлөх '.$amount.'₮. '.$link;
    return mb_strlen($text,'UTF-8')<=70?$text:'Tanii achaa irlee. Tanii uldegdel tulbur '.$amount.' tugrug. '.$link;
}
function sms_order_event(array $o,array $old): void {
    if(!sendsms_enabled('orders'))return;
    $events=[];
    if(!($old['paid']??false)&&($o['paid']??false))$events[]='paid';
    $due=sms_transport_balance_due($o);$oldDue=sms_transport_balance_due($old);
    if($due>0&&$oldDue===0)$events[]='transport_balance';
    if(sms_pickup_notice_ready($o,$due)&&!sms_pickup_notice_ready($old,$oldDue))$events[]='pickup';
    if(!$events||!preg_match('/^GS-[A-Z0-9-]{3,45}$/D',$o['id']??''))return;
    try{$phone=sendsms_phone((string)($o['phone']??''));}catch(ApiError $e){return;}
    sms_orders_schema();
    foreach($events as $event){
        if($event==='paid')$text='GOStore '.$o['id'].': төлбөр баталгаажлаа. gostore.mn';
        elseif($event==='transport_balance'){
            $reminder=db()->prepare("SELECT 1 FROM sms_order_queue WHERE order_id=? AND event GLOB 'transport_reminder:*' AND state IN ('pending','sending') LIMIT 1");
            $reminder->execute([$o['id']]);$pending=$reminder->fetchColumn();$reminder->closeCursor();
            if($pending)continue;
            $text=sms_transport_balance_text($o['id'],$due);
            // A stale item cancelled before sending can be queued again when a payable balance returns.
            db()->prepare('UPDATE sms_order_queue SET state=?,phone=?,message=?,created=?,updated=? WHERE order_id=? AND event=? AND state=?')
                ->execute(['pending',$phone,$text,time(),time(),$o['id'],$event,'cancelled']);
        }else{
            $location=$o['warehouse_locations']['ulaanbaatar']??'ulaanbaatar';$branch='УБ';
            if($location!=='ulaanbaatar'){
                $q=db()->prepare('SELECT value FROM meta WHERE key=?');$q->execute(['warehouse_definition_'.$location]);$definition=json_decode($q->fetchColumn()?:'{}',true);
                $branch=['Улаанбаатар'=>'УБ','Замын-Үүд'=>'Замын-Үүд','Сайншанд'=>'Сайншанд'][$definition['city']??'']??'сонгосон';
            }
            $text='GOStore '.$o['id'].': '.$branch.' салбарт бэлэн. gostore.mn';
        }
        if($event!=='transport_balance'&&mb_strlen($text,'UTF-8')>70)continue;
        db()->prepare('INSERT OR IGNORE INTO sms_order_queue(order_id,event,phone,message,state,created,updated) VALUES (?,?,?,?,?,?,?)')->execute([$o['id'],$event,$phone,$text,'pending',time(),time()]);
    }
}
function sms_transport_reminder(string $id): array {
    if(!preg_match('/^GS-[A-Z0-9-]{3,45}$/D',$id))fail('Захиалгын код буруу.');
    if(!sendsms_enabled('orders'))fail('Захиалгын SMS үйлчилгээ түр боломжгүй.',503);
    sms_orders_schema();$db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];
        $due=sms_transport_balance_due($o);
        if($due<1)fail('Төлөх үлдэгдэлтэй, авах эсвэл хүргэлтэд бэлэн захиалгад SMS илгээнэ.',409);
        $phone=sendsms_phone((string)($o['phone']??''));
        $now=time();
        $recent=$db->prepare("SELECT state FROM sms_order_queue
            WHERE order_id=? AND (event='transport_balance' OR event GLOB 'transport_reminder:*')
            AND (state IN ('pending','sending') OR (state IN ('accepted','uncertain','failed') AND updated>?))
            ORDER BY CASE WHEN state IN ('pending','sending') THEN 0 ELSE 1 END LIMIT 1");
        $recent->execute([$id,$now-300]);$state=$recent->fetchColumn();$recent->closeCursor();
        if(in_array($state,['pending','sending'],true)){
            $db->exec('COMMIT');return ['state'=>'already_queued'];
        }
        if($state!==false)fail('Сүүлийн 5 минутад SMS илгээх оролдлого бүртгэгдсэн. Түр хүлээгээд дахин оролдоно уу.',429);
        $event='transport_reminder:'.bin2hex(random_bytes(8));
        $db->prepare('INSERT INTO sms_order_queue(order_id,event,phone,message,state,created,updated) VALUES (?,?,?,?,?,?,?)')
            ->execute([$id,$event,$phone,sms_transport_balance_text($id,$due),'pending',$now,$now]);
        $db->exec('COMMIT');return ['state'=>'queued'];
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function sms_orders_drain(int $limit=20): int {
    if(!sendsms_enabled('orders'))return 0;sms_orders_schema();$db=db();$sent=0;
    // Crashed/uncertain attempts are never automatically sent again: this API has no idempotency key.
    $db->prepare('UPDATE sms_order_queue SET state="uncertain",last_error="worker_interrupted",updated=? WHERE state="sending" AND updated<?')->execute([time(),time()-300]);
    for($i=0;$i<$limit;$i++){
        $db->exec('BEGIN IMMEDIATE');
        try{$q=$db->query('SELECT * FROM sms_order_queue WHERE state="pending" ORDER BY id LIMIT 1');$row=$q->fetch();$q->closeCursor();if(!$row){$db->exec('COMMIT');break;}
            $o=order_row($row['order_id'])['order'];
            $due=sms_transport_balance_due($o);
            $event=str_starts_with($row['event'],'transport_reminder:')?'transport_balance':$row['event'];
            $message=match($event){
                'paid'=>!empty($o['paid'])?$row['message']:null,
                'pickup'=>sms_pickup_notice_ready($o,$due)?$row['message']:null,
                'transport_balance'=>$due>0?sms_transport_balance_text($o['id'],$due):null,
                default=>null,
            };
            $db->prepare('UPDATE sms_order_queue SET state=?,message=?,updated=? WHERE id=? AND state="pending"')
                ->execute([$message!==null?'sending':'cancelled',$message??$row['message'],time(),$row['id']]);$db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        if($message===null)continue;
        $cost=null;$error='';
        try{$result=sendsms_send($row['phone'],$message);$state='accepted';$cost=$result['cost'];$sent++;}
        catch(SendSmsRejected $e){$state='failed';$error='provider_rejected';}
        catch(Throwable $e){$state='uncertain';$error='acceptance_unknown';}
        $db->prepare('UPDATE sms_order_queue SET state=?,cost=?,last_error=?,updated=? WHERE id=? AND state="sending"')->execute([$state,$cost,$error,time(),$row['id']]);
    }return $sent;
}
