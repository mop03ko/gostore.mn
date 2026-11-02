<?php
declare(strict_types=1);
$dir=__DIR__.'/../tmp/warehouse-push-test-'.bin2hex(random_bytes(8));mkdir($dir,0700,true);putenv('GOSTORE_DATA_DIR='.$dir);putenv('GOSTORE_DISABLE_PUSH=1');
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/shipping.php';require __DIR__.'/../server/warehouse.php';
function check($v,string $m): void {if(!$v)throw new RuntimeException($m);}
function denied(callable $f,string $m): void {try{$f();}catch(ApiError){return;}throw new RuntimeException($m);}
warehouse_notice_schema(db());session_id(str_repeat('a',32));
foreach(['erenhot','ulaanbaatar'] as $location)db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute([warehouse_account_key($location),json_encode(['enabled'=>true,'version'=>'v1','password_hash'=>'test'])]);
$o=['id'=>'GS-PUSH01','status'=>'reviewing','route'=>['Эрээн','Замын-Үүд','Улаанбаатар'],'history'=>[]];
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$o['id'],'token','request',json_encode($o),gmdate('c'),gmdate('c')]);
save_order($o);check(count(warehouse_notice_list('erenhot')['notifications'])===0,'Unconfirmed order must not notify');
$keys=warehouse_push_keys();check($keys===warehouse_push_keys(),'VAPID key persists');check(strlen(base64_decode(strtr($keys['public'],'-_','+/')))===65,'Uncompressed P-256 public key');
foreach(['http://fcm.googleapis.com/x','https://fcm.googleapis.com.evil.test/x','https://127.0.0.1/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x','https://web.push.apple.com/x#fragment'] as $endpoint)denied(fn()=>warehouse_push_endpoint($endpoint),'Unsafe endpoint accepted');
$device=warehouse_push_subscribe(['endpoint'=>'https://fcm.googleapis.com/fcm/send/test','public_key'=>$keys['public']],'erenhot');
$ub=warehouse_push_subscribe(['endpoint'=>'https://updates.push.services.mozilla.com/wpush/v2/test','public_key'=>$keys['public']],'ulaanbaatar');
check(!isset($device['private']),'Private key not exposed');
$o['status']='confirmed';save_order($o);save_order($o);
check(count(warehouse_notice_list('erenhot')['notifications'])===1,'Erenhot gets one notification');check(warehouse_notice_list('ulaanbaatar')['unread']===1,'UB gets notification on confirmation');
check((int)db()->query('SELECT COUNT(*) FROM warehouse_push_devices WHERE queued_id>sent_id')->fetchColumn()===2,'Both devices queued');
$calls=0;check(warehouse_push_drain(20,function($d)use(&$calls){$calls++;return $d['location']==='erenhot'?201:503;})===1,'One provider accepts, one retries');
check($calls===2,'Both devices attempted');check(warehouse_push_drain(20,function()use(&$calls){$calls++;return 201;})===0&&$calls===2,'Delivered messages not resent and retries back off');
db()->exec('UPDATE warehouse_push_devices SET next_attempt=0');check(warehouse_push_drain(20,fn()=>201)===1,'Retry succeeds');
$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$device['token'];$delivery=warehouse_push_delivery();check($delivery['location']==='erenhot'&&$delivery['language']==='zh','Device scoped to Erenhot');check(!isset($delivery['notifications'][0]['customer']),'No customer PII in push');
$_SERVER['HTTP_AUTHORIZATION']='Bearer '.str_repeat('b',64);denied(fn()=>warehouse_push_delivery(),'Forged device token accepted');
$o['warehouse_locations']=['erenhot'=>'erenhot','ulaanbaatar'=>'wh-test'];
db()->prepare('INSERT INTO meta VALUES (?,?)')->execute(['warehouse_definition_wh-test',json_encode(['location'=>'wh-test','role'=>'ulaanbaatar','city'=>'Дархан','active'=>true])]);
save_order($o);check(warehouse_notice_list('ulaanbaatar')['unread']===0,'Former warehouse cannot read moved order');check(warehouse_notice_list('wh-test')['unread']===1,'New branch receives assigned order');
db()->exec('BEGIN IMMEDIATE');$o['warehouse_locations']['ulaanbaatar']='ulaanbaatar';save_order($o);db()->exec('ROLLBACK');check(warehouse_notice_list('ulaanbaatar')['unread']===0,'Rolled-back assignment stays private');
$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$device['token'];warehouse_push_revoke_token();denied(fn()=>warehouse_push_delivery(),'Revoked device token accepted');
$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$ub['token'];$account=warehouse_account('ulaanbaatar');$account['version']='v2';db()->prepare('UPDATE meta SET value=? WHERE key=?')->execute([json_encode($account),warehouse_account_key('ulaanbaatar')]);denied(fn()=>warehouse_push_delivery(),'Changed manager credentials must invalidate push');
for($i=0;$i<30;$i++){
 $header=warehouse_push_authorization('https://fcm.googleapis.com/fcm/send/test',$keys);preg_match('/t=([^,]+), k=/',$header,$m);$parts=explode('.',$m[1]);$sig=base64_decode(strtr($parts[2],'-_','+/'));check(strlen($sig)===64,'JWT signature width');
 $der='';foreach([substr($sig,0,32),substr($sig,32)] as $part){$part=ltrim($part,"\0");if(ord($part[0])>127)$part="\0".$part;$der.="\x02".chr(strlen($part)).$part;}$der="\x30".chr(strlen($der)).$der;
 check(openssl_verify($parts[0].'.'.$parts[1],$der,openssl_pkey_get_details(openssl_pkey_get_private($keys['private']))['key'],OPENSSL_ALGO_SHA256)===1,'VAPID signature verifies');
 $claims=json_decode(base64_decode(strtr($parts[1],'-_','+/')),true);check($claims['aud']==='https://fcm.googleapis.com'&&$claims['exp']>time()&&$claims['exp']<=time()+86400,'VAPID claims valid');
}
echo "PASS warehouse notifications: confirmation, deduplication, branch isolation, rollback, device revocation, endpoint restrictions, VAPID signatures.\n";
