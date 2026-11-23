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
    return ($o['status']??'')==='ready_pickup'&&$due===0
        &&(!isset($o['fulfillment'])||isset($o['settlement']));
}
function sms_transport_balance_text(string $id,int $due): string {
    $link='https://gostore.mn/account/orders/'.$id;
    $amount=number_format($due);
    $text=$amount.'₮ төлөх QPay '.$link;
    return mb_strlen($text,'UTF-8')<=70?$text:'GOStore: '.$amount.' tugrug uldegdel. QPay: '.$link;
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
function sms_orders_drain(int $limit=20): int {
    if(!sendsms_enabled('orders'))return 0;sms_orders_schema();$db=db();$sent=0;
    // Crashed/uncertain attempts are never automatically sent again: this API has no idempotency key.
    $db->prepare('UPDATE sms_order_queue SET state="uncertain",last_error="worker_interrupted",updated=? WHERE state="sending" AND updated<?')->execute([time(),time()-300]);
    for($i=0;$i<$limit;$i++){
        $db->exec('BEGIN IMMEDIATE');
        try{$q=$db->query('SELECT * FROM sms_order_queue WHERE state="pending" ORDER BY id LIMIT 1');$row=$q->fetch();$q->closeCursor();if(!$row){$db->exec('COMMIT');break;}
            $o=order_row($row['order_id'])['order'];
            $due=sms_transport_balance_due($o);
            $message=match($row['event']){
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
