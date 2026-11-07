<?php
declare(strict_types=1);
// Daily backup: consistent restorable copy, pruning, Google Drive upload/verification/pruning with a
// fake Google API, failure reporting, the operations e-mail (no customer data) and the CLI worker.
$dir=__DIR__.'/../tmp/backup-test-'.bin2hex(random_bytes(5));putenv('GOSTORE_DATA_DIR='.$dir);
require __DIR__.'/../server/bootstrap.php';require_once __DIR__.'/../server/shipping.php';require_once __DIR__.'/../server/supplier-budget.php';
require __DIR__.'/../server/backup.php';require __DIR__.'/../server/daily-report.php';
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
$now=gmdate('c');db()->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute(['c1','private-person@example.test','Нууц Нэр','99112233','Хаяг','hash',$now,$now]);
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute(['GS-1','hash','key-1','{"status":"new"}',$now,$now]);

// A gzipped copy restores to the same rows and passes SQLite's integrity check.
$b=backup_create();check(preg_match('/^gostore-\d{8}-\d{6}\.sqlite\.gz$/',$b['name'])===1&&$b['bytes']>0&&$b['tables']>5,'Backup created');
check((PHP_OS_FAMILY==='Windows'||substr(sprintf('%o',fileperms($b['file'])),-4)==='0600')&&!glob(backup_dir().'/.*.tmp'),'Private file, no temporary copy left');
$restored=$dir.'/restored.sqlite';file_put_contents($restored,gzdecode((string)file_get_contents($b['file'])));
$r=new PDO('sqlite:'.$restored);check($r->query('PRAGMA integrity_check')->fetchColumn()==='ok'&&$r->query("SELECT name FROM customers WHERE id='c1'")->fetchColumn()==='Нууц Нэр'&&$r->query('SELECT COUNT(*) FROM orders')->fetchColumn()==1,'Restorable copy');$r=null;

// Newest 30 copies are kept.
for($i=1;$i<=33;$i++)touch(backup_dir().sprintf('/gostore-202601%02d-000000.sqlite.gz',$i));
check(backup_prune()===4&&count(glob(backup_dir().'/gostore-*.sqlite.gz'))===30&&is_file($b['file'])&&!is_file(backup_dir().'/gostore-20260101-000000.sqlite.gz'),'Oldest copies pruned, today kept');

// Google Drive: not configured, refresh-token upload with checksum, pruning of this app's old files, failures.
check(backup_drive_upload($b,fn()=>throw new RuntimeException('No call without configuration'))===['configured'=>false],'Unconfigured Drive');
file_put_contents($dir.'/backup-drive.json',json_encode(['client_id'=>'client.apps.googleusercontent.com','client_secret'=>'secret','refresh_token'=>'refresh','folder_id'=>'FolderId_1234567890']));
$calls=[];$md5=md5_file($b['file']);
$google=function(string $method,string $url,array $headers,?string $body)use(&$calls,&$md5){$calls[]=[$method,$url,$headers,$body];
    if(str_starts_with($url,'https://oauth2.googleapis.com/token'))return [200,[],json_encode(['access_token'=>'access-1'])];
    if($method==='POST')return [200,['location'=>'https://www.googleapis.com/upload/drive/v3/files?upload_id=abc'],''];
    if($method==='PUT')return [200,[],json_encode(['id'=>'file-1','md5Checksum'=>$md5])];
    if($method==='GET')return [200,[],json_encode(['files'=>[['id'=>'old-1','name'=>'gostore-20250101-000000.sqlite.gz'],['id'=>'other','name'=>'notes.txt']]])];
    return [204,[],''];};
