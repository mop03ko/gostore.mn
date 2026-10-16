<?php
// Hosting cron: 0 */2 * * * /opt/cpanel/ea-php83/root/usr/bin/php /home/ACCOUNT/public_html/server/cache-refresh.php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';require __DIR__.'/shipping.php';require __DIR__.'/supplier.php';
set_time_limit(1200);
try{echo json_encode(supplier_snapshot_run(),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL;}
catch(Throwable $e){fwrite(STDERR,"Catalog snapshot refresh failed; the previous version was preserved.\n");exit(1);}
