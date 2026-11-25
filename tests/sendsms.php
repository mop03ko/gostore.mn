<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/sendsms-'.bin2hex(random_bytes(6)));
foreach(['SENDSMS_ENABLED=1','SENDSMS_ORDER_EVENTS=1','SENDSMS_OTP_ENABLED=1','SENDSMS_API_KEY=fake-key','SENDSMS_API_TOKEN=fake-token','SENDSMS_TYPE=standard'] as $v)putenv($v);
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/sms-orders.php';
$calls=[];$mode='ok';
function sendsms_http(array $body):array{global $calls,$mode;$calls[]=$body;if($mode==='unknown')throw new SendSmsUncertain('timeout');if($mode==='rejected')throw new SendSmsRejected('no balance');return ['status'=>1,'data'=>['queued'=>1,'totalCost'=>20]];}
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function rejected(callable $f):void{try{$f();}catch(ApiError $e){return;}throw new RuntimeException('Expected rejection');}
check(sendsms_phone('+976 9911-2233')==='99112233','Phone normalization');
foreach(['9911223','+861234567890','99112233,88112233','99112233<script>'] as $p)rejected(fn()=>sendsms_payload($p,'Hello'));
sendsms_payload('99112233',str_repeat('a',160));sendsms_payload('99112233',str_repeat('Ө',70));
rejected(fn()=>sendsms_payload('99112233',str_repeat('a',161)));rejected(fn()=>sendsms_payload('99112233',str_repeat('Ө',71)));rejected(fn()=>sendsms_payload('99112233',"a\nb"));
db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['warehouse_definition_wh-123456abcdef',json_encode(['city'=>'Сайншанд'])]);
function order_seed(string $id):array{$o=['id'=>$id,'paid'=>false,'status'=>'quoted','phone'=>'+97699112233','warehouse_locations'=>['ulaanbaatar'=>'wh-123456abcdef']];$at=gmdate('c');db()->prepare('INSERT INTO orders VALUES(?,?,?,?,?,?)')->execute([$id,hash('sha256',$id),$id,json_encode($o),$at,$at]);return $o;}
$o=order_seed('GS-SMS001');$o['paid']=true;$o['status']='confirmed';save_order($o);save_order($o);
check((int)db()->query('SELECT count(*) FROM sms_order_queue')->fetchColumn()===1,'One event per paid order');
check(sms_orders_drain()===1&&sms_orders_drain()===0&&count($calls)===1,'Drain must send once');
check($calls[0]['type']==='standard'&&$calls[0]['phone']==='99112233','Standard, single recipient');
$o['status']='ready_pickup';save_order($o);sms_orders_drain();check(str_contains($calls[1]['message'],'Сайншанд'),'Correct pickup branch');
$o['status']='confirmed';save_order($o);$o['status']='ready_pickup';save_order($o);sms_orders_drain();check(count($calls)===2,'Repeated status must not duplicate SMS');
$o=order_seed('GS-SMS002');$o['paid']=true;save_order($o);$mode='unknown';sms_orders_drain();sms_orders_drain();check(count($calls)===3,'Unknown acceptance must not retry');
check(db()->query('SELECT state FROM sms_order_queue WHERE order_id="GS-SMS002"')->fetchColumn()==='uncertain','Timeout retained for reconciliation');
$o=order_seed('GS-SMS003');$o['paid']=true;save_order($o);$mode='rejected';sms_orders_drain();sms_orders_drain();check(count($calls)===4,'Rejected SMS must not retry spending automatically');
$o=order_seed('GS-SMS004');$o['status']='ready_pickup';save_order($o);$o['status']='cancelled';save_order($o);$mode='ok';sms_orders_drain();check(count($calls)===4,'Stale pickup notice cancelled');
$o=order_seed('GS-SMS005');$o['paid']=true;db()->exec('BEGIN IMMEDIATE');save_order($o);db()->exec('ROLLBACK');sms_orders_drain();check(count($calls)===4,'Rolled back order must not queue SMS');
$o=order_seed('GS-SMS006');$o['paid']=true;save_order($o);db()->exec('UPDATE sms_order_queue SET state="sending",updated=0 WHERE order_id="GS-SMS006"');sms_orders_drain();check(count($calls)===4,'Interrupted send is not resent');
function queue_state(string $id,string $event): ?string {
    $q=db()->prepare('SELECT state FROM sms_order_queue WHERE order_id=? AND event=?');
    $q->execute([$id,$event]);return $q->fetchColumn()?:null;
}
function transport_bill(int $total): array {
    return ['total'=>$total,'breakdown'=>['cargo_mnt'=>2000,'delivery_mnt'=>2500],'confirmed_at'=>gmdate('c')];
}
$o=order_seed('GS-SMS007');$o['status']='erenhot_dispatched';$o['settlement']=transport_bill(4500);save_order($o);
check(sms_orders_drain()===0,'Early settlement does not notify until arrival');
$o['status']='ulaanbaatar';save_order($o);
check(sms_orders_drain()===0,'Receipt alone does not notify');
$o['status']='ready_delivery';save_order($o);save_order($o);
check(queue_state($o['id'],'transport_balance')==='pending','Ready delivery queues final balance');
$o['settlement']=transport_bill(5700);$o['freight']=['paid_amount'=>1200];save_order($o);
check(sms_orders_drain()===1&&sms_orders_drain()===0&&count($calls)===5,'Exactly one delivery balance SMS');
check($calls[4]['type']==='standard'&&$calls[4]['phone']==='99112233','Balance SMS uses customer phone and standard tariff');
check($calls[4]['message']==='Ачаа ирлээ. Төлөх 4,500₮. https://gostore.mn/account/orders/GS-SMS007','Arrival, current outstanding amount and the order payment link');

