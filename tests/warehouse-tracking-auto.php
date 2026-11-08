<?php
declare(strict_types=1);
// TaoWorld worker refreshes courier tracking for shipped, not-yet-scanned orders (Erenhot alerts):
// one order per run, each at most every six hours, read-only detail calls, no warehouse session.
$root=__DIR__.'/../tmp/tracking-auto-'.bin2hex(random_bytes(5));mkdir($root.'/server',0700,true);
foreach(glob(__DIR__.'/../server/*') as $f)if(is_file($f)&&!str_contains(basename($f),'.local.')&&preg_match('/\.(php|json)$/',$f))copy($f,$root.'/server/'.basename($f));
file_put_contents($root.'/server/config.local.php','<?php return '.var_export(['data_dir'=>$root.'/data'],true).';');
file_put_contents($root.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-long-enough','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
putenv('GOSTORE_DATA_DIR='.$root.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
// The CLI worker loads exactly these files (scripts/taoworld-worker.php); logistics.php is not among them.
foreach(['bootstrap','shipping','warehouse','taobao-purchase','taoworld-auth','taoworld-purchase'] as $f)require $root.'/server/'.$f.'.php';
function check(bool $yes,string $why):void{if(!$yes)throw new RuntimeException($why);}
$calls=[];$fixture=json_decode(file_get_contents(__DIR__.'/inbound-detail-fixture.json'),true);
function taoworld_http(string $path,array $params):array{global $calls,$fixture;$calls[]=[$path,$params];if($path!=='/logistics/detail/get')throw new RuntimeException('Only detail reads allowed: '.$path);return ['code'=>'0','result'=>['success'=>true,'data'=>$fixture]];}
taoworld_store(taoworld_token_state(['access_token'=>'fake','refresh_token'=>'fake','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'fixture']));
$order=function(string $id,string $status,array $extra=[]){
    $o=$extra+['id'=>$id,'title'=>'Fixture','type'=>'checkout','status'=>$status,'paid'=>true,'amount'=>1,'created'=>gmdate('c'),'phone'=>'99112233','route'=>['Эрээн','Замын-Үүд','Улаанбаатар'],'history'=>[],'items'=>[],
        'inbound'=>['numbers'=>[['no'=>'SF1234567890','company'=>'顺丰','source'=>'taoworld','added_at'=>gmdate('c')]]],
        'purchase'=>['provider'=>'taoworld','account_binding'=>tw_account(),'submitted_at'=>gmdate('c'),'tracked_at'=>gmdate('c'),'children'=>[['sub_purchase_order_id'=>'3000000000001','purchase_id'=>'2000000000001','status'=>'WAIT_BUYER_CONFIRM_GOODS','parcels'=>[]]]]];
    db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,'h'.$id,'k'.$id,tw_json($o),$o['created'],$o['created']]);
};
$order('GS-WAIT','shipping');
$order('GS-SCANNED','shipping',['logistics'=>['version'=>1,'parcels'=>['SF1234567890'=>['at'=>gmdate('c'),'location'=>'erenhot']]]]);
$order('GS-RECEIVED','erenhot');
$order('GS-OT','shipping',['purchase'=>['provider'=>'otcommerce']]);
$order('GS-UNSUBMITTED','confirmed',['purchase'=>['provider'=>'taoworld','account_binding'=>tw_account()]]);
check(warehouse_tracking_auto(1)===['GS-WAIT'],'Only shipped, unscanned TaoWorld orders are refreshed');
check(count($calls)===1&&$calls[0][1]['purchase_order_line_id']==='3000000000001','One read-only detail call');
$o=order_row('GS-WAIT')['order'];check(!empty($o['purchase']['domestic_tracking']['auto_at']),'Refresh time recorded');check(count($o['purchase']['domestic_tracking']['children']['3000000000001']['parcels'])===2,'Courier parcels saved');
check(warehouse_tracking_auto(1)===[]&&count($calls)===1,'Six-hour window respected');
tw_update('GS-WAIT',function(&$o){$o['purchase']['domestic_tracking']['auto_at']=gmdate('c',time()-WAREHOUSE_TRACKING_REFRESH-1);foreach($o['purchase']['domestic_tracking']['children'] as &$d){$d['checked_at']=gmdate('c',time()-700);$d['attempted_at']=gmdate('c',time()-700);}unset($d);});
check(warehouse_tracking_auto(1)===['GS-WAIT']&&count($calls)===2,'Refreshes again after six hours');
echo "PASS courier tracking refresh: shipped and unscanned TaoWorld orders only, one per run, six-hour window, read-only, no warehouse session.\n";
