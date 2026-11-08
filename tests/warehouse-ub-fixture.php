<?php
declare(strict_types=1);
// Ulaanbaatar one-step flow fixtures for tests/warehouse-ub-flow.mjs. Isolated test data only.
// setup: checkout orders GS-TEST-050…054 · pay <id>: the customer pays the balance · age <id> <days>: sorted N days ago
// · remind <unix>: run the daily reminders at that time.
$dir=getenv('GOSTORE_DATA_DIR');
if(!$dir||!str_contains(str_replace('\\','/',$dir),'/tmp/warehouse-test-'))throw new RuntimeException('Isolated test directory required.');
require __DIR__.'/../server/bootstrap.php';
$save=function(string $id,callable $change){$o=order_row($id)['order'];$change($o);db()->prepare('UPDATE orders SET data=? WHERE id=?')->execute([json_encode($o,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$id]);};
[$mode,$arg,$extra]=[$argv[1]??'',$argv[2]??'',$argv[3]??''];
if($mode==='setup'){
    $orders=['GS-TEST-050'=>['pickup','9911 5050',false],'GS-TEST-051'=>['pickup','99115050',false],'GS-TEST-052'=>['delivery','88001122',false],'GS-TEST-053'=>['pickup','88003344',true],'GS-TEST-054'=>['pickup','88005566',false]];
    foreach($orders as $id=>[$method,$phone,$later])$save($id,function(&$o)use($method,$phone,$later){
        $o['type']='checkout';unset($o['supplier']);$o['items']=[['name'=>'Тест үүргэвч','variant'=>'Хар','qty'=>2,'price'=>49500,'unit_cny'=>90,'sku'=>'test-sku']];$o['phone']=$phone;$o['fulfillment_request']=['method'=>$method];
        $parts=['goods_mnt'=>90000,'domestic_mnt'=>$later?0:4000,'service_mnt'=>$later?9000:5000,'cargo_mnt'=>0];
        $o['quote']=['breakdown'=>$parts,'total'=>99000,'auto'=>true,'cargo_later'=>true,'domestic_later'=>$later];$o['amount']=99000;$o['paid']=true;
    });
    echo "ok\n";exit;
}
if($mode==='pay'){
    $save($arg,function(&$o){
        $due=max(0,(int)$o['settlement']['total']-(int)$o['amount']-(int)($o['freight']['paid_amount']??0));
        $o['freight']=['amount'=>$due,'paid_amount'=>$due,'paid_at'=>gmdate('c'),'callback_token'=>str_repeat('a',64),'invoice'=>['state'=>'ready','sender_invoice_no'=>$o['id'].'-F-test','id'=>'test-invoice','qr_image'=>'','urls'=>[]]];
    });
    echo "ok\n";exit;
}
if($mode==='age'){$save($arg,function(&$o)use($extra){$o['fulfillment']['sorted_at']=gmdate('c',time()-(int)$extra*86400-60);});echo "ok\n";exit;}
if($mode==='remind'){
    // Same files as server/daily-worker.php loads.
    require_once __DIR__.'/../server/shipping.php';require_once __DIR__.'/../server/warehouse.php';require_once __DIR__.'/../server/logistics.php';
    echo warehouse_pickup_reminders((int)$arg),"\n";exit;
}
throw new RuntimeException('Unknown fixture mode.');
