<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/sms-orders.php';
$lock=fopen(config()['data_dir'].'/sms-worker.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))exit(0);
try{sms_orders_drain();db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['sms_worker_last',gmdate('c')]);}
catch(Throwable $e){fwrite(STDERR,'SMS worker failed: '.get_class($e).PHP_EOL);exit(1);}
finally{flock($lock,LOCK_UN);fclose($lock);}
