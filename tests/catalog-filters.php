<?php
declare(strict_types=1);
// Catalog price filter (MNT → CNY for OT), newest sort and result totals with synthetic cached data.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/catalog-filters-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
foreach(['bootstrap','shipping','supplier'] as $file)require __DIR__.'/../server/'.$file.'.php';
function expect_error(callable $call,int $status):void { try{$call();}catch(ApiError $e){if($e->getCode()===$status)return;throw $e;} throw new RuntimeException('Expected HTTP '.$status); }
function check(bool $ok,string $message):void { if(!$ok)throw new RuntimeException($message); }
check(supplier_price_range([])===[]&&supplier_price_range(['price_min'=>'','price_max'=>null])===[],'Empty bounds must be ignored');
check(supplier_price_range(['price_min'=>'10000','price_max'=>'50000'])===['price_min'=>10000,'price_max'=>50000],'Bounds not parsed');
foreach([['price_min'=>'-1'],['price_max'=>'1e5'],['price_min'=>'abc'],['price_min'=>'60000','price_max'=>'50000']] as $bad)expect_error(fn()=>supplier_price_range($bad),400);
expect_error(fn()=>supplier_search(['q'=>'bag','sort'=>'newest']),400);
$dir=config()['data_dir'].'/supplier-cache';mkdir($dir,0700,true);
$item=fn(string $id,float $cny)=>['Id'=>$id,'ProviderType'=>'Taobao','Title'=>'Бараа '.$id,'MainPictureUrl'=>'https://img.alicdn.com/'.$id.'.jpg','IsSellAllowed'=>true,'Price'=>['OriginalPrice'=>$cny,'OriginalCurrencyCode'=>'CNY']];
// At the default 550₮ rate, 10,000–50,000₮ is sent to OT as 18.18–90.91¥ with the newest-first sort.
$query=['language'=>'mn','item_title'=>'bag','page'=>1,'limit'=>12,'sort'=>'-updated_time','price_min'=>'18.18','price_max'=>'90.91'];
$data=['Items'=>['Items'=>['Content'=>array_map(fn($i)=>$item((string)(100000+$i),20+$i),range(1,12)),'TotalCount'=>250],'MaximumPageCount'=>50]];
file_put_contents($dir.'/'.supplier_cache_key('/v1/taobao/search',$query).'.json',json_encode(['data'=>$data,'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false]));
$r=supplier_search(['q'=>'bag','page'=>1,'sort'=>'-updated_time','price_min'=>'10000','price_max'=>'50000']);
check(count($r['products'])===12&&$r['total']===250&&$r['pages']===21&&$r['more']===true,'Filtered search totals changed');
$data['Items']['Items']['TotalCount']=5000;file_put_contents($dir.'/'.supplier_cache_key('/v1/taobao/search',$query).'.json',json_encode(['data'=>$data,'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false]));
check(supplier_search(['q'=>'bag','page'=>1,'sort'=>'-updated_time','price_min'=>'10000','price_max'=>'50000'])['pages']===50,'Pages must respect the provider maximum');
echo "PASS: catalog price bounds validation, MNT→CNY conversion for OT, newest sort, result total and page count.\n";
