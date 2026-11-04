<?php
declare(strict_types=1);
require_once __DIR__.'/cargo-tariff.php';
function warehouse_cargo_rates(array $o): array {
    // Quotes retain their exchange rate. The new policy applies when freight is recalculated.
    $s=$o['quote']['rates']??shipping_settings();
    return ['cny_rate'=>$s['cny_rate'],'cargo_tariff'=>cargo_tariff_policy()];
}
function warehouse_cargo_calculate(float $weight,float $volume,array $rates,int $pieces,array $dimensions=[]): array {
    return cargo_tariff_calculate($weight,$volume,$rates)+['pieces'=>$pieces,'dimensions'=>$dimensions,'calculated_at'=>gmdate('c')];
}
function warehouse_cargo_required(array $o): void {
    $l=logistics_state($o);
    if(isset($l['transport'])){if(empty($l['transport']['confirmed_at']))fail('Эрээнээс Улаанбаатар хүрэх тээврийн дүнг батална уу.',409);}
    elseif(!isset($l['measurement']))fail('Бодит хэмжилт шаардлагатай.',409);
}
