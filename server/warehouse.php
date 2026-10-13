<?php
declare(strict_types=1);

function warehouse_account(): array {
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['warehouse_account']);
    return array_replace(['email'=>'','password_hash'=>'','enabled'=>false,'version'=>''],json_decode($s->fetchColumn()?:'{}',true));
}
function warehouse_account_public(): array {
    $a=warehouse_account();
    return ['email'=>$a['email'],'enabled'=>$a['enabled'],'configured'=>$a['password_hash']!==''];
}
function warehouse_account_save(array $b): array {
    admin_required();
    $email=strtolower(str_field($b,'email',200));
    if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Имэйл хаягаа шалгана уу.');
    $password=$b['password']??'';
    if(!is_string($password)||($password!==''&&(strlen($password)<12||strlen($password)>72)))fail('Нууц үг 12–72 байт урттай байна.');
    if(!is_bool($b['enabled']??null))fail('Эрхийн төлөв буруу.');
    $a=warehouse_account();
    if($a['password_hash']===''&&$password==='')fail('Менежерийн анхны нууц үгийг оруулна уу.');
    $a['email']=$email;$a['enabled']=$b['enabled'];$a['version']=bin2hex(random_bytes(16));
    if($password!=='')$a['password_hash']=password_hash($password,PASSWORD_BCRYPT,['cost'=>12]);
    $a['updated']=gmdate('c');
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['warehouse_account',json_encode($a,JSON_THROW_ON_ERROR)]);
    return warehouse_account_public();
}
function warehouse_authenticated(): bool {
    $a=warehouse_account();
    return $a['enabled']&&!empty($_SESSION['warehouse_version'])&&hash_equals($a['version'],$_SESSION['warehouse_version']);
}
function warehouse_required(): void {
    if(!warehouse_authenticated())fail('Агуулахын эрхээр нэвтэрнэ үү.',401);
}
function warehouse_order_visible(array $o): bool {
    return in_array('Эрээн',$o['route']??[],true);
}
function warehouse_order_public(array $o): array {
    $result=array_intersect_key($o,array_flip(['id','title','customer','status','created','warehouse']));
    $items=isset($o['supplier'])?[$o['supplier']]:($o['items']??[]);
    $result['items']=array_map(fn($item)=>array_intersect_key($item,array_flip(['name','variant','qty'])),$items);
    $result['history']=array_map(fn($h)=>array_intersect_key($h,array_flip(['status','at'])), $o['history']??[]);
    $result['next_status']=match($o['status']){'confirmed','shipping'=>'erenhot','erenhot'=>'erenhot_dispatched',default=>null};
    return $result;
}
function warehouse_get(string $action): never {
    if($action==='warehouse-session')json_out(['authenticated'=>warehouse_authenticated(),'csrf'=>$_SESSION['csrf']]);
    warehouse_required();
    if($action!=='warehouse-orders')fail('Үйлдэл олдсонгүй.',404);
    $query=mb_strtolower(str_field($_GET,'q',100,false));$status=str_field($_GET,'status',30,false);
    $offset=filter_var($_GET['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>1000000]]);
    if($offset===false)fail('Хуудасны дугаар буруу.');
    $rows=[];$matched=0;$counts=['waiting'=>0,'received'=>0,'dispatched'=>0];
    foreach(db()->query('SELECT data FROM orders ORDER BY created DESC,id DESC') as $r){
        $o=json_decode($r['data'],true);if(!warehouse_order_visible($o))continue;
        if(in_array($o['status'],['confirmed','shipping'],true))$counts['waiting']++;
        if($o['status']==='erenhot')$counts['received']++;
        if($o['status']==='erenhot_dispatched')$counts['dispatched']++;
        if($status==='waiting'){if(!in_array($o['status'],['confirmed','shipping'],true))continue;}
        elseif($status!==''&&$status!=='all'&&$o['status']!==$status)continue;
        if($query!==''&&!str_contains(mb_strtolower($o['id'].' '.$o['title'].' '.$o['customer']),$query))continue;
        if($matched++<$offset)continue;
        if(count($rows)<51)$rows[]=warehouse_order_public($o);
    }
    json_out(['orders'=>array_slice($rows,0,50),'more'=>count($rows)>50,'total'=>$matched,'counts'=>$counts,'email'=>warehouse_account()['email'],'csrf'=>$_SESSION['csrf']]);
}
function warehouse_post(string $action,array $b): never {
    if($action==='warehouse-login'){
        limit_attempts('warehouse-login:'.($_SERVER['REMOTE_ADDR']??''),8,900);
        $email=strtolower(str_field($b,'email',200));$password=$b['password']??'';$a=warehouse_account();
        if(!is_string($password)||strlen($password)>500)fail('Имэйл эсвэл нууц үг буруу байна.',401);
        if(!$a['enabled']||$a['password_hash']===''||!hash_equals($a['email'],$email)||!password_verify($password,$a['password_hash']))fail('Имэйл эсвэл нууц үг буруу байна.',401);
        session_regenerate_id(true);$_SESSION['warehouse_version']=$a['version'];$_SESSION['csrf']=bin2hex(random_bytes(32));
        json_out(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
    }
    if($action==='warehouse-logout'){$_SESSION=[];session_destroy();json_out(['ok'=>true]);}
    warehouse_required();
    if($action!=='warehouse-order-update')fail('Үйлдэл олдсонгүй.',404);
    $id=str_field($b,'id',50);$status=str_field($b,'status',30);$expected=str_field($b,'expected_status',30);
    if(!in_array($status,['erenhot','erenhot_dispatched'],true))fail('Энэ төлөвийг өөрчлөх эрхгүй.',403);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        warehouse_required();
        $o=order_row($id)['order'];if(!warehouse_order_visible($o))fail('Захиалга олдсонгүй.',404);
        if($o['status']!==$expected)fail('Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.',409);
        if(warehouse_order_public($o)['next_status']!==$status)fail('Энэ захиалгыг сонгосон төлөвт шилжүүлэх боломжгүй.',409);
        $o['history'][]=['status'=>$status,'at'=>gmdate('c'),'actor'=>'warehouse','actor_email'=>warehouse_account()['email']];
        $o['status']=$status;save_order($o);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    json_out(['order'=>warehouse_order_public($o)]);
}
