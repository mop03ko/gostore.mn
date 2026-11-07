<?php
declare(strict_types=1);
// Admin directory of registered customers: list, details and profile edits.
const ADMIN_CUSTOMERS_PAGE=50;

function admin_customer_rows(?string $id=null): array {
    $sql='SELECT c.id,c.email,c.name,c.phone,c.address,c.created,c.updated,p.phone AS login_phone,
        (SELECT COUNT(*) FROM customer_orders co WHERE co.customer_id=c.id) AS orders,
        (SELECT MAX(co.created) FROM customer_orders co WHERE co.customer_id=c.id) AS last_order
        FROM customers c LEFT JOIN customer_phone_auth p ON p.customer_id=c.id';
    if($id!==null){$s=db()->prepare($sql.' WHERE c.id=?');$s->execute([$id]);return $s->fetchAll();}
    return db()->query($sql.' ORDER BY c.created DESC,c.rowid DESC')->fetchAll();
}
function admin_customer_item(array $c): array {
    // customer-delete replaces the profile with these placeholders; PIN-only accounts get a placeholder email.
    $deleted=str_starts_with($c['email'],'deleted-')&&str_ends_with($c['email'],'@invalid.example');
    $email=$deleted||str_ends_with($c['email'],'@phone.gostore.invalid')?'':$c['email'];
    $pin=$c['login_phone']!==null;
    $login=$deleted?'deleted':($pin?($email!==''?'both':'phone'):($email!==''?'email':'none'));
    return ['id'=>$c['id'],'name'=>$c['name'],'email'=>$email,'phone'=>$c['phone'],'login_phone'=>$c['login_phone']??'','login'=>$login,'created'=>$c['created'],'updated'=>$c['updated'],'orders'=>(int)$c['orders'],'last_order'=>$c['last_order']];
}
function admin_customers(array $q): array {
    $search=mb_strtolower(str_field($q,'q',100,false));$digits=preg_replace('/\D/','',$search);
    $filter=str_field($q,'filter',10,false)?:'active';
    if(!in_array($filter,['active','phone','email','deleted'],true))fail('Шүүлтүүр буруу.');
    $offset=filter_var($q['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>1000000]]);
    if($offset===false)fail('Хуудасны дугаар буруу.');
    $all=array_map('admin_customer_item',admin_customer_rows());
    $week=gmdate('c',time()-7*86400);$stats=['active'=>0,'phone'=>0,'email'=>0,'deleted'=>0,'week'=>0];
    foreach($all as $c){
        if($c['login']==='deleted'){$stats['deleted']++;continue;}
        $stats['active']++;$stats['week']+=$c['created']>=$week?1:0;
        $stats['phone']+=in_array($c['login'],['phone','both'],true)?1:0;$stats['email']+=in_array($c['login'],['email','both'],true)?1:0;
    }
    // Filtered in PHP: SQLite LIKE/lower() fold ASCII only, and names are mostly Cyrillic.
    $rows=array_values(array_filter($all,function(array $c)use($filter,$search,$digits): bool {
        if(($filter==='deleted')!==($c['login']==='deleted'))return false;
        if($filter==='phone'&&!in_array($c['login'],['phone','both'],true))return false;
        if($filter==='email'&&!in_array($c['login'],['email','both'],true))return false;
        if($search===''||str_contains(mb_strtolower($c['name']."\n".$c['email']."\n".$c['id']),$search))return true;
        if(strlen($digits)<3)return false;
        foreach([$c['phone'],$c['login_phone']] as $phone)if(str_contains(preg_replace('/\D/','',$phone),$digits))return true;
        return false;
    }));
    return ['customers'=>array_slice($rows,$offset,ADMIN_CUSTOMERS_PAGE),'total'=>count($rows),'offset'=>$offset,'page_size'=>ADMIN_CUSTOMERS_PAGE,'more'=>$offset+ADMIN_CUSTOMERS_PAGE<count($rows),'stats'=>$stats];
}
function admin_customer_record(string $id): array {
    $rows=admin_customer_rows($id);if(!$rows)fail('Хэрэглэгч олдсонгүй.',404);return $rows[0];
}
function admin_customer_detail(string $id): array {
    $row=admin_customer_record($id);$customer=admin_customer_item($row);
    $s=db()->prepare('SELECT label,recipient,phone,address,is_default FROM customer_addresses WHERE customer_id=? ORDER BY is_default DESC,created DESC,rowid DESC');$s->execute([$id]);
    $addresses=array_map(fn($a)=>['label'=>$a['label'],'recipient'=>$a['recipient'],'phone'=>$a['phone'],'address'=>$a['address'],'is_default'=>(bool)$a['is_default']],$s->fetchAll());
    // Accounts from before the address book keep their only address on the profile row.
    if(!$addresses&&trim($row['address'])!=='')$addresses[]=['label'=>'Профайлын хаяг','recipient'=>$row['name'],'phone'=>$row['phone'],'address'=>$row['address'],'is_default'=>true];
    $s=db()->prepare('SELECT o.data FROM orders o JOIN customer_orders co ON co.order_id=o.id WHERE co.customer_id=? ORDER BY o.created DESC,o.id DESC LIMIT 20');$s->execute([$id]);
    $orders=[];
    foreach($s->fetchAll() as $r){
        $o=json_decode($r['data'],true);if(!is_array($o))continue;
        $orders[]=['id'=>(string)$o['id'],'title'=>(string)($o['title']??''),'status'=>(string)($o['status']??''),'amount'=>(int)($o['amount']??0),'paid'=>(bool)($o['paid']??false),'created'=>(string)($o['created']??'')];
    }
    return ['customer'=>$customer,'addresses'=>$addresses,'orders'=>$orders];
}
function admin_customer_save(array $b): array {
    $id=str_field($b,'id',64);$name=str_field($b,'name',100);$phone=customer_phone($b);
    if(preg_match('/[\x00-\x1F\x7F]/u',$name))fail('Нэрийг нэг мөрөнд бичнэ үү.');
    $expected=$b['expected']??null;if(!is_array($expected))fail('Хэрэглэгчийг дахин нээж засна уу.');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $row=admin_customer_record($id);$current=admin_customer_item($row);
        if($current['login']==='deleted')fail('Устгагдсан бүртгэлийг засахгүй.',409);
        // The customer may have edited the profile since the admin opened it.
        foreach(['name','email','phone'] as $key)if(($expected[$key]??null)!==$current[$key])fail('Хэрэглэгч мэдээллээ саяхан өөрчилсөн байна. Дахин нээж засна уу.',409);
        $email=$row['email'];
        if($current['email']!==''){
            $email=customer_email($b);
            if(preg_match('/@(?:phone\.gostore\.invalid|invalid\.example)$/i',$email))fail('Энэ имэйл хаягийг ашиглахгүй.');
        }elseif(trim((string)($b['email']??''))!=='')fail('Утсаар бүртгүүлсэн хэрэглэгчид имэйл нэмэхгүй.',409);
        if($current['login_phone']!==''){
            // The login phone was proven by SMS; only the customer can replace it.
            if($phone===''||verify_mn_phone($phone)!==$current['login_phone'])fail('Нэвтрэх утсыг хэрэглэгч өөрөө SMS-ээр баталгаажуулж солино.',409);
            $phone=$current['login_phone'];
        }
        if($name!==$row['name']||$email!==$row['email']||$phone!==$row['phone']){
            try{$db->prepare('UPDATE customers SET name=?,email=?,phone=?,updated=? WHERE id=?')->execute([$name,$email,$phone,gmdate('c'),$id]);}
            catch(PDOException $e){if((string)$e->getCode()==='23000')fail('Энэ имэйл өөр бүртгэлд ашиглагдаж байна.',409);throw $e;}
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return admin_customer_detail($id);
}
