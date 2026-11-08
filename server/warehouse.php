<?php
declare(strict_types=1);
require_once __DIR__.'/warehouse-notifications.php';
require_once __DIR__.'/warehouse-session.php';
require_once __DIR__.'/warehouse-flow.php';

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
    if(warehouse_order_operable($o,$location))return true;
    return warehouse_role($location)==='ulaanbaatar'
        && warehouse_order_location($o,'ulaanbaatar')===$location
        && in_array('Улаанбаатар',$o['route']??[],true)
        && in_array($o['status'],['confirmed','shipping','erenhot','erenhot_ready','erenhot_dispatched'],true);
}
// Operational access stays narrower than visibility: early UB tracking is read-only.
function warehouse_order_operable(array $o,string $location='erenhot'): bool {
    if(warehouse_order_location($o,warehouse_role($location))!==$location)return false;
    if(warehouse_role($location)==='erenhot')return in_array('Эрээн',$o['route']??[],true);
    if(!in_array('Улаанбаатар',$o['route']??[],true))return false;
    return (isset($o['batch_id'])&&$o['status']==='erenhot_dispatched')
        || in_array($o['status'],['zamyn_uud','ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery','completed'],true)
        || count(array_intersect(array_column($o['history']??[],'status'),['zamyn_uud','ulaanbaatar']))>0;
}
function warehouse_order_public(array $o,string $location='erenhot',bool $details=true): array {
    $result=array_intersect_key($o,array_flip(['id','title','customer','status','created','warehouse','batch_id']));
    $result['read_only']=!warehouse_order_operable($o,$location);
    $items=isset($o['supplier'])?[$o['supplier']]:($o['items']??[]);
    $result['warehouse_names']=['erenhot'=>warehouse_profile(warehouse_order_location($o,'erenhot'))['name'],'ulaanbaatar'=>warehouse_profile(warehouse_order_location($o,'ulaanbaatar'))['name']];
    // Photos and the original Chinese title/options help the warehouse match parcel contents.
    $result['items']=array_map(fn($item)=>array_intersect_key($item,array_flip(['name','variant','qty','original_name','original_variant']))+(is_string($item['image']??null)&&str_starts_with($item['image'],'https://')?['image'=>$item['image']]:[]),$items);
    $result['history']=array_map(fn($h)=>array_intersect_key($h,array_flip(['status','at'])), $o['history']??[]);
    $result['logistics']=logistics_state($o);unset($result['logistics']['audit']);
    if(warehouse_role($location)==='erenhot')$result['cargo_rates']=warehouse_cargo_rates($o);
    $result['logistics']['photos']=array_map(fn($p)=>$p+['warehouse_name'=>warehouse_profile($p['location'])['name']],$result['logistics']['photos']);
    if(warehouse_role($location)==='erenhot'&&function_exists('inbound_public'))$result['inbound']=inbound_public($o,$details);
    if(warehouse_role($location)==='erenhot'){$result['parcels']=warehouse_parcels($o);$result['alerts']=warehouse_alerts($o);$result['expected_pieces']=warehouse_expected_pieces($o);}
    if(warehouse_role($location)==='ulaanbaatar')$result['inbound']=array_intersect_key($o['inbound']??[],array_flip(['status','checked_at']));
    if(warehouse_role($location)==='ulaanbaatar'&&!$result['read_only']){$result['billing']=settlement_summary($o);$result['quote']=$o['quote']??null;$result['cargo_rates']=warehouse_cargo_rates($o);$result['settlement']=$o['settlement']??null;}
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
// Totals for UB planning are independent of list filters and pagination.
function warehouse_overview_add(array &$overview,array $order): void {
    if(($order['status']??'')==='cancelled')return;
    $items=isset($order['supplier'])?[$order['supplier']]:($order['items']??[]);
    $quantity=array_sum(array_map(fn($item)=>max(0,(int)($item['qty']??0)),$items));
    $groups=['ordered'];
    if(in_array('Эрээн',$order['route']??[],true)&&in_array($order['status'],['erenhot','erenhot_ready'],true))$groups[]='erenhot';
    if(in_array('Улаанбаатар',$order['route']??[],true)&&in_array($order['status'],['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'],true))$groups[]='ulaanbaatar';
    foreach($groups as $group){$overview[$group]['orders']++;$overview[$group]['quantity']+=$quantity;}
}
// Exact incoming carrier-number matching; branch visibility remains authoritative.
function warehouse_tracking_matches(string $number,string $location): array {
    if(warehouse_role($location)!=='erenhot')fail('Энэ үйлдлийг хийх эрхгүй.',403);
    $number=strtoupper(trim($number));
    if(!preg_match('/^[A-Z0-9-]{6,40}$/D',$number))fail('Tracking дугаар буруу.');
    $matches=[];$total=0;
    foreach(db()->query('SELECT data FROM orders ORDER BY created DESC,id DESC') as $row){
        $o=json_decode($row['data'],true);
        if(!warehouse_order_visible($o,$location))continue;
        foreach($o['inbound']['numbers']??[] as $entry){
            if(strtoupper(trim((string)($entry['no']??'')))!==$number)continue;
            $total++;if(count($matches)<50)$matches[]=warehouse_order_public($o,$location,false);
            break;
        }
    }
    return ['number'=>$number,'orders'=>$matches,'total'=>$total,'more'=>$total>50];
}
function warehouse_get(string $action): never {
    if($action==='warehouse-session')json_out(['authenticated'=>warehouse_authenticated(),'location'=>warehouse_session_location(),'warehouses'=>warehouse_choices(),'csrf'=>$_SESSION['csrf']]);
    warehouse_required();
    $location=warehouse_session_location();
    if($action==='warehouse-notifications'){warehouse_push_schedule();json_out(warehouse_notice_list($location));}
    if($action==='warehouse-push-config')json_out(['public_key'=>warehouse_push_keys()['public'],'native_configured'=>warehouse_fcm_configured()]);
    if($action==='warehouse-photo'){$o=order_row(str_field($_GET,'id',50))['order'];if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);logistics_photo_read($o,str_field($_GET,'photo',32));}
    if($action==='warehouse-tracking')json_out(warehouse_tracking_matches(str_field($_GET,'number',40),$location));
    if($action==='warehouse-outbound-lookup')json_out(warehouse_outbound_lookup(str_field($_GET,'code',50),$location));
    if($action==='warehouse-order'){$o=order_row(str_field($_GET,'id',50))['order'];if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);json_out(['order'=>warehouse_order_public($o,$location)]);}
    if($action==='warehouse-exceptions'){$s=db()->prepare('SELECT * FROM warehouse_exceptions WHERE location=? ORDER BY id DESC LIMIT 200');$s->execute([$location]);$rows=$s->fetchAll();foreach($rows as &$row)$row['photos']=logistics_exception_photos((string)$row['id']);unset($row);json_out(['issues'=>$rows]);}
    if($action==='warehouse-exception-photo'){$id=str_field($_GET,'id',50);logistics_exception($id,$location);logistics_photo_read(['logistics'=>['photos'=>logistics_exception_photos($id)]],str_field($_GET,'photo',32));}
    if(str_starts_with($action,'warehouse-batch'))warehouse_batch_get($action,$location);
    if($action!=='warehouse-orders')fail('Үйлдэл олдсонгүй.',404);
    $query=mb_strtolower(str_field($_GET,'q',100,false));$status=str_field($_GET,'status',30,false);
    $offset=filter_var($_GET['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>1000000]]);
    if($offset===false)fail('Хуудасны дугаар буруу.');
    $rows=[];$matched=0;$counts=['waiting'=>0,'alerts'=>0,'packed'=>0,'received'=>0,'ready'=>0,'dispatched'=>0,'completed'=>0,'unsorted'=>0,'ready_pickup'=>0,'ready_delivery'=>0,'out_for_delivery'=>0];
    $overview=array_fill_keys(['ordered','erenhot','ulaanbaatar'],['orders'=>0,'quantity'=>0]);
    $waiting=warehouse_role($location)==='ulaanbaatar'?['erenhot_dispatched','zamyn_uud']:['confirmed','shipping'];
    $received=warehouse_role($location)==='ulaanbaatar'?'ulaanbaatar':'erenhot';
    foreach(db()->query('SELECT data FROM orders ORDER BY created DESC,id DESC') as $r){
        $o=json_decode($r['data'],true);
        if(warehouse_role($location)==='ulaanbaatar'&&warehouse_order_location($o,'ulaanbaatar')===$location)warehouse_overview_add($overview,$o);
        if(!warehouse_order_visible($o,$location))continue;
        if(in_array($o['status'],$waiting,true))$counts['waiting']++;
        $alerted=warehouse_role($location)==='erenhot'&&warehouse_alerts($o);if($alerted)$counts['alerts']++;
        $packed=warehouse_role($location)==='erenhot'&&(($o['status']==='erenhot'&&isset($o['batch_id']))||$o['status']==='erenhot_ready');if($packed)$counts['packed']++;
        if($o['status']===$received)$counts['received']++;
        if($o['status']==='erenhot_ready')$counts['ready']++;
        if($o['status']==='erenhot_dispatched')$counts['dispatched']++;
        if($o['status']==='completed')$counts['completed']++;
        if($o['status']==='ulaanbaatar_unsorted')$counts['unsorted']++;
        if(in_array($o['status'],['ready_pickup','ready_delivery','out_for_delivery'],true))$counts[$o['status']]++;
        if($status==='waiting'){if(!in_array($o['status'],$waiting,true))continue;}
        elseif($status==='alerts'){if(!$alerted)continue;}
        elseif($status==='packed'){if(!$packed)continue;}
        elseif($status==='pending_sort'){if(!in_array($o['status'],['ulaanbaatar_unsorted','ulaanbaatar'],true))continue;}
        elseif($status!==''&&$status!=='all'&&$o['status']!==$status)continue;
        if($query!==''&&!str_contains(mb_strtolower($o['id'].' '.$o['title'].' '.$o['customer'].' '.($o['batch_id']??'').' '.(logistics_state($o)['shelf']).' '.implode(' ',array_column($o['inbound']['numbers']??[],'no'))),$query))continue;
        if($matched++<$offset)continue;
        if(count($rows)<51)$rows[]=warehouse_order_public($o,$location,false);
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
        session_regenerate_id(true);$_SESSION['warehouse_version']=$a['version'];$_SESSION['warehouse_location']=$location;$_SESSION['csrf']=bin2hex(random_bytes(32));warehouse_device_issue();
        json_out(['ok'=>true,'location'=>$location,'warehouses'=>warehouse_choices(),'csrf'=>$_SESSION['csrf']]);
    }
    if($action==='warehouse-logout'){warehouse_push_revoke_session();warehouse_device_forget();$_SESSION=[];session_destroy();json_out(['ok'=>true]);}
    warehouse_required();
    $location=warehouse_session_location();
    if($action==='warehouse-push-subscribe')json_out(warehouse_push_subscribe($b,$location));
    if($action==='warehouse-fcm-subscribe')json_out(warehouse_fcm_subscribe($b,$location));
    if($action==='warehouse-push-unsubscribe'){
        warehouse_notice_schema(db());db()->prepare('DELETE FROM warehouse_push_devices WHERE id=? AND location=? AND session_hash=?')->execute([str_field($b,'id',64),$location,hash('sha256',session_id())]);json_out(['ok'=>true]);
    }
    if($action==='warehouse-notifications-read'){
        warehouse_notice_schema(db());$through=int_field($b,'through_id',0,PHP_INT_MAX);db()->prepare('UPDATE warehouse_notifications SET read_at=? WHERE location=? AND id<=? AND read_at IS NULL')->execute([gmdate('c'),$location,$through]);json_out(['ok'=>true]);
    }
    if($action==='warehouse-receive')json_out(['order'=>warehouse_order_public(warehouse_receive($b,$location),$location)]);
    if($action==='warehouse-outbound-pack')json_out(['batch'=>warehouse_batch_public(warehouse_outbound_pack($b,$location),$location,true)]);
    if($action==='warehouse-parcel-arrive')json_out(['order'=>warehouse_order_public(warehouse_parcel_arrive($b,$location),$location)]);
    if(in_array($action,['warehouse-cargo-calculate','warehouse-cargo-confirm','warehouse-measure','warehouse-shelf','warehouse-issue','warehouse-issue-resolve','warehouse-issue-unassigned','warehouse-issue-resolve-unassigned','warehouse-settlement'],true))logistics_post($action,$b,$location);
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
        $o=order_row($id)['order'];if(!warehouse_order_operable($o,$location))fail('Захиалга олдсонгүй.',404);
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
        'Эрээнээс Улаанбаатар хүрэх тээврийн дүнг батална уу.'=>'请先确认二连至乌兰巴托的运费。',
        'Нийт жин болон эзлэхүүнийг зөв оруулна уу.'=>'请输入正确的总重量和总体积。',
        'Жин болон эзлэхүүнийг оруулж автоматаар тооцоолно уу.'=>'请输入重量和体积，系统将自动计算运费。',
        'Тариф шинэчлэгдсэн. Жин, эзлэхүүнээр дахин тооцоолно уу.'=>'费率已更新，请输入重量和体积重新计算。',
        'Тээврийн тарифыг шинэчилж дахин тооцоолно уу.'=>'请刷新费率并重新计算运费。',
        'Тээврийн хэмжилт буруу.'=>'请输入正确的重量或体积。',
        'Тээврийн тарифыг админ шалгана уу.'=>'运费费率无效，请联系管理员检查。',
        'Тээврийн дүн хэтэрсэн.'=>'运费金额超出允许范围。',
        'Тээврийн дүнг Эрээнд хүлээн авсны дараа батална.'=>'二连仓库签收入库后才能计算和确认运费。',
        'Тээврийн дүнг шалгаснаа батална уу.'=>'请勾选确认已核对运费。',
        'Эхлээд тээврийн дүнг тооцоолно уу.'=>'请先计算运费。',
        'Тээврийн тооцоо өөрчлөгдсөн. Шинэчилнэ үү.'=>'运费计算已更新，请刷新后核对。',
        'Тээврийн дүн аль хэдийн батлагдсан.'=>'运费已确认，请勿重复提交。',
        'Эрээнд баталсан тээврийн аргыг өөрчлөхгүй.'=>'不能更改二连仓库已确认的计费方式。',
        'Эхлээд нээлттэй зөрчлийг шийдвэрлэнэ үү.'=>'请先处理未解决的异常。',
        'Мэдээлэл өөрчлөгдсөн байна. Шинэчилнэ үү.'=>'记录已更新，请刷新后重试。',
        'Нэг багцын захиалгууд ижил хүлээн авах агуулахтай байна.'=>'同一包裹的订单必须属于同一个收货仓库，请检查订单分配。',
        'Хүлээн авах агуулах буруу.'=>'请选择有效的收货仓库。',
        'Багц агуулахаас бодитоор гарсныг батална уу.'=>'请确认包裹已实际离开二连仓库。',
        'Энэ агуулахын хүлээн авах зургийг эхлээд оруулна уу.'=>'请先上传本仓库的收货照片。',
        'Бараа, тоо ширхэг, жин, хэмжээг тулгаж шалгана уу.'=>'请勾选确认已核对商品、数量、重量和尺寸。',
        'Илгээмж эсвэл тоо ширхэг дутуу байна. Хэсэгчлэн хүлээн авахыг сонгоно уу.'=>'包裹未到齐或数量不符，请勾选“部分到货 / 数量不符”后再收货。',
        'Хэсэгчилсэн хүлээн авалтын тохиргоо буруу.'=>'部分到货选项无效，请刷新页面后重试。',
        'Энэ захиалгыг хүлээн авах боломжгүй.'=>'此订单当前不能收货或重新测量，可能已加入包裹。',
        'Энэ захиалгад илгээмж бүртгэх боломжгүй.'=>'此订单当前状态不能登记到件。',
        'Энэ tracking дугаар захиалгад бүртгэлгүй.'=>'此运单号不属于该订单。',
        'Tracking дугаар буруу.'=>'运单号格式不正确。',
        'Тоо ширхэг зөрсөн байна. Зөрчил бүртгэж шалгана уу.'=>'商品数量不符，请登记异常后核对。',
        'Багцын захиалга бүрийг скан хийж тулгана уу.'=>'请先扫描核对包裹内全部订单。',
        'Багцын код үүсгэж чадсангүй.'=>'无法生成包裹编号，请重试。',
        'Скан хийсэн кодын жагсаалт буруу.'=>'扫描记录无效，请清空后重新扫描。',
        'Зарим захиалга илгээхэд бэлэн биш байна.'=>'部分订单尚不能出库（未收货、运费未确认、有异常或已装包），请移除后再确认。',
        'Зарим захиалгын илгээмж бүрэн уншигдаагүй.'=>'部分订单的包裹未扫描齐全，请补扫后再确认打包。',
        'Хүсэлтийн түлхүүр буруу.'=>'请求无效，请刷新页面后重试。',
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
