<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
foreach(['bootstrap','shipping','warehouse','logistics','qpay-http','qpay','checkout','taobao-purchase','taoworld-auth','taoworld-http','taoworld-purchase'] as $file)require_once __DIR__.'/../server/'.$file.'.php';
$lock=fopen(config()['data_dir'].'/checkout-expiry.lock','c');
if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))exit(0);
try{
    checkout_expire_due(true);
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['checkout_expiry_worker_last',gmdate('c')]);
}catch(Throwable $e){fwrite(STDERR,'Checkout expiry deferred: '.get_class($e).PHP_EOL);exit(1);}
finally{flock($lock,LOCK_UN);fclose($lock);}
