<?php
declare(strict_types=1);
// Ulaanbaatar warehouse shortcuts (owner request 2026-11-09): sort in one step (photo, shelf, method, bill),
// counter handover of several orders, courier runs, waiting alerts and reminders, and the early freight bill
// for pickup orders. Batch receipt (warehouse-batches.php) no longer needs a photo per order.
// settlement_summary/logistics_ready come from logistics.php at runtime.

const WAREHOUSE_STALE_DAYS=3;
const WAREHOUSE_REMINDER_DAYS=[2,5];
const WAREHOUSE_UB_ACTIVE=['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery'];

function warehouse_ub_role(string $location): void {
    if(warehouse_role($location)!=='ulaanbaatar')fail('Энэ үйлдлийг хийх эрхгүй.',403);
}
function warehouse_phone_digits(?string $phone): string {return (string)preg_replace('/\D/','',(string)$phone);}
function warehouse_new_pickup_code(): string {return str_pad((string)random_int(0,99999999),8,'0',STR_PAD_LEFT);}

// Pickup checkout orders whose Erenhot freight is approved get their final bill when they leave Erenhot,
// so the customer can pay while the goods travel. Delivery orders and orders whose Taobao domestic cost is
// not known yet are billed in Ulaanbaatar as before. Never creates a refund.
function warehouse_early_settlement(array &$o): bool {
    if(($o['type']??'')!=='checkout'||isset($o['settlement'])||isset($o['freight'])||!($o['paid']??false)||!empty($o['demo']))return false;
    if(isset($o['fulfillment'])||($o['fulfillment_request']['method']??'pickup')!=='pickup')return false;
    $q=$o['quote']??null;$t=$o['logistics']['transport']??null;
    if(!is_array($q)||empty($q['auto'])||!empty($q['domestic_later'])||!is_array($q['breakdown']??null)||!is_array($t)||empty($t['confirmed_at']))return false;
    $parts=['goods_mnt'=>(int)($q['breakdown']['goods_mnt']??0),'domestic_mnt'=>(int)($q['breakdown']['domestic_mnt']??0),'service_mnt'=>(int)($q['breakdown']['service_mnt']??0),'delivery_mnt'=>0,'cargo_mnt'=>(int)ceil($t['amount_mnt'])];
    $total=array_sum($parts);if($total<settlement_summary($o)['paid'])return false;
    $o['settlement']=['total'=>$total,'breakdown'=>$parts,'cargo_method'=>$t['method'],'measure'=>$t['measure'],'rates'=>$t['rates'],'transport'=>$t,'confirmed_at'=>gmdate('c'),'note'=>'','early'=>true];
    $o['pickup_code']??=warehouse_new_pickup_code();
    return true;
}
// One customer message when an order becomes ready (or leaves Erenhot with its bill), stating what is due.
function warehouse_bill_message(array $o): string {
    $s=settlement_summary($o);$due=number_format($s['due']).'₮';$ub=warehouse_profile(warehouse_order_location($o,'ulaanbaatar'))['name'];
    return match($o['status']){
        'ready_pickup'=>$ub.' · авахад бэлэн. '.($s['due']>0?'Үлдэгдэл '.$due.' төлөөд авах кодоо аваарай.':'Авах код «Миний ачаа» хэсэгт.'),
        'ready_delivery'=>$ub.' · хүргэлтэд бэлэн. '.($s['due']>0?'Үлдэгдэл '.$due.' төлөгдмөгц хүргэнэ.':'Удахгүй хүргэнэ.'),
        default=>'Замын-Үүд рүү явж байна. Тээврийн үлдэгдэл '.$due.'-ийг одоо төлбөл Улаанбаатарт ирэнгүүт авах боломжтой.',
    };
}

