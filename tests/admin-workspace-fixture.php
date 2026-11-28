<?php
declare(strict_types=1);
$dir=getenv('GOSTORE_DATA_DIR');
if(!$dir||!str_contains(str_replace('\\','/',$dir),'/tmp/warehouse-test-'))throw new RuntimeException('Test directory required');
require __DIR__.'/../server/bootstrap.php';
require_once __DIR__.'/../server/admin-users.php';

$db=db();
$add=$db->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)');
$db->exec('BEGIN IMMEDIATE');
try{
    $base=order_row('GS-TEST-001')['order'];
    $make=static function(string $id,array $extra)use($base,$add){
        $order=['id'=>$id]+$extra+$base;
        $add->execute([$id,hash('sha256',$id),hash('sha256','request'.$id),json_encode($order,JSON_THROW_ON_ERROR),$order['created'],$order['created']]);
    };
    $made='2026-10-01T09:00:00+00:00';
    $make('GS-WORKSPACE-OLD',['created'=>'2025-01-01T00:00:00+00:00','title'=>'Архивын захиалга']);
    for($i=0;$i<1001;$i++)$make('GS-WS-FILL-'.$i,['created'=>$made,'demo'=>true]);
    $bill=['total'=>103500,'breakdown'=>['cargo_mnt'=>3500,'delivery_mnt'=>1000],'confirmed_at'=>$made];
    $make('GS-WORKSPACE-DUE',['created'=>$made,'status'=>'completed','settlement'=>$bill,'title'=>'Үлдэгдэлтэй хүргэлт']);
    $make('GS-WORKSPACE-DUE2',['created'=>$made,'status'=>'completed','settlement'=>$bill,'title'=>'Хоёр дахь үлдэгдэл']);
    $numbers=array_map(fn($no)=>['no'=>$no,'company'=>'SF','added_at'=>$made],['SF100000001','SF100000002','SF100000003']);
    $make('GS-WORKSPACE-SPLIT',['created'=>$made,'status'=>'shipping','inbound'=>['numbers'=>$numbers],
        'logistics'=>['version'=>1,'parcels'=>['SF100000001'=>['at'=>$made,'location'=>'erenhot']]]]);
    $make('GS-WORKSPACE-BATCH',['created'=>$made,'status'=>'erenhot','inbound'=>['numbers'=>[$numbers[0]]],
        'logistics'=>['version'=>1,'parcels'=>['SF100000001'=>['at'=>$made,'location'=>'erenhot']]]]);
    $make('GS-WORKSPACE-REVIEW',['created'=>$made,'purchase'=>['state'=>'preflight_review','updated_at'=>$made]]);
    $db->exec('COMMIT');
}catch(Throwable $error){$db->exec('ROLLBACK');throw $error;}
