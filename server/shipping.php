<?php
declare(strict_types=1);

function shipping_settings(): array {
    $defaults=['cny_rate'=>550,'weight_step_kg'=>0.5,'weight_step_mnt'=>1500,'volume_small_cny'=>599,'volume_large_cny'=>399,'volume_threshold'=>1,'service_percent'=>0,'warehouse_address'=>'内蒙古锡林郭勒盟二连浩特市环宇商贸城10-16号','warehouse_phone'=>'18047981132','warehouse_contact_phone'=>'99889815','supplier_enabled'=>true,'api_daily_limit'=>40];
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['shipping_settings']);
    return array_replace($defaults,json_decode($s->fetchColumn()?:'{}',true));
}
function decimal_field(array $b,string $key,float $min,float $max): float {
    $v=$b[$key]??null;if((!is_int($v)&&!is_float($v))||!is_finite((float)$v)||$v<$min||$v>$max)fail('Тоо буруу: '.$key);
    return (float)$v;
}
function shipping_save(array $b): array {
    $s=[];
    foreach(['cny_rate'=>[1,100000],'weight_step_kg'=>[0.01,1000],'weight_step_mnt'=>[0,10000000],'volume_small_cny'=>[0,1000000],'volume_large_cny'=>[0,1000000],'volume_threshold'=>[0.001,1000],'service_percent'=>[0,100]] as $k=>$range)$s[$k]=decimal_field($b,$k,...$range);
    $s['warehouse_address']=str_field($b,'warehouse_address',1000,false);$s['warehouse_phone']=str_field($b,'warehouse_phone',80,false);
    $s['warehouse_contact_phone']=str_field($b,'warehouse_contact_phone',80,false);
    $s['supplier_enabled']=($b['supplier_enabled']??false)===true;$s['api_daily_limit']=int_field($b,'api_daily_limit',1,10000);$s['updated']=gmdate('c');
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($s,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);return $s;
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
    $s=shipping_settings();unset($s['api_daily_limit'],$s['supplier_enabled']);return $s;
}
function warehouse_destination(array $order,array $input): array {
    $family=str_field($input,'family_name',100);$given=str_field($input,'customer',100);
    foreach([$family,$given] as $name)if(preg_match('/[\x00-\x1F\x7F]/u',$name))fail('Овог, нэр нэг мөрөнд байна.');
    $s=shipping_settings();if(trim($s['warehouse_address'])===''||trim($s['warehouse_phone'])==='')fail('Эрээн агуулахын мэдээллийг админ тохируулах шаардлагатай.',503);
    $recipient=$family.' '.$given.' / '.$order['id'];
    return ['family_name'=>$family,'given_name'=>$given,'recipient'=>$recipient,'order_code'=>$order['id'],'address'=>$s['warehouse_address'],'phone'=>$s['warehouse_phone'],'contact_phone'=>$s['warehouse_contact_phone'],
        'label'=>"收件人: ".$recipient."\n手机号: ".$s['warehouse_phone']."\n地址: ".$s['warehouse_address']."\n联系电话: ".$s['warehouse_contact_phone']."\n订单号: ".$order['id']];
}
