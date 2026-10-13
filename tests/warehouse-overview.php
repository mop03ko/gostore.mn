<?php
declare(strict_types=1);
require __DIR__.'/../server/warehouse.php';
function check_overview(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$states=['new','confirmed','shipping','erenhot','erenhot_ready','erenhot_dispatched','zamyn_uud','ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery','completed','cancelled'];
foreach($states as $status){
    $totals=array_fill_keys(['ordered','erenhot','ulaanbaatar'],['orders'=>0,'quantity'=>0]);
    warehouse_overview_add($totals,['status'=>$status,'route'=>['Эрээн','Улаанбаатар'],'items'=>[['qty'=>2],['qty'=>3]]]);
    $expected=$status==='cancelled'?0:1;
    check_overview($totals['ordered']===['orders'=>$expected,'quantity'=>$expected*5],$status.' total');
    $cn=in_array($status,['erenhot','erenhot_ready'],true)?1:0;
    $ub=in_array($status,['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'],true)?1:0;
    check_overview($totals['erenhot']===['orders'=>$cn,'quantity'=>$cn*5],$status.' Erenhot stock');
    check_overview($totals['ulaanbaatar']===['orders'=>$ub,'quantity'=>$ub*5],$status.' UB stock');
}
$totals=array_fill_keys(['ordered','erenhot','ulaanbaatar'],['orders'=>0,'quantity'=>0]);
warehouse_overview_add($totals,['status'=>'erenhot','route'=>['Эрээн'],'supplier'=>['qty'=>7],'items'=>[['qty'=>7]],'logistics'=>['measurement'=>['pieces'=>1]]]);
warehouse_overview_add($totals,['status'=>'confirmed','items'=>[['qty'=>3],['qty'=>2]]]);
warehouse_overview_add($totals,['status'=>'ulaanbaatar','route'=>[],'items'=>[['qty'=>4]]]);
check_overview($totals['ordered']===['orders'=>3,'quantity'=>16],'Supplier counted once and local website orders included');
check_overview($totals['erenhot']===['orders'=>1,'quantity'=>7],'Count goods quantity, not shipping package count');
check_overview($totals['ulaanbaatar']===['orders'=>0,'quantity'=>0],'Warehouse route required');
echo "PASS: overview status matrix, cancellation/completion, current warehouse stock, mixed item quantities, supplier deduplication and route scope.\n";
