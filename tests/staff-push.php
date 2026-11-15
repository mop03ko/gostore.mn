<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/staff-push-test-'.bin2hex(random_bytes(5)));putenv('GOSTORE_ADMIN_HASH=test-owner-hash');putenv('GOSTORE_DISABLE_PUSH=1');
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/admin-users.php';require __DIR__.'/../server/shipping.php';require __DIR__.'/../server/warehouse.php';require __DIR__.'/../server/staff-push.php';
ini_set('session.use_cookies','0');session_start();$_SERVER['REMOTE_ADDR']='127.0.0.1';
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function denied(callable $f,int $status):void{try{$f();}catch(ApiError $e){check($e->getCode()===$status,'Expected HTTP '.$status);return;}throw new RuntimeException('Expected denial');}
function drain(callable $http):int{return staff_push_drain(20,$http);}
function idle():void{check(drain(fn()=>throw new RuntimeException('Unexpected push'))===0,'No send');}
function receipt():void{db()->exec('UPDATE staff_push_receipts SET next_attempt=0');drain(fn($op)=>$op==='getReceipts'?[200,['data'=>array_fill_keys(array_column(db()->query('SELECT ticket FROM staff_push_receipts')->fetchAll(),'ticket'),['status'=>'ok'])]]:throw new RuntimeException('Expected receipt'));}
function update(array $o):void{save_order($o);}

staff_push_schema();denied(fn()=>staff_push_identity('admin'),401);denied(fn()=>staff_push_identity('warehouse'),401);denied(fn()=>staff_push_identity('other'),422);
$_SESSION['admin']=true;$_SESSION['admin_user']='owner';$_SESSION['admin_version']=admin_session_version(admin_owner_record());$admin=staff_push_identity('admin');
$adminToken='ExpoPushToken[adminabcdefghijkl]';$ubToken='ExpoPushToken[warehouseabcdefg]';
$o=['id'=>'GS-TEST01','status'=>'confirmed','route'=>['Эрээн','Улаанбаатар'],'warehouse_locations'=>['ulaanbaatar'=>'ulaanbaatar']];
db()->prepare('INSERT INTO orders VALUES(?,?,?,?,?,?)')->execute([$o['id'],'hash','key',json_encode($o),gmdate('c'),gmdate('c')]);
staff_push_register($admin,['token'=>$adminToken]);idle();
warehouse_device_schema();db()->prepare('INSERT OR REPLACE INTO meta VALUES(?,?)')->execute([warehouse_account_key('ulaanbaatar'),json_encode(['enabled'=>true,'version'=>'v1','password_hash'=>'test'])]);
$_SESSION['warehouse_location']='ulaanbaatar';$_SESSION['warehouse_version']='v1';$_SESSION['warehouse_device_hash']='device-test';
db()->prepare('INSERT INTO warehouse_login_devices VALUES(?,?,?,?,?,?,?)')->execute(['device-test','ulaanbaatar','v1','csrf',hash('sha256',session_id()),time()+86400,time()]);
$ub=staff_push_identity('warehouse');staff_push_register($ub,['token'=>$ubToken]);idle();
$count=staff_push_cursor();update($o);check(staff_push_cursor()===$count,'No-op saves do not enqueue');
db()->exec('BEGIN');$o['status']='shipping';update($o);db()->exec('ROLLBACK');check(staff_push_cursor()===$count,'Event rolls back with order');
$o['status']='shipping';update($o);$sent=[];
$send=function($op,$p)use(&$sent){check($op==='send','Send operation');check($p['sound']==='default'&&$p['priority']==='high','Audible native alert');check(isset($p['title'],$p['body'])&&!isset($p['_contentAvailable']),'OS alert, not data-only wake');check(!str_contains(json_encode($p),'GS-TEST01'),'No order PII');$sent[]=$p['to'];return [200,['data'=>['status'=>'ok','id'=>'ticket-'.bin2hex(random_bytes(4))]]];};
check(drain($send)===2,'Admin + assigned UB');staff_push_register($admin,['token'=>$adminToken]);idle();$o['status']='erenhot';update($o);check(drain($send)===2,'New events send while prior receipts are pending');receipt();idle();
$o['warehouse_locations']['ulaanbaatar']='wh-other';update($o);$sent=[];check(drain($send)===1&&$sent===[$adminToken],'Reassigned order hidden from former UB');receipt();
$o['warehouse_locations']['ulaanbaatar']='ulaanbaatar';update($o);db()->exec('DELETE FROM warehouse_login_devices');$sent=[];check(drain($send)===1&&$sent===[$adminToken],'Warehouse logout revokes push even with suspended app');receipt();
staff_push_action($admin,'test',['token'=>$adminToken]);idle();db()->exec('UPDATE staff_push_devices SET test_at=1');check(drain($send)===1,'Delayed test does not require fake order');receipt();idle();
$o['status']='erenhot_ready';update($o);check(drain(fn()=>[503,[]])===0,'Transport fails safely');check((int)db()->query('SELECT attempts FROM staff_push_devices')->fetchColumn()===1,'Backoff recorded');idle();
db()->exec('UPDATE staff_push_devices SET next_attempt=0');check(drain($send)===1,'Transient retry sends');db()->exec('UPDATE staff_push_receipts SET next_attempt=0');drain(fn()=>[200,['data'=>array_fill_keys(array_column(db()->query('SELECT ticket FROM staff_push_receipts')->fetchAll(),'ticket'),['status'=>'error','details'=>['error'=>'InvalidCredentials']])]]);check((int)db()->query('SELECT cursor FROM staff_push_devices')->fetchColumn()<staff_push_cursor(),'Known receipt failure retains order for retry');
db()->exec('UPDATE staff_push_devices SET next_attempt=0');drain(fn()=>[200,['data'=>['status'=>'error','details'=>['error'=>'DeviceNotRegistered']]]]);check((int)db()->query('SELECT COUNT(*) FROM staff_push_devices')->fetchColumn()===0,'Dead token removed');
staff_push_register($admin,['token'=>$adminToken]);staff_push_revoke_session();check((int)db()->query('SELECT COUNT(*) FROM staff_push_devices')->fetchColumn()===0,'Admin logout revokes');
staff_push_register($admin,['token'=>$adminToken]);db()->exec('UPDATE staff_push_devices SET version="revoked",test_at=1');idle();check((int)db()->query('SELECT COUNT(*) FROM staff_push_devices')->fetchColumn()===0,'Changed account credentials revoke');
$_SESSION['csrf']='expected';$_SERVER['HTTP_X_CSRF_TOKEN']='forged';denied(fn()=>csrf_required(),403);
$max=staff_push_cursor();db()->exec('DELETE FROM staff_push_events');check(staff_push_cursor()===$max,'Retention never resets cursor');
echo "PASS staff native push: auth, CSRF, native sound, rollback, history, live branch scope, session/logout revocation, token refresh, coalescing, receipts, retries, delayed test and retention.\n";
