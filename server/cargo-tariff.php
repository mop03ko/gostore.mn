<?php
declare(strict_types=1);
// Owner-approved Erenhot -> Ulaanbaatar tariff. Historical invoices are not migrated.
// Version 3 (2026-11-10): small parcels cost 1,000 ₮ for each started 0.5 kg (0.5 kg = 1,000 ₮,
// 0.501 kg = 2,000 ₮). Version 2 (2026-11-06: ≤ 1 kg 1,000 ₮, then actual weight × 2,000 ₮/kg) still
// prices quotes that were saved with it. Large cargo is unchanged.
function cargo_tariff_policy(): array {
    return ['version'=>3,'small_weight_limit_kg'=>70,'small_volume_limit_m3'=>1,'small_step_kg'=>0.5,'small_step_mnt'=>1000,'large_per_m3_cny'=>390,'large_per_tonne_cny'=>1300];
}
function cargo_tariff_keys(int $version): array {
    $small=$version===2?['light_limit_kg','light_mnt','small_per_kg_mnt']:['small_step_kg','small_step_mnt'];
    return array_merge(['small_weight_limit_kg','small_volume_limit_m3'],$small,['large_per_m3_cny','large_per_tonne_cny']);
}
function cargo_tariff_calculate(float $weight,float $volume,array $rates): array {
    if(!is_finite($weight)||$weight<0.001||$weight>10000||!is_finite($volume)||$volume<=0||$volume>1000)fail('Нийт жин болон эзлэхүүнийг зөв оруулна уу.',400);
    $p=$rates['cargo_tariff']??null;$version=is_array($p)?($p['version']??null):null;
    if(!in_array($version,[2,3],true))fail('Тээврийн тарифыг шинэчилж дахин тооцоолно уу.',409);
    foreach(cargo_tariff_keys($version) as $key)if(!is_numeric($p[$key]??null)||!is_finite((float)$p[$key])||$p[$key]<=0)fail('Тээврийн тариф буруу.',409);
    $rate=$rates['cny_rate']??null;if(!is_numeric($rate)||!is_finite((float)$rate)||$rate<=0)fail('Юанийн ханш буруу.',409);
    // Exactly 70 kg is large; exactly 1 m3 can still be small.
    $large=$weight>=$p['small_weight_limit_kg']||$volume>$p['small_volume_limit_m3'];
    $weightCny=$weight*$p['large_per_tonne_cny']/1000;$volumeCny=$volume*$p['large_per_m3_cny'];
    $cny=$large?max($weightCny,$volumeCny):null;$billable=$weight;$steps=null;
    if($large){$basis=$weightCny>=$volumeCny?'weight':'volume';$amount=$cny*$rate;$billable=$basis==='volume'?$volume:$weight;}
    elseif($version===2){$basis=$weight<=$p['light_limit_kg']?'light':'weight';$amount=$basis==='light'?$p['light_mnt']:$weight*$p['small_per_kg_mnt'];}
    // Each started step counts; rounding guards against float noise (0.5/0.5 is exactly one step).
    else{$basis='weight';$steps=max(1,(int)ceil(round($weight/$p['small_step_kg'],8)));$amount=$steps*$p['small_step_mnt'];$billable=round($steps*$p['small_step_kg'],6);}
    $amount=(int)ceil(round($amount,8));if($amount<0||$amount>100000000)fail('Тээврийн дүн хэтэрсэн.',400);
    return ['method'=>'auto','category'=>$large?'large':'small','basis'=>$basis,'weight_kg'=>$weight,'volume_m3'=>$volume,'measure'=>$basis==='volume'?$volume:$weight,'billable_measure'=>$billable,'steps'=>$steps,'weight_cny'=>$large?$weightCny:null,'volume_cny'=>$large?$volumeCny:null,'amount_cny'=>$cny,'amount_mnt'=>$amount,'currency'=>'MNT','rates'=>$rates];
}
