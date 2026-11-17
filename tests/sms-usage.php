<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/sms-usage-'.bin2hex(random_bytes(6)));
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/admin-reports.php';require __DIR__.'/../server/sms-usage.php';
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function denied(callable $f,int $code):void{try{$f();}catch(ApiError $e){check($e->getCode()===$code,'Wrong status');return;}throw new RuntimeException('Expected denial');}
session_boot();denied(fn()=>admin_sms_usage([]),401);$_SESSION['admin']=true;$_SESSION['admin_version']=hash('sha256',admin_password_hash());
$a=sms_usage_otp_start('register','99112233');sms_usage_otp_result($a,'accepted',20);sms_usage_otp_result($a,'accepted',null,true);sms_usage_otp_result($a,'accepted',null,true);
$b=sms_usage_otp_start('reset','88112233');sms_usage_otp_result($b,'failed');
$c=sms_usage_otp_start('verify','77112233');db()->prepare('UPDATE sms_otp_usage SET updated=? WHERE id=?')->execute([time()-301,$c]);
$at=strtotime('2026-11-17T16:30:00Z');db()->exec('UPDATE sms_otp_usage SET created='.$at);
$insert=db()->prepare('INSERT INTO sms_order_queue(order_id,event,phone,message,state,created,updated,cost) VALUES (?,?,?,?,?,?,?,?)');
$insert->execute(['GS-TEST01','paid','99112233','private message','accepted',$at,$at,20]);
$insert->execute(['GS-TEST02','pickup','99112233','private message','accepted',$at,$at,null]);
$q=['from'=>'2026-11-18','to'=>'2026-11-18'];$r=admin_sms_usage($q);
check($r['summary']===['total'=>5,'known_cost'=>40,'unknown_cost'=>1,'verified'=>1],'Counts/cost/verification');
check($r['states']['accepted']===3&&$r['states']['failed']===1&&$r['states']['uncertain']===1,'Stale request uncertainty');
check(!str_contains(json_encode($r),'99112233')&&!str_contains(json_encode($r),'private message'),'No full phone or SMS content');
check(admin_sms_usage(['from'=>'2026-11-17','to'=>'2026-11-17'])['summary']['total']===0,'Ulaanbaatar day boundary');
check(admin_sms_usage($q+['kind'=>'otp'])['summary']['total']===3,'OTP filter');
check(admin_sms_usage($q+['kind'=>'order'])['summary']['total']===2,'Order filter');
for($i=0;$i<50;$i++)$insert->execute(['GS-PAGE'.$i,'paid','99112233','private','pending',$at,$at,null]);
$r=admin_sms_usage($q+['page'=>2]);check(count($r['rows'])===5&&$r['pages']===2,'Paginated all records');
denied(fn()=>admin_sms_usage($q+['kind'=>'secret']),400);denied(fn()=>admin_sms_usage($q+['page'=>0]),400);
echo "PASS SMS usage: admin access, date boundary, filters, totals, unknown cost, stale sends, masking, pagination.\n";
