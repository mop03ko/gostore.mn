<?php
declare(strict_types=1);
require_once __DIR__.'/warehouse-flow.php';

function workspace_tasks(array $order,array $bill,array $parcels): array {
    if(!empty($order['demo'])||$order['status']==='cancelled')return [];
    $tasks=[];
    if(!empty($order['paid'])&&in_array($order['purchase']['state']??'',['review','preflight_review','failed'],true))$tasks[]='purchase';
    if($parcels['arrived']>0&&$parcels['missing']&&in_array($order['status'],['confirmed','shipping','erenhot'],true))$tasks[]='parcel';
    if(($order['status']==='completed'||order_display_status($order)==='completed')&&workspace_transport_due($order,$bill))$tasks[]='balance';
    return $tasks;
}

function workspace_transport_due(array $order,array $bill): bool {
    return $order['status']!=='cancelled'&&!empty($bill['finalized'])&&$bill['due']>0
        && (!empty($order['paid'])||((int)$order['amount']===0&&($order['type']??'')==='forwarding'))
        && (($bill['breakdown']['cargo_mnt']??0)>0||($bill['breakdown']['delivery_mnt']??0)>0);
}

function workspace_staff(): array {
    admin_users_schema();
    return array_merge([['id'=>'owner','name'=>'Эзэмшигч']],db()->query("SELECT id,name FROM admin_users WHERE active=1 AND role IN ('owner','operator') ORDER BY name")->fetchAll());
}

function workspace_order_row(array $order,array $bill,array $branches): array {
    $location=warehouse_order_location($order,'ulaanbaatar');
    return ['id'=>$order['id'],'title'=>$order['title']??'','customer'=>$order['customer']??'','phone'=>$order['phone']??'',
        'created'=>$order['created'],'status'=>$order['status'],'display_status'=>order_display_status($order),
        'location'=>$location,'branch'=>$branches[$location]??$location,'amount'=>(int)$order['amount'],'paid'=>!empty($order['paid']),
        'transport_due'=>workspace_transport_due($order,$bill),'due'=>$bill['due'],'demo'=>!empty($order['demo'])];
}

function workspace_roster(): array {
    $branches=[];
    foreach(warehouse_catalog() as $id=>$profile)if($profile['role']==='ulaanbaatar')$branches[$id]=$profile['name']??$profile['city'];
    return $branches;
}

function workspace_query(array $q): array {
    if(($q['id']??'')!=='')return workspace_detail(str_field($q,'id',50));
    $mode=$q['view']??'orders';
    if(!in_array($mode,['orders','tasks'],true))fail('Жагсаалтын төрөл буруу.');
    $filter=str_field($q,'filter',20,false);
    if(!in_array($filter,['','due','ready','review','purchase','parcel','balance'],true))fail('Шүүлтүүр буруу.');
    $branch=str_field($q,'branch',32,false);$term=mb_strtolower(str_field($q,'q',100,false),'UTF-8');
    $dateFrom=str_field($q,'from',10,false);$dateTo=str_field($q,'to',10,false);
    foreach([$dateFrom,$dateTo] as $value)if($value!==''&&(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$value)||!($d=DateTimeImmutable::createFromFormat('!Y-m-d',$value,new DateTimeZone('Asia/Ulaanbaatar')))||$d->format('Y-m-d')!==$value))fail('Огноо буруу.');
    if($dateFrom&&$dateTo&&$dateFrom>$dateTo)fail('Эхлэх огноо дуусах огнооноос хойш байна.');
    $page=max(1,min(100000,(int)($q['page']??1)));$size=25;$offset=($page-1)*$size;
    $branches=workspace_roster();$matches=0;$rows=[];$counts=['all'=>0,'due'=>0,'ready'=>0,'review'=>0];
    $from=$dateFrom?gmdate('c',strtotime($dateFrom.'T00:00:00+08:00')):'';
    $to=$dateTo?gmdate('c',strtotime($dateTo.'T00:00:00+08:00')+86400):'';
    $conditions=[];$params=[];
    if($from){$conditions[]='created>=?';$params[]=$from;}
    if($to){$conditions[]='created<?';$params[]=$to;}
    if(preg_match('/^gs-[a-z0-9-]{6,45}$/D',$term)){
        $lookup=db()->prepare('SELECT id FROM orders WHERE id=?');$lookup->execute([strtoupper($term)]);
        if($lookup->fetchColumn()){$conditions[]='id=?';$params[]=strtoupper($term);}
    }
    $sql='SELECT data FROM orders'.($conditions?' WHERE '.implode(' AND ',$conditions):'').' ORDER BY created '.(($q['sort']??'')==='old'?'ASC,id ASC':'DESC,id DESC');
    $s=db()->prepare($sql);$s->execute($params);
    while(($raw=$s->fetchColumn())!==false){
        $order=json_decode($raw,true);
        if(!is_array($order)||($branch!==''&&warehouse_order_location($order,'ulaanbaatar')!==$branch))continue;
        if($term!==''&&!str_contains(mb_strtolower(implode(' ',[$order['id'],$order['title']??'',$order['customer']??'',$order['phone']??'']),'UTF-8'),$term)
            &&!(ctype_digit($term)&&strlen($term)>=4&&str_contains(preg_replace('/\D/','',$order['phone']??''),$term)))continue;
        $bill=settlement_summary($order);
        if($mode==='orders'){
            $tags=['all'=>true,'due'=>workspace_transport_due($order,$bill),'ready'=>in_array($order['status'],['ready_pickup','ready_delivery'],true),
                'review'=>in_array($order['purchase']['state']??'',['review','preflight_review','failed'],true)];
            foreach($tags as $tag=>$present)if($present)$counts[$tag]++;
            if($filter!==''&&empty($tags[$filter]))continue;
            if($matches++>=$offset&&count($rows)<$size)$rows[]=workspace_order_row($order,$bill,$branches);
        }else{
            $parcels=warehouse_parcels($order);
            foreach(workspace_tasks($order,$bill,$parcels) as $task){
                if($filter!==''&&$task!==$filter)continue;
                if($matches++<$offset||count($rows)>=$size)continue;
                $assignment=admin_meta('workspace-task:'.$order['id'].':'.$task);
                $rows[]=workspace_order_row($order,$bill,$branches)+['task'=>$task,'assignee'=>$assignment['assignee']??null,
                    'arrived'=>$parcels['arrived'],'pieces'=>$parcels['total'],'since'=>$order['purchase']['updated_at']??$order['created']];
            }
        }
    }
    $s->closeCursor();
    return ['rows'=>$rows,'total'=>$matches,'size'=>$size,'counts'=>$counts,'branches'=>$branches,
        'staff'=>$mode==='tasks'?workspace_staff():[],'statuses'=>ORDER_STATUSES];
}