$o=order_seed('GS-261013-ABCDEF12');$o['amount']=10000;$o['paid']=true;$o['status']='ulaanbaatar';save_order($o);sms_orders_drain();
$o['status']='ready_pickup';$o['fulfillment']=['method'=>'pickup','contact_phone'=>'88112233'];save_order($o);
check(sms_orders_drain()===0,'Pickup still awaiting manual settlement is not ready for collection SMS');
$o['settlement']=transport_bill(14500);save_order($o);
check(sms_orders_drain()===1&&queue_state($o['id'],'pickup')===null,'Manual settlement queues only the balance notice');
check(str_contains(end($calls)['message'],'Tanii achaa irlee. Tanii uldegdel tulbur 4,500 tugrug.')&&str_ends_with(end($calls)['message'],$o['id'])&&end($calls)['phone']==='99112233','Legacy ID and ordering customer, independent of handover contact');
$o['freight']=['paid_amount'=>4500];save_order($o);
check(sms_orders_drain()===1&&queue_state($o['id'],'pickup')==='accepted','Pickup notice after the full balance clears');

$o=order_seed('GS-SMS008');$o['status']='ready_delivery';$o['settlement']=transport_bill(1000);save_order($o);
$o['settlement']=transport_bill(2300);save_order($o);
check(sms_orders_drain()===1&&str_contains(end($calls)['message'],'2,300₮'),'Superseded balance is updated before sending');
$o=order_seed('GS-SMS009');$o['status']='ready_delivery';$o['settlement']=transport_bill(4500);save_order($o);
$o['freight']=['paid_amount'=>4500];save_order($o);
check(sms_orders_drain()===0&&queue_state($o['id'],'transport_balance')==='cancelled','Paying before the worker cancels the notice');
$o['settlement']=transport_bill(5000);save_order($o);
check(sms_orders_drain()===1&&str_contains(end($calls)['message'],'500₮'),'A new balance can revive a notice cancelled before sending');
$o=order_seed('GS-SMS010');$o['status']='ready_delivery';$o['settlement']=transport_bill(4500);
db()->exec('BEGIN IMMEDIATE');save_order($o);db()->exec('ROLLBACK');
check(queue_state($o['id'],'transport_balance')===null,'Rolled-back confirmation cancels queue insertion');
save_order($o);$o['status']='cancelled';save_order($o);
check(sms_orders_drain()===0&&queue_state($o['id'],'transport_balance')==='cancelled','Cancelled order is not messaged');
$o=order_seed('GS-SMS011');$o['status']='ready_delivery';$o['settlement']=transport_bill(4500);$o['demo']=true;save_order($o);
check(queue_state($o['id'],'transport_balance')===null,'Demo order is not messaged');
$o=order_seed('GS-SMS012');$o['status']='ready_delivery';$o['settlement']=transport_bill(4500);$o['phone']='invalid';save_order($o);
check(queue_state($o['id'],'transport_balance')===null,'Missing valid customer phone does not block settlement');
$o=order_seed('GS-SMS013');$o['status']='ready_delivery';$o['settlement']=transport_bill(4500);
putenv('SENDSMS_ORDER_EVENTS=0');save_order($o);putenv('SENDSMS_ORDER_EVENTS=1');save_order($o);
check(queue_state($o['id'],'transport_balance')===null,'Existing qualifying orders are not backfilled on ordinary saves');
function reminder_rejected(string $id,int $status): void {
    try{sms_transport_reminder($id);}catch(ApiError $e){check($e->getCode()===$status,'Unexpected reminder rejection code');return;}
    throw new RuntimeException('Expected reminder rejection');
}
$o=order_row('GS-SMS013')['order'];
check(sms_transport_reminder($o['id'])['state']==='queued','Administrator can queue for an existing payable balance');
check(sms_transport_reminder($o['id'])['state']==='already_queued','Repeated clicks reuse the pending request');
$o['settlement']=transport_bill(6200);$o['freight']=['paid_amount'=>1200];save_order($o);
check(sms_orders_drain()===1&&str_contains(end($calls)['message'],'5,000₮'),'Reminder uses the latest due and shares delivery worker');
reminder_rejected($o['id'],429);
db()->prepare("UPDATE sms_order_queue SET updated=0 WHERE order_id=?")->execute([$o['id']]);
check(sms_transport_reminder($o['id'])['state']==='queued','A new reminder can be queued after cooldown');
$o['freight']=['paid_amount'=>6200];save_order($o);
check(sms_orders_drain()===0,'Worker skips a reminder paid while pending');
reminder_rejected($o['id'],409);

