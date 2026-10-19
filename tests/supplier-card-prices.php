<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/catalog-price-test-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/shipping.php';require __DIR__.'/../server/supplier.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function price(float $n):array{return ['OriginalPrice'=>$n,'OriginalCurrencyCode'=>'CNY'];}
$raw=['Id'=>'671184888238','ProviderType'=>'Taobao','Title'=>'Stock test','IsSellAllowed'=>true,'Price'=>price(.01),'FirstLotQuantity'=>2,'ConfiguredItems'=>[
 ['Id'=>'sold','Quantity'=>0,'Price'=>price(.01)],['Id'=>'insufficient','Quantity'=>1,'Price'=>price(1)],['Id'=>'blocked','Quantity'=>200,'Price'=>price(2),'IsSellAllowed'=>false],['Id'=>'unknown','Price'=>price(3)],['Id'=>'available','Quantity'=>200,'Price'=>price(952)],['Id'=>'expensive','Quantity'=>200,'Price'=>price(1144)]]];
$p=supplier_normalize($raw,true,'taobao');check($p['cny']===952.0&&$p['mnt']===523600&&$p['price_status']==='available','Sold-out, insufficient and prohibited SKUs cannot set card price');
check($p['variants'][2]['cny']===null,'Prohibited SKU cannot be ordered');
$search=$raw;unset($search['ConfiguredItems']);$p=supplier_normalize($search,false,'taobao');check($p['cny']===null&&$p['price_status']==='unverified','Unknown stock does not advertise false minimum');
$search['MasterQuantity']=0;check(supplier_stock_price($search)['price_status']==='unavailable','Sold out standard product');
$raw['IsSellAllowed']=false;check(supplier_stock_price($raw)['cny']===null,'Blocked product');$raw['IsSellAllowed']=true;
$unknown=$raw;$unknown['IsSellAllowed']=false;$unknown['SellDisallowReason']='IsUnknownQuantity';check(supplier_stock_price($unknown)['cny']===952.0,'Stock-readable SKUs retain prices for purchasable unknown-quantity products');
$search['MasterQuantity']=200;check(supplier_stock_price($search,false)['price_status']==='unverified','Search aggregate stock cannot verify an unseen SKU minimum');
$dir=config()['data_dir'].'/supplier-cache';mkdir($dir,0700,true);$file=$dir.'/'.supplier_cache_key('/v1/taobao/product/671184888238',['language'=>'mn']).'.json';
$cache=['data'=>['Item'=>$raw],'expires'=>time()+3600,'fetched'=>gmdate('c'),'stale'=>false];supplier_snapshot_write($file,$cache);
$p=supplier_card_price(['id'=>'tb-671184888238','cny'=>.01,'mnt'=>6],time()+7200);check($p['mnt']===523600&&$p['price_expires']===$cache['expires'],'Existing detail cache corrects legacy snapshots without provider calls');
$cache['expires']=time()-1;supplier_snapshot_write($file,$cache);check(supplier_card_price(['id'=>'tb-671184888238','cny'=>.01,'mnt'=>6],time()+7200)['mnt']===null,'Expired detail cannot verify a legacy minimum');
$records=[];foreach(supplier_warm_queries() as $i=>$q){$products=[];for($j=0;$j<3;$j++)$products[]=['id'=>'tb-'.(100000+$i*3+$j),'name'=>$q,'cny'=>10+$i,'mnt'=>1,'price_status'=>'available'];$records[$q]=['products'=>$products,'fetched'=>gmdate('c'),'cache_expires'=>time()+7200,'more'=>false];}
$records['bag']['products'][0]=$records['home storage']['products'][0];
$snapshot=['version'=>1,'generated_at'=>time(),'next_refresh_at'=>time()+7200,'records'=>$records];supplier_snapshot_write(supplier_snapshot_dir().'/current.json',$snapshot);
$a=supplier_search(['q'=>'__all__','page'=>1,'sort'=>'default'],true);$b=supplier_search(['q'=>'__all__','page'=>2,'sort'=>'default'],true);
$mix=supplier_search(['q'=>'__all__','page'=>1,'sort'=>'-updated_time'],true);
check(count($mix['products'])===12&&count(array_unique(array_column($mix['products'],'name')))===12,'All shows diverse departments');
// Explicit price sorting is cheapest first across every department.
$ascending=supplier_search(['q'=>'__all__','page'=>1,'sort'=>'price'],true);
$prices=array_column($ascending['products'],'mnt');$sorted=$prices;sort($sorted);check(count($ascending['products'])===12&&$prices===$sorted,'Explicit price feed is cheapest first');
check(count(array_unique(array_column($a['products'],'name')))===12,'Default home feed preserves department diversity');
// The unfiltered home feed hides items below the admin floor; an explicit price filter shows them again.
$floorSettings=shipping_settings();$floorSettings['home_min_price_mnt']=6000;db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($floorSettings)]);
$floored=supplier_search(['q'=>'__all__','page'=>1,'sort'=>'default'],true);check(min(array_column($floored['products'],'mnt'))>=6000&&$floored['total']<$a['total'],'Home floor hides cheap items');
check(min(array_column(supplier_search(['q'=>'__all__','page'=>1,'sort'=>'default','price_min'=>'0'],true)['products'],'mnt'))<6000,'Price filter overrides the home floor');
$floorSettings['home_min_price_mnt']=0;db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($floorSettings)]);
check(!$a['stale']&&$a['more']&&$a['total']===count(supplier_warm_queries())*3-1,'Real deduplicated total and pagination');
check(!array_intersect(array_column($a['products'],'id'),array_column($b['products'],'id')),'Pages do not repeat products');
check($a['products'][0]['mnt']===5500,'Mixed feed recomputes exchange rate');
$c=supplier_search(['q'=>'__all__','page'=>1,'sort'=>'-price'],true);check($c['products'][0]['cny']===count(supplier_warm_queries())+9,'Price sorting uses verified amounts');
foreach($snapshot['records'] as &$r)$r['cache_expires']=time()-SUPPLIER_SNAPSHOT_STALE_MAX-1;unset($r);supplier_snapshot_write(supplier_snapshot_dir().'/current.json',$snapshot);
check(supplier_snapshot_all(1,'price')['products']===[],'Expired categories are excluded without network requests');
echo "PASS: purchasable SKU prices, unknown/expired data, cached detail overlay, mixed departments, deduplication, pagination, sorting, FX and zero provider calls.\n";
