<?php
declare(strict_types=1);
// Instant checkout pricing and unpaid-order expiry with synthetic provider data; no QPay or OT calls.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/checkout-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');putenv('GOSTORE_DISABLE_QPAY=1');
foreach(['bootstrap','shipping','supplier','qpay','logistics','checkout'] as $file)require __DIR__.'/../server/'.$file.'.php';
function expect_error(callable $call,int $status,string $text=''):void {
    try{$call();}catch(ApiError $e){if($e->getCode()===$status&&str_contains($e->getMessage(),$text))return;throw $e;}
    throw new RuntimeException('Expected HTTP '.$status);
}
function check(bool $ok,string $message):void { if(!$ok)throw new RuntimeException($message); }
$dir=config()['data_dir'].'/supplier-cache';mkdir($dir,0700,true);
$product=fn(string $id,string $vendor,array $variants)=>['Item'=>['Id'=>$id,'ProviderType'=>'Taobao','Title'=>'Бараа '.$id,'MainPictureUrl'=>'https://img.alicdn.com/'.$id.'.jpg','VendorId'=>$vendor,'IsSellAllowed'=>true,'Price'=>['OriginalPrice'=>10,'OriginalCurrencyCode'=>'CNY'],'FirstLotQuantity'=>1,'NextLotQuantity'=>1,'ConfiguredItems'=>$variants]];
$variant=fn(string $id,float $cny,int $stock)=>['Id'=>$id,'Quantity'=>$stock,'Price'=>['OriginalPrice'=>$cny,'OriginalCurrencyCode'=>'CNY']];
foreach(['111111111'=>$product('111111111','shop-a',[$variant('red',12.5,10),$variant('blue',20,0)]),'222222222'=>$product('222222222','shop-a',[$variant('one',8,5)]),'333333333'=>$product('333333333','shop-b',[$variant('one',100,5)])] as $id=>$data)
    file_put_contents($dir.'/'.supplier_cache_key('/v1/taobao/product/'.$id,['language'=>'mn']).'.json',json_encode(['data'=>$data,'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false]));
$s=shipping_settings();$s['cny_rate']=500;$s['service_percent']=5;$s['service_fee_mnt']=2000;$s['domestic_default_cny']=10;
db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($s)]);

$cart=[['id'=>'tb-111111111','sku'=>'red','qty'=>2],['id'=>'tb-222222222','sku'=>'one','qty'=>1],['id'=>'tb-333333333','sku'=>'one','qty'=>1]];
$q=checkout_quote(checkout_items(['items'=>$cart]));
// Goods 133¥ → 66,500₮; two sellers → 20¥ domestic; 5% service + 2,000₮ fixed; cargo later.
check($q['inputs']==['goods_cny'=>133.0,'domestic_cny'=>20.0,'vendors'=>2],'Goods or seller count changed');
check($q['breakdown']==['goods_mnt'=>66500,'domestic_mnt'=>10000,'service_mnt'=>5325,'cargo_mnt'=>0]&&$q['total']===81825,'Checkout total changed');
expect_error(fn()=>checkout_items(['items'=>[['id'=>'tb-111111111','sku'=>'blue','qty'=>1]]]),400,'үлдэгдл');
expect_error(fn()=>checkout_items(['items'=>[$cart[0],$cart[0]]]),400,'давхардсан');
expect_error(fn()=>checkout_items(['items'=>[]]),400);
expect_error(fn()=>checkout_order(['items'=>$cart,'expected_total'=>81824],['paid'=>false]),409,'Үнэ шинэчлэгдсэн');

expect_error(fn()=>checkout_order(['items'=>$cart,'expected_total'=>81825,'fulfillment'=>'delivery'],['paid'=>false,'delivery_address'=>' ']),400,'хаяг');
$delivery=checkout_order(['items'=>$cart,'expected_total'=>81825,'fulfillment'=>'delivery'],['paid'=>false,'delivery_address'=>'БЗД 1-р хороо']);check($delivery['fulfillment_request']==['method'=>'delivery']&&$delivery['delivery_address']==='БЗД 1-р хороо','Delivery choice lost');
$o=checkout_order(['items'=>$cart,'expected_total'=>81825],['type'=>'checkout','title'=>'x','paid'=>false,'demo'=>false,'created'=>gmdate('c')]);
check($o['status']==='quoted'&&$o['amount']===81825&&count($o['items'])===3&&$o['items'][0]['price']===6250&&$o['qty']===4,'Order fields changed');
check(abs(strtotime($o['payment_due'])-time()-86400)<5,'Payment window must default to 24 hours');
$insert=function(array $o,string $id){$o['id']=$id;db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,hash('sha256',$id),hash('sha256','k'.$id),json_encode($o,JSON_UNESCAPED_UNICODE),$o['created'],$o['created']]);};
$insert($o,'GS-000001');
$late=$o;$late['payment_due']=gmdate('c',time()-1);$insert($late,'GS-000002');
$invoiced=$late;$invoiced['invoice']=['state'=>'ready','id'=>'inv'];$invoiced['callback_token']='t';$insert($invoiced,'GS-000003');
$paid=$late;$paid['paid']=true;$insert($paid,'GS-000004');
checkout_expire_due(true);
$status=fn($id)=>order_row($id)['order']['status'];
check($status('GS-000001')==='quoted','Order within the window was cancelled');
check($status('GS-000002')==='cancelled'&&order_row('GS-000002')['order']['cancel_reason']==='payment_timeout','Expired unpaid order stays open');
check($status('GS-000003')==='quoted','Invoice was cancelled without checking QPay');
check($status('GS-000004')==='quoted','Paid order was cancelled');
check(checkout_expired_or_cancelled('GS-000002')&&!checkout_expired_or_cancelled('GS-000001'),'Expiry state incorrect');
// The final settlement keeps the stored rates and starts from the prepaid breakdown.
check(settlement_summary(order_row('GS-000001')['order'])['breakdown']['domestic_mnt']===10000,'Settlement lost checkout breakdown');
check(str_contains(shipping_public()['pickup']['address'],'14б байр, 4 тоот'),'Default Ulaanbaatar pickup address missing');
echo "PASS: checkout pricing (sellers, service, cargo later), stock/duplicate/stale-total checks, 24 h expiry, invoice and paid protection.\n";
