<?php
declare(strict_types=1);
function finance_meta_read(string $key): array {$s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute([$key]);return json_decode($s->fetchColumn()?:'{}',true)?:[];}
function finance_batch_share(string $id): ?array {$v=finance_meta_read('finance-batch-share:'.$id);return isset($v['amount_mnt'])?$v:null;}
function finance_batch_get(string $id, bool $detail=false): array {
    $s=db()->prepare('SELECT data, created FROM shipment_batches WHERE id=?');$s->execute([$id]);$row=$s->fetch();if(!$row)fail('Багц олдсонгүй.',404);$batch=json_decode($row['data'],true);
    $s=db()->prepare('SELECT o.data FROM orders o JOIN shipment_batch_orders m ON m.order_id=o.id WHERE m.batch_id=? ORDER BY o.id');$s->execute([$id]);$members=[];
    $orders=[];
    foreach($s->fetchAll() as $r){
        $o=json_decode($r['data'],true);$m=$o['logistics']['measurement']??[];
        $members[]=['id'=>$o['id'],'weight_kg'=>$m['weight_kg']??null,'volume_m3'=>$m['volume_m3']??null,'demo'=>!empty($o['demo']),'manual_cost'=>admin_finance_entry($o['id'])['transport_cost_mnt']];
        if($detail&&empty($o['demo'])){
            $finance=admin_finance_order($o);
            $orders[]=array_intersect_key($finance,array_flip(['id','day','part','net','transport_cost','bank_fx','profit']));
        }
    }
    $entry=array_replace(['version'=>0,'amount_mnt'=>null,'paid_date'=>'','note'=>'','allocations'=>[]],finance_meta_read('finance-batch:'.$id));
    $result=['id'=>$id,'status'=>$batch['status'],'batch_version'=>$batch['version'],'members'=>$members,'entry'=>$entry];
    if($detail){
        $result['destination']=finance_batch_destination($batch,warehouse_definitions());
        $result['day']=admin_report_day(finance_batch_date($batch,$row['created']));
        $result['orders']=$orders;
    }
    return $result;
}

function finance_batch_date(array $batch, string $created): string {
    return $batch['dispatched_at'] ?? $batch['ready_at'] ?? $created;
}

function finance_batch_destination(array $batch, array $warehouses): string {
    $location=$batch['destination']??'ulaanbaatar';
    return isset($warehouses[$location])?warehouse_profile($location)['name']:$location;
}

