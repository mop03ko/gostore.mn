<?php
declare(strict_types=1);
$fixture=__DIR__.'/../tmp/tw-catalog-'.bin2hex(random_bytes(6));mkdir($fixture.'/server',0700,true);
foreach(glob(__DIR__.'/../server/*') as $f)if(is_file($f)&&!str_contains(basename($f),'.local.')&&preg_match('/\.(php|json)$/',$f))copy($f,$fixture.'/server/'.basename($f));
putenv('GOSTORE_DATA_DIR='.$fixture.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
file_put_contents($fixture.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-long-enough','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
foreach(['bootstrap','shipping','supplier','checkout','taoworld-auth'] as $f)require_once $fixture.'/server/'.$f.'.php';
require_once $fixture.'/server/taoworld-catalog.php';
$calls=[];$stock=4;$price=393;$error=false;$unknown=false;
function taoworld_http(string $path,array $params): array {
    global $calls,$stock,$price,$error,$unknown;$calls[]=[$path,$params];
    if($error)throw new ApiError('Fake upstream unavailable',502);
    if($path==='/traffic/item/search'){
        $rows=[];for($i=0;$i<20;$i++){$id=(string)(700000000000+((int)$params['page_no']-1)*20+$i);$rows[]=['item_id'=>$id,'mi_id'=>'opaque-'.$id,'title'=>'收纳盒','main_image_url'=>'https://img.alicdn.com/example.jpg','multi_language_info'=>['title'=>'Storage box'],'price'=>'14.47'];}
        return ['code'=>'0','data'=>['data'=>$rows]];
    }
    if($path==='/traffic/item/get')return ['code'=>'0','data'=>['item_id'=>'700000000000','mi_id'=>'rotated-id','title'=>'Storage box','pic_urls'=>['https://img.alicdn.com/example.jpg'],'price'=>500,'promotion_price'=>$price,'coupon_price'=>1,'shop_id'=>'123','sku_list'=>[['sku_id'=>'999999999999999999999','quantity'=>$unknown?null:$stock,'price'=>500,'promotion_price'=>$price,'coupon_price'=>1,'properties'=>[['prop_name'=>'Color','value_name'=>'Blue']]]]]];
    if($path==='/upload/image'){check(base64_decode($params['image_base64'],true)==='fixture jpeg','Upload must send plain base64');return ['code'=>'0','data'=>['image_id'=>'12345']];}
    if($path==='/traffic/item/imgsearch')return ['code'=>'0','data'=>[['item_id'=>'700000000009','mi_id'=>'image-mi','title'=>'Backpack','price'=>'5.50']]];
    throw new RuntimeException('Unexpected provider call '.$path);
}
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function denied(callable $f,int $code):void{try{$f();}catch(ApiError $e){check($e->getCode()===$code,'Wrong rejection '.$e->getMessage());return;}throw new RuntimeException('Expected rejection');}
function settings(array $patch):void{$s=array_replace(shipping_settings(),$patch);db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($s)]);}
taoworld_store(taoworld_token_state(['access_token'=>'fake','refresh_token'=>'fake-refresh','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'fixture-buyer']));
settings(['catalog_provider'=>'taoworld','supplier_enabled'=>true,'api_daily_limit'=>1000,'image_search_enabled'=>true]);
$r=supplier_search(['q'=>'box','page'=>1,'limit'=>12]);check(count($r['products'])===12&&$r['products'][0]['approx_cny']===14.47,'Search prices are yuan');
$r2=supplier_search(['q'=>'box','page'=>2,'limit'=>12]);check($r2['products'][0]['id']==='tb-700000000012'&&end($r2['products'])['id']==='tb-700000000023','12-item pagination across native pages');
$r3=supplier_search(['q'=>'box','page'=>2,'limit'=>50]);check(count($r3['products'])===50&&$r3['products'][0]['id']==='tb-700000000050','50-item pagination');
$before=count($calls);supplier_search(['q'=>'box','page'=>1,'limit'=>12]);check(count($calls)===$before,'Search cache missed');
denied(fn()=>supplier_detail('tb-123456789'),409);check(count($calls)===$before,'Unknown old OT ID must not reach API');
$d=supplier_detail('tb-700000000000');check($d['product']['cny']===3.93&&$d['product']['variants'][0]['id']==='999999999999999999999','Fen conversion, coupon exclusion and exact long SKU');
$mixed=tw_catalog_product(['item_id'=>'700000000008','mi_id'=>'mixed','title'=>'Box','sku_list'=>[['sku_id'=>'1','price'=>100,'quantity'=>5],['sku_id'=>'2','price'=>50]]],true);check($mixed['sellable']&&$mixed['variants'][1]['cny']===null,'Unknown-stock SKU must be disabled even when another variant is available');
check(end($calls)[1]['mi_id']==='opaque-700000000000'&&!isset(end($calls)[1]['item_id']),'Detail must use mi_id');
$before=count($calls);supplier_detail('tb-700000000000');check(count($calls)===$before,'Rotated mi_id must not invalidate cache');
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
$state=taoworld_state();$state['account_id']='another-buyer';taoworld_store($state);denied(fn()=>supplier_detail('tb-700000000000'),409);
echo "PASS native catalog: pagination, cache, yuan/fen, coupon exclusion, mi_id rotation/account scope, SKU/stock, fresh checkout, policy, image upload/search pagination; no OT calls.\n";
