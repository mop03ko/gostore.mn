<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
require __DIR__.'/shipping.php';
require __DIR__.'/warehouse.php';
require __DIR__.'/admin-users.php';
require __DIR__.'/staff-push.php';
try{echo 'Staff sent: '.staff_push_drain().PHP_EOL;}catch(Throwable){fwrite(STDERR,"Staff push worker failed; queued items retained.\n");}
try{echo 'Sent: '.warehouse_push_drain(20).PHP_EOL;}catch(Throwable){fwrite(STDERR,"Warehouse push worker failed; queued items retained.\n");exit(1);}
