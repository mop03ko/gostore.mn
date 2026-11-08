<?php
declare(strict_types=1);
// Deals index: offers from every recent search (not only the homepage sample), six-hour offer window,
// newest copy wins, biggest cut first, expired offers dropped, stale index falls back, and the
// catalog worker builds it without TaoWorld calls.
require __DIR__.'/taoworld-catalog.php';
require_once $fixture.'/server/taoworld-deals.php';
$_SERVER['REMOTE_ADDR']='192.0.2.150';
$item=fn(string $id,string $price,?string $coupon=null,bool $promo=false,array $extra=[])=>$extra+['item_id'=>$id,'mi_id'=>'deal-'.$id,'title'=>'Deal '.$id,'multi_language_info'=>['title'=>'Deal '.$id,'main_image_url'=>'https://img.alicdn.com/deal-'.$id.'.jpg'],'main_image_url'=>'https://img.alicdn.com/deal-'.$id.'.jpg','price'=>$price]
    +($coupon!==null?['coupon_price'=>$coupon]:[])+($promo?['promotion_displays'=>[['promotion_info_list'=>[['promotion_name'=>'Store promotion']]]]]:[]);
$snap=function(string $keyword,int $age,array $rows){$q=['keyword'=>$keyword,'language'=>'en','page_no'=>'1','page_size'=>'20'];supplier_snapshot_write(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',$q).'.json',['time'=>time()-$age,'data'=>['data'=>$rows]]);};
foreach(glob(tw_catalog_dir().'/*.json') as $f)if(str_contains((string)file_get_contents($f),'"data":{"data":['))unlink($f);
$snap('deal keyword',600,[$item('900000000001','20.00','15.00'),$item('900000000002','10.00','9.00'),$item('900000000003','30.00',null,true),$item('900000000004','40.00')]);
$snap('deal older copy',1200,[$item('900000000001','20.00','19.00')]);
$snap('deal expired',TW_CATALOG_OFFER_DISPLAY+60,[$item('900000000005','50.00','10.00')]);
$built=tw_deals_index_build();check($built['items']===3&&$built['files']===2,'Index counts recent lists and offers only: '.json_encode($built));
$deals=tw_catalog_deals(['page'=>1]);$ids=array_column($deals['products'],'id');
check($deals['scope']==='deals_index'&&$ids===['tb-900000000001','tb-900000000002','tb-900000000003']&&!$deals['more']&&$deals['total']===3,'Index order and scope: '.json_encode($ids));
check($deals['products'][0]['offers']['coupon_percent']===25,'The newer copy of a product wins');
check(!array_filter($deals['products'],fn($p)=>isset($p['f'])||isset($p['p'])),'No index internals in products');

// Offers that expire after the build are dropped; an index older than an hour falls back.
$index=supplier_snapshot_read(tw_deals_index_path());$index['data']['items'][0]['p']['offers']['expires']=time()-1;supplier_snapshot_write(tw_deals_index_path(),$index);
check(array_column(tw_catalog_deals(['page'=>1])['products'],'id')===['tb-900000000002','tb-900000000003'],'Expired offers are filtered at read time');
$index['time']=time()-TW_DEALS_INDEX_FRESH-1;supplier_snapshot_write(tw_deals_index_path(),$index);
check((tw_catalog_deals(['page'=>1])['scope']??'')==='catalog_sample','A stale index falls back to the homepage sample');
denied(fn()=>tw_catalog_deals(['page'=>0]),400);denied(fn()=>tw_catalog_deals(['page'=>101]),400);

// Paging over a larger index.
$rows=[];for($i=0;$i<60;$i++)$rows[]=$item((string)(910000000000+$i),'100.00',(string)(99-$i).'.00');
$snap('deal many',300,$rows);tw_deals_index_build();
$p1=tw_catalog_deals(['page'=>1]);$p2=tw_catalog_deals(['page'=>2]);
check(count($p1['products'])===50&&$p1['more']&&count($p2['products'])===$p1['total']-50&&!$p2['more']&&!array_intersect(array_column($p1['products'],'id'),array_column($p2['products'],'id')),'Index pages are disjoint');
check(!tw_catalog_warming(),'Visitor requests never use the background budget');

// Worker (no --warm outside 06:00-09:00): builds the index and status without TaoWorld calls.
unlink(tw_deals_index_path());$cmd=[PHP_BINARY];
if(php_ini_loaded_file()===false){array_push($cmd,'-d','extension_dir='.ini_get('extension_dir'));foreach(['pdo_sqlite','mbstring','curl','openssl','gd'] as $x)array_push($cmd,'-d','extension='.$x);}
array_push($cmd,$fixture.'/server/catalog-worker.php');
$p=proc_open($cmd,[1=>['pipe','w'],2=>['pipe','w']],$pipes,null,['GOSTORE_DATA_DIR'=>$fixture.'/data','GOSTORE_DISABLE_SUPPLIER_NETWORK'=>'1']+getenv());
$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);$code=proc_close($p);$s=json_decode(trim($out),true);
check($code===0&&($s['deals']['items']??0)>=50&&is_file(tw_deals_index_path())&&is_file($fixture.'/data/catalog-worker-status.json'),'Worker builds the deals index: '.$out.$err);
echo "PASS deals index: all recent searches, six-hour offers, newest copy, biggest cut first, read-time expiry, stale fallback, paging, worker build.\n";
