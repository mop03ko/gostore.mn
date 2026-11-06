<?php
declare(strict_types=1);
function pin_auth_secret(): string {
    $key=getenv('GOSTORE_PIN_PEPPER');
    if($key===false){$path=__DIR__.'/pin-auth.env';if(is_file($path)&&filesize($path)<=1024&&preg_match('/^GOSTORE_PIN_PEPPER=([a-f0-9]{64})$/D',trim((string)file_get_contents($path)),$m))$key=$m[1];}
    if(!is_string($key)||!preg_match('/^[a-f0-9]{64}$/D',$key))fail('PIN нэвтрэлт түр боломжгүй байна.',503);
    return $key;
}
function pin_auth_value(array $b,string $field='pin'): string {
    $value=$b[$field]??null;if(!is_string($value)||!preg_match('/^[0-9]{4}$/D',$value))fail('PIN код 4 оронтой тоо байна.');return $value;
}
function pin_auth_digest(string $pin): string {return hash_hmac('sha256',$pin,pin_auth_secret());}
function pin_auth_record(string $customer): ?array {$q=db()->prepare('SELECT * FROM customer_phone_auth WHERE customer_id=?');$q->execute([$customer]);return $q->fetch()?:null;}
function pin_auth_rate(string $phone): void {
    limit_attempts('pin-ip:'.($_SERVER['REMOTE_ADDR']??''),30,900);
    limit_attempts('pin-phone:'.$phone,5,900);
    limit_attempts('pin-day:'.$phone,20,86400);
}
function pin_auth_check(string $phone,string $pin,?array $record): bool {
    pin_auth_rate($phone);
    $dummy='$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
    $valid=password_verify(pin_auth_digest($pin),$record['pin_hash']??$dummy);
    if(!$record||!$valid)return false;
    db()->prepare('DELETE FROM limits WHERE key=?')->execute([hash('sha256','pin-phone:'.$phone)]);
    return true;
}
function pin_auth_login(array $b): array {
    $phone=verify_mn_phone(str_field($b,'phone',30));$pin=pin_auth_value($b);
    $q=db()->prepare('SELECT * FROM customer_phone_auth WHERE phone=?');$q->execute([$phone]);$record=$q->fetch()?:null;
    if(!pin_auth_check($phone,$pin,$record))fail('Утасны дугаар эсвэл PIN буруу байна.',401);
    $q=db()->prepare('SELECT * FROM customers WHERE id=?');$q->execute([$record['customer_id']]);$customer=$q->fetch();
    if(!$customer)fail('Утасны дугаар эсвэл PIN буруу байна.',401);
    // Recheck credentials under a write lock: a concurrent reset must not authenticate the old PIN.
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{$current=pin_auth_record($customer['id']);if(!$current||!hash_equals($record['pin_hash'],$current['pin_hash']))fail('Дахин нэвтэрнэ үү.',401);$q->execute([$customer['id']]);$customer=$q->fetch();customer_sign_in($customer);$db->exec('COMMIT');}catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return ['customer'=>customer_public($customer),'csrf'=>$_SESSION['csrf']];
}
function pin_auth_setup(array $b): array {
    $phone=verify_mn_phone(str_field($b,'phone',30));$pin=pin_auth_value($b);
    if(($b['pin_confirm']??null)!==$pin)fail('PIN давталт таарахгүй байна.');
    $purpose=str_field($b,'purpose',16);$challenge=str_field($b,'challenge',48);
    $signed=current_customer();
    $proof=$_SESSION['phone_verified']??null;$s=$_SESSION['phone_verification']??null;
    if(!in_array($purpose,['register','reset','link'],true)||!$proof||!$s||$s['status']!=='VERIFIED'||$s['expires']<=time()||$s['phone']!==$phone||($s['purpose']??'verify')!==$purpose||!hash_equals($s['challenge'],$challenge)||$proof['phone']!==$phone||$proof['customer']!==($_SESSION['customer_id']??null)||($s['auth_version']??null)!==($_SESSION['customer_version']??null))fail('Энэ утсаа SMS-ээр дахин баталгаажуулна уу.',403);
    if($purpose==='link'&&!$signed)fail('Өмнөх бүртгэлээрээ нэвтэрнэ үү.',401);
    if($purpose==='register'&&$signed)fail('Нэвтэрсэн бүртгэлийнхээ утсыг холбоно уу.',409);
    $hash=password_hash(pin_auth_digest($pin),PASSWORD_BCRYPT,['cost'=>12]);$now=gmdate('c');$db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $q=$db->prepare('SELECT * FROM customer_phone_auth WHERE phone=?');$q->execute([$phone]);$record=$q->fetch();
        if($purpose==='register'){
            if($record)fail('Энэ дугаараар бүртгэлтэй байна. Нэвтрэх эсвэл PIN сэргээхийг сонгоно уу.',409);
            $id=bin2hex(random_bytes(16));$name=str_field($b,'name',100);$email=$id.'@phone.gostore.invalid';
            $db->prepare('INSERT INTO customers VALUES (?,?,?,?,?,?,1,?,?)')->execute([$id,$email,$name,$phone,'',password_hash(bin2hex(random_bytes(32)),PASSWORD_BCRYPT),$now,$now]);
        }elseif($purpose==='reset'){
            if(!$record)fail('Энэ дугаарт PIN бүртгэл олдсонгүй. Шинээр бүртгүүлнэ үү.',404);
            $id=$record['customer_id'];if($signed&&$signed['id']!==$id)fail('Өөр бүртгэлийн PIN солихын өмнө гарна уу.',409);
        }else{
            $id=$signed['id'];if($record&&$record['customer_id']!==$id)fail('Энэ дугаар өөр бүртгэлд холбогдсон байна.',409);
            $fresh=current_customer();if(!$fresh||$fresh['id']!==$id)fail('Дахин нэвтэрнэ үү.',401);
        }
        if($purpose!=='register')$db->prepare('UPDATE customers SET phone=?,auth_version=auth_version+1,updated=? WHERE id=?')->execute([$phone,$now,$id]);
        $db->prepare('DELETE FROM customer_phone_auth WHERE customer_id=?')->execute([$id]);
        $db->prepare('INSERT INTO customer_phone_auth (phone,customer_id,pin_hash,verified_at) VALUES (?,?,?,?)')->execute([$phone,$id,$hash,$now]);
        foreach(['pin-phone:','pin-day:'] as $prefix)$db->prepare('DELETE FROM limits WHERE key=?')->execute([hash('sha256',$prefix.$phone)]);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    unset($_SESSION['phone_verified'],$_SESSION['phone_verification']);
    $q=$db->prepare('SELECT * FROM customers WHERE id=?');$q->execute([$id]);$customer=$q->fetch();customer_sign_in($customer);
    return ['customer'=>customer_public($customer),'csrf'=>$_SESSION['csrf']];
}
function pin_auth_change(array $b): array {
    $customer=customer_required();$record=pin_auth_record($customer['id']);$old=pin_auth_value($b,'current_pin');$pin=pin_auth_value($b);
    if(!$record||!pin_auth_check($record['phone'],$old,$record))fail('Одоогийн PIN буруу байна.',401);
    if(($b['pin_confirm']??null)!==$pin)fail('PIN давталт таарахгүй байна.');
    $hash=password_hash(pin_auth_digest($pin),PASSWORD_BCRYPT,['cost'=>12]);$db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $q=$db->prepare('UPDATE customer_phone_auth SET pin_hash=? WHERE customer_id=? AND pin_hash=?');$q->execute([$hash,$customer['id'],$record['pin_hash']]);if($q->rowCount()!==1)fail('Дахин нэвтэрнэ үү.',401);
        $q=$db->prepare('UPDATE customers SET auth_version=auth_version+1,updated=? WHERE id=? AND auth_version=?');$q->execute([gmdate('c'),$customer['id'],$customer['auth_version']]);if($q->rowCount()!==1)fail('Дахин нэвтэрнэ үү.',401);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    $customer['auth_version']++;customer_sign_in($customer);return ['customer'=>customer_public($customer),'csrf'=>$_SESSION['csrf']];
}