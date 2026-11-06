<?php
declare(strict_types=1);
// Admin messages: audiences, inbox/read scope, link and text validation, idempotent sends,
// service vs promotional push consent, Expo batching, receipts, revocation and deletion.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/customer-messages-test-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_CUSTOMER_PUSH_ENABLED=1');putenv('GOSTORE_CUSTOMER_PUSH_PLATFORMS=ios,android');
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/verify-mn.php';require __DIR__.'/../server/customer-messages.php';
ini_set('session.use_cookies','0');session_start();$_SERVER['REMOTE_ADDR']='127.0.0.1';
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function denied(callable $f,int $code):void{try{$f();}catch(ApiError $e){check($e->getCode()===$code,'Wrong rejection '.$e->getCode().' '.$e->getMessage());return;}throw new RuntimeException('Expected rejection '.$code);}
function rows(string $sql):array{return db()->query($sql)->fetchAll();}
$now=gmdate('c');
foreach([['one','99 11-22 33','{"status":"new"}'],['two','','{"status":"completed"}'],['gone','88112233','{"status":"new"}']] as [$id,$phone,$order]){
    db()->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute([$id,$id==='gone'?'deleted-x@invalid.example':$id.'@example.test',$id,$phone,'','hash',$now,$now]);
    db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute(['order-'.$id,'hash','key-'.$id,$order,$now,$now]);db()->prepare('INSERT INTO customer_orders VALUES (?,?,?)')->execute(['order-'.$id,$id,$now]);
}
db()->prepare('INSERT INTO customer_phone_auth VALUES (?,?,?,?)')->execute(['95556677','two','hash',$now]);
$devices=['one'=>'ExponentPushToken[oneoneoneoneone]','two'=>'ExponentPushToken[twotwotwotwotwo]'];
foreach($devices as $id=>$token)customer_push_register(['id'=>$id,'auth_version'=>1],['token'=>$token,'platform'=>$id==='one'?'android':'ios']);

// Audiences exclude deleted accounts; "active" means an unfinished order; phones resolve to one account.
check(customer_message_preview(['kind'=>'service','audience'=>'all'])['recipients']===2,'All customers, excluding deleted');
check(customer_message_preview(['kind'=>'service','audience'=>'active'])['recipients']===1,'Active orders audience');
check(customer_message_recipients('customer','+976 99112233')===['one'],'Profile phone lookup');
check(customer_message_recipients('customer','95556677')===['two'],'Verified phone lookup');
denied(fn()=>customer_message_recipients('customer','88112233'),404);denied(fn()=>customer_message_recipients('customer','123'),400);
check(customer_message_preview(['kind'=>'service','audience'=>'all'])['push_devices']===2&&customer_message_preview(['kind'=>'promo','audience'=>'all'])['push_devices']===0,'Promo push needs separate consent');

// Validation: links stay on gostore.mn, control characters are removed, lengths are bounded.
check(customer_message_link('https://gostore.mn/help?x=1')==='/help?x=1'&&customer_message_link('/v/tb-1')==='/v/tb-1'&&customer_message_link('')==='','Site links');
foreach(['https://evil.example/','//evil.example','javascript:alert(1)','/a b'] as $bad)denied(fn()=>customer_message_link($bad),422);
$send=fn(array $extra)=>customer_message_send($extra+['request_id'=>bin2hex(random_bytes(10)),'kind'=>'service','audience'=>'all','title'=>'Баярын амралт','body'=>'Ачаа 2 хоног удаашрана.']);
denied(fn()=>$send(['title'=>'']),422);denied(fn()=>$send(['body'=>str_repeat('я',1001)]),422);denied(fn()=>$send(['kind'=>'spam']),422);denied(fn()=>$send(['request_id'=>'short']),422);
denied(fn()=>$send(['audience'=>'customer','phone'=>'88112233']),404);

// Service message to everyone: inbox per recipient, one push per device, repeat submit is not resent.
$first=$send(['request_id'=>'request-service-0001','body'=>"Ачаа\u{0007} 2 хоног удаашрана.\r\nУучлаарай.",'link'=>'https://gostore.mn/help']);
check(!$first['duplicate']&&$first['message']['recipients']===2&&$first['message']['body']==="Ачаа 2 хоног удаашрана.\nУучлаарай."&&$first['message']['link']==='/help','Sent and cleaned');
check($send(['request_id'=>'request-service-0001'])['duplicate']&&count(rows('SELECT * FROM customer_messages'))===1&&count(rows('SELECT * FROM customer_message_inbox'))===2,'Idempotent send');
$calls=[];$http=function(string $op,array $payload)use(&$calls){$calls[]=[$op,$payload];
    if($op==='send')return [200,['data'=>array_map(fn($p,$i)=>['status'=>'ok','id'=>'ticket-'.count($calls).'-'.$i],$payload,array_keys($payload))]];
    return [200,['data'=>array_combine($payload['ids'],array_map(fn($t)=>str_ends_with($t,'-0')?['status'=>'ok']:['status'=>'error','details'=>['error'=>'DeviceNotRegistered']],$payload['ids']))]];};
