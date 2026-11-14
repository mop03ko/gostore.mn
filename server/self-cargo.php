<?php
declare(strict_types=1);

// Forwarding is a transport-only order. Never mark supplier goods as paid or queue a purchase.
function customer_cargo_id(string $customer): string {
    $db=db();$find=$db->prepare('SELECT cargo_id FROM customer_cargo_ids WHERE customer_id=?');
    $find->execute([$customer]);if($id=$find->fetchColumn())return $id;
    // Unique constraints arbitrate parallel first visits. Retained after account deletion; never reassigned.
    $insert=$db->prepare('INSERT OR IGNORE INTO customer_cargo_ids (customer_id,cargo_id,created) VALUES (?,?,?)');
    for($i=0;$i<30;$i++){
        $insert->execute([$customer,'GO'.random_int(10000000,99999999),gmdate('c')]);
        $find->execute([$customer]);if($id=$find->fetchColumn())return $id;
    }
    fail('Карго ID үүсгэж чадсангүй. Дахин оролдоно уу.',503);
}
function self_cargo_delivery(string $cargoId,string $location='erenhot'): array {
    $w=warehouse_profile($location);
    if(trim($w['address'])===''||trim($w['phone'])==='')fail('Агуулахын хаягийг тохируулж байна.',503);
    $recipient=$cargoId.' GOStore';$address=rtrim($w['address']).' '.$cargoId.'号';
    return ['cargo_id'=>$cargoId,'name'=>$w['name'],'recipient'=>$recipient,'address'=>$address,'phone'=>$w['phone'],'contact_phone'=>$w['contact_phone'],
      'label'=>"收件人: $recipient\n手机号: {$w['phone']}\n地址: $address"];
}
function self_cargo_owned(array $customer,string $id): array {
    $q=db()->prepare('SELECT o.data FROM orders o JOIN customer_orders c ON c.order_id=o.id WHERE o.id=? AND c.customer_id=?');$q->execute([$id,$customer['id']]);$data=$q->fetchColumn();
    if(!$data)fail('Ачаа олдсонгүй.',404);$o=json_decode($data,true);
    if(($o['type']??'')!=='forwarding')fail('Ачаа олдсонгүй.',404);return $o;
}
function self_cargo_address(array $o): array {
    if(!empty($o['cargo_id']))return self_cargo_delivery($o['cargo_id'],warehouse_order_location($o,'erenhot'))+['order_code'=>$o['id']];
    $w=warehouse_profile(warehouse_order_location($o,'erenhot'));
    if(trim($w['address'])===''||trim($w['phone'])==='')fail('Агуулахын хаягийг тохируулж байна.',503);
    $recipient=$o['id'].' GOStore';
    return ['recipient'=>$recipient,'order_code'=>$o['id'],'address'=>$w['address'],'phone'=>$w['phone'],'contact_phone'=>$w['contact_phone'],
      'label'=>"收件人: $recipient\n手机号: {$w['phone']}\n地址: {$w['address']}\n订单号: {$o['id']}"];
}
function self_cargo_waybill(array &$o,array $b): void {
    $number=strtoupper(str_field($b,'number',40));$company=str_field($b,'company',80,false);
    if(!preg_match('/^[A-Z0-9-]{6,40}$/D',$number))fail('Хүргэлтийн дугаар 6–40 үсэг, тоо, зураас байна.');
    // The write transaction serializes competing customer registrations.
    $q=db()->prepare('SELECT id,data FROM orders WHERE id<>? AND data LIKE ?');$q->execute([$o['id'],'%'.$number.'%']);
    foreach($q as $row){$other=json_decode($row['data'],true);foreach($other['inbound']['numbers']??[] as $n)if(strtoupper($n['no'])===$number)fail('Энэ хүргэлтийн дугаар бүртгэлтэй байна. Агуулахтай холбогдоно уу.',409);}
    $existing=$o['inbound']['numbers']??[];
    foreach($existing as $n)if($n['no']===$number)return;
    if(count($existing)>=20)fail('Нэг ачаанд 20 хүртэл хүргэлтийн дугаар бүртгэнэ.');
    $o['inbound']['numbers'][]=['no'=>$number,'company'=>$company,'source'=>'customer','added_at'=>gmdate('c')];
    $o['inbound']['status']='Хэрэглэгчийн бүртгэсэн хүргэлтийн дугаар';
    if($o['status']==='confirmed'){$o['status']='shipping';$o['history'][]=['status'=>'shipping','at'=>gmdate('c'),'actor'=>'customer'];}
}
function self_cargo_create(array $c,array $b): array {
    $key=str_field($b,'request_key',80);if(!preg_match('/^[a-zA-Z0-9-]{16,80}$/D',$key))fail('Хүсэлтийн дугаар буруу.');
    $title=str_field($b,'title',200);$qty=int_field($b,'qty',1,10000);$phone=customer_phone($b);
    if($phone==='')fail('Холбоо барих утсаа оруулна уу.');
    $variant=str_field($b,'note',500,false);$request=hash('sha256','self-cargo:'.$c['id'].':'.$key);
    limit_attempts('self-cargo:'.$c['id'],30,3600);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $q=$db->prepare('SELECT id FROM orders WHERE request_key=?');$q->execute([$request]);$id=$q->fetchColumn();
        if($id){$o=self_cargo_owned($c,$id);$db->exec('COMMIT');return $o;}
        $pickupLocation=checkout_pickup_location(['pickup_location'=>$b['pickup_location']??'ulaanbaatar','fulfillment'=>'pickup']);
        $exists=$db->prepare('SELECT 1 FROM orders WHERE id=?');$id='';
        for($i=0;$i<20;$i++){$candidate='GS-'.strtoupper(bin2hex(random_bytes(3)));$exists->execute([$candidate]);if(!$exists->fetchColumn()){$id=$candidate;break;}}
        if(!$id)fail('Код үүсгэж чадсангүй.',503);$now=gmdate('c');
        $o=['id'=>$id,'type'=>'forwarding','title'=>$title,'customer'=>$c['name'],'phone'=>$phone,'status'=>'confirmed','created'=>$now,'amount'=>0,'paid'=>false,'demo'=>false,
          'items'=>[['id'=>$id,'name'=>$title,'variant'=>$variant,'qty'=>$qty,'price'=>0]],'route'=>['Эрээн','Замын-Үүд','Улаанбаатар'],
          'warehouse_locations'=>['erenhot'=>'erenhot','ulaanbaatar'=>$pickupLocation],'fulfillment_request'=>['method'=>'pickup'],
          'history'=>[['status'=>'confirmed','at'=>$now,'actor'=>'customer']],'inbound'=>['numbers'=>[]]];
        $o['cargo_id']=customer_cargo_id($c['id']);$o['warehouse']=self_cargo_address($o);
        if(str_field($b,'number',40,false)!=='')self_cargo_waybill($o,$b);
        $db->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,hash('sha256',random_bytes(32)),$request,json_encode($o,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$now,$now]);
        $db->prepare('INSERT INTO customer_orders VALUES (?,?,?)')->execute([$id,$c['id'],$now]);
        warehouse_notice_record($o,null);
        $db->exec('COMMIT');return $o;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function self_cargo_add_waybill(array $c,array $b): array {
    limit_attempts('self-cargo-tracking:'.$c['id'],60,3600);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=self_cargo_owned($c,str_field($b,'id',50));
        if(!in_array($o['status'],['confirmed','shipping'],true))fail('Агуулахад хүлээн авсны дараа дугаар нэмэхгүй. Менежертэй холбогдоно уу.',409);
        self_cargo_waybill($o,$b);save_order($o);$db->exec('COMMIT');return $o;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
