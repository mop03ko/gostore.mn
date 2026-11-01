<?php
declare(strict_types=1);
$fixture=__DIR__.'/../tmp/tw-catalog-'.bin2hex(random_bytes(6));mkdir($fixture.'/server',0700,true);
foreach(glob(__DIR__.'/../server/*') as $f)if(is_file($f)&&!str_contains(basename($f),'.local.')&&preg_match('/\.(php|json)$/',$f))copy($f,$fixture.'/server/'.basename($f));
putenv('GOSTORE_DATA_DIR='.$fixture.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
file_put_contents($fixture.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-long-enough','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
foreach(['bootstrap','shipping','supplier','checkout','taoworld-auth'] as $f)require_once $fixture.'/server/'.$f.'.php';
require_once $fixture.'/server/taoworld-catalog.php';
$calls=[];$stock=4;$price=393;$error=false;$unknown=false;$batches=[];$failPage=0;$short=false;$brandFixtures=[];
function taoworld_http_search_batch(array $queries): array {
    global $batches;$batches[]=$queries;return array_map(function($q){try{return taoworld_http('/traffic/item/search',$q);}catch(ApiError $e){return $e;}},$queries);
}
function taoworld_http(string $path,array $params): array {
    global $calls,$stock,$price,$error,$unknown,$failPage,$short,$brandFixtures;$calls[]=[$path,$params];
    if($error)throw new ApiError('Fake upstream unavailable',502);
    if($path==='/traffic/item/search'){
        if((int)$params['page_no']===$failPage)throw new ApiError('Fake page failure',502);
        $rows=[];for($i=0;$i<($short?3:20);$i++){$id=(string)(700000000000+((int)$params['page_no']-1)*20+$i);$rows[]=['item_id'=>$id,'mi_id'=>'opaque-'.$id,'title'=>'收纳盒','main_image_url'=>'https://img.alicdn.com/example.jpg','multi_language_info'=>['title'=>'Storage box'],'price'=>'14.47'];}
        if(($params['page_size']??'')==='6'){
            $brandId=array_values(array_filter(array_keys(supplier_brands()),fn($id)=>tw_catalog_brand_keyword($id)===($params['keyword']??'')))[0]??'uniqlo';$brand=supplier_brand($brandId);$offset=array_search($brandId,array_keys(supplier_brands()),true)*100;
            $rows=[];for($i=0;$i<6;$i++){
                $id=(string)(710000000000+$offset+$i);$rows[]=['item_id'=>$id,'mi_id'=>'brand-'.$id,'title'=>$brand['name'],'main_image_url'=>'https://img.alicdn.com/example.jpg','price'=>'14','shopDsr'=>$i===2?'4.6':'4.9'];
                $detail=['item_id'=>$id,'mi_id'=>'brand-'.$id,'title'=>$brand['name'],'pic_urls'=>['https://img.alicdn.com/example.jpg'],'price'=>1400,'shop_id'=>$i===5?$brand['shop_id']:'123','shop_name'=>$i===5?$brand['vendor']:'Reseller','properties'=>[['prop_id'=>20000,'value_name'=>$i===1?'Unrelated':($i===4?$brand['name'].' style':$brand['name'])]],'sku_list'=>[['sku_id'=>'1234','quantity'=>3,'price'=>1400]]];
                if(in_array($i,[3,5],true))unset($detail['properties']);$brandFixtures['brand-'.$id]=$detail;
            }
            return ['code'=>'0','data'=>['data'=>$rows]];
        }
        if(isset($params['shop_id'])){
            $brand=array_values(array_filter(supplier_brands(),fn($b)=>$b['shop_id']===$params['shop_id']))[0];
            foreach($rows as $i=>&$row){$row['shop_name']=$i===1?'Unrelated reseller':$brand['vendor'];if($i===2)$row['shop_id']='999999';if($i===3)unset($row['shop_name']);}unset($row);
        }
        return ['code'=>'0','data'=>['data'=>$rows]];
    }
    if($path==='/traffic/item/get'&&isset($brandFixtures[$params['mi_id']??'']))return ['code'=>'0','data'=>$brandFixtures[$params['mi_id']]];
    if($path==='/traffic/item/get')return ['code'=>'0','data'=>['item_id'=>'700000000000','mi_id'=>'rotated-id','title'=>'Storage box','pic_urls'=>['https://img.alicdn.com/example.jpg'],'price'=>500,'promotion_price'=>$price,'coupon_price'=>1,'shop_id'=>'123','sku_list'=>[['sku_id'=>'999999999999999999999','quantity'=>$unknown?null:$stock,'price'=>500,'promotion_price'=>$price,'coupon_price'=>1,'properties'=>[['prop_name'=>'Color','value_name'=>'Blue']]]]]];
    if($path==='/upload/image'){check(base64_decode($params['image_base64'],true)==='fixture jpeg','Upload must send plain base64');return ['code'=>'0','data'=>['image_id'=>'12345']];}
    if($path==='/traffic/item/imgsearch')return ['code'=>'0','data'=>[['item_id'=>'700000000009','mi_id'=>'image-mi','title'=>'Backpack','price'=>'5.50']]];
    throw new RuntimeException('Unexpected provider call '.$path);
}
function taoworld_http_detail_batch(array $queries): array {return array_map(fn($q)=>taoworld_http('/traffic/item/get',$q),$queries);}
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function denied(callable $f,int $code):void{try{$f();}catch(ApiError $e){check($e->getCode()===$code,'Wrong rejection '.$e->getMessage());return;}throw new RuntimeException('Expected rejection');}
function settings(array $patch):void{$s=array_replace(shipping_settings(),$patch);db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($s)]);}
taoworld_store(taoworld_token_state(['access_token'=>'fake','refresh_token'=>'fake-refresh','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'fixture-buyer']));
settings(['catalog_provider'=>'taoworld','supplier_enabled'=>true,'api_daily_limit'=>1000,'image_search_enabled'=>true]);
$r=supplier_search(['q'=>'box','page'=>1,'limit'=>12]);check(count($r['products'])===12&&$r['products'][0]['approx_cny']===14.47,'Search prices are yuan');
$r2=supplier_search(['q'=>'box','page'=>2,'limit'=>12]);check($r2['products'][0]['id']==='tb-700000000012'&&end($r2['products'])['id']==='tb-700000000023','12-item pagination across native pages');
$r3=supplier_search(['q'=>'box','page'=>2,'limit'=>50]);check(count($r3['products'])===50&&$r3['products'][0]['id']==='tb-700000000050','50-item pagination');
$before=count($calls);supplier_search(['q'=>'box','page'=>1,'limit'=>12]);check(count($calls)===$before,'Search cache missed');
$_SERVER['REMOTE_ADDR']='192.0.2.56';
foreach(supplier_brands() as $brandId=>$brand){
    $_SERVER['REMOTE_ADDR']='192.0.2.'.(60+array_search($brandId,array_keys(supplier_brands()),true));
    $r=supplier_search(['brand'=>$brandId,'q'=>'wrong unrelated keyword','page'=>1,'limit'=>12]);$searchCalls=array_values(array_filter($calls,fn($c)=>$c[0]==='/traffic/item/search'));$query=end($searchCalls)[1];
    check(!isset($query['shop_id'])&&isset($query['keyword']),'Brand selection must search across sellers');
    check(count($r['products'])===2&&$r['more']&&$r['brand']['scope']==='brand_selection','Wrong/missing brand, low rating and lookalikes must be omitted without breaking pagination');
    check($r['products'][0]['brand_id']===$brandId,'Brand context missing from cards');
}
unset($_SERVER['REMOTE_ADDR']);
$before=count($calls);$verified=supplier_detail('tb-710000000000',false,'nike');check(count($calls)===$before&&$verified['product']['vendor_name']==='Reseller','Brand reseller detail must reuse checked cache and preserve seller identity');
denied(fn()=>supplier_detail('tb-710000000001',false,'nike'),409);
check(!tw_catalog_product_brand_matches(['title'=>'Nike shoes','shop_name'=>'Nike outlet'], 'nike'),'Title or shop name alone must never establish brand');
check(tw_catalog_product_brand_matches(['title'=>'Nike shoes','properties'=>[['prop_id'=>20000,'value_name'=>'Nike/耐克']]],'nike'),'Bilingual supplier brand rejected');
check(!tw_catalog_product_brand_matches(['title'=>'Generic sweater','properties'=>[['prop_id'=>20000,'value_name'=>'ZARA']]],'zara'),'Generic recommendation with isolated brand attribute must be rejected');
$legacy=supplier_search(['q'=>'UNIQLO','page'=>1,'limit'=>12]);
check(($legacy['brand']['id']??'')==='uniqlo'&&count($legacy['products'])===2,'Older app exact brand queries must also use brand attribute verification');
$brand=supplier_brand('uniqlo');
check(!tw_catalog_brand_matches(['shop_name'=>$brand['vendor'],'shop_id'=>$brand['seller']],$brand,true),'Seller ID must not be mistaken for shop ID');
check(!tw_catalog_brand_matches(['shop_name'=>$brand['vendor']],$brand,true),'Details must include shop ID');
check(tw_catalog_brand_matches(['shop_name'=>$brand['vendor'],'shop_id'=>$brand['shop_id']],$brand,true),'Exact shop detail rejected');
$before=count($calls);supplier_search(['q'=>'box','page'=>1,'limit'=>12]);
$searchFile=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',['keyword'=>'box','language'=>'en','page_no'=>'1','page_size'=>'20']).'.json';$searchCache=supplier_snapshot_read($searchFile);$searchCache['time']=time()-1200;supplier_snapshot_write($searchFile,$searchCache);
$r=supplier_search(['q'=>'box','page'=>1,'limit'=>12]);check(count($calls)===$before&&$r['cache_ttl']<=600&&$r['cache_ttl']>590,'20-minute search should reuse list cache');
$searchCache['time']=time()-1801;supplier_snapshot_write($searchFile,$searchCache);supplier_search(['q'=>'box','page'=>1,'limit'=>12]);check(count($calls)===$before+1,'Expired 30-minute search must refresh');
$before=count($calls);$short=true;$r=supplier_search(['q'=>'small catalog','page'=>1,'limit'=>50]);$short=false;check(count($r['products'])===3&&count($calls)===$before+1,'Short first page must stop without extra calls');
$before=count($calls);$failPage=3;denied(fn()=>supplier_search(['q'=>'parallel test','page'=>1,'limit'=>50]),502);check(count($calls)===$before+3&&count(end($batches))===2,'Cold search must batch only remaining pages');
$failPage=0;$before=count($calls);$r=supplier_search(['q'=>'parallel test','page'=>1,'limit'=>50]);check(count($r['products'])===50&&$r['products'][20]['id']==='tb-700000000020'&&count($calls)===$before+1,'Retry must reuse successful pages and preserve ordering');
$before=count($calls);supplier_search(['q'=>'parallel test','page'=>1,'limit'=>50]);check(count($calls)===$before,'Warm batch repeated provider requests');
$used=supplier_budget_status()['used'];$cap=$used;while($cap-(int)ceil($cap*.2)<$used+1)$cap++;settings(['api_daily_limit'=>$cap]);
$before=count($calls);denied(fn()=>supplier_search(['q'=>'budget test','page'=>1,'limit'=>50]),429);check(count($calls)===$before+1&&supplier_budget_status()['used']===$used+1,'Batch budget must roll back unsent reservations');settings(['api_daily_limit'=>1000]);
check(count(supplier_search(['q'=>'budget test','page'=>1,'limit'=>50])['products'])===50,'Failed batch did not release page locks');
$before=count($calls);denied(fn()=>supplier_detail('tb-123456789'),409);check(count($calls)===$before,'Unknown old OT ID must not reach API');
$d=supplier_detail('tb-700000000000');check($d['product']['cny']===3.93&&$d['product']['variants'][0]['id']==='999999999999999999999','Fen conversion, coupon exclusion and exact long SKU');
denied(fn()=>supplier_detail('tb-700000000000',false,'uniqlo'),409);
$mixed=tw_catalog_product(['item_id'=>'700000000008','mi_id'=>'mixed','title'=>'Box','sku_list'=>[['sku_id'=>'1','price'=>100,'quantity'=>5],['sku_id'=>'2','price'=>50]]],true);check($mixed['sellable']&&$mixed['variants'][1]['cny']===null,'Unknown-stock SKU must be disabled even when another variant is available');
check(end($calls)[1]['mi_id']==='opaque-700000000000'&&!isset(end($calls)[1]['item_id']),'Detail must use mi_id');
$before=count($calls);supplier_detail('tb-700000000000');check(count($calls)===$before,'Rotated mi_id must not invalidate cache');
$cachedFile=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>'tb-700000000000','language'=>'en']).'.json';$lock=fopen($cachedFile.'.lock','c');flock($lock,LOCK_EX);
$start=microtime(true);supplier_detail('tb-700000000000');check(microtime(true)-$start<.5,'Fresh reader blocked behind writer lock');flock($lock,LOCK_UN);fclose($lock);
$map=tw_catalog_dir().'/item-700000000000.json';touch($map,time()-60);clearstatcache(true,$map);$modified=filemtime($map);supplier_detail('tb-700000000000');clearstatcache(true,$map);check(filemtime($map)===$modified,'Warm detail rewrote unchanged identifier');
$lines=checkout_items(['items'=>[['id'=>'tb-700000000000','sku'=>'999999999999999999999','qty'=>2]]]);check($lines[0]['goods_cny']===7.86&&$lines[0]['catalog_provider']==='taoworld','Native checkout totals/provenance');
denied(fn()=>supplier_order(['product_id'=>'tb-700000000000','sku'=>'wrong','qty'=>1]),409);
denied(fn()=>supplier_order(['product_id'=>'tb-700000000000','sku'=>'999999999999999999999','qty'=>5]),400);
$file=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>'tb-700000000000','language'=>'en']).'.json';
$c=supplier_snapshot_read($file);$c['time']=time()-121;supplier_snapshot_write($file,$c);$price=450;
$lines=checkout_items(['items'=>[['id'=>'tb-700000000000','sku'=>'999999999999999999999','qty'=>1]]]);check($lines[0]['unit_cny']===4.5,'Checkout failed to refresh old price');
$c=supplier_snapshot_read($file);$c['time']=time()-121;supplier_snapshot_write($file,$c);$error=true;
denied(fn()=>checkout_items(['items'=>[['id'=>'tb-700000000000','sku'=>'999999999999999999999','qty'=>1]]]),502);$error=false;
$unknown=true;denied(fn()=>supplier_order(['product_id'=>'tb-700000000000','sku'=>'999999999999999999999','qty'=>1]),409);$unknown=false;
$before=count($calls);check(supplier_search(['q'=>'knife','page'=>1])['products']===[]&&count($calls)===$before,'Prohibited keyword reached provider');
check(tw_catalog_cards([['item_id'=>'700000000002','mi_id'=>'bad','title'=>'Kitchen knife','price'=>'5']])===[],'Prohibited result displayed');
$hash=str_repeat('a',32);mkdir(supplier_image_search_dir(),0700,true);file_put_contents(supplier_image_search_dir().'/'.$hash.'.jpg','fixture jpeg');
$im=supplier_image_search($hash,1);check(count($im['products'])===1&&$im['products'][0]['approx_cny']===5.5,'Image search normalization');
$before=count($calls);$im=supplier_image_search($hash,2);check($im['products']===[]&&count($calls)===$before,'Image pagination must reuse one query');
$imageLock=fopen(tw_catalog_dir().'/image-'.$hash.'.json.lock','c');flock($imageLock,LOCK_EX);$start=microtime(true);supplier_image_search($hash,1);check(microtime(true)-$start<.5,'Warm image result waited for writer');flock($imageLock,LOCK_UN);fclose($imageLock);
$before=count($calls);settings(['supplier_enabled'=>false]);denied(fn()=>supplier_search(['q'=>'box','page'=>1]),503);denied(fn()=>supplier_detail('tb-700000000000'),503);denied(fn()=>supplier_image_search($hash,1),503);check(count($calls)===$before,'Disabled catalog spent API quota');settings(['supplier_enabled'=>true]);
$health=supplier_snapshot_health();check($health['provider']==='taoworld'&&$health['search_ttl']===1800&&!isset($health['cron_overdue']),'Native health reports legacy snapshot cron');
$_SERVER['REMOTE_ADDR']='192.0.2.55';for($i=0;$i<30;$i++)limit_attempts('supplier-ip-minute:192.0.2.55',30,60);
$before=count($calls);$budget=supplier_budget_status()['used'];denied(fn()=>supplier_search(['q'=>'rate limited cold','page'=>1]),429);check(count($calls)===$before&&supplier_budget_status()['used']===$budget,'Rate-limited call reached provider or spent daily quota');supplier_search(['q'=>'box','page'=>1]);check(count($calls)===$before,'Rate limit blocked cached browsing');unset($_SERVER['REMOTE_ADDR']);
$state=taoworld_state();$state['account_id']='another-buyer';taoworld_store($state);denied(fn()=>supplier_detail('tb-700000000000'),409);
echo "PASS native catalog: parallel pages, partial retry, budget rollback, lock-free fresh reads, 30-minute list cache, no redundant identifier writes, yuan/fen, mi_id/account scope, SKU/stock, fresh checkout, policy, image search; no OT calls.\n";
