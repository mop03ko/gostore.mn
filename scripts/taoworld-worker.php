<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
foreach(['bootstrap','shipping','warehouse','taobao-purchase','taoworld-auth','taoworld-http','taoworld-purchase'] as $file)require __DIR__.'/../server/'.$file.'.php';
$lock=fopen(taoworld_dir().'/worker.lock','c');
if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){fwrite(STDERR,"TaoWorld worker busy.\n");exit(0);}
try{$ids=tw_worker(3);echo 'TaoWorld processed '.count($ids)." orders.\n";}
catch(Throwable $e){fwrite(STDERR,'TaoWorld worker failed: '.get_class($e)."\n");exit(1);}
finally{flock($lock,LOCK_UN);fclose($lock);}
