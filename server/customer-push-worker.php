<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
require __DIR__.'/customer-push.php';
require __DIR__.'/customer-messages.php';
try{echo 'Accepted: '.customer_push_drain().PHP_EOL;echo 'Messages: '.customer_messages_push_drain().PHP_EOL;}catch(Throwable){fwrite(STDERR,"Customer push worker failed; pending notices retained.\n");exit(1);}
