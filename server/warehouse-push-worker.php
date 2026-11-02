<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
require __DIR__.'/shipping.php';
require __DIR__.'/warehouse.php';
try{echo 'Sent: '.warehouse_push_drain(20).PHP_EOL;}catch(Throwable){fwrite(STDERR,"Warehouse push worker failed; queued items retained.\n");exit(1);}
