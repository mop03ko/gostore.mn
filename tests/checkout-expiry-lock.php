<?php
declare(strict_types=1);
// Live 2026-11-10..14: catalog requests failed with "database is locked" in the checkout expiry sweep
// (checkout.php, INSERT OR REPLACE INTO meta) although busy_timeout is 10 s. A read cursor left open keeps its WAL
// snapshot; once another request has committed, upgrading that snapshot to a write fails at once and the busy
// handler is never called. The sweep must end its read before it writes, and a sweep that cannot write must not
// fail the catalog request it rides on.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/expiry-lock-test-'.bin2hex(random_bytes(5)));
require __DIR__.'/../server/bootstrap.php';require_once __DIR__.'/../server/checkout.php';
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
$db=db();$file=config()['data_dir'].'/gostore.sqlite';
$other=new PDO('sqlite:'.$file,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$other->exec('PRAGMA busy_timeout=10000');
$put=fn(PDO $c,string $v)=>$c->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['checkout_expiry_run',$v]);
$locked=function(callable $write):bool{$t=microtime(true);try{$write();return false;}catch(PDOException $e){check(microtime(true)-$t<2,'Fails without waiting for busy_timeout');return str_contains($e->getMessage(),'locked');}};

// The mechanism, as on live: read left open -> another connection commits -> the write fails at once.
$put($db,'0');$s=$db->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['checkout_expiry_run']);$s->fetchColumn();
$put($other,'1');
check($locked(fn()=>$put($db,'2')),'An open read cannot be upgraded after another commit');
$s->closeCursor();$s=null;

// The sweep's read ends before its write, so a commit from another request in between does no harm.
$put($db,'0');
check(checkout_expiry_last_run()===0,'Reads the last run');$put($other,'5');
check(!$locked(fn()=>$put($db,'6')),'After the read helper, writing still works');
$put($db,'0');checkout_expire_due();
check((int)$other->query("SELECT value FROM meta WHERE key='checkout_expiry_run'")->fetchColumn()>time()-60,'The sweep records its run');

// Another request holding the write lock: the catalog-side call gives up quietly and runs again next time.
$put($db,'0');$db->exec('PRAGMA busy_timeout=200');$other->exec('BEGIN IMMEDIATE');
$logged=ini_get('error_log');ini_set('error_log',config()['data_dir'].'/php-test.log');
checkout_expire_due_deferrable();
$other->exec('ROLLBACK');ini_set('error_log',(string)$logged);$db->exec('PRAGMA busy_timeout=10000');
check(str_contains((string)@file_get_contents(config()['data_dir'].'/php-test.log'),'GOStore checkout expiry deferred'),'Deferral is logged');
check(checkout_expiry_last_run()===0,'Nothing recorded, so the next request retries');
checkout_expire_due_deferrable();check(checkout_expiry_last_run()>time()-60,'Runs once the lock is free');
echo "PASS checkout expiry sweep: ends its read before writing (WAL snapshot upgrade), records its run, and defers quietly when another request holds the write lock.\n";
