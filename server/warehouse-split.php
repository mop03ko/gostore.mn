<?php
declare(strict_types=1);

// The purchase/payment stays on the original order. Extra GS records are transport-only
// consignments, owned by the same customer. The original GS record carries the remainder.
function shipment_items(array $o): array {
    if(($o['shipment_split']['mode']??'')==='parcels')return [['name'=>'Илгээмж / 包裹','variant'=>'','qty'=>count(shipment_numbers($o)),'price'=>0]];
    return $o['shipping_items']??(isset($o['supplier'])?[$o['supplier']]:($o['items']??[]));
}
function shipment_numbers(array $o): array {
    $excluded=$o['shipment_split']['excluded_numbers']??[];
    return array_values(array_filter($o['inbound']['numbers']??[],fn($n)=>!in_array(strtoupper($n['no']),$excluded,true)));
}
function shipment_split_allowed(array $o): bool {
    if(!empty($o['shipment_parent'])||!in_array($o['status'],['confirmed','shipping','erenhot'],true)||isset($o['batch_id'])||isset($o['fulfillment'])||isset($o['settlement'])||isset($o['freight'])||count($o['shipment_split']['parts']??[])>=40)return false;
    // Real damage/loss must be resolved. An automatic receipt shortfall can be partitioned.
    foreach(logistics_state($o)['issues'] as $i)if($i['state']==='open'&&($i['auto']??'')!=='receipt')return false;
    return true;
}
function shipment_summary(array $o): array {
    $root=!empty($o['shipment_parent'])?order_row($o['shipment_parent'])['order']:$o;
    if(empty($root['shipment_split']['parts']))return [];
    $parts=[$root];
    $q=db()->prepare('SELECT data FROM orders WHERE id=?');
    foreach($root['shipment_split']['parts'] as $id){$q->execute([$id]);if($data=$q->fetchColumn())$parts[]=json_decode($data,true);}
    return array_map(static function($p)use($root){
        return ['id'=>$p['id'],'parent_id'=>$root['id'],'remainder'=>$p['id']===$root['id'],'status'=>$p['status'],
            'unit'=>$root['shipment_split']['mode']==='parcels'?'parcel':'item','quantity'=>array_sum(array_column(shipment_items($p),'qty')),
            'numbers'=>array_column(shipment_numbers($p),'no'),'billing'=>settlement_summary($p)];
    },$parts);
}
function shipment_customer_status(array $parts): string {
    $rank=array_flip(['confirmed','shipping','erenhot','erenhot_ready','erenhot_dispatched','zamyn_uud','ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery','completed']);
    usort($parts,fn($a,$b)=>($rank[$a['status']]??-1)<=>($rank[$b['status']]??-1));
    return $parts[0]['status'];
}
function warehouse_split_order(array $b,string $location,?array $actor=null): array {
    if(warehouse_role($location)!=='erenhot')fail('Энэ үйлдлийг хийх эрхгүй.',403);
    if(($b['checked']??false)!==true)fail('Салгах бараа болон үлдэгдлийг тулгаж батална уу.');
    $id=str_field($b,'id',50);$mode=str_field($b,'mode',10);$reason=str_field($b,'reason',500);
    if(!in_array($mode,['parcels','items'],true)||$reason==='')fail('Салгах арга, тайлбараа оруулна уу.');
    $token=str_field($b,'token',64);if(!preg_match('/^[a-f0-9]{64}$/D',$token))fail('Хүсэлтийн түлхүүр буруу.');
    $request=hash('sha256','warehouse-split:'.$location.':'.$id.':'.$token);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        if($actor===null)warehouse_required();
        $o=order_row($id)['order'];
        if(!warehouse_order_operable($o,$location))fail('Захиалга олдсонгүй.',404);
        $q=$db->prepare('SELECT data FROM orders WHERE request_key=?');$q->execute([$request]);
        if($existing=$q->fetchColumn()){$db->exec('COMMIT');return ['order'=>$o,'part'=>json_decode($existing,true)];}
        if(!shipment_split_allowed($o))fail('Багцалсан, тооцоо баталсан эсвэл салгасан хэсгийг дахин салгахгүй.',409);
        $l=logistics_state($o);
        if(int_field($b,'expected_version',0,PHP_INT_MAX)!==$l['version']||str_field($b,'expected_status',30)!==$o['status'])fail('Мэдээлэл өөрчлөгдсөн байна. Шинэчилнэ үү.',409);
        if(isset($o['shipment_split'])&&$o['shipment_split']['mode']!==$mode)fail('Нэг захиалгыг өмнө сонгосон аргаар нь үргэлжлүүлэн салгана.',409);
        $numbers=$b['numbers']??[];
        if(!is_array($numbers)||!array_is_list($numbers)||count($numbers)>20)fail('Салгах илгээмжийн жагсаалт буруу.');
        foreach($numbers as $n)if(!is_string($n)||!preg_match('/^[A-Z0-9-]{6,40}$/D',$n))fail('Tracking дугаар буруу.');
        if(count(array_unique($numbers))!==count($numbers))fail('Салгах илгээмжийн жагсаалт буруу.');
        $known=warehouse_parcels($o);$arrived=array_column(array_filter($known['list'],fn($p)=>$p['arrived_at']!==null),'no');
        if(array_diff($numbers,$arrived))fail('Зөвхөн ирснээр бүртгэсэн илгээмжийг салгана.',409);
        $before=shipment_items($o);$remaining=[];$selected=[];
        if($mode==='parcels'){
            if(!$numbers||count($numbers)>=count($known['list']))fail('Илгээх болон үлдэх хэсэг хоёулаа хоосон биш байна.');
            $selected=[['name'=>'Илгээмж / 包裹','variant'=>'','qty'=>count($numbers),'price'=>0]];
        }else{
            $quantities=$b['quantities']??null;
            if(!is_array($quantities)||!array_is_list($quantities)||count($quantities)!==count($before))fail('Салгах барааны тоо ширхэг буруу.');
            foreach($before as $i=>$item){
                $qty=$quantities[$i];$total=(int)$item['qty'];
                if(!is_int($qty)||$qty<0||$qty>$total)fail('Салгах барааны тоо ширхэг буруу.');
                if($qty){$copy=$item;$copy['qty']=$qty;$copy['price']=0;$selected[]=$copy;}
                if($total>$qty){$copy=$item;$copy['qty']=$total-$qty;$remaining[]=$copy;}
            }
            if(!$selected||!$remaining)fail('Илгээх болон үлдэх хэсэг хоёулаа хоосон биш байна.');
            // Item parts use their GS label: a single courier box can contain both parts.
            if($numbers)fail('Бараагаар салгасан хэсгийг GS кодоор тулгана.');
        }
        $now=gmdate('c');$childId='GS-'.strtoupper(bin2hex(random_bytes(6)));
        $child=array_intersect_key($o,array_flip(['customer','phone','cargo_id','route','warehouse_locations','fulfillment_request','demo']));
        $child+=['id'=>$childId,'type'=>'forwarding','title'=>$id.' · Хэсэг / 分件 '.(count($o['shipment_split']['parts']??[])+1),'status'=>'confirmed','created'=>$now,'amount'=>0,'paid'=>false,'demo'=>false,
            'shipment_parent'=>$id,'shipment_unit'=>$mode==='parcels'?'parcel':'item','items'=>$selected,'inbound'=>['numbers'=>[]],
            'history'=>[['status'=>'confirmed']+warehouse_event('split_created',$actor)]];
        $child['warehouse']=$o['warehouse']??[];$child['warehouse']['order_code']=$childId;
        $child['delivery_address']=warehouse_delivery_address($o);
        if($rates=settlement_service_rates($o))$child['service_rates']=array_merge($rates,['service_fee_mnt'=>0]);
        // Do not copy the original payment, provider purchase, pricing, refund, pickup code or photos.
        $child['logistics']=['version'=>1,'photos'=>[],'issues'=>[],'shelf'=>'','parcels'=>[],
            'audit'=>[warehouse_event('split_created',$actor)+['parent_id'=>$id,'mode'=>$mode,'reason'=>$reason,'numbers'=>$numbers]]];
        if($mode==='parcels'){
            $child['inbound']['numbers']=array_values(array_filter(shipment_numbers($o),fn($n)=>in_array(strtoupper($n['no']),$numbers,true)));
            foreach($numbers as $n)$child['logistics']['parcels'][$n]=$l['parcels'][$n];
        }else{$child['shipment_source_numbers']=$arrived;}
        $split=$o['shipment_split']??['mode'=>$mode,'parts'=>[],'excluded_numbers'=>[]];$split['parts'][]=$childId;
        $split['excluded_numbers']=array_values(array_unique(array_merge($split['excluded_numbers'],$numbers)));
        $o['shipment_split']=$split;
        if($mode==='items')$o['shipping_items']=$remaining;
        // Keep the original receipts in the audit; require a fresh photo/measurement for each new portion.
        $l['audit'][]=warehouse_event('split',$actor)+['part_id'=>$childId,'mode'=>$mode,'reason'=>$reason,'numbers'=>$numbers,
            'selected_items'=>$selected,'previous_status'=>$o['status'],'previous_measurement'=>$l['measurement']??null,'previous_transport'=>$l['transport']??null,'previous_photos'=>$l['photos']];
        unset($l['measurement'],$l['transport']);$l['photos']=[];$l['shelf']='';$l['version']++;
        foreach($numbers as $n)unset($l['parcels'][$n]);
        foreach($l['issues'] as &$issue)if($issue['state']==='open'&&($issue['auto']??'')==='receipt'){$issue['state']='resolved';$issue['resolution']='Хэсэгчлэн илгээхээр салгасан / 已拆分发货';$issue['resolved_at']=$now;}
        unset($issue);$o['logistics']=$l;
        if($o['status']==='erenhot'){$o['status']='shipping';$o['history'][]=['status'=>'shipping']+warehouse_event('split_remainder',$actor);}
        $db->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$childId,hash('sha256',random_bytes(32)),$request,json_encode($child,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$now,$now]);
        $db->prepare('INSERT INTO customer_orders (order_id,customer_id,created) SELECT ?,customer_id,? FROM customer_orders WHERE order_id=?')->execute([$childId,$now,$id]);
        save_order($o);warehouse_notice_record($child,null);
        $db->prepare('INSERT INTO order_notifications (order_id,kind,message,created,read_at) VALUES (?,?,?,?,NULL)')->execute([$id,'shipment_split','Захиалгыг хэсэгчлэн илгээнэ. Шинэ хэсэг: '.$childId,$now]);
        customer_push_schedule();$db->exec('COMMIT');return ['order'=>$o,'part'=>$child];
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
