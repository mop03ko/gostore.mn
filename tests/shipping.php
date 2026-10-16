<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/shipping-test-'.bin2hex(random_bytes(5)));
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/shipping.php';require __DIR__.'/../server/supplier.php';
function check(bool $v,string $message):void{if(!$v)throw new RuntimeException($message);}
$s=shipping_settings();
foreach([[0.5,1500],[0.501,3000],[1,3000],[1.001,4500]] as [$kg,$expected]){ $q=shipping_calculate(['goods_cny'=>10,'domestic_cny'=>2,'cargo_method'=>'weight','cargo_measure'=>$kg]);check($q['breakdown']['cargo_mnt']===$expected,'Weight rounding');check($q['total']===6600+$expected,'Goods plus domestic');}
foreach([[0.5,164725],[1,219450],[1.1,241395]] as [$m,$expected]){ $q=shipping_calculate(['goods_cny'=>0,'domestic_cny'=>0,'cargo_method'=>'volume','cargo_measure'=>$m]);check($q['total']===$expected,'Volume tier');}
foreach([-1,'0.5',INF] as $invalid){try{shipping_calculate(['goods_cny'=>0,'domestic_cny'=>0,'cargo_method'=>'weight','cargo_measure'=>$invalid]);throw new RuntimeException('Invalid accepted');}catch(ApiError){}}
$fixture=['Id'=>'abb-123456789','Title'=>'Өнгө Үүргэвч','MainPictureUrl'=>'javascript:alert(1)','IsSellAllowed'=>true,'Price'=>['OriginalPrice'=>12.5,'OriginalCurrencyCode'=>'CNY'],'FirstLotQuantity'=>2,'Attributes'=>[['Pid'=>'color','Vid'=>'red','PropertyName'=>'Өнгө','Value'=>'Улаан']],'ConfiguredItems'=>[['Id'=>'sku1','Quantity'=>3,'Configurators'=>[['Pid'=>'color','Vid'=>'red']],'Price'=>['OriginalPrice'=>15,'OriginalCurrencyCode'=>'CNY']]]];
$p=supplier_normalize($fixture,true);check($p['mnt']===6875&&$p['image']==='','Conversion and unsafe URL');check($p['variants'][0]['label']==='Өнгө: Улаан'&&$p['variants'][0]['stock']===3,'Variant mapping');
$fixture['Pictures']=[['Url'=>'https://img.alicdn.com/first.jpg'],['Url'=>'https://img.alicdn.com/first.jpg'],['Url'=>'javascript:alert(1)'],['Url'=>'https://untrusted.example/image.jpg']];
$fixture['VendorName']='Нийлүүлэгч';$p=supplier_normalize($fixture,true);
check($p['images']===['https://img.alicdn.com/first.jpg'],'Gallery deduplicates and allows safe image hosts only');
check($p['vendor_name']==='Нийлүүлэгч'&&$p['attributes']===[['name'=>'Өнгө','value'=>'Улаан']],'Detail vendor and attributes');
$taobao=array_replace($fixture,['Id'=>'123456789','ProviderType'=>'Taobao','Title'=>'','OriginalTitle'=>'原商品']);
$tp=supplier_normalize($taobao,true,'taobao');check($tp['id']==='tb-123456789'&&$tp['provider']==='taobao'&&$tp['name']==='原商品','Taobao namespace and original-title fallback');
check($tp['url']==='https://item.taobao.com/item.htm?id=123456789'&&$tp['mnt']===6875&&$tp['variants'][0]['cny']===15.0,'Taobao CNY prices and SKU');
foreach([array_replace($taobao,['ProviderType'=>'Alibaba1688']),array_replace($taobao,['Id'=>'abb-123456789']),array_replace($taobao,['HasError'=>true])] as $invalid){try{supplier_normalize($invalid,true,'taobao');throw new RuntimeException('Wrong provider accepted');}catch(ApiError){}}
check(supplier_cache_key('/v1/taobao/product/123456789',['language'=>'mn'])!==supplier_cache_key('/v1/alibaba1688/product/123456789',['language'=>'mn']),'Provider cache isolation');
check(supplier_cny(['OriginalPrice'=>20,'OriginalCurrencyCode'=>'USD'])===null,'Currency isolation');
$sold=supplier_normalize(array_replace($taobao,['Volume'=>1234]),false,'taobao');check($sold['sold_count']===1234,'Real provider sales count');
foreach([null,0,-1,'unknown',1.5,INF,9007199254740992] as $volume)check(supplier_normalize(array_replace($taobao,['Volume'=>$volume]),false,'taobao')['sold_count']===null,'Unknown or invalid sales never displayed as zero');
$before=shipping_calculate(['goods_cny'=>10,'domestic_cny'=>0,'cargo_method'=>'weight','cargo_measure'=>0.5]);$s['cny_rate']=600;shipping_save($s);check((float)shipping_settings()['cny_rate']===600.0,'Persist rate');check($before['total']===7000,'Snapshot preserved');
$destination=warehouse_destination(['id'=>'GS-TEST-123'],['family_name'=>'Бат','customer'=>'Тамир','warehouse'=>['recipient'=>'Wrong','address'=>'Wrong']]);
check($destination['recipient']==='Бат Тамир / GS-TEST-123','Server recipient and code');
check($destination['address']==='内蒙古锡林郭勒盟二连浩特市环宇商贸城10-16号'&&$destination['phone']==='18047981132'&&$destination['contact_phone']==='99889815','Warehouse destination');
foreach([['family_name'=>'','customer'=>'Тамир'],['family_name'=>"Бат\nOther",'customer'=>'Тамир']] as $invalid){try{warehouse_destination(['id'=>'GS-TEST-123'],$invalid);throw new RuntimeException('Invalid recipient accepted');}catch(ApiError){}}
echo "Shipping rounding, volume thresholds, validation, rate snapshots, supplier normalization and warehouse recipient passed.\n";
