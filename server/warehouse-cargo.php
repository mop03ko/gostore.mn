<?php
declare(strict_types=1);
function warehouse_cargo_rates(array $o): array {
    return array_intersect_key($o['quote']['rates']??shipping_settings(),array_flip(['cny_rate','weight_step_kg','weight_step_mnt','volume_small_cny','volume_large_cny','volume_threshold']));
}
function warehouse_cargo_calculate(string $method,float $measure,array $rates,int $pieces,array $dimensions=[]): array {
    if(!in_array($method,['weight','volume'],true)||!is_finite($measure)||$measure<=0)fail('Тээврийн хэмжилт буруу.',400);
    foreach(['cny_rate','weight_step_kg','weight_step_mnt','volume_small_cny','volume_large_cny','volume_threshold'] as $k)if(!is_numeric($rates[$k]??null)||!is_finite((float)$rates[$k])||$rates[$k]<=0)fail('Тээврийн тарифыг админ шалгана уу.',409);
    $billable=$method==='weight'?ceil(round($measure/$rates['weight_step_kg'],9))*$rates['weight_step_kg']:$measure;
    $amount=$method==='weight'?ceil(round($measure/$rates['weight_step_kg'],9))*$rates['weight_step_mnt']:$measure*($measure<$rates['volume_threshold']?$rates['volume_small_cny']:$rates['volume_large_cny'])*$rates['cny_rate'];
    if(!is_finite($amount)||$amount>100000000)fail('Тээврийн дүн хэтэрсэн.',400);
    return ['method'=>$method,'measure'=>$measure,'billable_measure'=>$billable,'pieces'=>$pieces,'dimensions'=>$dimensions,'rates'=>$rates,'amount_mnt'=>(int)ceil($amount),'currency'=>'MNT','calculated_at'=>gmdate('c')];
}
function warehouse_cargo_required(array $o): void {
    $l=logistics_state($o);
    if(isset($l['transport'])){if(empty($l['transport']['confirmed_at']))fail('Эрээнээс Улаанбаатар хүрэх тээврийн дүнг батална уу.',409);}
    elseif(!isset($l['measurement']))fail('Бодит хэмжилт шаардлагатай.',409);
}
