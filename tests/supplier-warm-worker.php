<?php
if(PHP_SAPI!=='cli'||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')!=='1')exit(1);
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/shipping.php';
function fastcgi_finish_request(): bool {file_put_contents(config()['data_dir'].'/warm-finished','done',FILE_APPEND);return true;}
require __DIR__.'/../server/supplier.php';
if(($argv[1]??'')==='budget'){
    $max=(int)floor(shipping_settings()['api_daily_limit']/2);
    db()->prepare('INSERT OR REPLACE INTO limits VALUES (?,?,?)')->execute([hash('sha256','supplier-warm:'.gmdate('Y-m-d')),$max,time()+86400]);
}
if(!is_file(config()['data_dir'].'/supplier-cache/warm.retry')){
// A background transfer must not monopolize unrelated foreground requests.
$dir=config()['data_dir'].'/supplier-cache';$held=fopen($dir.'/network-0.lock','c');flock($held,LOCK_EX);
$q=['language'=>'mn','item_title'=>'slot-test-'.($argv[1]??'first'),'page'=>1,'limit'=>12,'sort'=>'default'];
try{supplier_request('/v1/taobao/search',$q,true);throw new RuntimeException('Expected isolated network block');}catch(ApiError $e){if(!str_contains($e->getMessage(),'Туршилтын'))throw $e;}
$second=fopen($dir.'/network-1.lock','c');flock($second,LOCK_EX);$q['item_title'].='-full';
try{supplier_request('/v1/taobao/search',$q,true);throw new RuntimeException('Concurrency limit bypassed');}catch(ApiError $e){if(!str_contains($e->getMessage(),'завгүй'))throw $e;}
flock($second,LOCK_UN);fclose($second);flock($held,LOCK_UN);fclose($held);
}
supplier_schedule_warm();supplier_schedule_warm();
if(is_file(config()['data_dir'].'/warm-finished'))throw new RuntimeException('Warmup ran before response');
