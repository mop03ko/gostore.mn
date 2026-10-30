<?php
declare(strict_types=1);
// Mixed product recommendations and the shop rating carried from search rows to the product page.
require __DIR__.'/taoworld-catalog.php';
$_SERVER['REMOTE_ADDR']='192.0.2.77';settings(['api_daily_limit'=>2000]);
$keywords=array_values(array_unique(tw_catalog_departments()));
$file=fn(string $k)=>tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',['keyword'=>$k,'language'=>'en','page_no'=>'1','page_size'=>'20']).'.json';
$row=fn(int $n,array $extra=[])=>['item_id'=>(string)(810000000000+$n),'mi_id'=>'rec-'.$n,'title'=>'商品','multi_language_info'=>['title'=>'Item '.$n],'main_image_url'=>'https://img.alicdn.com/r.jpg','price'=>'9.50']+$extra;
// Four departments cached with five products each; department d owns IDs d*100+0..4.
foreach([0,1,2,3] as $d)supplier_snapshot_write($file($keywords[$d]),['time'=>time()-60,'data'=>['data'=>array_map(fn($i)=>$row($d*100+$i,['shopDsr'=>'4.'.(5+$i%5),'shippingOrigin'=>'浙江金华']+($i===0?['deliveryTimes'=>'48shipping']:[])),range(0,4))]]);
$before=count($calls);$current='tb-'.(810000000000+101);
$r=supplier_recommend($current);$ids=array_column($r['products'],'id');
check(count($calls)===$before,'Cached recommendations must not call the provider');
check(count($ids)===19&&!in_array($current,$ids,true)&&count(array_unique($ids))===19,'Recommendations exclude the current product and duplicates');
$departments=array_map(fn($id)=>intdiv((int)substr($id,3)-810000000000,100),array_slice($ids,0,3));sort($departments);
check(count(array_unique($departments))===3,'The first cards must come from different departments, not the product category');
check($r['products'][0]['shop_rating']>=4.5&&$r['shipping']['cny_rate']>0,'Cards carry the shop rating and shipping settings');
// The same product ID always starts at the same department; another product rotates the order.
check(array_column(supplier_recommend($current)['products'],'id')===$ids,'Recommendations are stable for one product');
// Fewer than 12 cached products: exactly one uncached department is fetched.
foreach([0,1,2,3] as $d)unlink($file($keywords[$d]));supplier_snapshot_write($file($keywords[0]),['time'=>time()-60,'data'=>['data'=>[$row(1)]]]);
$before=count($calls);$r=supplier_recommend('tb-'.(810000000000+999));check(count($calls)===$before+1&&count($r['products'])===21,'A thin cache fetches one department');
$fetched=end($calls)[1]['keyword'];$before=count($calls);supplier_recommend('tb-'.(810000000000+999));check(count($calls)===$before+1&&end($calls)[1]['keyword']!==$fetched,'With fewer than four departments each view widens the mix by one new department');
foreach(array_slice($keywords,0,6) as $k)if(!is_file($file($k)))supplier_snapshot_write($file($k),['time'=>time()-60,'data'=>['data'=>[$row(500)]]]);
$before=count($calls);supplier_recommend('tb-'.(810000000000+999));check(count($calls)===$before,'Enough cached departments and products need no provider call');
$error=true;foreach(glob(tw_catalog_dir().'/*.json') as $f)if(!str_contains($f,'item-'))unlink($f);
$r=supplier_recommend('tb-'.(810000000000+999));$error=false;check($r['products']===[],'Provider failure leaves recommendations empty, not an error');
denied(fn()=>supplier_recommend('abb-123456'),400);
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
echo "PASS: mixed department recommendations, 30-minute display detail allowance, current/duplicate exclusion, cache-only reads with one bounded fetch, failure fallback, shop rating/region/48h carried to details.\n";
