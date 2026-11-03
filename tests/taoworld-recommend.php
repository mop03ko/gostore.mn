<?php
declare(strict_types=1);
// Related product recommendations and seller facts carried to product pages.
require __DIR__.'/taoworld-catalog.php';
$_SERVER['REMOTE_ADDR']='192.0.2.77';settings(['api_daily_limit'=>2000]);
// Populate a source detail and category search pages without provider requests.
$current='tb-810000000000';$category='收纳盒';
$detailFile=fn(string $id)=>tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>$id,'language'=>'en']).'.json';
$searchFile=fn(string $query,int $page)=>tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',['keyword'=>$query,'language'=>'en','page_no'=>(string)$page,'page_size'=>'20']).'.json';
$seed=['item_id'=>'810000000000','mi_id'=>'source-mi','title'=>'透明收纳盒','category_name'=>$category,'category_id'=>'5001','category_path'=>'家居->收纳->收纳盒','price'=>950,'sku_list'=>[['sku_id'=>'12345','quantity'=>5,'price'=>950]]];
tw_catalog_remember($seed);supplier_snapshot_write($detailFile($current),['time'=>time(),'data'=>$seed]);
$row=fn(int $n,array $extra=[])=>$extra+['item_id'=>(string)(810000000000+$n),'mi_id'=>'rec-'.$n,'title'=>'透明收纳盒 '.$n,'main_image_url'=>'https://img.alicdn.com/r.jpg','price'=>'9.50','shopDsr'=>'4.8'];
$rows=array_map($row,range(0,59));$rows[2]['price']=null;$rows[3]['category_id']='unrelated';$rows[4]=$rows[1];
supplier_snapshot_write($detailFile('tb-810000000005'),['time'=>time(),'data'=>['category_id'=>'unrelated']]);
foreach(array_chunk($rows,20) as $n=>$part)supplier_snapshot_write($searchFile($category,$n+1),['time'=>time()-30,'data'=>['data'=>$part]]);
supplier_snapshot_write($searchFile($category,4),['time'=>time()-30,'data'=>['data'=>[]]]);
$before=count($calls);$r=supplier_recommend($current);$ids=array_column($r['products'],'id');
check(count($calls)===$before,'Warm source and category pages must make no provider calls');
check(count($ids)===19&&count(array_unique($ids))===19&&!in_array($current,$ids,true),'Exclude current item, duplicates, unpriced cards and known category mismatches');
check($r['more']&&$r['page']===1&&$r['products'][0]['approx_mnt']>0&&$r['products'][0]['shop_rating']===4.8,'Keep prices, seller facts and pagination');
check(array_column(supplier_recommend($current)['products'],'id')===$ids,'The same source produces a stable first page');
$r2=supplier_recommend($current,2);$r3=supplier_recommend($current,3);
check(count($r2['products'])===24&&$r2['products'][0]['id']==='tb-810000000024'&&$r2['more'],'Second page must not shift when first page filters cards');
check(count($r3['products'])===12&&!$r3['more'],'Short final page stops scrolling');
check(!array_intersect($ids,array_column($r2['products'],'id')),'Sequential pages must not repeat products');
check(count($calls)===$before,'All cached scroll pages must avoid provider work');
check(tw_catalog_recommend_query($seed)===$category,'Prefer leaf category over title');
check(tw_catalog_recommend_query(['category_path'=>'家居-&gt;收纳-&gt;收纳盒'])===$category,'Use leaf of encoded category path');
check(tw_catalog_recommend_query(['category_name'=>'null','title'=>'Leather ankle boots'])==='Leather ankle boots','Missing category uses the product title, never home storage');
check(tw_catalog_recommend_query(['category_name'=>'其他','category_path'=>'','title'=>''])==='','Unknown taxonomy and title stay empty');
// Different product types must use independent category searches, with native pagination.
$seed['category_name']='男靴';$seed['category_id']='5002';supplier_snapshot_write($detailFile($current),['time'=>time(),'data'=>$seed]);
$before=count($calls);supplier_recommend($current);
$new=array_slice($calls,$before);
check(count($new)===2&&$new[0][0]==='/traffic/item/search'&&$new[0][1]['keyword']==='男靴'&&$new[1][1]['page_no']==='2','Cold source category fetches only two relevant search pages');
// Missing source context must not show unrelated cached homepage products.
$seed['category_name']='';$seed['category_path']='';$seed['title']='';supplier_snapshot_write($detailFile($current),['time'=>time(),'data'=>$seed]);
$before=count($calls);$r=supplier_recommend($current);check($r['products']===[]&&!$r['more']&&count($calls)===$before,'Missing category and title produces no mixed fallback');
$seed['category_name']='手机';supplier_snapshot_write($detailFile($current),['time'=>time(),'data'=>$seed]);
$error=true;denied(fn()=>supplier_recommend($current),502);$error=false;
denied(fn()=>supplier_recommend('abb-123456'),400);denied(fn()=>supplier_recommend($current,0),400);
// Shop rating, ship-from region and 48-hour dispatch survive a detail fetch, which has none of them.
foreach(glob(tw_catalog_dir().'/item-700000000000.json') as $f)unlink($f);
tw_catalog_cards([['item_id'=>'700000000000','mi_id'=>'search-mi','title'=>'收纳盒','price'=>'1.00','shopDsr'=>'4.80','shippingOrigin'=>'广东东莞','deliveryTimes'=>'48shipping']]);
$p=supplier_detail('tb-700000000000',true)['product'];
check($p['shop_rating']===4.8&&$p['ship_from']==='Хятад, Гуандун'&&$p['ships_48h']===true,'Detail must show the remembered seller facts');
$saved=supplier_snapshot_read(tw_catalog_dir().'/item-700000000000.json');check($saved['shop_rating']===4.8&&$saved['mi_id']==='rotated-id','Detail refresh must keep seller facts with the new identifier');
$mtime=filemtime(tw_catalog_dir().'/item-700000000000.json');clearstatcache();tw_catalog_cards([['item_id'=>'700000000000','mi_id'=>'rotated-id','title'=>'收纳盒','price'=>'1.00','shopDsr'=>'4.80','shippingOrigin'=>'广东东莞','deliveryTimes'=>'48shipping']],$saved['time']);
check(supplier_snapshot_read(tw_catalog_dir().'/item-700000000000.json')==$saved,'Identical seller facts are not rewritten');
tw_catalog_cards([['item_id'=>'700000000000','mi_id'=>'rotated-id','title'=>'收纳盒','price'=>'1.00','shopDsr'=>'9.9','shippingOrigin'=>'多仓发货']],$saved['time']);
$saved=supplier_snapshot_read(tw_catalog_dir().'/item-700000000000.json');check(!isset($saved['ships_48h'])&&$saved['shop_rating']===4.8&&tw_catalog_ship_from($saved['ship_from'])==='Хятад, олон агуулахаас','Newer rows update facts; invalid ratings are ignored');
check(tw_catalog_ship_from('火星')===''&&tw_catalog_ship_from('内蒙古呼和浩特')==='Хятад, Өвөр Монгол','Unknown regions are omitted');
// Product pages show details up to 30 minutes old; checkout and older snapshots go to the provider.
$detailFile=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>'tb-700000000000','language'=>'en']).'.json';
$age=function(int $seconds)use($detailFile){$c=supplier_snapshot_read($detailFile);$c['time']=time()-$seconds;supplier_snapshot_write($detailFile,$c);};
$age(900);$before=count($calls);$d=supplier_detail('tb-700000000000',true);check(count($calls)===$before&&$d['product']['id']==='tb-700000000000'&&$d['cache_ttl']===0&&!$d['stale'],'A 15-minute-old detail is shown at once and not cached by browsers');
$before=count($calls);supplier_detail('tb-700000000000');check(count($calls)===$before+1,'Non-display reads keep the 5-minute detail limit');
$age(900);$before=count($calls);supplier_detail('tb-700000000000',false,'',true);check(count($calls)===$before+1,'Checkout never uses the display allowance');
$age(1900);$before=count($calls);supplier_detail('tb-700000000000',true);check(count($calls)===$before+1,'Details older than 30 minutes are fetched again');
echo "PASS: category-specific recommendations, independent query caches, stable scrolling, price/category/current/duplicate filtering, missing metadata and retryable failure, seller facts and detail freshness.\n";
