<?php
declare(strict_types=1);
// Fake OT transport: verifies Taobao purchasing to Erenhot without any real order or payment.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/taobao-purchase-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');putenv('GOSTORE_DISABLE_QPAY=1');
foreach(['bootstrap','shipping','supplier','checkout','taobao-purchase'] as $file)require __DIR__.'/../server/'.$file.'.php';
$calls=[];$next=[];
function taobao_http(string $method,string $path,array $query=[],?array $json=null,?array $form=null): array {
    global $calls,$next;$calls[]=compact('method','path','query','json','form');
    $r=array_shift($next);if($r instanceof Throwable)throw $r;if($r===null)throw new RuntimeException('Unexpected call '.$path);return $r;
}
function expect_error(callable $call,int $status,string $text=''):void {
    try{$call();}catch(ApiError $e){if($e->getCode()===$status&&str_contains($e->getMessage(),$text))return;throw $e;}
    throw new RuntimeException('Expected HTTP '.$status);
}
function check(bool $ok,string $message):void { if(!$ok)throw new RuntimeException($message); }
$token=fn(string $a)=>['status'=>200,'body'=>['access_token'=>$a,'refresh_token'=>'r-'.$a,'expires_in'=>3600,'refresh_expires_in'=>86400,'account'=>'gostore-buyer']];
$o=['id'=>'GS-AAA111','type'=>'checkout','status'=>'confirmed','paid'=>false,'demo'=>false,'amount'=>1000,'created'=>gmdate('c'),
    'items'=>[['id'=>'tb-123456789','sku'=>'555','qty'=>2,'name'=>'A','variant'=>'Red'],['id'=>'tb-987654321','sku'=>'standard','qty'=>1,'name'=>'B','variant'=>'One']]];
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$o['id'],'h','k',json_encode($o),$o['created'],$o['created']]);
$set=function(array $changes)use($o){$current=order_row($o['id'])['order'];foreach($changes as $k=>$v)$current[$k]=$v;save_order($current);};

expect_error(fn()=>taobao_purchase_preview('GS-AAA111'),409,'холбогдоогүй');
$next=[$token('a1')];taobao_buyer_connect('oauth-code');
check($calls[0]['path']==='/v1/taobao/oauth/token'&&$calls[0]['form']===['code'=>'oauth-code'],'OAuth code exchange changed');
$public=json_encode(taobao_buyer_public());check(!str_contains($public,'a1')&&!str_contains($public,'r-a1')&&str_contains($public,'gostore-buyer'),'Tokens must stay server-side');

$next=[['status'=>200,'body'=>['total'=>88]]];$calls=[];taobao_purchase_preview('GS-AAA111');
$body=$calls[0]['json'];
check($calls[0]['path']==='/v1/taobao/order/render'&&$body['access_token']==='a1','Render must use the buyer token');
check($body['items']===[['item_id'=>'123456789','quantity'=>2,'sku_id'=>'555'],['item_id'=>'987654321','quantity'=>1]],'Items or SKU mapping changed');
check($body['receiver']['name']==='GS-AAA111 GOStore'&&$body['receiver']['address']==='内蒙古锡林郭勒盟二连浩特市环宇商贸城10-16号'&&$body['receiver']['district']==='二连浩特市','Receiver must be the Erenhot warehouse with the GS code');

expect_error(fn()=>taobao_purchase_create('GS-AAA111'),409,'төлбөр орсон');
$set(['paid'=>true]);
$next=[['status'=>400,'body'=>['error'=>'bad_request','reason'=>'Invalid items.']]];$calls=[];$r=taobao_purchase_create('GS-AAA111');
check($r['purchase']['state']==='failed'&&$r['purchase']['error']==='Invalid items.'&&$calls[0]['json']['order_id']==='GS-AAA111','Rejected order must be retryable');
check(taobao_reason(['error'=>'bad_request','reason'=>'Missing parameter','data'=>['sub_msg'=>'sku_id is required']],400)==='Missing parameter · sku_id is required'&&taobao_reason(null,502)==='HTTP 502','Provider detail must reach the admin');
$next=[new ApiError('timeout',504)];$calls=[];$r=taobao_purchase_create('GS-AAA111');
check($r['purchase']['state']==='review'&&$calls[0]['json']['order_id']==='GS-AAA111-2','Ambiguous result must wait for review with a new external number');
expect_error(fn()=>taobao_purchase_create('GS-AAA111'),409,'шалгаж');
taobao_purchase_resolve('GS-AAA111',['outcome'=>'failed']);
$next=[['status'=>200,'body'=>['data'=>['trade_ids'=>['3344556677'],'pay_url'=>'x']]]];$r=taobao_purchase_create('GS-AAA111');
check($r['purchase']['state']==='created'&&$r['purchase']['provider_order_ids']===['3344556677']&&$r['purchase']['order_id']==='GS-AAA111-3','Created order must keep Taobao ids');
expect_error(fn()=>taobao_purchase_create('GS-AAA111'),409);
check(!isset(public_order(order_row('GS-AAA111')['order'])['purchase']),'Purchase details are internal');

