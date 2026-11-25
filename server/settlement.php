<?php
declare(strict_types=1);

function settlement_freight_paid(array $o): int {
    return (int)($o['freight']['paid_amount']??0)+array_sum(array_column($o['freight_receipts']??[],'amount'));
}
function settlement_summary(array $o): array {
    $s=$o['settlement']??null;
    // Refunds the admin has sent back (order-refund) reduce what counts as paid.
    $refunded=array_sum(array_map(fn($r)=>(int)($r['amount']??0),$o['refunds']??[]));
    $paid=(($o['paid']??false)?(int)($o['amount']??0):0)+settlement_freight_paid($o)-$refunded;
    $total=$s['total']??(int)($o['amount']??0);
    return ['finalized'=>$s!==null,'total'=>$total,'paid'=>$paid,'refunded'=>$refunded,'due'=>max(0,$total-$paid),'refund_due'=>max(0,$paid-$total),'breakdown'=>$s['breakdown']??($o['quote']['breakdown']??[]),'confirmed_at'=>$s['confirmed_at']??null];
}
