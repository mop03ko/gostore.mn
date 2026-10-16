<?php
declare(strict_types=1);
// Address book and ordered-products list for the account page, on an isolated SQLite file.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/customer-addresses-'.bin2hex(random_bytes(5)));
foreach(['bootstrap','customers'] as $file)require __DIR__.'/../server/'.$file.'.php';
function expect_error(callable $call,int $status):void { try{$call();}catch(ApiError $e){if($e->getCode()===$status)return;throw $e;} throw new RuntimeException('Expected HTTP '.$status); }
function check(bool $ok,string $message):void { if(!$ok)throw new RuntimeException($message); }
$now=gmdate('c');$db=db();
foreach([['c1','a@example.test','Бат','99112233','БЗД 1-р хороо'],['c2','b@example.test','Сараа','88112233','']] as [$id,$email,$name,$phone,$address])
    $db->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute([$id,$email,$name,$phone,$address,'x',$now,$now]);
$_SESSION=['customer_id'=>'c1','customer_version'=>1];$c=current_customer();
// A profile address saved before the address book becomes the default entry.
$list=customer_addresses($c);check(count($list)===1&&$list[0]['is_default']&&$list[0]['address']==='БЗД 1-р хороо'&&$list[0]['recipient']==='Бат','Legacy address not migrated');
check(count(customer_addresses(current_customer()))===1,'Migration repeated');
$list=customer_address_save($c,['label'=>'Ажил','recipient'=>'Бат','phone'=>'99112233','address'=>'СБД 8-р хороо','is_default'=>true]);
check($list[0]['label']==='Ажил'&&$list[0]['is_default']&&!$list[1]['is_default'],'New default not first');
check(current_customer()['address']==='СБД 8-р хороо','Default address must mirror the profile');
$work=$list[0]['id'];$home=$list[1]['id'];
$list=customer_address_save(current_customer(),['id'=>$home,'label'=>'Гэр','recipient'=>'Бат Б','phone'=>'99112233','address'=>'БЗД 2-р хороо','is_default'=>false]);
check(array_column($list,'label')===['Ажил','Гэр']&&$list[1]['address']==='БЗД 2-р хороо','Edit failed');
foreach([['recipient'=>'','phone'=>'99112233','address'=>'x'],['recipient'=>'A','phone'=>'','address'=>'x'],['recipient'=>'A','phone'=>'99112233','address'=>''],['recipient'=>'A','phone'=>'abc','address'=>'x'],['recipient'=>"A\nB",'phone'=>'99112233','address'=>'x'],['recipient'=>'A','phone'=>'99112233','address'=>'x','is_default'=>'yes']] as $bad)expect_error(fn()=>customer_address_save(current_customer(),$bad),400);
for($i=3;$i<=10;$i++)customer_address_save(current_customer(),['recipient'=>'Бат','phone'=>'99112233','address'=>'Хаяг '.$i]);
expect_error(fn()=>customer_address_save(current_customer(),['recipient'=>'Бат','phone'=>'99112233','address'=>'11']),409);
// Deleting the default promotes the newest remaining address and keeps the profile in sync.
$list=customer_address_delete(current_customer(),$work);
check(count($list)===9&&$list[0]['is_default']&&$list[0]['address']==='Хаяг 10'&&current_customer()['address']==='Хаяг 10','Default not reassigned');
// Another customer cannot see, edit or delete these addresses.
$_SESSION=['customer_id'=>'c2','customer_version'=>1];$other=current_customer();
check(customer_addresses($other)===[],'Address book leaked');
expect_error(fn()=>customer_address_save($other,['id'=>$home,'recipient'=>'X','phone'=>'99112233','address'=>'x']),404);
expect_error(fn()=>customer_address_delete($other,$home),404);
// Ordered products: newest first, one row per product, cancelled orders ignored.
$order=function(string $id,string $created,array $o)use($db){$o+=['id'=>$id,'created'=>$created,'paid'=>true,'status'=>'confirmed'];$db->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,'h'.$id,'k'.$id,json_encode($o,JSON_UNESCAPED_UNICODE),$created,$created]);$db->prepare('INSERT INTO customer_orders VALUES (?,?,?)')->execute([$id,'c1',$created]);};
$order('GS-1','2026-10-01T00:00:00+00:00',['type'=>'checkout','items'=>[['id'=>'tb-111111111','name'=>'Цүнх','variant'=>'Хар','qty'=>1,'image'=>'https://img.alicdn.com/a.jpg'],['id'=>'tb-222222222','name'=>'Гутал','variant'=>'42','qty'=>2,'image'=>'javascript:x']]]);
$order('GS-2','2026-10-05T00:00:00+00:00',['type'=>'supplier','supplier'=>['id'=>'tb-111111111','name'=>'Цүнх','variant'=>'Цагаан','qty'=>3,'image'=>'']]);
$order('GS-3','2026-10-06T00:00:00+00:00',['type'=>'checkout','status'=>'cancelled','items'=>[['id'=>'tb-333333333','name'=>'Цуцалсан','variant'=>'','qty'=>1]]]);
$_SESSION=['customer_id'=>'c1','customer_version'=>1];$products=customer_products(current_customer());
check(array_column($products,'id')===['tb-111111111','tb-222222222'],'Products order or cancellation filter changed');
check($products[0]['order_id']==='GS-2'&&$products[0]['times']===2&&$products[0]['variant']==='Цагаан'&&$products[0]['supplier']===true,'Latest order row not used');
check($products[1]['image']==='','Unsafe image URL must be dropped');
check(customer_products(['id'=>'c2'])===[],'Other customer sees products');
echo "PASS: address book (legacy migration, 10-address limit, default sync, edit/delete, validation, isolation) and ordered products.\n";
