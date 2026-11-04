<?php
declare(strict_types=1);
// Owner-approved Erenhot -> Ulaanbaatar tariff, 2026-11-04. Historical invoices are not migrated.
function cargo_tariff_policy(): array {
    return ['version'=>2,'small_weight_limit_kg'=>70,'small_volume_limit_m3'=>1,'light_limit_kg'=>0.5,'light_mnt'=>1000,'small_per_kg_mnt'=>2500,'large_per_m3_cny'=>390,'large_per_tonne_cny'=>1300];
}
function cargo_tariff_calculate(float $weight,float $volume,array $rates): array {
    if(!is_finite($weight)||$weight<0.001||$weight>10000||!is_finite($volume)||$volume<=0||$volume>1000)fail('Нийт жин болон эзлэхүүнийг зөв оруулна уу.',400);
    $p=$rates['cargo_tariff']??null;
    if(!is_array($p)||($p['version']??null)!==2)fail('Тээврийн тарифыг шинэчилж дахин тооцоолно уу.',409);
    foreach(array_keys(cargo_tariff_policy()) as $key)if(!is_numeric($p[$key]??null)||!is_finite((float)$p[$key])||$p[$key]<=0)fail('Тээврийн тариф буруу.',409);
    $rate=$rates['cny_rate']??null;if(!is_numeric($rate)||!is_finite((float)$rate)||$rate<=0)fail('Юанийн ханш буруу.',409);
    // Exactly 70 kg is large; exactly 1 m3 can still be small. Do not round weights upward.
    $large=$weight>=$p['small_weight_limit_kg']||$volume>$p['small_volume_limit_m3'];
    $weightCny=$weight*$p['large_per_tonne_cny']/1000;$volumeCny=$volume*$p['large_per_m3_cny'];
    $basis=$large?($weightCny>=$volumeCny?'weight':'volume'):($weight<=$p['light_limit_kg']?'light':'weight');
    $cny=$large?max($weightCny,$volumeCny):null;
    $amount=$large?$cny*$rate:($basis==='light'?$p['light_mnt']:$weight*$p['small_per_kg_mnt']);
    $amount=(int)ceil(round($amount,8));if($amount<0||$amount>100000000)fail('Тээврийн дүн хэтэрсэн.',400);
    return ['method'=>'auto','category'=>$large?'large':'small','basis'=>$basis,'weight_kg'=>$weight,'volume_m3'=>$volume,'measure'=>$basis==='volume'?$volume:$weight,'billable_measure'=>$basis==='volume'?$volume:$weight,'weight_cny'=>$large?$weightCny:null,'volume_cny'=>$large?$volumeCny:null,'amount_cny'=>$cny,'amount_mnt'=>$amount,'currency'=>'MNT','rates'=>$rates];
}
