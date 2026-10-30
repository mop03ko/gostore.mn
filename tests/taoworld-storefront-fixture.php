<?php
declare(strict_types=1);
$root=realpath(__DIR__.'/..');$dir=realpath(getenv('GOSTORE_DATA_DIR')?:'');
if(!$dir||!str_starts_with(strtolower($dir),strtolower($root.DIRECTORY_SEPARATOR.'tmp'.DIRECTORY_SEPARATOR))||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')!=='1')throw new RuntimeException('Isolated offline fixture required');
foreach(['bootstrap','shipping','supplier','taoworld-catalog'] as $f)require_once $root.'/server/'.$f.'.php';
taoworld_store(taoworld_token_state(['access_token'=>'offline-fixture','refresh_token'=>'offline-refresh','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'offline-browser']));
$s=array_replace(shipping_settings(),['catalog_provider'=>'taoworld','catalog_language'=>'en','supplier_enabled'=>true,'image_search_enabled'=>true,'home_min_price_mnt'=>0]);
db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($s)]);
$rows=[];for($i=0;$i<60;$i++)$rows[]=['item_id'=>(string)(700111111111+$i),'mi_id'=>'offline-mi-'.$i,'title'=>'收纳盒','multi_language_info'=>['title'=>'English storage box '.$i],'main_image_url'=>'https://img.alicdn.com/imgextra/native-test.jpg','price'=>'10'];
$searchTime=time()-(in_array('--stale',$argv??[],true)?1805:0);
for($page=1;$page<=3;$page++)supplier_snapshot_write(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',['keyword'=>'收纳盒','language'=>'en','page_no'=>(string)$page,'page_size'=>'20']).'.json',['time'=>$searchTime,'data'=>['data'=>array_slice($rows,($page-1)*20,20)]]);
$id='tb-'.$rows[0]['item_id'];tw_catalog_remember($rows[0]);$detail=$rows[0]+['pic_urls'=>[$rows[0]['main_image_url']],'shop_id'=>'123','shop_name'=>'Fixture shop','description'=>'<p>Storage box</p>','sku_list'=>[['sku_id'=>'9000011','quantity'=>10,'price'=>1000,'properties'=>[['prop_name'=>'Color','value_name'=>'Blue']]],['sku_id'=>'9000012','quantity'=>5,'price'=>1234,'properties'=>[['prop_name'=>'Color','value_name'=>'White']]]]];
supplier_snapshot_write(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>$id,'language'=>'en']).'.json',['time'=>time(),'data'=>$detail]);
$hash=bin2hex(random_bytes(16));$images=supplier_image_search_dir();if(!is_dir($images))mkdir($images,0755,true);file_put_contents($images.'/'.$hash.'.jpg',file_get_contents($root.'/assets/backpack.jpg'));
supplier_snapshot_write(tw_catalog_dir().'/image-'.$hash.'.json',['time'=>time(),'data'=>tw_catalog_cards(array_slice($rows,0,2))]);
require_once $root.'/server/checkout.php';require_once $root.'/server/taoworld-domestic.php';
$lines=checkout_items(['items'=>[['id'=>$id,'sku'=>'9000012','qty'=>2]]]);$receiver=tw_domestic_receiver();$key=tw_domestic_key($lines,$receiver);
supplier_snapshot_write(tw_catalog_dir().'/domestic-'.$key.'.json',['time'=>time(),'data'=>['source'=>'taoworld_render','shipping_fen'=>1000,'supplier_total_fen'=>3468,'seller_count'=>1,'account'=>tw_account(),'receiver'=>$receiver,'key'=>$key,'reference'=>['status'=>'unavailable'],'expires_at'=>time()+120]]);
echo json_encode(['id'=>$id,'image'=>$hash],JSON_THROW_ON_ERROR);