$o=order_seed('GS-SMS014');$o['status']='ready_delivery';$o['settlement']=transport_bill(4200);save_order($o);
check(sms_transport_reminder($o['id'])['state']==='already_queued','Manual action does not duplicate a pending automatic send');
check(sms_orders_drain()===1,'Automatic SMS still sends exactly once');
reminder_rejected($o['id'],429);
reminder_rejected('GS-SMS010',409);
reminder_rejected('GS-SMS011',409);
reminder_rejected('GS-SMS012',400);
$o=order_seed('GS-SMS015');$o['status']='ready_pickup';$o['settlement']=transport_bill(4500);$o['admin_status']='completed';save_order($o);
$o['freight_receipts'][]=['amount'=>4500,'recorded_at'=>gmdate('c')];save_order($o);
check(sms_orders_drain()===0&&queue_state($o['id'],'pickup')===null,'A recorded delivery must not get a pickup notice after paying');
$longId='GS-'.str_repeat('A',45);
$longText=sms_transport_balance_text($longId,100000000);
check(str_contains($longText,'Tanii achaa irlee. Tanii uldegdel tulbur 100,000,000 tugrug.')&&str_ends_with($longText,$longId),'Long order IDs use the single-segment ASCII template');
sendsms_payload('99112233',$longText);

echo "PASS Transport SMS: post-arrival final balance, payment link, latest amount, deduplication, pending cancellation, standard tariff, and customer phone.\n";
echo "PASS SendSMS: validation, text limits, standard tariff, atomic queue, deduplication, branch text, stale cancellation, rejected/uncertain/crashed sends retained without retries.\n";
