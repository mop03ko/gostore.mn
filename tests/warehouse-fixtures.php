<?php
declare(strict_types=1);
// Run only with a disposable warehouse test directory.
$dir=getenv('GOSTORE_DATA_DIR');
if(!$dir||!str_contains(str_replace('\\','/',$dir),'/tmp/warehouse-test-'))throw new RuntimeException('Isolated warehouse test data required.');
require __DIR__.'/../server/bootstrap.php';
$base=['title'=>'Тест ачаа','customer'=>'Бат Тамир','phone'=>'99112233','notes'=>'PRIVATE ADDRESS','internal_note'=>'PRIVATE NOTE','callback_token'=>'PRIVATE CALLBACK','status'=>'confirmed','amount'=>99000,'paid'=>true,'created'=>'2026-01-01T00:00:00+00:00','type'=>'supplier','route'=>['Эрээн','Замын-Үүд','Улаанбаатар'],'supplier'=>['name'=>'Тест үүргэвч','variant'=>'Хар','qty'=>2,'goods_cny'=>100],'invoice'=>['raw'=>['secret'=>'PRIVATE INVOICE']]];
$insert=db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)');
foreach(range(0,54) as $i){$o=$base;$o['id']=$i===0?'GS-261013-ABCDEF12':'GS-TEST-'.str_pad((string)$i,3,'0',STR_PAD_LEFT);$token=hash('sha256','warehouse-fixture-'.$i);$hash=hash('sha256',$token);$insert->execute([$o['id'],$hash,$hash,json_encode($o,JSON_UNESCAPED_UNICODE),$o['created'],$o['created']]);}
$local=$base;$local['id']='GS-LOCAL-OLD';$local['type']='cart';unset($local['route'],$local['supplier'],$local['invoice']);$local['items']=[['name'=>'Хуучин бэлэн бараа','qty'=>1,'variant'=>'Стандарт']];$token=hash('sha256','local-fixture');$hash=hash('sha256',$token);$insert->execute([$local['id'],$hash,$hash,json_encode($local,JSON_UNESCAPED_UNICODE),$local['created'],$local['created']]);
echo "Warehouse fixtures created.\n";
