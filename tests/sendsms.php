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
echo "PASS SendSMS: validation, text limits, standard tariff, atomic queue, deduplication, branch text, stale cancellation, rejected/uncertain/crashed sends retained without retries.\n";