// Waiting flags for the Ulaanbaatar list: unpaid bills and orders not collected for 3+ days.
function warehouse_ub_flags(array $o,?int $now=null): array {
    $flags=[];
    if(in_array($o['status'],['ready_pickup','ready_delivery'],true)){
        $s=settlement_summary($o);if($s['finalized']&&$s['due']>0)$flags['unpaid']=$s['due'];
        $sorted=strtotime((string)($o['fulfillment']['sorted_at']??''))?:0;$days=$sorted?intdiv(($now??time())-$sorted,86400):0;
        if($days>=WAREHOUSE_STALE_DAYS)$flags['stale']=$days;
    }
    return $flags;
}

// One step: receipt photo (uploaded first), shelf, method/contact and the final bill; the order becomes ready.
function warehouse_ub_sort(array $b,string $location): array {
    warehouse_ub_role($location);
    if(($b['checked']??false)!==true)fail('Бараа, хувилбар, тоо ширхэгийг тулгаж шалгана уу.');
    $method=str_field($b,'method',20);if(!in_array($method,['pickup','delivery'],true))fail('Хүлээлгэн өгөх хэлбэр буруу.');
    $phone=str_field($b,'contact_phone',30);if(!preg_match('/^[+\d ()-]{8,25}$/D',$phone))fail('Холбогдох утасны дугаараа шалгана уу.');
    $address=str_field($b,'address',500,$method==='delivery');$shelf=str_field($b,'shelf',50);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        warehouse_required();$o=order_row(str_field($b,'id',50))['order'];
        if(!warehouse_order_operable($o,$location))fail('Захиалга олдсонгүй.',404);
        if(str_field($b,'expected_status',30)!==$o['status'])fail('Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.',409);
        $l=logistics_state($o);if(int_field($b,'expected_version',0,PHP_INT_MAX)!==$l['version'])fail('Мэдээлэл өөрчлөгдсөн байна. Шинэчилж дахин оролдоно уу.',409);
        if(!in_array($o['status'],['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'],true))fail('Эхлээд багцыг хүлээн авна уу.',409);
        if(logistics_open_issues($o))fail('Эхлээд нээлттэй зөрчлийг шийдвэрлэнэ үү.',409);
        logistics_receipt_photo_required($o,$location);warehouse_cargo_required($o);
        if(isset($o['freight']['invoice'])){
            // An issued freight invoice fixes the bill; an early bill is for pickup.
            if($method!==($o['fulfillment']['method']??'pickup'))fail('Тээврийн төлбөрийн нэхэмжлэл үүссэн тул авах хэлбэрийг өөрчлөхгүй. Админтай шийднэ үү.',409);
        }else{
            $base=$o['settlement']['breakdown']??($o['quote']['breakdown']??null);
            // Independent purchases are already paid to the seller: GOStore bills transport only.
            if(($o['type']??'')==='forwarding')$base=['goods_mnt'=>0,'domestic_mnt'=>0,'service_mnt'=>0];
            // Orders without a price breakdown (older manual quotes) keep the separate final-bill form.
            if(is_array($base)){
                $parts=['goods_mnt'=>(int)($base['goods_mnt']??0),'domestic_mnt'=>(int)($base['domestic_mnt']??0),'service_mnt'=>(int)($base['service_mnt']??0)];
                if(!isset($o['settlement'])&&!empty($o['quote']['domestic_later']))$parts['domestic_mnt']=int_field($b,'domestic_mnt',0,100000000);
                $parts['delivery_mnt']=$method==='delivery'?int_field($b,'delivery_mnt',0,10000000):0;
                if(isset($l['transport'])){$q=$l['transport'];$cargoMethod=$q['method'];$rates=$q['rates'];}
                else{$m=$l['measurement'];$rates=warehouse_cargo_rates($o);$q=warehouse_cargo_calculate($m['weight_kg'],$m['volume_m3'],$rates,$m['pieces']);$cargoMethod='auto';}
                $parts['cargo_mnt']=(int)ceil($q['amount_mnt']);$total=array_sum($parts);if($total>100000000)fail('Нийт дүн хэтэрсэн.');
                if(($o['settlement']['breakdown']??null)!==$parts||($o['settlement']['total']??null)!==$total)
                    $o['settlement']=['total'=>$total,'breakdown'=>$parts,'cargo_method'=>$cargoMethod,'measure'=>$q['measure'],'rates'=>$rates,'transport'=>$q,'confirmed_at'=>gmdate('c'),'note'=>''];
                $o['pickup_code']??=warehouse_new_pickup_code();
            }
        }
        $l['shelf']=$shelf;$l['version']++;$l['audit'][]=warehouse_event('sort');$o['logistics']=$l;
        $o['fulfillment']=['method'=>$method,'contact_phone'=>$phone,'address'=>$method==='delivery'?$address:'','sorted_at'=>$o['fulfillment']['sorted_at']??gmdate('c')];
        $next=$method==='pickup'?'ready_pickup':'ready_delivery';
        if($o['status']!==$next)warehouse_change_order($o,$next);else save_order($o);
        if(isset($o['batch_id'])){
            $batch=warehouse_batch_row($o['batch_id']);
            $remaining=array_filter(warehouse_batch_members($batch['id']),fn($member)=>$member['status']==='ulaanbaatar_unsorted');
            if(!$remaining&&$batch['status']==='received'){$batch['status']='sorted';warehouse_batch_save($batch,'sorted');}
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return $o;
}

function warehouse_ub_card(array $o,bool $verified=false): array {
    $s=settlement_summary($o);$items=isset($o['supplier'])?[$o['supplier']]:($o['items']??[]);
    $reason='';
    if($o['status']!=='ready_pickup')$reason=match($o['status']){'ulaanbaatar_unsorted','ulaanbaatar'=>'not_sorted','ready_delivery'=>'delivery','out_for_delivery'=>'out_for_delivery',default=>'unavailable'};
    elseif(logistics_open_issues($o))$reason='issue';
    elseif(!$s['finalized'])$reason='no_bill';
    elseif($s['due']>0)$reason='unpaid';
    elseif($s['refund_due']>0)$reason='refund';
    return ['id'=>$o['id'],'customer'=>(string)($o['customer']??''),'phone'=>(string)($o['fulfillment']['contact_phone']??$o['phone']??''),'status'=>$o['status'],
        'shelf'=>logistics_state($o)['shelf'],'pieces'=>array_sum(array_map(fn($i)=>max(0,(int)($i['qty']??0)),$items)),'address'=>(string)($o['fulfillment']['address']??''),
        'due'=>$s['due'],'refund_due'=>$s['refund_due'],'reason'=>$reason,'verified'=>$verified];
}
function warehouse_ub_orders(string $location,array $statuses): array {
    $rows=[];
    foreach(db()->query('SELECT data FROM orders ORDER BY created DESC,id DESC') as $r){
        $o=json_decode($r['data'],true);
        if(is_array($o)&&in_array($o['status']??'',$statuses,true)&&warehouse_order_operable($o,$location))$rows[]=$o;
    }
    return $rows;
}
// Counter lookup by phone (any 6+ digits, matched at the end), order code or the customer's 8-digit pickup
// code. A pickup code also brings the same customer's other orders and marks its own order as verified.
function warehouse_handover_lookup(string $query,string $location): array {
    warehouse_ub_role($location);
    $query=trim($query);$digits=warehouse_phone_digits($query);$code=strtoupper($query);
    if(strlen($digits)<6&&!preg_match('/^GS-[A-Z0-9-]{3,45}$/D',$code))fail('Утасны дугаар, авах код эсвэл захиалгын кодоо оруулна уу.');
    limit_attempts('handover-lookup:'.$location,120,900);
    $orders=warehouse_ub_orders($location,WAREHOUSE_UB_ACTIVE);$phones=[];$verified=[];
    foreach($orders as $o){
        $byCode=strlen($digits)===8&&!empty($o['pickup_code'])&&hash_equals((string)$o['pickup_code'],$digits);
        if($byCode)$verified[$o['id']]=true;
        if($byCode||$o['id']===$code)foreach([$o['phone']??'',$o['fulfillment']['contact_phone']??''] as $p)if(strlen(warehouse_phone_digits($p))>=6)$phones[]=warehouse_phone_digits($p);
    }
    if(strlen($digits)>=6&&!$verified)$phones[]=$digits;
    $found=array_values(array_filter($orders,function($o)use($phones,$verified,$code){
        if(isset($verified[$o['id']])||$o['id']===$code)return true;
        foreach([$o['phone']??'',$o['fulfillment']['contact_phone']??''] as $p){$d=warehouse_phone_digits($p);foreach($phones as $q)if($d!==''&&str_ends_with($d,$q))return true;}
        return false;
    }));
    if(!$found)fail('Энэ агуулахад тохирох захиалга олдсонгүй.',404);
    // Orders that can be handed over now come first.
    $cards=array_map(fn($o)=>warehouse_ub_card($o,isset($verified[$o['id']])),array_slice($found,0,30));
    usort($cards,fn($a,$b)=>($a['reason']!=='')<=>($b['reason']!==''));
    return ['orders'=>$cards];
}
// Hands over several pickup orders at once; every order needs its own pickup code. All or nothing.
function warehouse_handover(array $b,string $location): array {
    warehouse_ub_role($location);
    $items=$b['items']??null;if(!is_array($items)||!array_is_list($items)||!$items||count($items)>30)fail('Хүлээлгэн өгөх захиалгаа сонгоно уу.');
    $codes=[];
    foreach($items as $item){
        if(!is_array($item))fail('Хүлээлгэн өгөх захиалгаа сонгоно уу.');
        $id=str_field($item,'id',50);if(isset($codes[$id]))fail('Захиалга давхардсан байна.');$codes[$id]=str_field($item,'code',8);
    }
    $by=str_field($b,'received_by',100);
    foreach(array_keys($codes) as $id)limit_attempts('pickup:'.$id,10,900);
    $db=db();$db->exec('BEGIN IMMEDIATE');$done=[];
    try{
        warehouse_required();
        foreach($codes as $id=>$code){
            $o=order_row($id)['order'];if(!warehouse_order_operable($o,$location))fail('Захиалга олдсонгүй.',404);
            if($o['status']!=='ready_pickup')fail('Захиалгыг хүлээлгэн өгөх боломжгүй.',409);
            logistics_ready($o);
            if(empty($o['pickup_code'])||!hash_equals((string)$o['pickup_code'],$code))fail('Авах код буруу байна.',403);
            unset($o['pickup_code']);$o['fulfillment']['received_by']=$by;$o['fulfillment']['completed_at']=gmdate('c');
            warehouse_change_order($o,'completed');$done[]=$o;
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return $done;
}
// Ready delivery orders plus the couriers used recently at this warehouse.
function warehouse_delivery_list(string $location): array {
    warehouse_ub_role($location);
    $couriers=[];
    foreach(warehouse_ub_orders($location,['out_for_delivery','completed']) as $o){
        $f=$o['fulfillment']??[];if(($f['method']??'')!=='delivery'||empty($f['courier_name'])||empty($f['courier_phone']))continue;
        $key=mb_strtolower($f['courier_name']).'|'.warehouse_phone_digits($f['courier_phone']);
        if(!isset($couriers[$key])||strcmp((string)($f['dispatched_at']??''),(string)$couriers[$key]['at'])>0)$couriers[$key]=['name'=>$f['courier_name'],'phone'=>$f['courier_phone'],'at'=>(string)($f['dispatched_at']??'')];
    }
    usort($couriers,fn($a,$b)=>strcmp($b['at'],$a['at']));
    $orders=array_map(function($o){$s=settlement_summary($o);$ready=!logistics_open_issues($o)&&$s['finalized']&&!$s['due']&&!$s['refund_due'];
        return array_merge(warehouse_ub_card($o),['ready'=>$ready,'reason'=>$ready?'':(logistics_open_issues($o)?'issue':(!$s['finalized']?'no_bill':($s['due']?'unpaid':'refund')))]);},warehouse_ub_orders($location,['ready_delivery']));
    return ['orders'=>$orders,'couriers'=>array_map(fn($c)=>['name'=>$c['name'],'phone'=>$c['phone']],array_slice($couriers,0,8))];
}
function warehouse_delivery_dispatch(array $b,string $location): array {
    warehouse_ub_role($location);
    $ids=$b['ids']??null;if(!is_array($ids)||!array_is_list($ids)||!$ids||count($ids)>50)fail('Хүргэх захиалгаа сонгоно уу.');
    foreach($ids as $id)if(!is_string($id)||!preg_match('/^[A-Z0-9-]{3,50}$/D',$id))fail('Хүргэх захиалгаа сонгоно уу.');
    if(count(array_unique($ids))!==count($ids))fail('Захиалга давхардсан байна.');
    $name=str_field($b,'courier_name',100);$phone=str_field($b,'courier_phone',30);
    if(!preg_match('/^[+\d ()-]{8,25}$/D',$phone))fail('Холбогдох утасны дугаараа шалгана уу.');
    $db=db();$db->exec('BEGIN IMMEDIATE');$done=[];
    try{
        warehouse_required();
        foreach($ids as $id){
            $o=order_row($id)['order'];if(!warehouse_order_operable($o,$location))fail('Захиалга олдсонгүй.',404);
            if($o['status']!=='ready_delivery'||($o['fulfillment']['method']??'')!=='delivery')fail('Захиалга хүргэлтэд бэлэн биш байна.',409);
            logistics_ready($o);
            $o['fulfillment']['courier_name']=$name;$o['fulfillment']['courier_phone']=$phone;$o['fulfillment']['dispatched_at']=gmdate('c');
            warehouse_change_order($o,'out_for_delivery');$done[]=$o;
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return $done;
}
// Daily: remind customers whose order has waited 2 and 5 days in Ulaanbaatar (unpaid or not collected).
function warehouse_pickup_reminders(?int $now=null): int {
    $now??=time();$sent=0;
    $ids=[];
    foreach(db()->query('SELECT data FROM orders') as $r){$o=json_decode($r['data'],true);if(is_array($o)&&in_array($o['status']??'',['ready_pickup','ready_delivery'],true))$ids[]=$o['id'];}
    foreach($ids as $id){
        $db=db();$db->exec('BEGIN IMMEDIATE');
        try{
            $o=order_row($id)['order'];$sorted=strtotime((string)($o['fulfillment']['sorted_at']??''))?:0;
            $s=settlement_summary($o);$days=$sorted?intdiv($now-$sorted,86400):0;$done=$o['reminders']??[];
            $stage=max(array_merge([0],array_filter(WAREHOUSE_REMINDER_DAYS,fn($d)=>$days>=$d)));
            // Delivery orders wait only for payment; pickup orders wait for payment or collection.
            if(!$stage||in_array($stage,$done,true)||!in_array($o['status'],['ready_pickup','ready_delivery'],true)||($o['status']==='ready_delivery'&&$s['due']<1)){$db->exec('COMMIT');continue;}
            $o['reminders']=array_values(array_unique(array_merge($done,array_filter(WAREHOUSE_REMINDER_DAYS,fn($d)=>$d<=$stage))));save_order($o);
            $ub=warehouse_profile(warehouse_order_location($o,'ulaanbaatar'))['name'];$due=$s['due']>0?'Үлдэгдэл '.number_format($s['due']).'₮ төлөөд ':'';
            $message=$o['status']==='ready_pickup'?$ub.'-д таны бараа '.$days.' хоног хүлээж байна. '.$due.'авах кодоороо ирж аваарай.':'Хүргэлтийн үлдэгдэл '.number_format($s['due']).'₮ төлөгдмөгц бараагаа хүргүүлнэ.';
            $db->prepare('INSERT INTO order_notifications (order_id,kind,message,created,read_at) VALUES (?,?,?,?,NULL)')->execute([$o['id'],'reminder',$message,gmdate('c',$now)]);
            $db->exec('COMMIT');$sent++;
        }catch(Throwable $e){$db->exec('ROLLBACK');error_log('GOStore pickup reminder skipped: '.$e->getMessage());}
    }
    return $sent;
}
