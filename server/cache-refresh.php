<?php
// Hosting cron: */10 * * * * /opt/cpanel/ea-php83/root/usr/bin/php /home/ACCOUNT/public_html/server/cache-refresh.php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';require __DIR__.'/shipping.php';require __DIR__.'/supplier.php';
set_time_limit(1200);
try{$r=supplier_snapshot_run();supplier_snapshot_write(supplier_snapshot_dir().'/cron.json',['last_run'=>time(),'status'=>$r['status']]);echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL;if(($r['errors']??0)>0)exit(1);}
catch(Throwable $e){supplier_snapshot_write(supplier_snapshot_dir().'/cron.json',['last_run'=>time(),'status'=>'failed']);fwrite(STDERR,"Catalog snapshot refresh failed; the previous version was preserved.\n");exit(1);}