check(customer_messages_push_drain(300,$http)===2&&count($calls)===1&&count($calls[0][1])===2,'One Expo batch for both devices');
$p=$calls[0][1][0];check($p['title']==='Баярын амралт'&&$p['data']===['screen'=>'notifications','message_id'=>$first['message']['id']]&&$p['channelId']==='orders','Service push payload');
check(customer_messages_push_drain(300,$http)===0&&count($calls)===1,'Sent pushes are not repeated before receipts');
db()->exec('UPDATE customer_message_push SET ticket_at=ticket_at-1000');customer_messages_push_drain(300,$http);
check(count(rows("SELECT * FROM customer_message_push WHERE status='done'"))===1&&count(rows("SELECT * FROM customer_message_push WHERE status='failed'"))===1&&count(rows('SELECT * FROM customer_push_devices'))===1,'Receipts finish delivery and remove unregistered devices');
customer_push_register(['id'=>'two','auth_version'=>1],['token'=>$devices['two'],'platform'=>'ios']);

// Customer inbox: own messages only, read through an ID; other customers are unaffected.
$list=customer_messages_list('one');check($list['unread']===1&&$list['messages'][0]['title']==='Баярын амралт'&&!isset($list['messages'][0]['customer_id']),'Inbox list');
customer_messages_read('two',$first['message']['id']);check(customer_messages_list('one')['unread']===1&&customer_messages_list('two')['unread']===0,'Read state is per customer');
check(customer_message_summary(rows('SELECT * FROM customer_messages')[0])['read']===1,'Admin sees read count');

// Promotions push only to consenting customers; opting out skips queued promotional pushes.
check(customer_message_settings('one')===['promo_push'=>false],'Promo push off by default');
denied(fn()=>customer_message_settings_save('one',['promo_push'=>'yes']),422);
customer_message_settings_save('one',['promo_push'=>true]);customer_message_settings_save('two',['promo_push'=>true]);
$promo=$send(['kind'=>'promo','title'=>'11.11 хямдрал','body'=>str_repeat('Хямдрал ',40)]);
check(count(rows('SELECT * FROM customer_message_push WHERE message_id='.$promo['message']['id']))===2,'Consenting devices queued');
customer_message_settings_save('two',['promo_push'=>false]);$calls=[];customer_messages_push_drain(300,$http);
check(count($calls)===1&&count($calls[0][1])===1&&$calls[0][1][0]['to']===$devices['one']&&!isset($calls[0][1][0]['channelId'])&&mb_strlen($calls[0][1][0]['body'])===170,'Opt-out skipped; promo uses default channel and a short body');
check(rows("SELECT status FROM customer_message_push WHERE token='".$devices['two']."' AND message_id=".$promo['message']['id'])[0]['status']==='skipped','Opted-out push marked skipped');

// Single customer; PIN/password reset revokes queued pushes; transient errors back off then fail.
$one=$send(['audience'=>'customer','phone'=>'99112233','title'=>'Таны ачаа','body'=>'Агуулахаас авна уу.']);
check($one['message']['recipients']===1&&customer_messages_list('two')['messages'][0]['id']!==$one['message']['id'],'Only the chosen customer receives it');
db()->exec("UPDATE customers SET auth_version=2 WHERE id='one'");$calls=[];customer_messages_push_drain(300,$http);
check(!$calls&&rows("SELECT status FROM customer_message_push WHERE message_id=".$one['message']['id'])[0]['status']==='skipped','Revoked device skipped');
db()->exec("UPDATE customers SET auth_version=1 WHERE id='one'");customer_push_register(['id'=>'one','auth_version'=>1],['token'=>$devices['one'],'platform'=>'android']);
$late=$send(['audience'=>'customer','phone'=>'99112233']);
for($i=0;$i<4;$i++){db()->exec('UPDATE customer_message_push SET next_attempt=0 WHERE message_id='.$late['message']['id']);customer_messages_push_drain(300,fn()=>[503,[]]);}
check(rows('SELECT status,attempts FROM customer_message_push WHERE message_id='.$late['message']['id'])[0]===['status'=>'failed','attempts'=>4],'Bounded retries');

// Disabled push still delivers to the inbox; deletion removes the customer's message data.
putenv('GOSTORE_CUSTOMER_PUSH_ENABLED=0');$quiet=$send(['audience'=>'all']);
check($quiet['message']['recipients']===2&&!rows('SELECT * FROM customer_message_push WHERE message_id='.$quiet['message']['id'])&&customer_messages_push_drain(300,fn()=>throw new RuntimeException('Disabled push sent'))===0,'Inbox without push');
customer_messages_delete_customer('one');check(!rows("SELECT * FROM customer_message_inbox WHERE customer_id='one'")&&!rows("SELECT * FROM customer_message_prefs WHERE customer_id='one'"),'Deletion removes inbox and consent');
echo "PASS customer messages: audiences, phone lookup, validation, idempotent sends, per-customer inbox/read, service/promo consent, Expo batches, receipts, revocation, retries, disabled push, deletion.\n";
