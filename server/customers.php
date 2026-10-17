<?php
declare(strict_types=1);

function current_customer(): ?array {
    if (empty($_SESSION['customer_id'])) return null;
    $s=db()->prepare('SELECT * FROM customers WHERE id=?');$s->execute([$_SESSION['customer_id']]);$c=$s->fetch();
    if (!$c || (int)$c['auth_version']!==($_SESSION['customer_version']??0)) {
        unset($_SESSION['customer_id'],$_SESSION['customer_version']);return null;
    }
    return $c;
}
function customer_required(): array { $c=current_customer();if(!$c)fail('Бүртгэлээрээ нэвтэрнэ үү.',401);return $c; }
function customer_public(?array $c): ?array {
    if(!$c)return null;
    return array_intersect_key($c,array_flip(['id','email','name','phone','address','created']));
}
function customer_sign_in(array $c): void {
    session_regenerate_id(true);$_SESSION['customer_id']=$c['id'];$_SESSION['customer_version']=(int)$c['auth_version'];$_SESSION['csrf']=bin2hex(random_bytes(32));
}
function customer_email(array $b): string {
    $email=strtolower(str_field($b,'email',200));if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Имэйл хаягаа зөв оруулна уу.');return $email;
}
function customer_password(array $b,string $field='password',bool $new=false): string {
    $password=$b[$field]??null;
    if(!is_string($password)||$password===''||str_contains($password,"\0")||strlen($password)>72||($new&&mb_strlen($password)<10))fail('Нууц үг 10-аас доошгүй тэмдэгттэй байна. Хэт урт нууц үг оруулахгүй байна уу.');
    return $password;
}
function customer_phone(array $b): string {
    $phone=str_field($b,'phone',30,false);if($phone!==''&&!preg_match('/^[+\d ()-]{8,25}$/',$phone))fail('Утасны дугаараа зөв оруулна уу.');return $phone;
}
// Address book: up to 10 delivery addresses; the default one mirrors customers.address for older screens.
function customer_addresses(array $c): array {
    $db=db();$s=$db->prepare('SELECT * FROM customer_addresses WHERE customer_id=? ORDER BY is_default DESC,created DESC,rowid DESC');$s->execute([$c['id']]);$rows=$s->fetchAll();
    if(!$rows&&trim((string)$c['address'])!==''){
        // Accounts created before the address book keep their saved profile address as the default.
        // The write lock and re-check stop two parallel first visits from creating two defaults.
        $db->exec('BEGIN IMMEDIATE');
        try{
            $s->execute([$c['id']]);
            if(!$s->fetchAll()){$now=gmdate('c');$db->prepare('INSERT INTO customer_addresses VALUES (?,?,?,?,?,?,1,?,?)')->execute([bin2hex(random_bytes(16)),$c['id'],'Үндсэн хаяг',$c['name'],$c['phone'],$c['address'],$now,$now]);}
            $db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        $s->execute([$c['id']]);$rows=$s->fetchAll();
    }
    return array_map(fn($a)=>['id'=>$a['id'],'label'=>$a['label'],'recipient'=>$a['recipient'],'phone'=>$a['phone'],'address'=>$a['address'],'is_default'=>(bool)$a['is_default']],$rows);
}
function customer_address_sync(string $customer): void {
    $s=db()->prepare('SELECT address FROM customer_addresses WHERE customer_id=? AND is_default=1');$s->execute([$customer]);$address=$s->fetchColumn();
    db()->prepare('UPDATE customers SET address=?,updated=? WHERE id=?')->execute([$address===false?'':$address,gmdate('c'),$customer]);
}
function customer_address_save(array $c,array $b): array {
    $label=str_field($b,'label',40,false)?:'Хаяг';$recipient=str_field($b,'recipient',100);$phone=customer_phone($b);$address=str_field($b,'address',500);
    if($phone==='')fail('Холбогдох утасны дугаараа оруулна уу.');
    foreach([$label,$recipient] as $value)if(preg_match('/[\x00-\x1F\x7F]/u',$value))fail('Нэр, шошгыг нэг мөрөнд бичнэ үү.');
    if(isset($b['is_default'])&&!is_bool($b['is_default']))fail('Үндсэн хаягийн тохиргоо буруу.');
    $id=str_field($b,'id',32,false);$default=($b['is_default']??false)===true;$now=gmdate('c');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $s=$db->prepare('SELECT count(*) FROM customer_addresses WHERE customer_id=?');$s->execute([$c['id']]);$count=(int)$s->fetchColumn();
        if($id!==''){
            $s=$db->prepare('UPDATE customer_addresses SET label=?,recipient=?,phone=?,address=?,updated=? WHERE id=? AND customer_id=?');$s->execute([$label,$recipient,$phone,$address,$now,$id,$c['id']]);
            if($s->rowCount()!==1)fail('Хаяг олдсонгүй.',404);
        }else{
            if($count>=10)fail('10 хүртэл хаяг хадгална. Хэрэггүй хаягаа устгана уу.',409);
            $id=bin2hex(random_bytes(16));$default=$default||$count===0;
            $db->prepare('INSERT INTO customer_addresses VALUES (?,?,?,?,?,?,0,?,?)')->execute([$id,$c['id'],$label,$recipient,$phone,$address,$now,$now]);
        }
        if($default){$db->prepare('UPDATE customer_addresses SET is_default=0 WHERE customer_id=?')->execute([$c['id']]);$db->prepare('UPDATE customer_addresses SET is_default=1 WHERE id=?')->execute([$id]);}
        customer_address_sync($c['id']);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return customer_addresses(current_customer());
}
function customer_address_delete(array $c,string $id): array {
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $s=$db->prepare('DELETE FROM customer_addresses WHERE id=? AND customer_id=?');$s->execute([$id,$c['id']]);if($s->rowCount()!==1)fail('Хаяг олдсонгүй.',404);
        $s=$db->prepare('SELECT count(*) FROM customer_addresses WHERE customer_id=? AND is_default=1');$s->execute([$c['id']]);
        if(!(int)$s->fetchColumn())$db->prepare('UPDATE customer_addresses SET is_default=1 WHERE id=(SELECT id FROM customer_addresses WHERE customer_id=? ORDER BY created DESC,rowid DESC LIMIT 1)')->execute([$c['id']]);
        customer_address_sync($c['id']);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return customer_addresses(current_customer());
}
// Products the customer has ordered (newest first, one row per product) for quick re-ordering.
function customer_products(array $c): array {
    $s=db()->prepare('SELECT o.data FROM orders o JOIN customer_orders co ON co.order_id=o.id WHERE co.customer_id=? ORDER BY o.created DESC LIMIT 300');$s->execute([$c['id']]);
    $products=[];
    foreach($s->fetchAll() as $row){
        $o=json_decode($row['data'],true);if(!is_array($o)||($o['status']??'')==='cancelled')continue;
        foreach($o['items']??(isset($o['supplier'])?[$o['supplier']]:[]) as $line){
            $id=(string)($line['id']??'');if($id==='')continue;
            if(isset($products[$id])){$products[$id]['times']++;continue;}
            if(count($products)>=100)continue;
            $products[$id]=['id'=>$id,'name'=>mb_substr((string)($line['name']??''),0,300),'image'=>is_string($line['image']??null)&&str_starts_with($line['image'],'https://')?$line['image']:'','variant'=>mb_substr((string)($line['variant']??''),0,300),'qty'=>(int)($line['qty']??0),'order_id'=>$o['id'],'ordered_at'=>$o['created'],'paid'=>(bool)($o['paid']??false),'times'=>1,'supplier'=>(bool)preg_match('/^(?:tb|abb)-\d{5,20}$/D',$id)];
        }
    }
    return array_values($products);
}
function order_owner(string $id): ?string {
    $s=db()->prepare('SELECT customer_id FROM customer_orders WHERE order_id=?');$s->execute([$id]);return $s->fetchColumn()?:null;
}
function customer_order_access(array $r,array $b): void {
    $owner=order_owner($r['id']);
    if($owner!==null){if((current_customer()['id']??null)!==$owner)fail('Энэ захиалгыг харах эрхгүй.',403);return;}
    $token=str_field($b,'token',100,false);
    if(!hash_equals($r['token_hash'],hash('sha256',$token)))fail('Захиалга харах эрхгүй.',403);
}
function customer_get(string $action): never {
    if($action==='customer-me')json_out(['customer'=>customer_public(current_customer()),'csrf'=>$_SESSION['csrf']]);
    $c=customer_required();
    if($action==='customer-addresses')json_out(['addresses'=>customer_addresses($c)]);
    if($action==='customer-products')json_out(['products'=>customer_products($c)]);
    if($action==='customer-notifications'){
        $s=db()->prepare('SELECT n.* FROM order_notifications n JOIN customer_orders co ON co.order_id=n.order_id WHERE co.customer_id=? ORDER BY n.id DESC LIMIT 100');$s->execute([$c['id']]);
        $count=db()->prepare('SELECT COUNT(*) FROM order_notifications n JOIN customer_orders co ON co.order_id=n.order_id WHERE co.customer_id=? AND n.read_at IS NULL');$count->execute([$c['id']]);json_out(['notifications'=>$s->fetchAll(),'unread'=>(int)$count->fetchColumn()]);
    }
    if($action==='customer-orders'){
        $offset=filter_var($_GET['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>100000]]);
        if($offset===false)fail('Хуудасны дугаар буруу.');
        $s=db()->prepare('SELECT o.data FROM orders o JOIN customer_orders co ON co.order_id=o.id WHERE co.customer_id=? ORDER BY o.created DESC,o.id DESC LIMIT 21 OFFSET ?');
        $s->bindValue(1,$c['id']);$s->bindValue(2,$offset,PDO::PARAM_INT);$s->execute();$rows=$s->fetchAll();
        $orders=array_map(fn($r)=>public_order(json_decode($r['data'],true)),array_slice($rows,0,20));
        json_out(['orders'=>$orders,'more'=>count($rows)>20]);
    }
    fail('Үйлдэл олдсонгүй.',404);
}
function customer_post(string $action,array $b): never {
    $ip=$_SERVER['REMOTE_ADDR']??'';
    if($action==='customer-register'){
        limit_attempts('customer-register:'.$ip,5,3600);
        $email=customer_email($b);$name=str_field($b,'name',100);$phone=customer_phone($b);$password=customer_password($b,'password',true);
        if(($b['password_confirm']??null)!==$password)fail('Нууц үгийн давталт таарахгүй байна.');
        $now=gmdate('c');$id=bin2hex(random_bytes(16));
        try{db()->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute([$id,$email,$name,$phone,'',password_hash($password,PASSWORD_BCRYPT,['cost'=>12]),$now,$now]);}
        catch(PDOException $e){if((string)$e->getCode()==='23000')fail('Энэ имэйлээр бүртгэл үүсгэх боломжгүй. Нэвтрэх хэсгийг ашиглана уу.',409);throw $e;}
        customer_sign_in(['id'=>$id,'auth_version'=>1]);json_out(['customer'=>customer_public(current_customer()),'csrf'=>$_SESSION['csrf']],201);
    }
    if($action==='customer-login'){
        limit_attempts('customer-login:'.$ip,20,900);$email=customer_email($b);limit_attempts('customer-login-email:'.$email,10,900);
        $password=customer_password($b);$s=db()->prepare('SELECT * FROM customers WHERE email=?');$s->execute([$email]);$c=$s->fetch();
        $dummy='$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $valid=password_verify($password,$c['password_hash']??$dummy);if(!$c||!$valid)fail('Имэйл эсвэл нууц үг буруу байна.',401);
        customer_sign_in($c);json_out(['customer'=>customer_public($c),'csrf'=>$_SESSION['csrf']]);
    }
    if($action==='customer-logout'){
        $_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));json_out(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
    }
    $c=customer_required();
    if($action==='customer-notifications-read'){
        $id=int_field($b,'through_id',0,PHP_INT_MAX);db()->prepare('UPDATE order_notifications SET read_at=? WHERE id<=? AND read_at IS NULL AND order_id IN (SELECT order_id FROM customer_orders WHERE customer_id=?)')->execute([gmdate('c'),$id,$c['id']]);json_out(['ok'=>true]);
    }
    if($action==='customer-address-save'){limit_attempts('customer-address:'.$c['id'],60,3600);json_out(['addresses'=>customer_address_save($c,$b)]);}
    if($action==='customer-address-delete')json_out(['addresses'=>customer_address_delete($c,str_field($b,'id',32))]);
    if($action==='customer-profile'){
        // The account page edits addresses in the address book; older forms may still send one.
        $name=str_field($b,'name',100);$phone=customer_phone($b);$address=array_key_exists('address',$b)?str_field($b,'address',500,false):$c['address'];
        db()->prepare('UPDATE customers SET name=?,phone=?,address=?,updated=? WHERE id=?')->execute([$name,$phone,$address,gmdate('c'),$c['id']]);
        if($address!==$c['address']&&$address!=='')db()->prepare('UPDATE customer_addresses SET address=?,updated=? WHERE customer_id=? AND is_default=1')->execute([$address,gmdate('c'),$c['id']]);
        json_out(['customer'=>customer_public(current_customer())]);
    }
    if($action==='customer-password'){
        limit_attempts('customer-password:'.$c['id'],8,900);
        if(!password_verify(customer_password($b,'current_password'),$c['password_hash']))fail('Одоогийн нууц үг буруу байна.',400);
        $password=customer_password($b,'password',true);if(($b['password_confirm']??null)!==$password)fail('Нууц үгийн давталт таарахгүй байна.');
        // Compare-and-swap rejects a simultaneous change based on stale credentials.
        $s=db()->prepare('UPDATE customers SET password_hash=?,auth_version=auth_version+1,updated=? WHERE id=? AND auth_version=?');
        $s->execute([password_hash($password,PASSWORD_BCRYPT,['cost'=>12]),gmdate('c'),$c['id'],$c['auth_version']]);
        if($s->rowCount()!==1)fail('Дахин нэвтэрч оролдоно уу.',401);
        $c['auth_version']=(int)$c['auth_version']+1;customer_sign_in($c);json_out(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
    }
    if($action==='customer-claim-order'){
        limit_attempts('customer-claim:'.$c['id'],100,3600);$id=str_field($b,'id',50);$token=str_field($b,'token',100);
        $db=db();$db->exec('BEGIN IMMEDIATE');
        try{
            $r=order_row($id);$owner=order_owner($id);
            if(($owner!==null&&$owner!==$c['id'])||!hash_equals($r['token_hash'],hash('sha256',$token)))fail('Энэ захиалгыг холбох эрхгүй.',403);
            $db->prepare('INSERT OR IGNORE INTO customer_orders VALUES (?,?,?)')->execute([$id,$c['id'],gmdate('c')]);$db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        json_out(['ok'=>true]);
    }
    fail('Үйлдэл олдсонгүй.',404);
}
