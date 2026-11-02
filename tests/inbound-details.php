<?php
declare(strict_types=1);
$root=__DIR__.'/../tmp/inbound-details-'.bin2hex(random_bytes(5));mkdir($root.'/server',0700,true);
foreach(glob(__DIR__.'/../server/*') as $f)if(is_file($f)&&!str_contains(basename($f),'.local.')&&preg_match('/\.(php|json)$/',$f))copy($f,$root.'/server/'.basename($f));
file_put_contents($root.'/server/config.local.php','<?php return '.var_export(['data_dir'=>$root.'/data'],true).';');
file_put_contents($root.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-long-enough','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
putenv('GOSTORE_DATA_DIR='.$root.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
foreach(['bootstrap','shipping','warehouse','logistics','taobao-purchase','taoworld-auth','taoworld-purchase'] as $f)require $root.'/server/'.$f.'.php';
function check(bool $yes,string $why):void{if(!$yes)throw new RuntimeException($why);}
function denied(callable $f,int $code):void{try{$f();}catch(ApiError $e){check($e->getCode()===$code,'Wrong error '.$e->getMessage());return;}throw new RuntimeException('Expected rejection');}
$calls=[];$mode='ok';$fixture=json_decode(file_get_contents(__DIR__.'/inbound-detail-fixture.json'),true);
function taoworld_http(string $path,array $params):array{global $calls,$mode,$fixture;$calls[]=[$path,$params];if($path!=='/logistics/detail/get')throw new RuntimeException('Only detail reads allowed: '.$path);if($mode==='fail')throw new ApiError('PRIVATE provider token',403);return ['code'=>'0','result'=>['success'=>true,'data'=>$mode==='malformed'?[]:$fixture]];}
taoworld_store(taoworld_token_state(['access_token'=>'fake','refresh_token'=>'fake','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'fixture']));
$id='GS-TEST';$o=['id'=>$id,'title'=>'Fixture','type'=>'checkout','status'=>'erenhot','paid'=>true,'amount'=>1,'created'=>gmdate('c'),'phone'=>'99112233','route'=>['Эрээн','Замын-Үүд','Улаанбаатар'],'history'=>[['status'=>'erenhot','at'=>gmdate('c')]],'items'=>[],
 'purchase'=>['provider'=>'taoworld','account_binding'=>tw_account(),'submitted_at'=>gmdate('c'),'tracked_at'=>gmdate('c'),'children'=>[['sub_purchase_order_id'=>'3000000000001','purchase_id'=>'2000000000001','taobao_order_id'=>'9999999999999999999991','quantity'=>2,'status'=>'WAIT_BUYER_CONFIRM_GOODS','parcels'=>[]]]]];
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,'h','k',tw_json($o),gmdate('c'),gmdate('c')]);
$updated=inbound_details_refresh($id,'erenhot');$public=inbound_public($updated);$child=$public['details']['children'][0];
check(count($calls)===1&&$calls[0][1]['purchase_order_line_id']==='3000000000001','Wrong ID/endpoint');check(count($child['parcels'])===2,'Split parcels missing');check($child['parcels'][0]['traces'][0]['time']==='2026-11-02 08:30:00','Trace order');check($child['taobao_order_id']==='9999999999999999999991','Big ID corrupted');check(!str_contains(tw_json($public),'PRIVATE')&&!str_contains(tw_json($public),'<script>'),'Whitelist failed');check($updated['status']==='erenhot'&&$updated['history']===$o['history'],'Carrier query changed warehouse status');
check(count($updated['inbound']['numbers'])===2,'Detailed waybills not searchable');
check(warehouse_order_public($updated,'erenhot',false)['inbound']['details']===null,'List downloads full trace payload');
inbound_details_refresh($id,'erenhot');check(count($calls)===1,'TTL cache ignored');
$customer=public_order($updated);check(!str_contains(tw_json($customer),'18000000000')&&!isset($customer['purchase']),'Receiver leaked to customer');$ub=warehouse_order_public($updated,'ulaanbaatar');check(!isset($ub['inbound']['details']),'Details leaked to UB');
denied(fn()=>inbound_details_refresh($id,'ulaanbaatar'),404);tw_update($id,function(&$o){$o['warehouse_locations']['erenhot']='wh-foreign';});denied(fn()=>inbound_details_refresh($id,'erenhot'),404);tw_update($id,function(&$o){unset($o['warehouse_locations']);});
function expire_detail(string $id):void{tw_update($id,function(&$o){foreach($o['purchase']['domestic_tracking']['children'] as &$d){$d['checked_at']=gmdate('c',time()-700);$d['attempted_at']=gmdate('c',time()-700);}unset($d);});}
expire_detail($id);$mode='fail';$failed=inbound_details_refresh($id,'erenhot');$d=inbound_public($failed)['details']['children'][0];check($d['error']&&count($d['parcels'])===2,'Failure destroyed cache');check(!str_contains(tw_json($failed),'PRIVATE'),'Provider exception leaked');$count=count($calls);inbound_details_refresh($id,'erenhot');check(count($calls)===$count,'Failed requests were not backed off');
expire_detail($id);$mode='malformed';$bad=inbound_details_refresh($id,'erenhot');check(count(inbound_public($bad)['details']['children'][0]['parcels'])===2,'Malformed success destroyed cache');
$mode='ok';tw_update($id,function(&$o){$o['purchase']['children']=[];for($n=1;$n<=5;$n++)$o['purchase']['children'][]=['sub_purchase_order_id'=>(string)(3000000000010+$n),'status'=>'WAIT_BUYER_CONFIRM_GOODS'];});$count=count($calls);inbound_details_refresh($id,'erenhot');check(count($calls)===$count+3,'Per-refresh limit');$count=count($calls);inbound_details_refresh($id,'erenhot');check(count($calls)===$count+2,'Later children starved');
tw_update($id,function(&$o){unset($o['purchase']['submitted_at']);});$count=count($calls);denied(fn()=>inbound_details_refresh($id,'erenhot'),409);check(count($calls)===$count,'Refresh created an unsubmitted order');
echo "PASS domestic details: official schema, split parcels, trace order, big IDs, TTL/backoff, stale preservation, bounded requests, read-only refresh, branch/role privacy.\n";
