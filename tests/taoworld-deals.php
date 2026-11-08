<?php
declare(strict_types=1);
// Deals index: only real price cuts from product details saved within 24 hours (no coupons or
// promotion-only items), biggest cut first, read-time re-check of re-saved details, on-demand rebuild,
// paging, the six-hour list-card offer window, and the catalog worker build without TaoWorld calls.
require __DIR__.'/taoworld-catalog.php';
require_once $fixture.'/server/taoworld-deals.php';
$_SERVER['REMOTE_ADDR']='192.0.2.150';
foreach(glob(tw_catalog_dir().'/*.json') as $f)if(preg_match('/^[a-f0-9]{64}\.json$/D',basename($f))&&isset(supplier_snapshot_read($f)['data']['sku_list']))unlink($f);
foreach(glob(tw_deals_index_path().'*')?:[] as $f)unlink($f);
$detail=fn(string $id,int $price,int $promotion,int $qty=3)=>['item_id'=>$id,'mi_id'=>'deal-'.$id,'title'=>'Deal box '.$id,'pic_urls'=>['https://img.alicdn.com/deal-'.$id.'.jpg'],'price'=>$price,'promotion_price'=>$promotion,'coupon_price'=>(int)($promotion/2),'description'=>'Long text','sku_list'=>[['sku_id'=>'21','quantity'=>$qty,'price'=>$price,'promotion_price'=>$promotion,'coupon_price'=>(int)($promotion/2)]]];
$save=function(string $id,int $price,int $promotion,int $age,int $qty=3)use($detail){$file=tw_deals_detail_path('tb-'.$id);supplier_snapshot_write($file,['time'=>time()-$age,'data'=>$detail($id,$price,$promotion,$qty)]);touch($file,time()-$age);};
$save('920000000001',10000,7000,5*3600);   // 30% cut, 5 hours old
$save('920000000002',10000,7000,25*3600);  // older than 24 hours
$save('920000000003',10000,10000,60);      // coupon only, no price cut
$save('920000000004',10000,9000,600);      // 10% cut
$save('920000000005',10000,7000,3600);     // 30% cut, newer than 001
$save('920000000006',10000,5000,60,0);     // cut, but sold out
$before=count($calls);$built=tw_deals_index_build();
check($built===['items'=>3,'files'=>5],'Index keeps real, in-stock cuts under 24 hours: '.json_encode($built));
$deals=tw_catalog_deals(['page'=>1]);$ids=array_column($deals['products'],'id');
check(count($calls)===$before,'Deals never call TaoWorld');
check($deals['scope']==='deals_index'&&$ids===['tb-920000000005','tb-920000000001','tb-920000000004']&&$deals['total']===3&&!$deals['more']&&$deals['verified_within']===86400,'Biggest cut first, newer breaks ties: '.json_encode($ids));
$deal=$deals['products'][1];
check($deal['card_discount']['percent']===30&&$deal['card_discount']['current_mnt']===$deal['mnt']&&abs(strtotime($deal['verified_at'])-(time()-5*3600))<=2&&$deal['card_discount']['expires']===strtotime($deal['verified_at'])+TW_DEALS_MAX_AGE&&$deal['price_expires']===$deal['card_discount']['expires'],'Discount valid 24 hours after its detail and matching the shown price');
check($deal['variants']===[]&&!isset($deal['description'])&&!isset($deal['images'])&&array_keys($deal['offers'])===['expires','promotions','discount']&&!isset($deal['f'])&&!isset($deal['p']),'Compact cards without coupons or index internals');
// A detail saved again without the cut hides the product at once; an expired discount is dropped.
$save('920000000005',10000,10000,0);
check(array_column(tw_catalog_deals(['page'=>1])['products'],'id')===['tb-920000000001','tb-920000000004'],'Re-saved detail without a cut is hidden before the next build');
$index=supplier_snapshot_read(tw_deals_index_path());foreach($index['data']['items'] as &$item)if($item['p']['id']==='tb-920000000004')$item['p']['card_discount']['expires']=time()-1;unset($item);supplier_snapshot_write(tw_deals_index_path(),$index);
check(array_column(tw_catalog_deals(['page'=>1])['products'],'id')===['tb-920000000001'],'Expired discounts are dropped at read time');
// An index over an hour old, or a missing one, is rebuilt on demand.
$index['time']=time()-TW_DEALS_INDEX_FRESH-1;supplier_snapshot_write(tw_deals_index_path(),$index);
$rebuilt=tw_catalog_deals(['page'=>1]);check(array_column($rebuilt['products'],'id')===['tb-920000000001','tb-920000000004']&&supplier_snapshot_read(tw_deals_index_path())['time']>=time()-5,'Stale index is rebuilt');
unlink(tw_deals_index_path());check(count(tw_catalog_deals(['page'=>1])['products'])===2,'Missing index is rebuilt');
denied(fn()=>tw_catalog_deals(['page'=>0]),400);denied(fn()=>tw_catalog_deals(['page'=>101]),400);
// Paging over a larger index.
for($i=0;$i<60;$i++)$save((string)(930000000000+$i),10000,3000+$i*50,120);
tw_deals_index_build();$p1=tw_catalog_deals(['page'=>1]);$p2=tw_catalog_deals(['page'=>2]);
check(count($p1['products'])===TW_DEALS_PAGE&&$p1['more']&&count($p2['products'])===$p1['total']-TW_DEALS_PAGE&&!$p2['more']&&!array_intersect(array_column($p1['products'],'id'),array_column($p2['products'],'id')),'Index pages are disjoint');
check($p1['products'][0]['card_discount']['percent']===70,'Largest cut leads the first page');
// List cards keep named promotions for six hours and never carry coupon prices.
$row=['item_id'=>'940000000001','mi_id'=>'list-940000000001','title'=>'Box','price'=>'20.00','coupon_price'=>'10.00','promotion_displays'=>[['promotion_info_list'=>[['promotion_name'=>'Store promotion']]]]];
$card=tw_catalog_product($row,false,time()-1860);check($card['offers']['expires']>time()&&$card['offers']['promotions']===[['name'=>'Store promotion']]&&array_keys($card['offers'])===['expires','promotions'],'A 31-minute-old list keeps promotions, without coupon prices');
check(tw_catalog_product($row,false,time()-TW_CATALOG_OFFER_DISPLAY-1)['offers']['expires']<=time(),'Offers older than six hours are hidden');
check(!tw_catalog_warming(),'Visitor requests never use the background budget');
// Worker (no --warm outside 06:00-09:00): builds the index and status without TaoWorld calls.
unlink(tw_deals_index_path());$cmd=[PHP_BINARY];
if(php_ini_loaded_file()===false){array_push($cmd,'-d','extension_dir='.ini_get('extension_dir'));foreach(['pdo_sqlite','mbstring','curl','openssl','gd'] as $x)array_push($cmd,'-d','extension='.$x);}
array_push($cmd,$fixture.'/server/catalog-worker.php');
$p=proc_open($cmd,[1=>['pipe','w'],2=>['pipe','w']],$pipes,null,['GOSTORE_DATA_DIR'=>$fixture.'/data','GOSTORE_DISABLE_SUPPLIER_NETWORK'=>'1']+getenv());
$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);$code=proc_close($p);$s=json_decode(trim($out),true);
check($code===0&&($s['deals']['items']??0)>=60&&is_file(tw_deals_index_path())&&is_file($fixture.'/data/catalog-worker-status.json'),'Worker builds the deals index: '.$out.$err);
echo "PASS deals index: real price cuts from details under 24 hours, no coupons or promotion-only items, biggest cut first, re-saved details re-checked, read-time expiry, on-demand rebuild, paging, six-hour list offers, worker build.\n";
