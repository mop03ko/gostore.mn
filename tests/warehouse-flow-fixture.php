<?php
declare(strict_types=1);
// Arrival alerts and item display for tests/warehouse-flow.mjs. Isolated test data only.
$dir=getenv('GOSTORE_DATA_DIR');
if(!$dir||!str_contains(str_replace('\\','/',$dir),'/tmp/warehouse-test-'))throw new RuntimeException('Isolated test directory required.');
require __DIR__.'/../server/bootstrap.php';
$save=function(string $id,callable $change){$o=order_row($id)['order'];$change($o);db()->prepare('UPDATE orders SET data=? WHERE id=?')->execute([json_encode($o,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$id]);};
$old=gmdate('c',time()-6*86400);$recent=gmdate('c',time()-86400);
// Late: a parcel known for six days that has not been scanned.
$save('GS-TEST-040',function(&$o)use($old,$recent){$o['status']='shipping';$o['inbound']['numbers']=[['no'=>'YT6000000000001','company'=>'圆通','source'=>'taoworld','added_at'=>$old],['no'=>'YT6000000000002','company'=>'圆通','source'=>'taoworld','added_at'=>$recent]];});
// Courier says delivered (signed), but the warehouse has not scanned it; recent, so not also "late".
$save('GS-TEST-041',function(&$o)use($recent){$o['status']='shipping';$o['inbound']['numbers']=[['no'=>'SF7000000000001','company'=>'顺丰','source'=>'taoworld','added_at'=>$recent]];
    $o['purchase']=['provider'=>'taoworld','domestic_tracking'=>['children'=>['1'=>['parcels'=>[['mail_no'=>'SF7000000000001','logistics_status'=>'SIGN','logistics_desc'=>'已签收','traces'=>[['status_desc'=>'已签收','standerd_desc'=>'快件已签收，签收人：二连仓库']]]]]]]];});
// Recent and unsigned: no alert.
$save('GS-TEST-042',function(&$o)use($recent){$o['status']='shipping';$o['inbound']['numbers']=[['no'=>'ZT8000000000001','company'=>'中通','source'=>'taoworld','added_at'=>$recent]];});
// Supplier photo and Chinese title/options for the Erenhot item view.
$save('GS-TEST-043',function(&$o){$o['supplier']['image']='https://img.alicdn.com/imgextra/i1/example.jpg';$o['supplier']['original_name']='双肩包 大容量 旅行';$o['supplier']['original_variant']='颜色: 黑色';});
echo "Warehouse flow fixtures created.\n";
