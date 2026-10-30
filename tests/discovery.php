<?php
declare(strict_types=1);
require __DIR__.'/../server/discovery.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
$products=[['id'=>'tb-100001'],['id'=>'tb-100002'],['id'=>'tb-100003'],['id'=>'tb-100004']];
$reference=['status'=>'available','item_fees_fen'=>['tb-100001'=>0,'tb-100002'=>1200,'tb-100004'=>null]];
check(array_column(discovery_free_products($products,$reference),'id')===['tb-100001'],'Only an explicitly known integer zero qualifies; paid, missing and null fees do not.');
check(discovery_free_products($products,['status'=>'unavailable','item_fees_fen'=>['tb-100001'=>0]])===[],'Unavailable data must never advertise free shipping.');
check(discovery_free_products($products,['status'=>'busy'])===[],'Busy means unknown, not free.');
check(discovery_free_products($products,['status'=>'available','item_fees_fen'=>['tb-100001'=>'0']])===[],'Unvalidated raw string fees are not trusted.');
check(discovery_free_products($products,$reference)[0]['domestic_shipping_reference_fen']===0,'Explicitly scoped reference accompanies the card.');
echo "PASS discovery: known zero only, no missing/error-to-free coercion.\n";
