<?php
declare(strict_types=1);
$dir=getenv('GOSTORE_DATA_DIR');
if(!$dir||!str_contains(str_replace('\\','/',$dir),'/tmp/warehouse-test-'))throw new RuntimeException('Isolated test directory required.');
require __DIR__.'/../server/bootstrap.php';
foreach(['GS-TEST-021'=>true,'GS-TEST-022'=>false] as $id=>$confirmed){
    $o=order_row($id)['order'];$o['status']=$confirmed?'ready_pickup':'erenhot';
    $q=['method'=>'weight','measure'=>1,'billable_measure'=>1,'amount_mnt'=>3000,'currency'=>'MNT','pieces'=>2,'dimensions'=>[],'rates'=>['cny_rate'=>550,'weight_step_kg'=>0.5,'weight_step_mnt'=>1500,'volume_small_cny'=>599,'volume_large_cny'=>399,'volume_threshold'=>1],'calculated_at'=>'2026-11-03T00:00:00Z'];
    if($confirmed)$q['confirmed_at']='2026-11-03T00:01:00Z';
    $o['logistics']=['version'=>1,'transport'=>$q];
    db()->prepare('UPDATE orders SET data=? WHERE id=?')->execute([json_encode($o,JSON_THROW_ON_ERROR),$id]);
}