function workspace_detail(string $id): array {
    $order=order_row($id)['order'];
    $bill=settlement_summary($order);$freight=$order['freight']??[];
    $root=isset($order['shipment_parent'])?order_row($order['shipment_parent'])['order']:$order;
    $parcels=warehouse_parcels($order);
    $shipments=shipment_summary($root);
    foreach($shipments as &$part)$part['batch_id']=order_row($part['id'])['order']['batch_id']??null;
    unset($part);
    $source=warehouse_order_location($order,'erenhot');$operable=warehouse_order_operable($order,$source);
    $status=$order['status'];
    return ['order'=>workspace_order_row($order,$bill,workspace_roster()),'billing'=>$bill,
        'initial_paid_at'=>$order['paid_at']??null,'qpay_paid'=>(int)($freight['paid_amount']??0),'qpay_paid_at'=>$freight['paid_at']??null,
        'qpay_open'=>($freight['invoice']['state']??null)==='ready'&&(int)($freight['paid_amount']??0)<(int)($freight['amount']??0),
        'receipts'=>$order['freight_receipts']??[],'shipments'=>$shipments,'parcel_list'=>$parcels,
        'batch_id'=>$order['batch_id']??null,'parent_id'=>$order['shipment_parent']??null,'version'=>logistics_state($order)['version'],
        'can_split'=>$operable&&shipment_split_allowed($order)&&$parcels['total']>1&&$parcels['arrived']>0,
        'can_arrive'=>$operable&&in_array($status,['confirmed','shipping','erenhot'],true),
        'can_batch'=>$operable&&$status==='erenhot'&&empty($order['batch_id'])&&!$parcels['missing'],
        'history'=>array_map(fn($event)=>array_intersect_key($event,array_flip(['at','status','event'])),array_values($order['history']??[]))];
}

function workspace_assign(array $b): array {
    $id=str_field($b,'id',50);$task=str_field($b,'task',12);$assignee=str_field($b,'assignee',45,false);
    $staff=array_column(workspace_staff(),'id');
    if($assignee!==''&&!in_array($assignee,$staff,true))fail('Хариуцагч идэвхтэй оператор байх ёстой.');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $order=order_row($id)['order'];
        if(!in_array($task,workspace_tasks($order,settlement_summary($order),warehouse_parcels($order)),true))fail('Энэ ажил шийдэгдсэн эсвэл өөрчлөгдсөн байна.',409);
        admin_meta_put('workspace-task:'.$id.':'.$task,['assignee'=>$assignee?:null,'at'=>gmdate('c')]);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return ['ok'=>true];
}

function workspace_logistics(string $action,array $b): never {
    $id=str_field($b,'id',50);$order=order_row($id)['order'];
    $source=warehouse_order_location($order,'erenhot');
    $actor=['actor'=>'admin','actor_location'=>$source,'actor_email'=>admin_current()['email']];
    if($action==='admin-workspace-arrive'){warehouse_parcel_arrive($b,$source,$actor);json_out(workspace_detail($id));}
    if($action==='admin-workspace-split'){
        $result=warehouse_split_order(['mode'=>'parcels']+$b,$source,$actor);
        json_out(workspace_detail($id)+['new_part'=>$result['part']['id']],201);
    }
    $destination=warehouse_order_location($order,'ulaanbaatar');
    warehouse_batch_post('warehouse-batch-create',['order_ids'=>[$id],'destination'=>$destination,'token'=>str_field($b,'token',64)],$source,$actor);
}