// Expired access token is refreshed before tracking.
$s=taobao_buyer_state();$s['expires_at']=time()+10;taobao_buyer_store($s);
$next=[$token('a2'),['status'=>200,'body'=>['logistics'=>['tracking_no'=>'SF123']]]];$calls=[];$r=taobao_purchase_track('GS-AAA111');
check($calls[0]['path']==='/v1/taobao/oauth/refresh'&&$calls[0]['form']===['refresh_token'=>'r-a1'],'Refresh must use the stored refresh token');
check($calls[1]['path']==='/v1/taobao/order/tracker/3344556677'&&$calls[1]['query']===['access_token'=>'a2']&&str_contains($r['purchase']['tracking'],'SF123'),'Tracking changed');
check(order_row('GS-AAA111')['order']['inbound']['numbers']===[],'Tracker without a waybill invented a number');
// Tracker payloads are free-form; numbers and carriers are found at any depth and never duplicated.
$tracker=['data'=>['packages'=>[['logistics_company'=>'顺丰速运','mail_no'=>'sf1234567890','events'=>[['desc'=>'已揽收']]],['cp_name'=>'中通','waybill_no'=>'ZT9876543210'],['mail_no'=>'<x>']]]];
$next=[['status'=>200,'body'=>$tracker],['status'=>200,'body'=>$tracker]];taobao_purchase_track('GS-AAA111');$r=taobao_purchase_track('GS-AAA111');
check(array_map(fn($n)=>[$n['no'],$n['company'],$n['source']],$r['inbound']['numbers'])===[['SF1234567890','顺丰速运','taobao'],['ZT9876543210','中通','taobao']],'Tracking numbers not extracted');
check($r['inbound']['status']==='已揽收'&&isset($r['inbound']['checked_at']),'Tracking status not stored');
$r=inbound_add_manual('GS-AAA111',['number'=>'yt-555666777','company'=>'圆通']);check(end($r['inbound']['numbers'])['no']==='YT-555666777'&&end($r['inbound']['numbers'])['source']==='admin','Manual tracking not stored');
expect_error(fn()=>inbound_add_manual('GS-AAA111',['number'=>'12 34']),400);
$public=inbound_public($r);check(count($public['numbers'])===3&&$public['trackable']&&!isset($public['numbers'][0]['added_at']),'Inbound public view changed');
check(inbound_refresh_candidates(5)===[],'Recently checked order refreshed again');
check(inbound_refresh_candidates(5,time()+10801)===['GS-AAA111'],'Stale purchased order not refreshed');
$s=taobao_buyer_state();$s['refresh_expires_at']=time()-1;$s['expires_at']=time();taobao_buyer_store($s);
expect_error(fn()=>taobao_purchase_track('GS-AAA111'),409,'Дахин холбоно');

// Automatic purchase only when enabled, and never twice.
$second=$o;$second['id']='GS-BBB222';$second['paid']=true;
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$second['id'],'h2','k2',json_encode($second),$second['created'],$second['created']]);
$next=[$token('a3')];taobao_buyer_connect('code-2');$calls=[];
taobao_purchase_after_payment('GS-BBB222');check($calls===[]&&!isset(order_row('GS-BBB222')['order']['purchase']),'Auto purchase must be opt-in');
$s=taobao_buyer_state();$s['auto_purchase']=true;taobao_buyer_store($s);
$next=[['status'=>200,'body'=>['order_id'=>'99887766']]];taobao_purchase_after_payment('GS-BBB222');
check(order_row('GS-BBB222')['order']['purchase']['state']==='created'&&order_row('GS-BBB222')['order']['purchase']['auto']===true,'Auto purchase did not run');
$calls=[];taobao_purchase_after_payment('GS-BBB222');check($calls===[],'Auto purchase repeated');
$mixed=$o;$mixed['id']='GS-CCC333';$mixed['paid']=true;$mixed['items'][]=['id'=>'abb-123456789','sku'=>'x','qty'=>1];
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$mixed['id'],'h3','k3',json_encode($mixed),$mixed['created'],$mixed['created']]);
expect_error(fn()=>taobao_purchase_create('GS-CCC333'),409,'1688');
echo "PASS: Taobao buyer OAuth (server-side tokens, refresh, expiry), Erenhot receiver, SKU mapping, render, create/reject/retry, ambiguous review, inbound tracking (extraction, manual numbers, stale refresh), opt-in auto purchase without duplicates.\n";