function finance_batch_report_list(array $query): array {
    [$from,$to,,$lastTimestamp]=admin_report_range($query);
    $offset=filter_var($query['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0]]);
    if($offset===false)fail('Хуудасны дугаар буруу.');
    $warehouses=warehouse_definitions();
    $rows=db()->prepare('SELECT id, data, created FROM shipment_batches WHERE created<=?');
    $rows->execute([gmdate('c',$lastTimestamp)]);
    $eligible=[];
    foreach($rows as $row){
        $batch=json_decode($row['data'],true);
        if(!is_array($batch)||!in_array($batch['status']??null,['draft','ready','dispatched','received','sorted'],true))continue;
        if(($warehouses[$batch['source']??'erenhot']['role']??null)!=='erenhot')continue;
        $at=finance_batch_date($batch,$row['created']);
        $day=admin_report_day($at);
        if($day<$from||$day>$to)continue;
        $eligible[]=['batch'=>$batch,'id'=>$row['id'],'at'=>$at,'day'=>$day];
    }
    usort($eligible,fn($a,$b)=>[$b['at'],$b['id']]<=>[$a['at'],$a['id']]);
    $batches=[];
    $members=db()->prepare('SELECT o.data FROM orders o JOIN shipment_batch_orders m ON m.order_id=o.id WHERE m.batch_id=?');
    foreach(array_slice($eligible,$offset,25) as $row){
        $members->execute([$row['id']]);
        $count=0;
        while(($data=$members->fetchColumn())!==false){
            $order=json_decode($data,true);
            if(is_array($order)&&empty($order['demo']))$count++;
        }
        $entry=finance_meta_read('finance-batch:'.$row['id']);
        $batches[]=['id'=>$row['id'],'day'=>$row['day'],'status'=>$row['batch']['status'],
            'destination'=>finance_batch_destination($row['batch'],$warehouses),'order_count'=>$count,
            'amount_mnt'=>$entry['amount_mnt']??null];
    }
    return ['batches'=>$batches,'offset'=>$offset,'total'=>count($eligible),'more'=>$offset+25<count($eligible)];
}
function finance_batch_save(array $b): array {
    admin_required();if(!admin_role_at_least('owner'))fail('Зөвхөн эзэмшигч багцын зардал бүртгэнэ.',403);
    $id=str_field($b,'id',50);$amount=int_field($b,'amount_mnt',0,100000000);$date=str_field($b,'paid_date',10);$note=str_field($b,'note',500);
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)||!checkdate((int)substr($date,5,2),(int)substr($date,8,2),(int)substr($date,0,4)))fail('Төлсөн огноо буруу байна.');
    if(($b['confirmed']??false)!==true)fail('Багцын дүн, хуваарилалтыг шалгаснаа батална уу.');
    $alloc=$b['allocations']??null;if(!is_array($alloc)||count($alloc)>500)fail('Хуваарилалт буруу.');$sum=0;
    foreach($alloc as $order=>$v){if(!is_string($order)||!is_int($v)||$v<0||$v>100000000)fail('Захиалга бүрийн зардлыг бүхэл төгрөгөөр оруулна уу.');$sum+=$v;}
    if($sum!==$amount)fail('Хуваарилалтын нийлбэр багцын төлсөн дүнтэй тэнцэх ёстой.');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $current=finance_batch_get($id);$old=$current['entry'];
        if(!in_array($current['status'],['dispatched','received','sorted'],true))fail('Зөвхөн илгээсэн багцын зардлыг бүртгэнэ.',409);
        if(int_field($b,'version',0,PHP_INT_MAX)!==$old['version']||int_field($b,'batch_version',0,PHP_INT_MAX)!==$current['batch_version'])fail('Багц эсвэл тооцоо өөрчлөгдсөн. Дахин нээнэ үү.',409);
        $ids=array_column($current['members'],'id');$keys=array_keys($alloc);sort($ids);sort($keys);if(!$ids||$ids!==$keys)fail('Багцын бүх захиалгад зардал хуваарилна уу.',409);
        foreach($current['members'] as $m){if($m['demo'])fail('Жишээ захиалгад бодит зардал бүртгэхгүй.',409);if(($m['manual_cost']??0)>0)fail($m['id'].' захиалгын тусдаа тээврийн зардлыг эхлээд арилгана уу. Давхар тооцохгүй.',409);$share=finance_batch_share($m['id']);if($share&&$share['batch_id']!==$id)fail('Захиалга өөр багцын зардалтай байна.',409);}
        $entry=['version'=>$old['version']+1,'amount_mnt'=>$amount,'paid_date'=>$date,'note'=>$note,'allocations'=>$alloc,'updated_at'=>gmdate('c')];
        $put=$db->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)');$put->execute(['finance-batch:'.$id,json_encode($entry,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        foreach(array_diff(array_keys($old['allocations']),$ids) as $removed)$db->prepare('DELETE FROM meta WHERE key=?')->execute(['finance-batch-share:'.$removed]);
        foreach($alloc as $order=>$v)$put->execute(['finance-batch-share:'.$order,json_encode(['batch_id'=>$id,'amount_mnt'=>$v,'version'=>$entry['version']],JSON_THROW_ON_ERROR)]);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    admin_audit_write('admin-finance-batch-save',$id,json_encode(['before'=>$old,'after'=>$entry],JSON_UNESCAPED_UNICODE));return ['ok'=>true,'entry'=>$entry];
}
