<?php
declare(strict_types=1);

function logistics_state(array $o): array {
    return array_replace(['version'=>0,'photos'=>[],'issues'=>[],'shelf'=>''], $o['logistics']??[]);
}
function logistics_has_receipt_photo(array $o,string $location): bool {
    foreach(logistics_state($o)['photos'] as $p)if(($p['location']??'')===$location&&preg_match('/^[a-f0-9]{32}$/D',$p['id']??'')&&is_file(config()['data_dir'].'/warehouse-photos/'.$p['id'].'.jpg'))return true;
    return false;
}
function logistics_receipt_photo_required(array $o,string $location): void {
    if(!logistics_has_receipt_photo($o,$location))fail('Энэ агуулахын хүлээн авах зургийг эхлээд оруулна уу.',409);
}
function logistics_open_issues(array $o): bool {
    return (bool)array_filter(logistics_state($o)['issues'],fn($i)=>$i['state']==='open');
}
function settlement_summary(array $o): array {
    $s=$o['settlement']??null;
    $paid=(($o['paid']??false)?(int)($o['amount']??0):0)+(int)($o['freight']['paid_amount']??0);
    $total=$s['total']??(int)($o['amount']??0);
    return ['finalized'=>$s!==null,'total'=>$total,'paid'=>$paid,'due'=>max(0,$total-$paid),'refund_due'=>max(0,$paid-$total),'breakdown'=>$s['breakdown']??($o['quote']['breakdown']??[]),'confirmed_at'=>$s['confirmed_at']??null];
}
function logistics_ready(array $o): void {
    if(logistics_open_issues($o))fail('Эхлээд нээлттэй зөрчлийг шийдвэрлэнэ үү.',409);
    $s=settlement_summary($o);
    if(!$s['finalized']||$s['due']>0||$s['refund_due']>0)fail('Эцсийн тооцоо, төлбөр эсвэл буцаалтын зөрүүг шийдвэрлэнэ үү.',409);
}
function logistics_touch(array &$o,string $event): void {
    $o['logistics']=logistics_state($o);$o['logistics']['version']++;
    $o['logistics']['audit'][]=warehouse_event($event);save_order($o);
}
function logistics_notify(array $o,?array $old): void {
    if(!$old)return;
    $events=[];
    if($old['status']!==$o['status']){
        $message=$o['status'];$kind='status';
        if(isset($o['warehouse_locations'])&&in_array($o['status'],['erenhot','erenhot_ready','ulaanbaatar','ulaanbaatar_unsorted'],true)){
            $role=$o['status']==='erenhot'?'erenhot':'ulaanbaatar';$message=warehouse_profile(warehouse_order_location($o,$role))['name'].match($o['status']){'erenhot_ready'=>' руу гарахад бэлэн','ulaanbaatar_unsorted'=>' · ангилж байна',default=>' · бараа ирсэн'};$kind='warehouse_status';
        }$events[]=[$kind,$message];
    }
    if(($old['settlement']??null)!==($o['settlement']??null))$events[]=['settlement','Эцсийн тооцоо баталгаажлаа'];
    if(!($old['paid']??false)&&($o['paid']??false))$events[]=['payment','Төлбөр баталгаажлаа'];
    if(($old['freight']['paid_amount']??0)!==($o['freight']['paid_amount']??0))$events[]=['payment','Үлдэгдэл төлбөр баталгаажлаа'];
    $oldPhotos=array_column(logistics_state($old)['photos'],'id');
    foreach(logistics_state($o)['photos'] as $p)if(!in_array($p['id'],$oldPhotos,true))$events[]=['photo',warehouse_profile($p['location'])['name'].' · зураг нэмэгдлээ'];
    foreach($events as [$kind,$message])db()->prepare('INSERT INTO order_notifications (order_id,kind,message,created,read_at) VALUES (?,?,?,?,NULL)')->execute([$o['id'],$kind,$message,gmdate('c')]);
}
function logistics_public(array $o): array {
    $l=logistics_state($o);
    $result=['measurement'=>$l['measurement']??null,'photos'=>array_map(fn($p)=>array_merge(array_intersect_key($p,array_flip(['id','at','location'])),['warehouse_name'=>warehouse_profile($p['location'])['name']]),$l['photos']),'issue_count'=>count(array_filter($l['issues'],fn($i)=>$i['state']==='open'))];
    $result['billing']=settlement_summary($o);
    if(in_array($o['status'],['ready_pickup','out_for_delivery'],true)&&$result['billing']['finalized']&&!$result['billing']['due']&&!$result['billing']['refund_due']&&!logistics_open_issues($o))$result['pickup_code']=$o['pickup_code']??null;
    if(isset($o['freight']['invoice']))$result['freight_invoice']=array_intersect_key($o['freight']['invoice'],array_flip(['state','qr_image','urls']));
    return $result;
}
function logistics_post(string $action,array $b,string $location): never {
    if($action==='warehouse-issue-unassigned'){
        $kind=str_field($b,'kind',30);if(!in_array($kind,['unknown','extra','damaged'],true))fail('Зөрчлийн төрөл буруу.');
        $code=str_field($b,'code',100);$note=str_field($b,'note',1000);
        db()->prepare('INSERT INTO warehouse_exceptions (location,code,kind,note,state,created,resolution) VALUES (?,?,?,?,?,?,?)')->execute([$location,$code,$kind,$note,'open',gmdate('c'),'']);
        json_out(['ok'=>true]);
    }
    if($action==='warehouse-issue-resolve-unassigned'){
        $s=db()->prepare('UPDATE warehouse_exceptions SET state=?,resolution=? WHERE id=? AND location=? AND state=?');
        $s->execute(['resolved',str_field($b,'resolution',1000),int_field($b,'issue_id',1,PHP_INT_MAX),$location,'open']);if(!$s->rowCount())fail('Зөрчил олдсонгүй эсвэл шийдэгдсэн байна.',409);json_out(['ok'=>true]);
    }
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        warehouse_required();$o=order_row(str_field($b,'id',50))['order'];
        if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);
        $l=logistics_state($o);
        if(int_field($b,'expected_version',0,PHP_INT_MAX)!==$l['version'])fail('Мэдээлэл өөрчлөгдсөн байна. Шинэчилнэ үү.',409);
        if(in_array($o['status'],['completed','cancelled'],true))fail('Дууссан захиалгыг өөрчлөхгүй.',409);
        if($action==='warehouse-measure'){
            $legacy=warehouse_role($location)==='ulaanbaatar'&&!isset($l['measurement'])&&!isset($o['settlement'])&&in_array($o['status'],['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'],true);
            if(!$legacy&&(warehouse_role($location)!=='erenhot'||$o['status']!=='erenhot'))fail('Эрээнд хүлээн авсны дараа хэмжилт хийнэ.',409);
            $m=[];foreach(['weight_kg'=>[0.001,10000],'length_cm'=>[0.1,1000],'width_cm'=>[0.1,1000],'height_cm'=>[0.1,1000]] as $key=>$range)$m[$key]=decimal_field($b,$key,...$range);
            $m['pieces']=int_field($b,'pieces',1,1000000);
            $expected=array_sum(array_column(isset($o['supplier'])?[$o['supplier']]:($o['items']??[]),'qty'));
            if($m['pieces']!==$expected)fail('Тоо ширхэг зөрсөн байна. Зөрчил бүртгэж шалгана уу.',409);
            $m['volume_m3']=round($m['length_cm']*$m['width_cm']*$m['height_cm']/1000000,6);$m['at']=gmdate('c');$l['measurement']=$m;
        }elseif($action==='warehouse-shelf'){
            if(warehouse_role($location)!=='ulaanbaatar'||!in_array($o['status'],['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'],true))fail('УБ агуулахад ирсэн барааны байрлалыг бүртгэнэ.',409);
            $l['shelf']=str_field($b,'shelf',50);
        }elseif($action==='warehouse-issue'){
            $kind=str_field($b,'kind',30);if(!in_array($kind,['missing','damaged','wrong','extra'],true))fail('Зөрчлийн төрөл буруу.');
            if(count($l['issues'])>=100)fail('Зөрчлийн бүртгэлийн хязгаарт хүрсэн.',409);
            $l['issues'][]=['id'=>bin2hex(random_bytes(8)),'kind'=>$kind,'note'=>str_field($b,'note',1000),'state'=>'open','location'=>$location,'at'=>gmdate('c')];
        }elseif($action==='warehouse-issue-resolve'){
            $found=false;foreach($l['issues'] as &$issue)if($issue['id']===str_field($b,'issue_id',32)&&$issue['state']==='open'){$issue['state']='resolved';$issue['resolution']=str_field($b,'resolution',1000);$issue['resolved_at']=gmdate('c');$issue['resolved_location']=$location;$found=true;}unset($issue);
            if(!$found)fail('Нээлттэй зөрчил олдсонгүй.',404);
        }elseif($action==='warehouse-settlement'){
            if(warehouse_role($location)!=='ulaanbaatar')fail('УБ агуулахад эцсийн тооцоог батална.',403);
            if(!in_array($o['status'],['ready_pickup','ready_delivery'],true))fail('Эхлээд барааг ангилж авах хэлбэрийг сонгоно уу.',409);
            if(isset($o['freight']['invoice']))fail('Нэхэмжлэл үүссэн тул тооцоог өөрчлөхгүй.',409);
            if(isset($o['invoice'])&&!$o['paid'])fail('Эхний нэхэмжлэлийн төлбөрийг баталгаажуулна уу.',409);
            if(!isset($l['measurement']))fail('Бодит хэмжилт шаардлагатай.',409);
            $method=str_field($b,'cargo_method',20);$measure=$method==='weight'?$l['measurement']['weight_kg']:$l['measurement']['volume_m3'];
            if(!in_array($method,['weight','volume'],true))fail('Каргоны арга буруу.');
            $rates=$o['quote']['rates']??shipping_settings();
            $cargo=$method==='weight'?ceil(round($measure/$rates['weight_step_kg'],9))*$rates['weight_step_mnt']:$measure*($measure<$rates['volume_threshold']?$rates['volume_small_cny']:$rates['volume_large_cny'])*$rates['cny_rate'];
            $parts=[];foreach(['goods_mnt','domestic_mnt','service_mnt','delivery_mnt'] as $key)$parts[$key]=int_field($b,$key,0,100000000);
            $parts['cargo_mnt']=(int)ceil($cargo);$total=array_sum($parts);if($total>100000000)fail('Нийт дүн хэтэрсэн.');
            if($total<settlement_summary($o)['paid'])fail('Өмнө төлсөн дүнгээс бага байна. Буцаалтыг админтай тулган шийднэ үү.',409);
            $o['settlement']=['total'=>$total,'breakdown'=>$parts,'cargo_method'=>$method,'measure'=>$measure,'rates'=>$rates,'confirmed_at'=>gmdate('c'),'note'=>str_field($b,'note',500)];
            $o['pickup_code']=str_pad((string)random_int(0,99999999),8,'0',STR_PAD_LEFT);
        }else fail('Үйлдэл олдсонгүй.',404);
        $o['logistics']=$l;logistics_touch($o,$action);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    json_out(['order'=>warehouse_order_public($o,$location)]);
}
function logistics_exception(string $id,string $location): array {
    $s=db()->prepare('SELECT * FROM warehouse_exceptions WHERE id=? AND location=?');$s->execute([$id,$location]);$row=$s->fetch();if(!$row)fail('Зөрчил олдсонгүй.',404);return $row;
}
function logistics_exception_photos(string $id): array {
    $s=db()->prepare('SELECT id FROM warehouse_exception_photos WHERE exception_id=? ORDER BY created');$s->execute([$id]);return $s->fetchAll();
}
function logistics_photo_upload(bool $exception=false): never {
    warehouse_required();$id=str_field($_POST,'id',50);$location=warehouse_session_location();
    if($exception)logistics_exception($id,$location);else{$o=order_row($id)['order'];if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);}
    $f=$_FILES['image']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||$f['size']>5*1024*1024)fail('5 MB хүртэл зураг сонгоно уу.');
    $info=@getimagesize($f['tmp_name']);if(!$info||!in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true)||$info[0]*$info[1]>12000000)fail('JPEG, PNG, WebP зураг (12 MP хүртэл) оруулна уу.');
    if(!function_exists('imagecreatefromstring'))fail('GD өргөтгөл шаардлагатай.',503);
    $image=@imagecreatefromstring(file_get_contents($f['tmp_name']));if(!$image)fail('Зураг уншигдсангүй.');
    $width=min(1600,imagesx($image));$height=max(1,(int)round(imagesy($image)*$width/imagesx($image)));$canvas=imagecreatetruecolor($width,$height);imagefill($canvas,0,0,imagecolorallocate($canvas,255,255,255));imagecopyresampled($canvas,$image,0,0,0,0,$width,$height,imagesx($image),imagesy($image));
    $dir=config()['data_dir'].'/warehouse-photos';if(!is_dir($dir))mkdir($dir,0700,true);$photo=bin2hex(random_bytes(16));$path=$dir.'/'.$photo.'.jpg';
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        warehouse_required();
        if($exception){
            $issue=logistics_exception($id,$location);if($issue['state']!=='open')fail('Зөрчил шийдвэрлэгдсэн байна.',409);
            if(count(logistics_exception_photos($id))>=12)fail('12 хүртэл зураг хадгална.');
            if(!imagejpeg($canvas,$path,85))fail('Зураг хадгалагдсангүй.',503);
            $db->prepare('INSERT INTO warehouse_exception_photos VALUES (?,?,?)')->execute([$photo,$id,gmdate('c')]);
        }else{
        $o=order_row($id)['order'];$l=logistics_state($o);
        if(!warehouse_order_visible($o,$location)||in_array($o['status'],['completed','cancelled'],true))fail('Зураг нэмэх боломжгүй.',409);
        if((string)$l['version']!==($_POST['expected_version']??''))fail('Мэдээлэл өөрчлөгдсөн байна. Шинэчилнэ үү.',409);
        $allowed=warehouse_role($location)==='erenhot'?['confirmed','shipping','erenhot','erenhot_ready']:['erenhot_dispatched','zamyn_uud','ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery'];
        if(!in_array($o['status'],$allowed,true))fail('Энэ төлөвт агуулахын зураг нэмэх боломжгүй.',409);
        if(count(array_filter($l['photos'],fn($p)=>($p['location']??'')===$location))>=12)fail('Нэг агуулахад 12 хүртэл зураг хадгална.');
        if(!imagejpeg($canvas,$path,85))fail('Зураг хадгалагдсангүй.',503);
        $l['photos'][]=['id'=>$photo,'at'=>gmdate('c'),'location'=>$location];$o['logistics']=$l;logistics_touch($o,'photo');
        }$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');if(is_file($path))unlink($path);throw $e;}finally{imagedestroy($canvas);imagedestroy($image);}
    json_out($exception?['ok'=>true]:['order'=>warehouse_order_public($o,$location)]);
}
function logistics_photo_read(array $o,string $photo): never {
    if(!preg_match('/^[a-f0-9]{32}$/D',$photo)||!in_array($photo,array_column(logistics_state($o)['photos'],'id'),true))fail('Зураг олдсонгүй.',404);
    $path=config()['data_dir'].'/warehouse-photos/'.$photo.'.jpg';if(!is_file($path))fail('Зураг олдсонгүй.',404);
    header('Content-Type: image/jpeg');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');readfile($path);exit;
}
