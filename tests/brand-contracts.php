<?php
require __DIR__.'/../server/bootstrap.php';require __DIR__.'/../server/shipping.php';require __DIR__.'/../server/supplier.php';
function check_brand(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$raw=['ErrorCode'=>'BatchError','Result'=>['Item'=>['Id'=>'123456789','Promotions'=>[['Name'=>'Must hide']]],'PromotionsError'=>['ErrorCode'=>'NotAvailable']]];
$result=supplier_response('/service-json/BatchGetItemFullInfo',true,200,json_encode($raw));check_brand($result['Item']['Promotions']===[],'Optional offer failures must clear offers');
$raw['Result']['VendorError']=['ErrorCode'=>'NotFound'];try{supplier_response('/service-json/BatchGetItemFullInfo',true,200,json_encode($raw));throw new RuntimeException('Vendor errors must fail closed');}catch(ApiError $e){check_brand($e->getCode()===503,'Expected provider error');}
$cache=['stale'=>false,'expires'=>time()+500];$item=['IsValidPromotions'=>true,'Promotions'=>[['Name'=>'Calculated','Desciption'=>'<script>bad()</script>2 items','IsCalculated'=>true,'Price'=>['OriginalPrice'=>50,'OriginalCurrencyCode'=>'CNY']]]];$offers=supplier_offers($item,$cache);check_brand($offers['promotions'][0]['price_mnt']===27500,'Calculated reference price');check_brand($offers['promotions'][0]['description']==='2 items','Markup removed');$item['IsValidPromotions']=false;check_brand(supplier_offers($item,$cache)['promotions']===[],'Invalid offers hidden');
echo "PASS: optional promotion errors preserve product, seller errors fail closed, calculated offer prices and sanitization.\n";
