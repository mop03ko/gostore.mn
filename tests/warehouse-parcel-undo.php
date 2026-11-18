<?php
declare(strict_types=1);
require __DIR__.'/../server/warehouse-flow.php';
function check(bool $ok): void { if(!$ok)throw new RuntimeException('Parcel undo policy failed'); }
foreach(['confirmed','shipping','erenhot'] as $status){
    $o=['status'=>$status];check(warehouse_parcel_undo_allowed($o));
    foreach([['batch_id'=>'GB-TEST'],['settlement'=>['total'=>1000]],['freight'=>['invoice'=>['state'=>'pending']]]] as $lock)check(!warehouse_parcel_undo_allowed($o+$lock));
}
foreach(['pending','cancelled','erenhot_ready','erenhot_dispatched','zamyn_uud','ulaanbaatar','completed'] as $status)check(!warehouse_parcel_undo_allowed(['status'=>$status]));
echo "PASS parcel undo policy: waiting/received only, packing and billing locks.\n";
