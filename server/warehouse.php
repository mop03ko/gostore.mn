<?php
declare(strict_types=1);

// A warehouse has an immutable operational role and an independent manager session.
function warehouse_definitions(): array {
    $rows=['erenhot'=>['location'=>'erenhot','role'=>'erenhot','city'=>'Эрээн','active'=>true], 'ulaanbaatar'=>['location'=>'ulaanbaatar','role'=>'ulaanbaatar','city'=>'Улаанбаатар','active'=>true]];
    foreach(db()->query("SELECT value FROM meta WHERE key LIKE 'warehouse_definition_%'") as $row){$w=json_decode($row['value'],true);$rows[$w['location']]=$w;}
    return $rows;
}
function warehouse_role(string $location): string {
    if(in_array($location,['erenhot','ulaanbaatar'],true))return $location;
    static $roles=[];if(isset($roles[$location]))return $roles[$location];
    $w=warehouse_definitions()[$location]??null;if(!$w)fail('Агуулах олдсонгүй.',404);return $roles[$location]=$w['role'];
}
function warehouse_catalog(): array {
    return array_map(fn($w)=>array_merge($w,warehouse_profile($w['location'])),warehouse_definitions());
}
function warehouse_accounts(): array {return array_map(fn($w)=>warehouse_account_public($w['location']),warehouse_definitions());}
function warehouse_choices(): array {
    return array_values(array_map(fn($w)=>array_intersect_key($w,array_flip(['location','role','name','city'])),array_filter(warehouse_catalog(),fn($w)=>$w['active'])));
}
function warehouse_order_location(array $o,string $role): string {return $o['warehouse_locations'][$role]??$role;}
function warehouse_create(array $b): array {
    admin_required();$role=str_field($b,'role',30);if(!in_array($role,['erenhot','ulaanbaatar'],true))fail('Агуулахын үүрэг буруу.');
    $city=str_field($b,'city',100);$name=str_field($b,'name',150);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        foreach(warehouse_catalog() as $w)if(mb_strtolower($w['name'])===mb_strtolower($name))fail('Ижил нэртэй агуулах бүртгэлтэй байна.',409);
        $id='wh-'.bin2hex(random_bytes(6));$definition=['location'=>$id,'role'=>$role,'city'=>$city,'active'=>true];
        $db->prepare('INSERT INTO meta VALUES (?,?)')->execute(['warehouse_definition_'.$id,json_encode($definition,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        warehouse_profile_save(array_merge($b,['location'=>$id]),true);
        warehouse_account_save(array_merge($b,['location'=>$id,'enabled'=>true]));
        $db->exec('COMMIT');return warehouse_catalog()[$id];
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function warehouse_assign_order(array $b): array {
    admin_required();$db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row(str_field($b,'id',50))['order'];
        if(($o['purchase']['provider']??'')==='taoworld')fail('TaoWorld худалдан авалт эхэлсэн тул агуулахын оноолтыг солихгүй.',409);
        if(isset($o['batch_id'])||!in_array($o['status'],['new','reviewing','quoted','confirmed','shipping','erenhot'],true)||!in_array('Эрээн',$o['route']??[],true))fail('Багцлахаас өмнө агуулах онооно.',409);
        if(str_field($b,'expected_status',30)!==$o['status'])fail('Захиалгын төлөв өөрчлөгдсөн байна.',409);
        $defs=warehouse_definitions();$old=[];$next=[];
        foreach(['erenhot','ulaanbaatar'] as $role){
            $old[$role]=warehouse_order_location($o,$role);$id=str_field($b,$role,30);
            if(($b['expected_'.$role]??null)!==$old[$role])fail('Агуулахын оноолт өөрчлөгдсөн байна.',409);
            if(!isset($defs[$id])||$defs[$id]['role']!==$role||!$defs[$id]['active'])fail('Идэвхтэй, тохирох үүрэгтэй агуулах сонгоно уу.');$next[$role]=$id;
        }
        if($next['erenhot']!==$old['erenhot']){
            if(in_array($o['status'],['shipping','erenhot'],true)||logistics_state($o)['photos']||isset($o['logistics']['measurement']))fail('Илгээсэн эсвэл бүртгэж эхэлсэн барааны эхлэх агуулахыг солихгүй.',409);
            $profile=warehouse_profile($next['erenhot']);$w=$o['warehouse']??[];
            $recipient=$w['recipient']??($o['customer'].' / '.$o['id']);
            foreach(['address','phone','contact_phone'] as $key)$w[$key]=$profile[$key];
            $w['label']="收件人: ".$recipient."\n手机号: ".$w['phone']."\n地址: ".$w['address']."\n联系电话: ".$w['contact_phone']."\n订单号: ".$o['id'];$o['warehouse']=$w;
        }
        $o['warehouse_locations']=$next;$o['warehouse_assignment_history'][]=['at'=>gmdate('c'),'from'=>$old,'to'=>$next,'actor'=>'admin'];save_order($o);$db->exec('COMMIT');return $o;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}

function warehouse_location(array $input): string {
    $location=$input['location']??'erenhot';
    if(!is_string($location)||!isset(warehouse_definitions()[$location]))fail('Агуулахын байршил буруу.');
    return $location;
}
function warehouse_session_location(): string {
    return warehouse_location(['location'=>$_SESSION['warehouse_location']??'erenhot']);
}
function warehouse_account_key(string $location): string {
    return $location==='erenhot'?'warehouse_account':'warehouse_account_'.$location;
}
function warehouse_account(string $location='erenhot'): array {
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute([warehouse_account_key($location)]);
    return array_replace(['email'=>'','password_hash'=>'','enabled'=>false,'version'=>''],json_decode($s->fetchColumn()?:'{}',true));
}
function warehouse_account_public(string $location='erenhot'): array {
    $a=warehouse_account($location);
    return ['location'=>$location,'email'=>$a['email'],'enabled'=>$a['enabled'],'configured'=>$a['password_hash']!==''];
}
function warehouse_account_save(array $b): array {
    admin_required();
    $location=warehouse_location($b);
    $email=strtolower(str_field($b,'email',200));
    if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Имэйл хаягаа шалгана уу.');
    $password=$b['password']??'';
    if(!is_string($password)||str_contains($password,"\0")||($password!==''&&(strlen($password)<12||strlen($password)>72)))fail('Нууц үг 12–72 байт урттай байна.');
    if(!is_bool($b['enabled']??null))fail('Эрхийн төлөв буруу.');
    $a=warehouse_account($location);
    if($a['password_hash']===''&&$password==='')fail('Менежерийн анхны нууц үгийг оруулна уу.');
    $a['email']=$email;$a['enabled']=$b['enabled'];$a['version']=bin2hex(random_bytes(16));
    if($password!=='')$a['password_hash']=password_hash($password,PASSWORD_BCRYPT,['cost'=>12]);
    $a['updated']=gmdate('c');
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute([warehouse_account_key($location),json_encode($a,JSON_THROW_ON_ERROR)]);
    return warehouse_account_public($location);
}
function warehouse_authenticated(): bool {
    $a=warehouse_account(warehouse_session_location());
    return (warehouse_definitions()[warehouse_session_location()]['active']??false)&&$a['enabled']&&!empty($_SESSION['warehouse_version'])&&hash_equals($a['version'],$_SESSION['warehouse_version']);
}
function warehouse_required(): void {
    if(!warehouse_authenticated())fail('Агуулахын эрхээр нэвтэрнэ үү.',401);
}
function warehouse_order_visible(array $o,string $location='erenhot'): bool {
    if(warehouse_order_location($o,warehouse_role($location))!==$location)return false;
    if(warehouse_role($location)==='erenhot')return in_array('Эрээн',$o['route']??[],true);
    if(!in_array('Улаанбаатар',$o['route']??[],true))return false;
    return (isset($o['batch_id'])&&$o['status']==='erenhot_dispatched')
        || in_array($o['status'],['zamyn_uud','ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery','completed'],true)
        || count(array_intersect(array_column($o['history']??[],'status'),['zamyn_uud','ulaanbaatar']))>0;
}
function warehouse_order_public(array $o,string $location='erenhot'): array {
    $result=array_intersect_key($o,array_flip(['id','title','customer','status','created','warehouse','batch_id']));
    $items=isset($o['supplier'])?[$o['supplier']]:($o['items']??[]);
    $result['warehouse_names']=['erenhot'=>warehouse_profile(warehouse_order_location($o,'erenhot'))['name'],'ulaanbaatar'=>warehouse_profile(warehouse_order_location($o,'ulaanbaatar'))['name']];
    $result['items']=array_map(fn($item)=>array_intersect_key($item,array_flip(['name','variant','qty'])),$items);
    $result['history']=array_map(fn($h)=>array_intersect_key($h,array_flip(['status','at'])), $o['history']??[]);
    $result['logistics']=logistics_state($o);unset($result['logistics']['audit']);
    $result['logistics']['photos']=array_map(fn($p)=>$p+['warehouse_name'=>warehouse_profile($p['location'])['name']],$result['logistics']['photos']);
    if(warehouse_role($location)==='erenhot'&&function_exists('inbound_public'))$result['inbound']=inbound_public($o);
    if(warehouse_role($location)==='ulaanbaatar'){$result['billing']=settlement_summary($o);$result['quote']=$o['quote']??null;$result['cargo_rates']=$o['quote']['rates']??shipping_settings();$result['settlement']=$o['settlement']??null;}
    if(warehouse_role($location)==='ulaanbaatar'&&in_array($o['status'],['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery','completed'],true)){
        $result['requested_method']=$o['fulfillment_request']['method']??null;
        $result['contact']=['phone'=>$o['fulfillment']['contact_phone']??$o['phone'],'address'=>$o['fulfillment']['address']??warehouse_delivery_address($o)];
        if(isset($o['fulfillment']))$result['fulfillment']=$o['fulfillment'];
    }
    $result['next_status']=isset($o['batch_id'])?null:(warehouse_role($location)==='ulaanbaatar'
        ? ($o['status']==='zamyn_uud'?'ulaanbaatar':null)
        : match($o['status']){'confirmed','shipping'=>'erenhot',default=>null});
    return $result;
}
// Read-only totals for UB planning; these do not grant access to early-stage orders.
function warehouse_overview_add(array &$overview,array $order): void {
    if(($order['status']??'')==='cancelled')return;
    $items=isset($order['supplier'])?[$order['supplier']]:($order['items']??[]);
    $quantity=array_sum(array_map(fn($item)=>max(0,(int)($item['qty']??0)),$items));
    $groups=['ordered'];
    if(in_array('Эрээн',$order['route']??[],true)&&in_array($order['status'],['erenhot','erenhot_ready'],true))$groups[]='erenhot';
    if(in_array('Улаанбаатар',$order['route']??[],true)&&in_array($order['status'],['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'],true))$groups[]='ulaanbaatar';
    foreach($groups as $group){$overview[$group]['orders']++;$overview[$group]['quantity']+=$quantity;}
}
function warehouse_get(string $action): never {
    if($action==='warehouse-session')json_out(['authenticated'=>warehouse_authenticated(),'location'=>warehouse_session_location(),'warehouses'=>warehouse_choices(),'csrf'=>$_SESSION['csrf']]);
    warehouse_required();
    $location=warehouse_session_location();
    if($action==='warehouse-photo'){$o=order_row(str_field($_GET,'id',50))['order'];if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);logistics_photo_read($o,str_field($_GET,'photo',32));}
    if($action==='warehouse-order'){$o=order_row(str_field($_GET,'id',50))['order'];if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);json_out(['order'=>warehouse_order_public($o,$location)]);}
    if($action==='warehouse-exceptions'){$s=db()->prepare('SELECT * FROM warehouse_exceptions WHERE location=? ORDER BY id DESC LIMIT 200');$s->execute([$location]);$rows=$s->fetchAll();foreach($rows as &$row)$row['photos']=logistics_exception_photos((string)$row['id']);unset($row);json_out(['issues'=>$rows]);}
    if($action==='warehouse-exception-photo'){$id=str_field($_GET,'id',50);logistics_exception($id,$location);logistics_photo_read(['logistics'=>['photos'=>logistics_exception_photos($id)]],str_field($_GET,'photo',32));}
    if(str_starts_with($action,'warehouse-batch'))warehouse_batch_get($action,$location);
    if($action!=='warehouse-orders')fail('Үйлдэл олдсонгүй.',404);
    $query=mb_strtolower(str_field($_GET,'q',100,false));$status=str_field($_GET,'status',30,false);
    $offset=filter_var($_GET['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>1000000]]);
    if($offset===false)fail('Хуудасны дугаар буруу.');
    $rows=[];$matched=0;$counts=['waiting'=>0,'received'=>0,'ready'=>0,'dispatched'=>0,'completed'=>0,'unsorted'=>0,'ready_pickup'=>0,'ready_delivery'=>0,'out_for_delivery'=>0];
    $overview=array_fill_keys(['ordered','erenhot','ulaanbaatar'],['orders'=>0,'quantity'=>0]);
    $waiting=warehouse_role($location)==='ulaanbaatar'?['erenhot_dispatched','zamyn_uud']:['confirmed','shipping'];
    $received=warehouse_role($location)==='ulaanbaatar'?'ulaanbaatar':'erenhot';
    foreach(db()->query('SELECT data FROM orders ORDER BY created DESC,id DESC') as $r){
        $o=json_decode($r['data'],true);
        if(warehouse_role($location)==='ulaanbaatar'&&warehouse_order_location($o,'ulaanbaatar')===$location)warehouse_overview_add($overview,$o);
        if(!warehouse_order_visible($o,$location))continue;
        if(in_array($o['status'],$waiting,true))$counts['waiting']++;
        if($o['status']===$received)$counts['received']++;
        if($o['status']==='erenhot_ready')$counts['ready']++;
        if($o['status']==='erenhot_dispatched')$counts['dispatched']++;
        if($o['status']==='completed')$counts['completed']++;
        if($o['status']==='ulaanbaatar_unsorted')$counts['unsorted']++;
        if(in_array($o['status'],['ready_pickup','ready_delivery','out_for_delivery'],true))$counts[$o['status']]++;
        if($status==='waiting'){if(!in_array($o['status'],$waiting,true))continue;}
        elseif($status==='pending_sort'){if(!in_array($o['status'],['ulaanbaatar_unsorted','ulaanbaatar'],true))continue;}
        elseif($status!==''&&$status!=='all'&&$o['status']!==$status)continue;
        if($query!==''&&!str_contains(mb_strtolower($o['id'].' '.$o['title'].' '.$o['customer'].' '.($o['batch_id']??'').' '.(logistics_state($o)['shelf']).' '.implode(' ',array_column($o['inbound']['numbers']??[],'no'))),$query))continue;
        if($matched++<$offset)continue;
        if(count($rows)<51)$rows[]=warehouse_order_public($o,$location);
    }
    if(warehouse_role($location)==='erenhot'&&function_exists('inbound_schedule_refresh'))inbound_schedule_refresh();
    json_out(['orders'=>array_slice($rows,0,50),'more'=>count($rows)>50,'total'=>$matched,'counts'=>$counts,...(warehouse_role($location)==='ulaanbaatar'?['overview'=>$overview]:[]),'location'=>$location,'email'=>warehouse_account($location)['email'],'csrf'=>$_SESSION['csrf']]);
}
function warehouse_post(string $action,array $b): never {
    if($action==='warehouse-login'){
        $location=warehouse_location($b);
        limit_attempts('warehouse-login:'.$location.':'.($_SERVER['REMOTE_ADDR']??''),8,900);
        $email=strtolower(str_field($b,'email',200));$password=$b['password']??'';$a=warehouse_account($location);
        if(!is_string($password)||strlen($password)>500)fail('Имэйл эсвэл нууц үг буруу байна.',401);
        if(!warehouse_definitions()[$location]['active']||!$a['enabled']||$a['password_hash']===''||!hash_equals($a['email'],$email)||!password_verify($password,$a['password_hash']))fail('Имэйл эсвэл нууц үг буруу байна.',401);
        session_regenerate_id(true);$_SESSION['warehouse_version']=$a['version'];$_SESSION['warehouse_location']=$location;$_SESSION['csrf']=bin2hex(random_bytes(32));
        json_out(['ok'=>true,'location'=>$location,'warehouses'=>warehouse_choices(),'csrf'=>$_SESSION['csrf']]);
    }
    if($action==='warehouse-logout'){$_SESSION=[];session_destroy();json_out(['ok'=>true]);}
    warehouse_required();
    $location=warehouse_session_location();
    if(in_array($action,['warehouse-measure','warehouse-shelf','warehouse-issue','warehouse-issue-resolve','warehouse-issue-unassigned','warehouse-issue-resolve-unassigned','warehouse-settlement'],true))logistics_post($action,$b,$location);
    if(str_starts_with($action,'warehouse-batch-'))warehouse_batch_post($action,$b,$location);
    if($action==='warehouse-fulfillment-update')warehouse_fulfillment($b,$location);
    if(str_starts_with($action,'warehouse-inbound-')&&function_exists('inbound_warehouse_post'))inbound_warehouse_post($action,$b,$location);
    if($action!=='warehouse-order-update')fail('Үйлдэл олдсонгүй.',404);
    $id=str_field($b,'id',50);$status=str_field($b,'status',30);$expected=str_field($b,'expected_status',30);
    $allowed=warehouse_role($location)==='ulaanbaatar'?['ulaanbaatar']:['erenhot'];
    if(!in_array($status,$allowed,true))fail('Энэ төлөвийг өөрчлөх эрхгүй.',403);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        warehouse_required();
        $o=order_row($id)['order'];if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);
        if($o['status']!==$expected)fail('Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.',409);
        if(warehouse_order_public($o,$location)['next_status']!==$status)fail('Энэ захиалгыг сонгосон төлөвт шилжүүлэх боломжгүй.',409);
        logistics_receipt_photo_required($o,$location);
        $o['history'][]=['status'=>$status,'at'=>gmdate('c'),'actor'=>'warehouse','actor_location'=>$location,'actor_email'=>warehouse_account($location)['email']];
        $o['status']=$status;save_order($o);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    json_out(['order'=>warehouse_order_public($o,$location)]);
}
function warehouse_error_zh(string $message): string {
    return match($message){
        'Нэг багцын захиалгууд ижил хүлээн авах агуулахтай байна.'=>'同一包裹的订单必须属于同一个收货仓库，请检查订单分配。',
        'Хүлээн авах агуулах буруу.'=>'请选择有效的收货仓库。',
        'Багц агуулахаас бодитоор гарсныг батална уу.'=>'请确认包裹已实际离开二连仓库。',
        'Энэ агуулахын хүлээн авах зургийг эхлээд оруулна уу.'=>'请先上传本仓库的收货照片。',
        'Энэ төлөвт агуулахын зураг нэмэх боломжгүй.'=>'当前订单状态无法上传本仓库照片。',
        'Нэг агуулахад 12 хүртэл зураг хадгална.'=>'每个仓库最多上传12张照片。',
        'Имэйл эсвэл нууц үг буруу байна.'=>'邮箱或密码错误。',
        'Агуулахын эрхээр нэвтэрнэ үү.'=>'请使用仓库账号登录。',
        'Хуудас шинэчлээд дахин оролдоно уу.'=>'会话已更新，请刷新页面后重试。',
        'Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.'=>'尝试次数过多，请稍后再试。',
        'Захиалга олдсонгүй.'=>'未找到订单，请检查订单编号。',
        'Багц олдсонгүй.'=>'未找到包裹。',
        'Энэ үйлдлийг хийх эрхгүй.','Энэ төлөвийг өөрчлөх эрхгүй.'=>'当前仓库无权执行此操作。',
        'Багц өөрчлөгдсөн байна. Шинэчилж дахин оролдоно уу.'=>'包裹已更新，请刷新后重试。',
        'Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.'=>'订单状态已更新，请刷新列表。',
        'Зөвхөн Эрээнд ирсэн захиалгыг багцлана.'=>'只能将二连仓库已签收的订单加入包裹。',
        'Захиалга өөр багцад бүртгэлтэй байна.'=>'订单已加入包裹，不能重复装包。',
        'Хоосон багцыг илгээх боломжгүй.'=>'空包裹不能发货，请先添加订单。',
        'Багцын төлөв энэ үйлдлийг зөвшөөрөхгүй.'=>'当前包裹状态不允许此操作，已发货包裹不可修改。',
        'Захиалгын код давхардсан байна.'=>'订单编号重复，请检查。',
        'Нэг багцад 200 хүртэл захиалга бүртгэнэ.'=>'每个包裹最多可包含200个完整订单。',
        'Захиалгын кодын жагсаалт буруу.'=>'订单编号格式不正确，请输入GS开头的编号。',
        'Захиалгын код оруулна уу.'=>'请输入订单编号。',
        'Захиалга энэ багцад байхгүй.'=>'该订单不在此包裹中。',
        'Багцын захиалгын төлөв зөрсөн байна.'=>'包裹内订单状态不一致，请联系管理员。',
        default=>'操作未完成，请检查输入并刷新页面后重试。'
    };
}
