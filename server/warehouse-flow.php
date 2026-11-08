<?php
declare(strict_types=1);
// Erenhot shortcuts (2026-11-08): parcel-by-parcel arrival, one-step receipt with freight approval,
// automatic packing into an open batch, one-step shipping (warehouse-batches.php) and late-parcel alerts.
// This file only defines functions; the TaoWorld CLI worker loads it without logistics.php.

// A known courier parcel not scanned in this many days after its number appeared is flagged.
const WAREHOUSE_LATE_DAYS=5;
// Background courier refresh: each order at most every six hours, one order per worker run.
const WAREHOUSE_TRACKING_REFRESH=21600;

// Courier numbers known for an order and which of them the warehouse has scanned in.
function warehouse_parcels(array $o): array {
    $arrived=is_array($o['logistics']['parcels']??null)?$o['logistics']['parcels']:[];$list=[];
    foreach($o['inbound']['numbers']??[] as $n){
        $no=strtoupper(trim((string)($n['no']??'')));if($no===''||isset($list[$no]))continue;
        $list[$no]=['no'=>$no,'company'=>(string)($n['company']??''),'added_at'=>$n['added_at']??null,'arrived_at'=>$arrived[$no]['at']??null];
    }
    $list=array_values($list);$missing=array_values(array_column(array_filter($list,fn($p)=>$p['arrived_at']===null),'no'));
    return ['list'=>$list,'total'=>count($list),'arrived'=>count($list)-count($missing),'missing'=>$missing];
}
// Numbers the courier reports as delivered (from the saved TaoWorld domestic tracking).
function warehouse_parcels_signed(array $o): array {
    $signed=[];
    foreach($o['purchase']['domestic_tracking']['children']??[] as $child)foreach($child['parcels']??[] as $p){
        if(!is_array($p))continue;$status=strtoupper((string)($p['logistics_status']??''));$latest=$p['traces'][0]??[];
        $text=($p['logistics_desc']??'').' '.($latest['status_desc']??'').' '.($latest['standerd_desc']??'');
        if((str_contains($status,'SIGN')&&!str_contains($status,'RETURN'))||preg_match('/已签收|代签收|已代收/u',$text))$signed[]=strtoupper((string)($p['mail_no']??''));
    }
    return array_values(array_unique(array_filter($signed)));
}
// Waiting orders needing attention: the courier says delivered but nothing was scanned, or a known
// parcel is overdue. Only parcels with a known number can be judged.
function warehouse_alerts(array $o,?int $now=null): array {
    if(!in_array($o['status']??'',['confirmed','shipping'],true))return [];
    $now??=time();$parcels=warehouse_parcels($o);$alerts=[];
    $signed=array_values(array_intersect(warehouse_parcels_signed($o),$parcels['missing']));
    if($signed)$alerts[]=['kind'=>'signed','numbers'=>$signed];
    $late=[];
    foreach($parcels['list'] as $p){
        $known=strtotime((string)$p['added_at'])?:0;
        if($p['arrived_at']===null&&$known>0&&$known<$now-WAREHOUSE_LATE_DAYS*86400&&!in_array($p['no'],$signed,true))$late[]=$p['no'];
    }
    if($late)$alerts[]=['kind'=>'late','numbers'=>$late,'days'=>WAREHOUSE_LATE_DAYS];
    return $alerts;
}
function warehouse_expected_pieces(array $o): int {
    return (int)array_sum(array_column(isset($o['supplier'])?[$o['supplier']]:($o['items']??[]),'qty'));
}
// Scanning or tapping a courier parcel records its arrival; the last one clears the automatic shortfall.
function warehouse_parcel_arrive(array $b,string $location): array {
    if(warehouse_role($location)!=='erenhot')fail('Энэ үйлдлийг хийх эрхгүй.',403);
    $number=strtoupper(str_field($b,'number',40));
    if(!preg_match('/^[A-Z0-9-]{6,40}$/D',$number))fail('Tracking дугаар буруу.');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        warehouse_required();$o=order_row(str_field($b,'id',50))['order'];
        if(!warehouse_order_operable($o,$location))fail('Захиалга олдсонгүй.',404);
        if(!in_array($o['status'],['confirmed','shipping','erenhot'],true))fail('Энэ захиалгад илгээмж бүртгэх боломжгүй.',409);
        if(!in_array($number,array_column(warehouse_parcels($o)['list'],'no'),true))fail('Энэ tracking дугаар захиалгад бүртгэлгүй.',409);
        $l=logistics_state($o);
        if(!isset($l['parcels'][$number])){
            $l['parcels'][$number]=['at'=>gmdate('c'),'location'=>$location];
            if($o['status']==='erenhot'&&!warehouse_parcels(['inbound'=>$o['inbound']??[],'logistics'=>$l])['missing']){
                foreach($l['issues'] as &$issue)if(($issue['auto']??'')==='receipt'&&$issue['state']==='open'&&($issue['parcels']??[])){$issue['state']='resolved';$issue['resolution']='全部包裹已到 · Бүх илгээмж ирсэн';$issue['resolved_at']=gmdate('c');$issue['resolved_location']=$location;}
                unset($issue);
            }
            $o['logistics']=$l;logistics_touch($o,'parcel_arrived');
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return $o;
}
// Shared by the freight calculator and the one-step receipt.
function logistics_measure_input(array $b,array $o,string $location): array {
    $weight=decimal_field($b,'weight_kg',0.001,10000);$dimensions=[];
    if(($b['volume_input']??'dimensions')==='dimensions'){
        foreach(['length_cm','width_cm','height_cm'] as $k)$dimensions[$k]=decimal_field($b,$k,0.1,1000);
        $volume=round(array_product($dimensions)/1000000,9);
    }elseif($b['volume_input']==='direct')$volume=decimal_field($b,'volume_m3',0.000000001,1000);
    else fail('Тээврийн хэмжилт буруу.',400);
    $pieces=int_field($b,'pieces',1,1000000);
    return [['weight_kg'=>$weight,'volume_m3'=>$volume,'pieces'=>$pieces,'at'=>gmdate('c')]+$dimensions,
        warehouse_cargo_calculate($weight,$volume,warehouse_cargo_rates($o),$pieces,$dimensions)+['location'=>$location]];
}
// One step: the receipt photo is already saved; this receives the order, records weight and size, and
// approves the freight. A missing parcel or piece shortfall needs "partial" and opens an issue instead.
function warehouse_receive(array $b,string $location): array {
    if(warehouse_role($location)!=='erenhot')fail('Энэ үйлдлийг хийх эрхгүй.',403);
    if(($b['checked']??false)!==true)fail('Бараа, тоо ширхэг, жин, хэмжээг тулгаж шалгана уу.');
    if(isset($b['partial'])&&!is_bool($b['partial']))fail('Хэсэгчилсэн хүлээн авалтын тохиргоо буруу.');
    $partial=($b['partial']??false)===true;
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        warehouse_required();$o=order_row(str_field($b,'id',50))['order'];
        if(!warehouse_order_operable($o,$location))fail('Захиалга олдсонгүй.',404);
        if($o['status']!==str_field($b,'expected_status',30))fail('Захиалгын төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү.',409);
        $l=logistics_state($o);
        if(int_field($b,'expected_version',0,PHP_INT_MAX)!==$l['version'])fail('Мэдээлэл өөрчлөгдсөн байна. Шинэчилнэ үү.',409);
        // Already in Erenhot: a new measurement replaces the approved one while the order is outside a batch.
        $receiving=in_array($o['status'],['confirmed','shipping'],true);
        if(!$receiving&&($o['status']!=='erenhot'||isset($o['batch_id'])))fail('Энэ захиалгыг хүлээн авах боломжгүй.',409);
        logistics_receipt_photo_required($o,$location);
        [$measurement,$transport]=logistics_measure_input($b,$o,$location);
        $expected=warehouse_expected_pieces($o);$missing=warehouse_parcels($o)['missing'];
        if(($missing||$measurement['pieces']!==$expected)&&!$partial)fail('Илгээмж эсвэл тоо ширхэг дутуу байна. Хэсэгчлэн хүлээн авахыг сонгоно уу.',409);
        $now=gmdate('c');
        if($receiving){$o['history'][]=['status'=>'erenhot','at'=>$now,'actor'=>'warehouse','actor_location'=>$location,'actor_email'=>warehouse_account($location)['email']];$o['status']='erenhot';}
        if(!$missing)foreach(warehouse_parcels($o)['list'] as $p)$l['parcels'][$p['no']]??=['at'=>$now,'location'=>$location];
        if($missing||$measurement['pieces']!==$expected){
            // Earlier automatic shortfalls are replaced, so a repeated partial receipt keeps one open note.
            foreach($l['issues'] as &$issue)if(($issue['auto']??'')==='receipt'&&$issue['state']==='open'){$issue['state']='resolved';$issue['resolution']='Шинэ хэмжилтээр солигдсон · 已按新的收货记录更新';$issue['resolved_at']=$now;$issue['resolved_location']=$location;}
            unset($issue);
            $note=[];
            if($missing)$note[]='未到包裹 / Ирээгүй илгээмж: '.implode(', ',$missing);
            if($measurement['pieces']!==$expected)$note[]='收到 '.$measurement['pieces'].' 件，应为 '.$expected.' 件 / Ирсэн '.$measurement['pieces'].', захиалсан '.$expected;
            if(count($l['issues'])>=100)fail('Зөрчлийн бүртгэлийн хязгаарт хүрсэн.',409);
            $l['issues'][]=['id'=>bin2hex(random_bytes(8)),'kind'=>$measurement['pieces']>$expected?'extra':'missing','note'=>implode("\n",$note),'state'=>'open','location'=>$location,'at'=>$now,'auto'=>'receipt','parcels'=>$missing];
        }
        $l['measurement']=$measurement;$l['transport']=$transport;
        if(!array_filter($l['issues'],fn($i)=>$i['state']==='open')){$l['transport']['confirmed_at']=$now;$l['transport']['confirmed_location']=$location;}
        $o['logistics']=$l;logistics_touch($o,'receive');
        warehouse_batch_auto($o['id'],$location);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return order_row($o['id'])['order'];
}
// An approved order joins the newest automatic draft batch for its Ulaanbaatar warehouse, or starts one.
// Batches created by hand are never filled automatically.
function warehouse_batch_auto(string $id,string $location): ?array {
    $o=order_row($id)['order'];
    if(warehouse_role($location)!=='erenhot'||$o['status']!=='erenhot'||isset($o['batch_id'])||empty($o['logistics']['transport']['confirmed_at'])||logistics_open_issues($o))return null;
    $destination=warehouse_order_location($o,'ulaanbaatar');$batch=null;
    foreach(db()->query('SELECT data FROM shipment_batches ORDER BY created DESC,id DESC')->fetchAll() as $row){
        $b=json_decode($row['data'],true);
        if(!empty($b['auto'])&&$b['status']==='draft'&&($b['source']??'erenhot')===$location&&($b['destination']??'ulaanbaatar')===$destination&&count(warehouse_batch_members($b['id']))<200){$batch=$b;break;}
    }
    if(!$batch){
        $exists=db()->prepare('SELECT 1 FROM shipment_batches WHERE id=?');
        for($attempt=0;$attempt<20;$attempt++){$bid='GB-'.strtoupper(bin2hex(random_bytes(3)));$exists->execute([$bid]);$taken=$exists->fetchColumn();$exists->closeCursor();if(!$taken)break;}
        if($taken)fail('Багцын код үүсгэж чадсангүй.',503);
        $batch=['id'=>$bid,'source'=>$location,'destination'=>$destination,'status'=>'draft','version'=>1,'created'=>gmdate('c'),'note'=>'','auto'=>true,'fingerprint'=>bin2hex(random_bytes(32)),'history'=>[warehouse_event('created')]];
        db()->prepare('INSERT INTO shipment_batches VALUES (?,?,?,?)')->execute([$bid,hash('sha256',random_bytes(32)),json_encode($batch,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$batch['created']]);
    }
    warehouse_batch_add($batch,[$id]);warehouse_batch_save($batch,'auto_add');
    return $batch;
}
// TaoWorld worker: refresh domestic courier tracking for one shipped, not yet arrived order per run, so
// "delivered but not scanned" shows up without a manual refresh. Purchase APIs are not the catalog budget.
function warehouse_tracking_auto(int $limit=1,?int $now=null): array {
    $now??=time();$candidates=[];
    foreach(db()->query('SELECT data FROM orders ORDER BY created')->fetchAll() as $row){
        $o=json_decode($row['data'],true);$p=$o['purchase']??[];
        if(!is_array($o)||!in_array($o['status']??'',['confirmed','shipping'],true)||($p['provider']??'')!=='taoworld'||empty($p['submitted_at']))continue;
        if(!warehouse_parcels($o)['missing'])continue;
        $attempted=strtotime((string)($p['domestic_tracking']['auto_at']??''))?:0;
        if($attempted>$now-WAREHOUSE_TRACKING_REFRESH)continue;
        $candidates[]=['id'=>$o['id'],'at'=>$attempted];
    }
    usort($candidates,fn($a,$b)=>$a['at']<=>$b['at']);$done=[];
    foreach(array_slice($candidates,0,$limit) as $c){
        try{inbound_details_refresh($c['id'],null);$done[]=$c['id'];}catch(Throwable $e){error_log('GOStore courier tracking deferred');}
        try{tw_update($c['id'],static function(&$o){$o['purchase']['domestic_tracking']['auto_at']=gmdate('c');});}catch(Throwable $e){}
    }
    return $done;
}
