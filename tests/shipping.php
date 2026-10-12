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
check(supplier_cny(['OriginalPrice'=>20,'OriginalCurrencyCode'=>'USD'])===null,'Currency isolation');
$before=shipping_calculate(['goods_cny'=>10,'domestic_cny'=>0,'cargo_method'=>'weight','cargo_measure'=>0.5]);$s['cny_rate']=600;shipping_save($s);check((float)shipping_settings()['cny_rate']===600.0,'Persist rate');check($before['total']===7000,'Snapshot preserved');
echo "Shipping rounding, volume thresholds, validation, rate snapshots and supplier normalization passed.\n";
