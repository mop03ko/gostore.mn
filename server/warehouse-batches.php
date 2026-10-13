<?php
declare(strict_types=1);

function warehouse_event(string $event): array {
    $location=warehouse_session_location();
    return ['event'=>$event,'at'=>gmdate('c'),'actor'=>'warehouse','actor_location'=>$location,'actor_email'=>warehouse_account($location)['email']];
}
function warehouse_change_order(array &$o,string $status): void {
    $o['status']=$status;$o['history'][]=['status'=>$status]+warehouse_event($status);save_order($o);
}
function warehouse_batch_row(string $id): array {
    $s=db()->prepare('SELECT data FROM shipment_batches WHERE id=?');$s->execute([$id]);$data=$s->fetchColumn();
    if(!$data)fail('Багц олдсонгүй.',404);return json_decode($data,true);
}
function warehouse_batch_members(string $id): array {
    $s=db()->prepare('SELECT o.data FROM orders o JOIN shipment_batch_orders m ON m.order_id=o.id WHERE m.batch_id=? ORDER BY o.id');$s->execute([$id]);
    return array_map(fn($r)=>json_decode($r['data'],true),$s->fetchAll());
}
function warehouse_batch_save(array &$batch,string $event): void {
    $batch['version']++;$batch['history'][]=warehouse_event($event);
    db()->prepare('UPDATE shipment_batches SET data=? WHERE id=?')->execute([json_encode($batch,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$batch['id']]);
}
function warehouse_batch_visible(array $batch,string $location): bool {
    return warehouse_role($location)==='erenhot'?($batch['source']??'erenhot')===$location:(($batch['destination']??'ulaanbaatar')===$location&&in_array($batch['status'],['dispatched','received','sorted'],true));
}
function warehouse_batch_public(array $batch,string $location,bool $detail=false): array {
    $result=array_intersect_key($batch,array_flip(['id','status','version','created','note','ready_at','dispatched_at','received_at']));
    $result['source']=$batch['source']??'erenhot';$result['destination']=$batch['destination']??'ulaanbaatar';
    $result['source_name']=warehouse_profile($result['source'])['name'];$result['destination_name']=warehouse_profile($result['destination'])['name'];
    $members=warehouse_batch_members($batch['id']);$result['order_count']=count($members);
    $result['unsorted_count']=count(array_filter($members,fn($o)=>$o['status']==='ulaanbaatar_unsorted'));
    $result['piece_count']=array_sum(array_map(fn($o)=>array_sum(array_column(isset($o['supplier'])?[$o['supplier']]:($o['items']??[]),'qty')),$members));
    $result['scanned']=$batch['checks'][$location]??[];
    if($detail){$result['orders']=array_map(fn($o)=>warehouse_order_public($o,$location),$members);$result['history']=array_map(fn($h)=>array_intersect_key($h,array_flip(['event','at'])),$batch['history']);}
    return $result;
}
function warehouse_batch_get(string $action,string $location): never {
    if($action==='warehouse-batch'){
        $batch=warehouse_batch_row(str_field($_GET,'id',50));if(!warehouse_batch_visible($batch,$location))fail('Багц олдсонгүй.',404);
        json_out(['batch'=>warehouse_batch_public($batch,$location,true),'location'=>$location]);
    }
    if($action!=='warehouse-batches')fail('Үйлдэл олдсонгүй.',404);
    $query=mb_strtolower(str_field($_GET,'q',100,false));$status=str_field($_GET,'status',30,false);
    $offset=filter_var($_GET['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>1000000]]);if($offset===false)fail('Хуудасны дугаар буруу.');
    $rows=[];$total=0;
    foreach(db()->query('SELECT data FROM shipment_batches ORDER BY created DESC,id DESC') as $r){
        $b=json_decode($r['data'],true);if(!warehouse_batch_visible($b,$location))continue;
        if($status!==''&&$status!=='all'&&$status!==$b['status'])continue;
        if($query!==''&&!str_contains(mb_strtolower($b['id'].' '.$b['note']),$query))continue;
        if($total++<$offset)continue;if(count($rows)<51)$rows[]=warehouse_batch_public($b,$location);
    }
    json_out(['batches'=>array_slice($rows,0,50),'more'=>count($rows)>50,'total'=>$total,'location'=>$location]);
}
function warehouse_batch_ids(array $b): array {
    $ids=$b['order_ids']??[];
    if(!is_array($ids)||count($ids)>200||!array_is_list($ids))fail('Захиалгын кодын жагсаалт буруу.');
    foreach($ids as $id)if(!is_string($id)||!preg_match('/^GS-[A-Z0-9-]{1,45}$/D',$id))fail('Захиалгын кодын жагсаалт буруу.');
    if(count(array_unique($ids))!==count($ids))fail('Захиалгын код давхардсан байна.');
    return $ids;
}
function warehouse_batch_add(array $batch,array $ids): void {
    $members=warehouse_batch_members($batch['id']);if(count($members)+count($ids)>200)fail('Нэг багцад 200 хүртэл захиалга бүртгэнэ.');
    $lookup=db()->prepare('SELECT batch_id FROM shipment_batch_orders WHERE order_id=?');
    foreach($ids as $id){
        $o=order_row($id)['order'];
        if(!warehouse_order_visible($o,$batch['source']??'erenhot')||$o['status']!=='erenhot')fail('Зөвхөн Эрээнд ирсэн захиалгыг багцлана.',409);
        if(warehouse_order_location($o,'ulaanbaatar')!==($batch['destination']??'ulaanbaatar'))fail('Нэг багцын захиалгууд ижил хүлээн авах агуулахтай байна.',409);
        $lookup->execute([$id]);if($lookup->fetchColumn())fail('Захиалга өөр багцад бүртгэлтэй байна.',409);
        db()->prepare('INSERT INTO shipment_batch_orders VALUES (?,?)')->execute([$id,$batch['id']]);$o['batch_id']=$batch['id'];save_order($o);
    }
}
function warehouse_batch_post(string $action,array $b,string $location): never {
    $allowed=warehouse_role($location)==='erenhot'?['warehouse-batch-create','warehouse-batch-add','warehouse-batch-remove','warehouse-batch-ready','warehouse-batch-reopen','warehouse-batch-dispatch','warehouse-batch-cancel','warehouse-batch-scan']:['warehouse-batch-receive','warehouse-batch-scan'];
    if(!in_array($action,$allowed,true))fail('Энэ үйлдлийг хийх эрхгүй.',403);
    $db=db();$db->exec('BEGIN IMMEDIATE');$created=false;
    try{
        warehouse_required();
        if($action==='warehouse-batch-create'){
            $token=str_field($b,'token',64);if(!preg_match('/^[a-f0-9]{64}$/D',$token))fail('Хүсэлтийн түлхүүр буруу.');
            $ids=warehouse_batch_ids($b);sort($ids);$note=str_field($b,'note',500,false);$destination=$b['destination']??'ulaanbaatar';$defs=warehouse_definitions();if(!is_string($destination)||!isset($defs[$destination])||$defs[$destination]['role']!=='ulaanbaatar'||!$defs[$destination]['active'])fail('Хүлээн авах агуулах буруу.');$fingerprint=hash('sha256',json_encode([$ids,$note,$location,$destination],JSON_THROW_ON_ERROR));
            $s=$db->prepare('SELECT data FROM shipment_batches WHERE request_key=?');$s->execute([hash('sha256',$token)]);$existing=$s->fetchColumn();$s->closeCursor();
            if($existing){$batch=json_decode($existing,true);if(!isset($batch['source'])&&$location==='erenhot'&&$destination==='ulaanbaatar')$fingerprint=hash('sha256',json_encode([$ids,$note],JSON_THROW_ON_ERROR));if(!hash_equals($batch['fingerprint'],$fingerprint))fail('Давтан хүсэлтийн мэдээлэл өөр байна.',409);}
            else{
                $s=$db->prepare('SELECT 1 FROM shipment_batches WHERE id=?');
                for($attempt=0;$attempt<20;$attempt++){$id='GB-'.strtoupper(bin2hex(random_bytes(3)));$s->execute([$id]);$taken=$s->fetchColumn();$s->closeCursor();if(!$taken)break;}
                if($taken)fail('Багцын код үүсгэж чадсангүй.',503);
                $batch=['id'=>$id,'source'=>$location,'destination'=>$destination,'status'=>'draft','version'=>1,'created'=>gmdate('c'),'note'=>$note,'fingerprint'=>$fingerprint,'history'=>[warehouse_event('created')]];
                $db->prepare('INSERT INTO shipment_batches VALUES (?,?,?,?)')->execute([$id,hash('sha256',$token),json_encode($batch,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$batch['created']]);
                warehouse_batch_add($batch,$ids);$created=true;
            }
        }else{
            $batch=warehouse_batch_row(str_field($b,'id',50));
            if(!warehouse_batch_visible($batch,$location))fail('Багц олдсонгүй.',404);
            if(int_field($b,'expected_version',1,PHP_INT_MAX)!==$batch['version'])fail('Багц өөрчлөгдсөн байна. Шинэчилж дахин оролдоно уу.',409);
            $expected=warehouse_role($location)==='ulaanbaatar'?'dispatched':(in_array($action,['warehouse-batch-dispatch','warehouse-batch-reopen'],true)?'ready':'draft');
            if($batch['status']!==$expected)fail('Багцын төлөв энэ үйлдлийг зөвшөөрөхгүй.',409);
            $members=warehouse_batch_members($batch['id']);
            if($action==='warehouse-batch-scan'){
                $id=str_field($b,'order_id',50);if(!in_array($id,array_column($members,'id'),true))fail('Захиалга энэ багцад байхгүй.',409);
                $batch['checks'][$location]=array_values(array_unique(array_merge($batch['checks'][$location]??[],[$id])));
            }elseif($action==='warehouse-batch-add'){
                $ids=warehouse_batch_ids($b);if(!$ids)fail('Захиалгын код оруулна уу.');warehouse_batch_add($batch,$ids);
            }elseif($action==='warehouse-batch-remove'){
                $id=str_field($b,'order_id',50);$matches=array_values(array_filter($members,fn($o)=>$o['id']===$id));if(!$matches)fail('Захиалга энэ багцад байхгүй.',404);
                $o=$matches[0];unset($o['batch_id']);save_order($o);$db->prepare('DELETE FROM shipment_batch_orders WHERE order_id=? AND batch_id=?')->execute([$id,$batch['id']]);
                $batch['checks'][$location]=array_values(array_diff($batch['checks']['erenhot']??[],[$id]));
            }elseif($action==='warehouse-batch-cancel'){
                foreach($members as $o){unset($o['batch_id']);save_order($o);}$db->prepare('DELETE FROM shipment_batch_orders WHERE batch_id=?')->execute([$batch['id']]);$batch['status']='cancelled';
            }elseif($action==='warehouse-batch-reopen'){
                foreach($members as $o){
                    if($o['status']!=='erenhot_ready')fail('Багцын захиалгын төлөв зөрсөн байна.',409);
                    warehouse_change_order($o,'erenhot');
                }
                $batch['status']='draft';$batch['checks']['erenhot']=[];unset($batch['ready_at']);
            }else{
                if($action==='warehouse-batch-dispatch'&&($b['checked']??false)!==true)fail('Багц агуулахаас бодитоор гарсныг батална уу.');
                if(!$members)fail('Хоосон багцыг илгээх боломжгүй.',409);
                if(array_diff(array_column($members,'id'),$batch['checks'][$location]??[]))fail('Багцын захиалга бүрийг скан хийж тулгана уу.',409);
                foreach($members as $o){
                    if(logistics_open_issues($o))fail('Эхлээд нээлттэй зөрчлийг шийдвэрлэнэ үү.',409);
                    if(warehouse_role($location)==='erenhot'&&!isset($o['logistics']['measurement']))fail('Бодит хэмжилт шаардлагатай.',409);
                    $orderExpected=match($action){'warehouse-batch-ready'=>'erenhot','warehouse-batch-dispatch'=>'erenhot_ready',default=>'erenhot_dispatched'};
                    if($o['status']!==$orderExpected)fail('Багцын захиалгын төлөв зөрсөн байна.',409);
                    if($action==='warehouse-batch-receive')logistics_receipt_photo_required($o,$location);
                    warehouse_change_order($o,match($action){'warehouse-batch-ready'=>'erenhot_ready','warehouse-batch-dispatch'=>'erenhot_dispatched',default=>'ulaanbaatar_unsorted'});
                }
                $batch['status']=match($action){'warehouse-batch-ready'=>'ready','warehouse-batch-dispatch'=>'dispatched',default=>'received'};$batch[$batch['status'].'_at']=gmdate('c');
            }
            warehouse_batch_save($batch,substr($action,16));
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    json_out(['batch'=>warehouse_batch_public($batch,$location,true)],$created?201:200);
}
function warehouse_delivery_address(array $o): string {
    if(isset($o['delivery_address']))return $o['delivery_address'];
    $marker="Хүргэлтийн хаяг: ";$notes=$o['notes']??'';$at=mb_strrpos($notes,$marker);
    if($at===false||($at>0&&mb_substr($notes,$at-1,1)!=="\n"))return '';
    return mb_substr($notes,$at+mb_strlen($marker),500);
}
function warehouse_fulfillment(array $b,string $location): never {
    if(warehouse_role($location)!=='ulaanbaatar')fail('Энэ үйлдлийг хийх эрхгүй.',403);
    $action=str_field($b,'operation',30);
    if($action==='complete')limit_attempts('pickup:'.str_field($b,'id',50),10,900);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        warehouse_required();$o=order_row(str_field($b,'id',50))['order'];
        if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);
        if(str_field($b,'expected_status',30)!==$o['status'])fail('Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.',409);
        if(logistics_open_issues($o))fail('Эхлээд нээлттэй зөрчлийг шийдвэрлэнэ үү.',409);
        if($action==='sort'){
            if(!in_array($o['status'],['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'],true))fail('Эхлээд багцыг хүлээн авна уу.',409);
            if(($b['checked']??false)!==true)fail('Бараа, хувилбар, тоо ширхэгийг тулгаж шалгана уу.');
            $method=str_field($b,'method',20);if(!in_array($method,['pickup','delivery'],true))fail('Хүлээлгэн өгөх хэлбэр буруу.');
            if(isset($o['settlement'])&&isset($o['fulfillment'])&&$method!==$o['fulfillment']['method'])fail('Эцсийн тооцооны дараа авах хэлбэрийг өөрчлөхгүй.',409);
            $phone=str_field($b,'contact_phone',30);if(!preg_match('/^[+\d ()-]{8,25}$/D',$phone))fail('Холбогдох утасны дугаараа шалгана уу.');
            $address=str_field($b,'address',500,$method==='delivery');
            $o['fulfillment']=['method'=>$method,'contact_phone'=>$phone,'address'=>$method==='delivery'?$address:'','sorted_at'=>gmdate('c')];
            warehouse_change_order($o,$method==='pickup'?'ready_pickup':'ready_delivery');
            if(isset($o['batch_id'])){
                $batch=warehouse_batch_row($o['batch_id']);
                if(!in_array($batch['status'],['received','sorted'],true))fail('Эхлээд багцыг хүлээн авна уу.',409);
                $remaining=array_filter(warehouse_batch_members($batch['id']),fn($member)=>$member['status']==='ulaanbaatar_unsorted');
                if(!$remaining&&$batch['status']==='received'){$batch['status']='sorted';warehouse_batch_save($batch,'sorted');}
            }
        }elseif($action==='dispatch_delivery'){
            logistics_ready($o);
            if($o['status']!=='ready_delivery'||($o['fulfillment']['method']??'')!=='delivery')fail('Захиалга хүргэлтэд бэлэн биш байна.',409);
            $o['fulfillment']['courier_name']=str_field($b,'courier_name',100);$phone=str_field($b,'courier_phone',30);
            if(!preg_match('/^[+\d ()-]{8,25}$/D',$phone))fail('Холбогдох утасны дугаараа шалгана уу.');
            $o['fulfillment']['courier_phone']=$phone;$o['fulfillment']['dispatched_at']=gmdate('c');warehouse_change_order($o,'out_for_delivery');
        }elseif($action==='complete'){
            if(!in_array($o['status'],['ready_pickup','out_for_delivery'],true))fail('Захиалгыг хүлээлгэн өгөх боломжгүй.',409);
            logistics_ready($o);
            if(empty($o['pickup_code'])||!hash_equals($o['pickup_code'],str_field($b,'pickup_code',8)))fail('Авах код буруу байна.',403);
            unset($o['pickup_code']);
            $o['fulfillment']['received_by']=str_field($b,'received_by',100);$o['fulfillment']['completed_at']=gmdate('c');warehouse_change_order($o,'completed');
        }else fail('Үйлдэл олдсонгүй.',404);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    json_out(['order'=>warehouse_order_public($o,$location)]);
}
