<?php
declare(strict_types=1);
// Cross-device cart/saved snapshot and the unpaid-checkout reminder, on an isolated SQLite file.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/customer-state-'.bin2hex(random_bytes(5)));
foreach(['bootstrap','customers','customer-state'] as $file)require __DIR__.'/../server/'.$file.'.php';
function expect_error(callable $call,int $status):void { try{$call();}catch(ApiError $e){if($e->getCode()===$status)return;throw $e;} throw new RuntimeException('Expected HTTP '.$status); }
function check(bool $ok,string $message):void { if(!$ok)throw new RuntimeException($message); }
$now=gmdate('c');$db=db();
foreach([['c1','a@example.test'],['c2','b@example.test']] as [$id,$email])
    $db->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute([$id,$email,'Бат','99112233','','x',$now,$now]);
$c1=['id'=>'c1'];$c2=['id'=>'c2'];

$empty=customer_state_get($c1);
check($empty===['cart'=>[],'favorites'=>[],'version'=>0,'pending'=>[]],'New customer must start empty');

$line=['id'=>'tb-123456789','sku'=>'555','qty'=>2,'name'=>"Үүргэвч\x07",'image'=>'https://img.alicdn.com/a.jpg','variant'=>'Хар','cny'=>12.5,'min_qty'=>1,'step'=>1,'stock'=>10,'vendor_id'=>'v1','vendor_name'=>"Hangzhou Store",'extra'=>'drop'];
$r=customer_state_save($c1,['cart'=>[$line,$line,['id'=>'bad','sku'=>'1','qty'=>1,'min_qty'=>1,'step'=>1],['id'=>'tb-987654321','sku'=>'','qty'=>1,'min_qty'=>1,'step'=>1],
    ['id'=>'tb-111111111','sku'=>'1','qty'=>1,'min_qty'=>1,'step'=>1,'image'=>'javascript:alert(1)','name'=>'Plain']]]);
check($r['version']===1&&count($r['cart'])===2,'Invalid and duplicate lines must be dropped');
check($r['cart'][0]['name']==='Үүргэвч'&&!isset($r['cart'][0]['extra'])&&$r['cart'][0]['cny']===12.5,'Line fields must be whitelisted and cleaned');
check($r['cart'][1]['image']==='','Only HTTPS image URLs are kept');
check($r['cart'][0]['vendor_name']==='Hangzhou Store'&&$r['cart'][1]['vendor_name']==='','The shop name used by the grouped cart syncs, cleaned');
check(customer_state_get($c1)['favorites']===[],'Saving the cart must keep favorites');

// Restricted listings never sync back to another device.
$r=customer_state_save($c1,['favorites'=>[['id'=>'tb-222222222','name'=>'Гал тогооны хутга','image'=>'https://img.alicdn.com/k.jpg'],['id'=>'tb-333333333','name'=>'Цүнх','mnt'=>5000,'card_discount'=>['x'=>1]],['id'=>'abb-123456']]]);
check($r['version']===2&&count($r['favorites'])===1&&$r['favorites'][0]['id']==='tb-333333333','Favorites must drop restricted and non-Taobao items');
check(!isset($r['favorites'][0]['card_discount'])&&$r['favorites'][0]['variants']===[]&&count(customer_state_get($c1)['cart'])===2,'Favorites must keep only card fields and leave the cart');
check(customer_state_get($c2)['version']===0,'State is per customer');
expect_error(fn()=>customer_state_save($c1,['cart'=>['id'=>'tb-123456789']]),400);
expect_error(fn()=>customer_state_save($c1,['favorites'=>'x']),400);
$many=[];for($i=0;$i<40;$i++)$many[]=['id'=>'tb-'.(100000000+$i),'sku'=>'1','qty'=>1,'min_qty'=>1,'step'=>1];
check(count(customer_state_save($c2,['cart'=>$many])['cart'])===CUSTOMER_CART_MAX,'Cart must be capped');

// Only payable instant checkouts appear in the reminder.
$orders=[['GS-PAY1','checkout','quoted',false,gmdate('c',time()+3600)],['GS-PAID','checkout','quoted',true,gmdate('c',time()+3600)],['GS-LATE','checkout','quoted',false,gmdate('c',time()-60)],['GS-SUPP','supplier','quoted',false,gmdate('c',time()+3600)],['GS-CANC','checkout','cancelled',false,gmdate('c',time()+3600)]];
foreach($orders as [$id,$type,$status,$paid,$due]){
    $db->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,'h',bin2hex(random_bytes(8)),json_encode(['id'=>$id,'type'=>$type,'status'=>$status,'paid'=>$paid,'amount'=>45000,'payment_due'=>$due]),$now,$now]);
    $db->prepare('INSERT INTO customer_orders VALUES (?,?,?)')->execute([$id,'c1',$now]);
}
$pending=customer_state_get($c1)['pending'];
check(count($pending)===1&&$pending[0]['id']==='GS-PAY1'&&$pending[0]['amount']===45000,'Only unpaid, unexpired checkouts are reminded');
check(customer_state_get($c2)['pending']===[],'Reminders are per customer');
echo "PASS: customer state (whitelisted cart/favorites, policy filter, per-customer versions, caps, unpaid-checkout reminder).\n";