$u=backup_drive_upload($b,$google);check($u['id']==='file-1'&&$u['removed']===1,'Uploaded and pruned');
check(str_contains($calls[0][3],'grant_type=refresh_token')&&in_array('Authorization: Bearer access-1',$calls[1][2],true)&&str_contains($calls[1][3],'"parents":["FolderId_1234567890"]')&&$calls[2][3]===file_get_contents($b['file']),'Token, folder and exact bytes');
check(str_contains(urldecode($calls[3][1]),"'FolderId_1234567890' in parents")&&count(array_filter($calls,fn($c)=>$c[0]==='DELETE'))===1&&str_ends_with($calls[4][1],'/old-1'),'Only old backup files are deleted');
$md5='different';try{backup_drive_upload($b,$google);check(false,'Checksum mismatch accepted');}catch(RuntimeException $e){check(str_contains($e->getMessage(),'checksum'),'Checksum mismatch reported');}
file_put_contents($dir.'/backup-drive.json',json_encode(['client_id'=>'x','client_secret'=>'y','refresh_token'=>'z','folder_id'=>"bad' or 1=1"]));
try{backup_drive_upload($b,$google);check(false,'Unsafe folder ID accepted');}catch(RuntimeException $e){check(str_contains($e->getMessage(),'folder'),'Folder ID validated');}

// Daily run: local backup succeeds even when Drive fails; the status says so.
file_put_contents($dir.'/backup-drive.json',json_encode(['client_id'=>'x','client_secret'=>'y','refresh_token'=>'z','folder_id'=>'FolderId_1234567890']));
$s=backup_run(fn()=>[400,[],json_encode(['error'=>'invalid_grant'])]);
check($s['ok']&&$s['drive']['ok']===false&&str_contains($s['drive']['error'],'invalid_grant')&&backup_status()['name']===$s['name'],'Drive failure recorded, local backup kept');

// Report: counts and warnings only; no customer details; error log grouping; mail headers.
$log=$dir.'/php.log';file_put_contents($log,'['.gmdate('d-M-Y H:i:s',time()-90000)." UTC] old error\n".str_repeat('['.gmdate('d-M-Y H:i:s',time()-60)." UTC] GOStore API: PDOException 19 UNIQUE constraint failed: customers.email in customers.php:42\n",3).'['.gmdate('d-M-Y H:i:s')." UTC] GOStore TaoWorld background refresh deferred\n");
$e=daily_report_errors(time()-86400,$log);check($e['total']===4&&reset($e['kinds'])===3&&!isset($e['kinds']['old error']),'Errors grouped for 24 hours');
$report=daily_report_build();check(str_contains($report['body'],'1 шинэ захиалга, 1 шинэ хэрэглэгч')&&str_starts_with($report['subject'],'⚠ ')&&count(array_filter($report['warnings'],fn($w)=>str_contains($w,'Google Drive')))===1,'Report counts and Drive warning');
foreach(['private-person@example.test','Нууц Нэр','99112233','Хаяг','GS-1'] as $private)check(!str_contains($report['body'],$private),'Report leaked '.$private);
$sent=[];check(daily_report_send($report,function($to,$subject,$body,$headers)use(&$sent){$sent=[$to,$subject,$body,$headers];return true;}),'Mail sent');
check($sent[0]==='shop@gostore.mn'&&str_starts_with($sent[1],'=?UTF-8?B?')&&str_contains($sent[3],'charset=UTF-8')&&$sent[2]===$report['body'],'Mail recipient and encoding');

// CLI worker: runs once (lock), backs up and reports without mailing in tests.
unlink($dir.'/backup-drive.json');$php=PHP_BINARY;
// The bundled Windows PHP has no php.ini and gets extensions on the command line; an installed PHP
// (CI, server) already loads them, and repeating -d extension= would print warnings into the output.
$cmd=[$php];if(php_ini_loaded_file()===false){array_push($cmd,'-d','extension_dir='.ini_get('extension_dir'));foreach(['pdo_sqlite','mbstring','curl','openssl'] as $x)array_push($cmd,'-d','extension='.$x);}
array_push($cmd,__DIR__.'/../server/daily-worker.php','--no-mail');
$p=proc_open($cmd,[1=>['pipe','w'],2=>['pipe','w']],$pipes,null,['GOSTORE_DATA_DIR'=>$dir]+getenv());$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);$code=proc_close($p);
$o=json_decode(trim($out),true);check($code===0&&$o['backup_ok']===true&&$o['mail_sent']===false,'Worker run: '.$out.$err);
echo "PASS backup: restorable gzip copy, 30-copy pruning, Drive refresh-token upload/checksum/pruning/validation, failure status, private-free daily report, mail encoding, CLI worker.\n";
