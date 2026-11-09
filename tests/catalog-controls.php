<?php
declare(strict_types=1);
// Site controls: hidden items and shops (every product path), home keyword mix, reviewed official
// store list with validation and reset, and the campaign period (auto, extended, ended early).
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/catalog-controls-test-'.bin2hex(random_bytes(5)));
require __DIR__.'/../server/bootstrap.php';
foreach(['shipping','supplier','taoworld-catalog','catalog-controls'] as $f)require_once __DIR__.'/../server/'.$f.'.php';
$_SERVER['REMOTE_ADDR']='127.0.0.1';
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function denied(callable $f,int $code):void{try{$f();}catch(ApiError $e){check($e->getCode()===$code,'Wrong rejection '.$e->getCode().' '.$e->getMessage());return;}throw new RuntimeException('Expected rejection '.$code);}

// Defaults: nothing hidden, the built-in home mix and the shipped store file.
$a=catalog_controls_admin();
check($a['controls']['blocked_items']===[]&&$a['stores_custom']===false&&count($a['stores'])===12,'Defaults');
$builtin=tw_catalog_home_keywords();check(count($builtin)>20,'Built-in home mix');
check(!product_policy_blocked(['id'=>'tb-123456789','name'=>'Cup','vendor_name'=>'好店']),'Not hidden yet');

// Hidden items and shops apply to any product shape (search card, detail, cart line).
denied(fn()=>catalog_controls_save(['blocked_items'=>['abc']]),400);
denied(fn()=>catalog_controls_save(['home_keywords'=>['包','鞋']]),400);
denied(fn()=>catalog_controls_save(['home_keywords'=>['包','鞋','帽','杯','灯','knife set']]),400);
denied(fn()=>catalog_controls_save(['campaign'=>['mode'=>'later']]),400);
$a=catalog_controls_save(['blocked_items'=>"tb-123456789\n987654321, 987654321",'blocked_shops'=>['好店 ',''],'home_keywords'=>['收纳盒','保温杯','积木','瑜伽垫','雨伞','台灯'],'campaign'=>['mode'=>'auto']]);
check($a['controls']['blocked_items']===['123456789','987654321']&&$a['controls']['blocked_shops']===['好店'],'Normalized lists: '.json_encode($a['controls'],JSON_UNESCAPED_UNICODE));
check(product_policy_blocked(['id'=>'tb-123456789','name'=>'Cup'])&&product_policy_blocked(['id'=>'987654321']),'Hidden items');
check(product_policy_blocked(['id'=>'tb-1111111','name'=>'Cup','shop_name'=>'好店'])&&product_policy_blocked(['id'=>'tb-1111111','vendor_name'=>' 好店']),'Hidden shops');
check(!product_policy_blocked(['id'=>'tb-1111111','name'=>'Cup','shop_name'=>'另一店']),'Other shops stay');
try{product_policy_assert(['id'=>'tb-2222222','name'=>'Cup','shop_name'=>'好店']);throw new RuntimeException('Shop not hidden');}catch(ApiError $e){check($e->getCode()===404,'Hidden products are not found');}
check(tw_catalog_home_keywords()===['收纳盒','保温杯','积木','瑜伽垫','雨伞','台灯'],'Custom home mix');
check(count(tw_catalog_home_order())===6,'The daily rotation uses the custom mix');
catalog_controls_save(['blocked_items'=>[],'blocked_shops'=>[],'home_keywords'=>[]]);check(tw_catalog_home_keywords()===$builtin&&!product_policy_blocked(['id'=>'123456789']),'Clearing restores the defaults');

// Official stores: reviewed identities only; reset returns to the shipped list.
$store=['id'=>'57303596','name'=>'优衣库官方旗舰店','display_name'=>'UNIQLO','logo'=>'/assets/brands/uniqlo.svg','source_url'=>'https://shop57303596.tmall.com/category.htm','verification'=>'Checked on the Tmall page 2026-11-09'];
denied(fn()=>catalog_stores_save(['stores'=>[]]),400);
denied(fn()=>catalog_stores_save(['stores'=>[['id'=>'12ab']+$store]]),400);
denied(fn()=>catalog_stores_save(['stores'=>[$store,$store]]),400);
denied(fn()=>catalog_stores_save(['stores'=>[['source_url'=>'https://evil.example/tmall.com']+$store]]),400);
denied(fn()=>catalog_stores_save(['stores'=>[['source_url'=>'http://shop1.tmall.com/']+$store]]),400);
denied(fn()=>catalog_stores_save(['stores'=>[['logo'=>'/assets/brands/../../server/config.local.php']+$store]]),400);
denied(fn()=>catalog_stores_save(['stores'=>[['verification'=>'']+$store]]),400);
$a=catalog_stores_save(['stores'=>[$store,['id'=>'152438116','name'=>'星优旗舰店','display_name'=>'Xingyou','logo'=>'','source_url'=>'https://xingyou.tmall.com/','verification'=>'Shop id from a TaoWorld product detail']]]);
check($a['stores_custom']===true&&count($a['stores'])===2&&array_map('strval',array_keys(official_stores_registry()))===['57303596','152438116'],'Custom store list');
$a=catalog_stores_save(['reset'=>true]);check($a['stores_custom']===false&&count(official_stores_registry())===12,'Reset to the shipped list');

// Campaign: auto follows the date; "on" extends to a date (≤ 60 days); "off" ends it early.
$nov5=strtotime('2026-11-05 12:00:00 +08:00');$nov20=strtotime('2026-11-20 12:00:00 +08:00');
check(catalog_campaign_state(['campaign'=>['mode'=>'auto','until'=>'']],$nov5)['active']===true&&catalog_campaign_state(['campaign'=>['mode'=>'auto']],$nov20)['active']===false,'Auto mode');
check(catalog_campaign_state(['campaign'=>['mode'=>'on','until'=>'2026-11-25']],$nov20)['active']===true&&catalog_campaign_state(['campaign'=>['mode'=>'on','until'=>'2026-11-19']],$nov20)['active']===false,'Extended');
check(catalog_campaign_state(['campaign'=>['mode'=>'off']],$nov5)['active']===false,'Ended early');
check(catalog_campaign_public()['active']===null,'Auto mode lets the browser keep its date rule');
$today=gmdate('Y-m-d',time()+8*3600);
denied(fn()=>catalog_controls_save(['campaign'=>['mode'=>'on','until'=>'']]),400);
denied(fn()=>catalog_controls_save(['campaign'=>['mode'=>'on','until'=>gmdate('Y-m-d',time()+8*3600-86400)]]),400);
denied(fn()=>catalog_controls_save(['campaign'=>['mode'=>'on','until'=>gmdate('Y-m-d',time()+8*3600+61*86400)]]),400);
$a=catalog_controls_save(['campaign'=>['mode'=>'on','until'=>$today]]);check($a['campaign']['active']===true&&catalog_campaign_public()===['mode'=>'on','until'=>$today,'active'=>true],'Extended through today');
$a=catalog_controls_save(['campaign'=>['mode'=>'off','until'=>$today]]);check(catalog_campaign_public()===['mode'=>'off','until'=>null,'active'=>false],'Ended early, no date kept');
echo "catalog-controls ok\n";
