<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/customer-push-test-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_CUSTOMER_PUSH_ENABLED=1');
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/customer-push.php';
ini_set('session.use_cookies','0');session_start();$_SERVER['REMOTE_ADDR']='127.0.0.1';
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function notice(string $owner):void{db()->prepare('INSERT INTO order_notifications (order_id,kind,message,created) VALUES (?,"status","private details",?)')->execute(['order-'.$owner,gmdate('c')]);}
$now=gmdate('c');foreach(['one','two'] as $id){db()->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute([$id,$id.'@example.test',$id,'','','hash',$now,$now]);db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute(['order-'.$id,'hash','key-'.$id,'{}',$now,$now]);db()->prepare('INSERT INTO customer_orders VALUES (?,?,?)')->execute(['order-'.$id,$id,$now]);}
$c=['id'=>'one','auth_version'=>1];$token='ExponentPushToken[abcdefghijklmnop]';$input=['token'=>$token,'platform'=>'android'];
notice('one');customer_push_register($c,$input);check(customer_push_drain(20,fn()=>throw new RuntimeException('Historical notification sent'))===0,'Skip historical notices');
putenv('GOSTORE_CUSTOMER_PUSH_PLATFORMS=ios');check(customer_push_enabled('ios')&&!customer_push_enabled('android'),'Platform activation');
notice('one');check(customer_push_drain(20,fn()=>throw new RuntimeException('Disabled Android sent'))===0,'Disabled platform never sends');
putenv('GOSTORE_CUSTOMER_PUSH_PLATFORMS');db()->exec('DELETE FROM order_notifications WHERE id=(SELECT MAX(id) FROM order_notifications)');
notice('two');check(customer_push_drain(20,fn()=>throw new RuntimeException('Wrong owner'))===0,'Owner scope');
notice('one');$calls=0;$send=function($op,$payload)use(&$calls){$calls++;check($op==='send','Send endpoint');check(!str_contains(json_encode($payload),'private details')&&!isset($payload['data']['order_id']),'No personal/order content');return [200,['data'=>['status'=>'ok','id'=>'ticket-1']]];};
check(customer_push_drain(20,$send)===1&&$calls===1,'One send');
customer_push_register($c,$input);check(customer_push_drain(20,$send)===0&&$calls===1,'Pending ticket survives registration and prevents duplicate send');
db()->exec('UPDATE customer_push_devices SET next_attempt=0');
customer_push_drain(20,fn($op,$p)=>[200,['data'=>['ticket-1'=>['status'=>'ok']]]]);check(customer_push_drain(20,$send)===0,'Receipt advances cursor');
notice('one');customer_push_drain(20,fn()=>[500,[]]);check((int)db()->query('SELECT attempts FROM customer_push_devices')->fetchColumn()===1,'Failure backoff');
db()->exec('UPDATE customer_push_devices SET next_attempt=0');customer_push_drain(20,fn()=>[200,['data'=>['status'=>'error','details'=>['error'=>'DeviceNotRegistered']]]]);check((int)db()->query('SELECT COUNT(*) FROM customer_push_devices')->fetchColumn()===0,'Invalid device deleted');
customer_push_register($c,$input);customer_push_unregister(['id'=>'two'],$input);check((int)db()->query('SELECT COUNT(*) FROM customer_push_devices')->fetchColumn()===1,'Cannot unsubscribe another account');
$_SESSION['customer_id']='one';customer_push_revoke_session();check((int)db()->query('SELECT COUNT(*) FROM customer_push_devices')->fetchColumn()===0,'Logout revokes device');
customer_push_register($c,$input);db()->exec('UPDATE customers SET auth_version=2 WHERE id="one"');notice('one');customer_push_drain(20,fn()=>throw new RuntimeException('Revoked account sent'));check((int)db()->query('SELECT COUNT(*) FROM customer_push_devices')->fetchColumn()===0,'Reset revokes push');
putenv('GOSTORE_CUSTOMER_PUSH_ENABLED=0');check(customer_push_drain()===0,'Disabled worker does not send');
echo "PASS customer push: ownership, history cursor, ticket deduplication, receipts, retry, invalid tokens, logout/reset revocation, disabled delivery.\n";
