<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/product-policy-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');putenv('GOSTORE_DISABLE_QPAY=1');
foreach(['bootstrap','shipping','supplier','checkout','taobao-purchase'] as $file)require __DIR__.'/../server/'.$file.'.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function blocked(callable $call,int $status=404):void{try{$call();}catch(ApiError $e){check($e->getCode()===$status,'Unexpected error '.$e->getCode());return;}throw new RuntimeException('Restricted item was accepted');}
$cases=json_decode(file_get_contents(__DIR__.'/product-policy-cases.json'),true);
foreach(PRODUCT_POLICY_TAOBAO_IDS as $id){blocked(fn()=>supplier_detail('tb-'.$id));check(product_policy_blocked(['id'=>'tb-'.$id,'name'=>'Renamed item']),'Known ID cannot be relisted by renaming');}
foreach($cases as $group=>$texts)foreach($texts as $text)check(product_policy_text_blocked($text)===($group==='blocked'),'Text classification: '.$text);
check(product_policy_text_blocked('Kni&#102;e'),'HTML entities decoded');
$safe=['Id'=>'123456789','ProviderType'=>'Taobao','Title'=>'Cooking pot','OriginalTitle'=>'锅具','IsSellAllowed'=>true,'VendorId'=>'shop','Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY'],'ConfiguredItems'=>[['Id'=>'one','Quantity'=>5,'Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY']]]];
check(!product_policy_blocked($safe+['MainPictureUrl'=>'https://img.alicdn.com/knife.jpg']),'Image filename is not a product label');
$knife=array_replace($safe,['Id'=>'123456788','Title'=>'Kitchen set','OriginalTitle'=>'厨房菜刀']);
foreach(['Title'=>'Knife','OriginalTitle'=>'菜刀','Description'=>'Includes a knife','CategoryName'=>'Knives','Attributes'=>[['PropertyName'=>'Style','Value'=>'Knife set']],'ConfiguredItems'=>[['Id'=>'one','Name'=>'Knife']],'Promotions'=>[['Name'=>'Free knife']]] as $field=>$value)blocked(fn()=>supplier_normalize(array_replace($safe,[$field=>$value]),true,'taobao'));
$cache=['data'=>['Items'=>['Items'=>['Content'=>[$safe,$knife],'TotalCount'=>2]]],'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false];
check(count(supplier_search_result($cache,1)['products'])===1,'Search, image and brand result pipeline filters knives');
$cache['stale']=true;check(count(supplier_search_result($cache,1)['products'])===1,'Stale raw cache is filtered');
$dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))mkdir($dir,0700,true);
$put=function(string $path,array $query,array $data,bool $stale=false)use($dir){file_put_contents($dir.'/'.supplier_cache_key($path,$query).'.json',json_encode(['data'=>$data,'fetched'=>gmdate('c'),'expires'=>time()+($stale?-1:3600),'stale'=>$stale],JSON_UNESCAPED_UNICODE));};
$put('/v1/taobao/product/123456789',['language'=>'mn'],['Item'=>$safe,'RecommendedItems'=>['Content'=>[$knife]],'VendorItems'=>['Content'=>[$knife]]]);
$put('/v1/taobao/product/123456788',['language'=>'mn'],['Item'=>$knife]);
check(supplier_detail('tb-123456789')['product']['related']===[],'Recommendations filtered');
blocked(fn()=>supplier_detail('tb-123456788'));
blocked(fn()=>supplier_order(['product_id'=>'tb-123456788','sku'=>'one','qty'=>1]));
blocked(fn()=>checkout_items(['items'=>[['id'=>'tb-123456788','sku'=>'one','qty'=>1]]]));
$legacy=array_replace($knife,['Id'=>'abb-123456788','ProviderType'=>'Alibaba1688']);
$put('/v1/alibaba1688/product/123456788',['language'=>'mn'],['Item'=>$legacy]);blocked(fn()=>supplier_detail('abb-123456788'));
$put('/v1/taobao/product/123456789',['language'=>'mn'],['Item'=>$safe,'RootPath'=>['Content'=>[['Name'=>'Knives']]]]);blocked(fn()=>supplier_detail('tb-123456789'));
// A translated display title cannot erase the original provider's restricted title.
$translated=array_replace($safe,['Title'=>'Kitchen knife','OriginalTitle'=>'']);
$put('/v1/taobao/product/123456789',['language'=>'mn'],['Item'=>$translated]);supplier_title_write('tb-123456789','Kitchen accessory');blocked(fn()=>supplier_detail('tb-123456789'));
$put('/v1/taobao/product/123456788',['language'=>'mn'],['Item'=>$knife],true);blocked(fn()=>supplier_detail('tb-123456788',true));
// Search cards also honor more detailed cached metadata for the same item.
check(supplier_search_result($cache,1)['products']===[],'Detail cache blocks a generic search title');
$put('/v1/taobao/product/123456789',['language'=>'mn'],['Item'=>$safe]);
foreach(['knife','хутга','菜刀','нож'] as $q)check(supplier_search(['q'=>$q,'page'=>1])['products']===[],'Restricted searches do not call provider');
// Old normalized snapshots lack original titles: reject them and use filtered raw cache.
$records=[];foreach(supplier_warm_queries() as $q)$records[$q]=['products'=>[['id'=>'tb-123456788','name'=>'Kitchen accessory']],'fetched'=>gmdate('c'),'cache_expires'=>time()+3600,'more'=>false];
$old=['version'=>1,'generated_at'=>time(),'next_refresh_at'=>time()+3600,'records'=>$records];
supplier_snapshot_write(supplier_snapshot_dir().'/current.json',$old);check(supplier_snapshot_current()===null,'Unclassified snapshots rejected');
$put('/v1/taobao/search',['language'=>'mn','item_title'=>'bag','page'=>1,'limit'=>12,'sort'=>'default'],$cache['data']);
check(array_column(supplier_snapshot_all(1,'default')['products'],'id')===['tb-123456789'],'Home fallback filters raw cached originals');
$settings=shipping_settings();$settings['catalog_snapshot_enabled']=true;shipping_save($settings);
$fresh=$old+['product_policy'=>PRODUCT_POLICY_VERSION];foreach($fresh['records'] as &$record)$record['products']=[['id'=>'tb-123456788','name'=>'Knife'],['id'=>'tb-123456789','name'=>'Cooking pot']];unset($record);
supplier_snapshot_write(supplier_snapshot_dir().'/current.json',$fresh);
check(count(supplier_snapshot_search('bag',1,'default')['products'])===1,'Department snapshot filtered');check(count(supplier_snapshot_all(1,'default')['products'])===1,'Home snapshot filtered');
// Local inventory stays available to administrators, but cannot enter a customer cart.
$local=['id'=>'policy-test','name'=>'Knife','active'=>true,'type'=>'china'];db()->prepare('INSERT INTO products VALUES (?,?,?)')->execute([$local['id'],json_encode($local),gmdate('c')]);
check(!in_array('policy-test',array_column(products(),'id'),true)&&in_array('policy-test',array_column(products(true),'id'),true),'Local public/admin visibility');
blocked(fn()=>product_policy_order_assert(['items'=>[['name'=>'Pot','variant'=>'with knife']]]),409);
blocked(fn()=>taobao_purchase_check(['paid'=>true,'status'=>'quoted','supplier'=>['name'=>'Knife']]),409);
product_policy_order_assert(['title'=>'Pot','notes'=>'Customer lives near Knife Street','items'=>[['name'=>'Pot']]]);
echo "PASS: multilingual policy, raw/stale cache, translation, detail, legacy, recommendations, snapshots, local inventory, checkout and procurement.\n";
