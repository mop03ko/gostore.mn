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
    if($action==='customer-profile'){
        $name=str_field($b,'name',100);$phone=customer_phone($b);$address=str_field($b,'address',500,false);
        db()->prepare('UPDATE customers SET name=?,phone=?,address=?,updated=? WHERE id=?')->execute([$name,$phone,$address,gmdate('c'),$c['id']]);
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
