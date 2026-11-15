<?php
declare(strict_types=1);

// Keep the original account and its sessions intact. Additional managers have
// independent versions; existing device/push rows already store that version.
function warehouse_manager_rows(string $location): array {
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');
    $s->execute(['warehouse_managers_'.$location]);
    return json_decode($s->fetchColumn()?:'{}',true,512,JSON_THROW_ON_ERROR);
}
function warehouse_manager_accounts(string $location): array {
    return ['primary'=>warehouse_account($location)]+warehouse_manager_rows($location);
}
function warehouse_managers_public(string $location): array {
    $rows=[];
    foreach(warehouse_manager_accounts($location) as $id=>$a){
        if($id==='primary'&&$a['password_hash']==='')continue;
        $rows[]=['id'=>$id,'location'=>$location,'name'=>$a['name']??'','email'=>$a['email'],'enabled'=>(bool)$a['enabled'],'configured'=>$a['password_hash']!==''];
    }
    return $rows;
}
function warehouse_account_by_version(string $location,string $version): array {
    if($version!=='')foreach(warehouse_manager_accounts($location) as $a){
        if($a['version']!==''&&hash_equals($a['version'],$version))return $a;
    }
    return ['email'=>'','password_hash'=>'','enabled'=>false,'version'=>''];
}
function warehouse_current_account(string $location): array {
    if(($_SESSION['warehouse_location']??'erenhot')!==$location)return warehouse_account_by_version($location,'');
    return warehouse_account_by_version($location,(string)($_SESSION['warehouse_version']??''));
}
function warehouse_account_by_email(string $location,string $email): array {
    foreach(warehouse_manager_accounts($location) as $a)if(hash_equals($a['email'],$email))return $a;
    return warehouse_account_by_version($location,'');
}
function warehouse_manager_unique_email(string $location,string $email,string $except): void {
    foreach(warehouse_manager_accounts($location) as $id=>$a){
        if($id!==$except&&strtolower($a['email'])===$email)fail('Энэ имэйлээр тус агуулахт менежер бүртгэлтэй байна.',409);
    }
}
function warehouse_manager_save(array $b): array {
    admin_required();
    if(function_exists('admin_role_at_least')&&!admin_role_at_least('owner'))fail('Менежерийн эрхийг зөвхөн үндсэн админ удирдана.',403);
    $location=warehouse_location($b);$id=str_field($b,'manager_id',40);
    if($id!=='new'&&!preg_match('/^wm-[a-f0-9]{24}$/D',$id))fail('Менежерийн дугаар буруу.');
    $name=str_field($b,'name',100);$email=strtolower(str_field($b,'email',200));
    if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Имэйл хаягаа шалгана уу.');
    $password=$b['password']??'';
    if(!is_string($password)||str_contains($password,"\0")||($password!==''&&(strlen($password)<12||strlen($password)>72)))fail('Нууц үг 12–72 байт урттай байна.');
    if(!is_bool($b['enabled']??null))fail('Эрхийн төлөв буруу.');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $rows=warehouse_manager_rows($location);
        if($id==='new'){
            if(count($rows)>=50)fail('Нэг агуулахад 50 хүртэл нэмэлт менежер бүртгэнэ.',409);
            if($password==='')fail('Менежерийн анхны нууц үгийг оруулна уу.');
            $id='wm-'.bin2hex(random_bytes(12));$a=['password_hash'=>'','created'=>gmdate('c')];
        }else{
            if(!isset($rows[$id]))fail('Энэ агуулахын менежер олдсонгүй.',404);
            $a=$rows[$id];
        }
        warehouse_manager_unique_email($location,$email,$id);
        $a=array_replace($a,['name'=>$name,'email'=>$email,'enabled'=>$b['enabled'],'version'=>bin2hex(random_bytes(16)),'updated'=>gmdate('c')]);
        if($password!=='')$a['password_hash']=password_hash($password,PASSWORD_BCRYPT,['cost'=>12]);
        $rows[$id]=$a;
        $db->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['warehouse_managers_'.$location,json_encode($rows,JSON_THROW_ON_ERROR)]);
        $db->exec('COMMIT');
        return warehouse_account_public($location);
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function warehouse_managers_revoke(string $location): void {
    $rows=warehouse_manager_rows($location);
    foreach($rows as &$a)$a['version']=bin2hex(random_bytes(16));unset($a);
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['warehouse_managers_'.$location,json_encode($rows,JSON_THROW_ON_ERROR)]);
}
