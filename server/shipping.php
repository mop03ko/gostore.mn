<?php
declare(strict_types=1);

function shipping_settings(): array {
    $defaults=['cny_rate'=>550,'weight_step_kg'=>0.5,'weight_step_mnt'=>1500,'volume_small_cny'=>599,'volume_large_cny'=>399,'volume_threshold'=>1,'service_percent'=>0,'warehouse_address'=>'内蒙古锡林郭勒盟二连浩特市环宇商贸城10-16号','warehouse_phone'=>'18047981132','warehouse_contact_phone'=>'99889815','supplier_enabled'=>true,'api_daily_limit'=>40,'catalog_snapshot_enabled'=>false,'image_search_enabled'=>false,'domestic_default_cny'=>10,'service_fee_mnt'=>0,'payment_window_hours'=>24];
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['shipping_settings']);
    $settings=array_replace($defaults,json_decode($s->fetchColumn()?:'{}',true));
    $s->execute(['warehouse_profile_erenhot']);$profile=json_decode($s->fetchColumn()?:'{}',true);
    foreach(['address','phone','contact_phone'] as $key)if(isset($profile[$key]))$settings['warehouse_'.$key]=$profile[$key];
    return $settings;
}
function decimal_field(array $b,string $key,float $min,float $max): float {
    $v=$b[$key]??null;if((!is_int($v)&&!is_float($v))||!is_finite((float)$v)||$v<$min||$v>$max)fail('Тоо буруу: '.$key);
    return (float)$v;
}
function shipping_save(array $b): array {
    $s=[];
    foreach(['cny_rate'=>[1,100000],'weight_step_kg'=>[0.01,1000],'weight_step_mnt'=>[0,10000000],'volume_small_cny'=>[0,1000000],'volume_large_cny'=>[0,1000000],'volume_threshold'=>[0.001,1000],'service_percent'=>[0,100]] as $k=>$range)$s[$k]=decimal_field($b,$k,...$range);
    $existing=shipping_settings();
    // Checkout fields are optional so older admin clients keep their saved values.
    foreach(['domestic_default_cny'=>[0,10000],'service_fee_mnt'=>[0,10000000]] as $k=>$range)$s[$k]=array_key_exists($k,$b)?decimal_field($b,$k,...$range):$existing[$k];
    $s['payment_window_hours']=array_key_exists('payment_window_hours',$b)?int_field($b,'payment_window_hours',1,168):$existing['payment_window_hours'];
    foreach(['warehouse_address'=>1000,'warehouse_phone'=>80,'warehouse_contact_phone'=>80] as $key=>$max)$s[$key]=array_key_exists($key,$b)?str_field($b,$key,$max,false):$existing[$key];
    $s['catalog_snapshot_enabled']=array_key_exists('catalog_snapshot_enabled',$b)?$b['catalog_snapshot_enabled']===true:($existing['catalog_snapshot_enabled']??false);
    $s['image_search_enabled']=array_key_exists('image_search_enabled',$b)?$b['image_search_enabled']===true:($existing['image_search_enabled']??false);
    $s['supplier_enabled']=($b['supplier_enabled']??false)===true;$s['api_daily_limit']=int_field($b,'api_daily_limit',1,10000);$s['updated']=gmdate('c');
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($s,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);return shipping_settings();
}
function warehouse_profile(string $location): array {
    if(!in_array($location,['erenhot','ulaanbaatar'],true)&&(!function_exists('warehouse_definitions')||!isset(warehouse_definitions()[$location])))fail('Агуулахын байршил буруу.');
    $defaults=['name'=>$location==='erenhot'?'Эрээн агуулах':'Улаанбаатар агуулах','address'=>'','phone'=>'','contact_phone'=>'','hours'=>''];
    // Customers collect parcels at the Ulaanbaatar cargo office unless the admin saves another address.
    if($location==='ulaanbaatar')$defaults['address']="Улаанбаатар хот, Сүхбаатар дүүрэг, 3-р хороо, 5-р хороолол, 14б байр, 4 тоот.
Шуудангийн код: 14252-0024";
    if($location==='erenhot'){$s=shipping_settings();foreach(['address','phone','contact_phone'] as $key)$defaults[$key]=$s['warehouse_'.$key];}
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['warehouse_profile_'.$location]);
    return array_replace($defaults,json_decode($s->fetchColumn()?:'{}',true),['location'=>$location]);
}
function warehouse_profile_save(array $b,bool $withinTransaction=false): array {
    if(!$withinTransaction){admin_required();$db=db();$db->exec('BEGIN IMMEDIATE');try{$result=warehouse_profile_save($b,true);$db->exec('COMMIT');return $result;}catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}}

    admin_required();$location=str_field($b,'location',30);
    if(!in_array($location,['erenhot','ulaanbaatar'],true)&&(!function_exists('warehouse_definitions')||!isset(warehouse_definitions()[$location])))fail('Агуулахын байршил буруу.');
    $p=['name'=>str_field($b,'name',150),'address'=>str_field($b,'address',1000),'phone'=>str_field($b,'phone',80),'contact_phone'=>str_field($b,'contact_phone',80,false),'hours'=>str_field($b,'hours',300,false)];
    if(isset($b['city']))$p['city']=str_field($b,'city',100);
    if(function_exists('warehouse_catalog'))foreach(warehouse_catalog() as $existing)if($existing['location']!==$location&&mb_strtolower($existing['name'])===mb_strtolower($p['name']))fail('Ижил нэртэй агуулах бүртгэлтэй байна.',409);
    foreach(['phone','contact_phone'] as $key)if($p[$key]!==''&&!preg_match('/^[+0-9 ()-]{5,80}$/',$p[$key]))fail('Утасны дугаараа шалгана уу.');
    if(!in_array($location,['erenhot','ulaanbaatar'],true)){
        $d=warehouse_definitions()[$location];
        if(isset($b['city']))$d['city']=str_field($b,'city',100);
        if(array_key_exists('active',$b)){if(!is_bool($b['active']))fail('Агуулахын төлөв буруу.');$d['active']=$b['active'];}
        if(!$d['active']){
            foreach(db()->query('SELECT data FROM orders') as $row){$o=json_decode($row['data'],true);if(warehouse_order_location($o,$d['role'])===$location&&!in_array($o['status'],['completed','cancelled'],true))fail('Дуусаагүй захиалгатай агуулахыг идэвхгүй болгохгүй.',409);}
            // Rotate sessions even if the warehouse is later reactivated.
            $a=warehouse_account($location);$a['version']=bin2hex(random_bytes(16));db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute([warehouse_account_key($location),json_encode($a,JSON_THROW_ON_ERROR)]);
        }
        db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['warehouse_definition_'.$location,json_encode($d,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    }
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['warehouse_profile_'.$location,json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    return warehouse_profile($location);
}
function shipping_calculate(array $b,?array $s=null): array {
    $s??=shipping_settings();$goods=decimal_field($b,'goods_cny',0,1000000);$domestic=decimal_field($b,'domestic_cny',0,1000000);
    $method=str_field($b,'cargo_method',10);$measure=decimal_field($b,'cargo_measure',0.001,100000);
    if(!in_array($method,['weight','volume'],true))fail('Каргоны арга буруу.');
    $cargo=$method==='weight'?ceil(round($measure/$s['weight_step_kg'],9))*$s['weight_step_mnt']:$measure*($measure<$s['volume_threshold']?$s['volume_small_cny']:$s['volume_large_cny'])*$s['cny_rate'];
    $parts=['goods_mnt'=>(int)ceil(round($goods*$s['cny_rate'],8)),'domestic_mnt'=>(int)ceil(round($domestic*$s['cny_rate'],8)),'service_mnt'=>(int)ceil(round($goods*$s['cny_rate']*$s['service_percent']/100,8)),'cargo_mnt'=>(int)ceil(round($cargo,8))];
    $total=array_sum($parts);if($total>100000000)fail('Үнийн санал зөвшөөрөх дүнгээс хэтэрсэн.');
    return ['inputs'=>['goods_cny'=>$goods,'domestic_cny'=>$domestic,'cargo_method'=>$method,'cargo_measure'=>$measure],'rates'=>$s,'breakdown'=>$parts,'total'=>$total,'created'=>gmdate('c')];
}
function shipping_public(): array {
    $s=shipping_settings();unset($s['api_daily_limit'],$s['supplier_enabled'],$s['catalog_snapshot_enabled']);
    $pickup=warehouse_profile('ulaanbaatar');$s['pickup']=array_intersect_key($pickup,array_flip(['name','address','phone','hours']));return $s;
}
function warehouse_destination(array $order,array $input): array {
    $family=str_field($input,'family_name',100);$given=str_field($input,'customer',100);
    foreach([$family,$given] as $name)if(preg_match('/[\x00-\x1F\x7F]/u',$name))fail('Овог, нэр нэг мөрөнд байна.');
    $s=shipping_settings();if(trim($s['warehouse_address'])===''||trim($s['warehouse_phone'])==='')fail('Эрээн агуулахын мэдээллийг админ тохируулах шаардлагатай.',503);
    $recipient=$family.' '.$given.' / '.$order['id'];
    return ['family_name'=>$family,'given_name'=>$given,'recipient'=>$recipient,'order_code'=>$order['id'],'address'=>$s['warehouse_address'],'phone'=>$s['warehouse_phone'],'contact_phone'=>$s['warehouse_contact_phone'],
        'label'=>"收件人: ".$recipient."\n手机号: ".$s['warehouse_phone']."\n地址: ".$s['warehouse_address']."\n联系电话: ".$s['warehouse_contact_phone']."\n订单号: ".$order['id']];
}
