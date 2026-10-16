<?php
// CLI-only shim verifies post-response scheduling without a live provider call.
if(PHP_SAPI!=='cli'||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')!=='1')exit(1);
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/shipping.php';
function fastcgi_finish_request(): bool {file_put_contents(config()['data_dir'].'/finish-marker','finished',FILE_APPEND);return true;}
require __DIR__.'/../server/supplier.php';
$q=['language'=>'mn','item_title'=>'bag','page'=>1,'limit'=>12,'sort'=>'default'];
$lock=fopen(config()['data_dir'].'/supplier-cache/request.lock','c');flock($lock,LOCK_EX);
$t=microtime(true);$first=supplier_request('/v1/taobao/search',$q,true);$second=supplier_request('/v1/taobao/search',$q,true);
if(!$first['stale']||!$second['stale']||microtime(true)-$t>1||is_file(config()['data_dir'].'/finish-marker'))throw new RuntimeException('Stale browsing waited or refreshed before response');
flock($lock,LOCK_UN);fclose($lock);
echo "PASS: stale reads bypass a busy provider lock; refresh waits until shutdown.\n";
