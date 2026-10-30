<?php
declare(strict_types=1);
$root=__DIR__.'/../tmp/tw-domestic-'.bin2hex(random_bytes(6));mkdir($root.'/server',0700,true);
foreach(glob(__DIR__.'/../server/*') as $file)if(is_file($file)&&!str_contains(basename($file),'.local.')&&preg_match('/\.(php|json)$/',$file))copy($file,$root.'/server/'.basename($file));
file_put_contents($root.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-long-enough','callback_url'=>'https://example.test/callback'];");
file_put_contents($root.'/server/config.local.php','<?php return '.var_export(['data_dir'=>$root.'/data','site_url'=>'https://example.test','qpay'=>['enabled'=>true,'client_id'=>'fake','client_secret'=>'fake','invoice_code'=>'fake']],true).';');
putenv('GOSTORE_DATA_DIR='.$root.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');putenv('GOSTORE_DISABLE_QPAY=0');
foreach(['bootstrap','shipping','supplier','checkout','taoworld-domestic','qpay'] as $f)require_once $root.'/server/'.$f.'.php';
$calls=[];$qpayCalls=[];$ship=1000;$error=false;$referenceError=false;$missing=false;$wrongSku=false;$extraGoods=0;$onRender=null;
$products=[
 '700000000001'=>['seller'=>'a','mp'=>'80001','skus'=>['11'=>['mp'=>'90011','price'=>1000],'12'=>['mp'=>'90012','price'=>1200]]],
 '700000000002'=>['seller'=>'a','mp'=>'80002','skus'=>['21'=>['mp'=>'90021','price'=>2000]]],
 '700000000003'=>['seller'=>'b','mp'=>'80003','skus'=>['31'=>['mp'=>'90031','price'=>3000]]],
];
function check(bool $yes,string $why):void{if(!$yes)throw new RuntimeException($why);}
function denied(callable $fn,int $code):void{try{$fn();}catch(ApiError $e){check($e->getCode()===$code,'Unexpected rejection: '.$e->getMessage());return;}throw new RuntimeException('Expected rejection');}
function taoworld_http(string $path,array $params):array{
 global $calls,$products,$ship,$error,$referenceError,$missing,$wrongSku,$extraGoods,$onRender;$calls[]=[$path,$params];
 check(!in_array($path,['/purchase/order/create','/purchase/order/batch/pay'],true),'Checkout attempted a purchase/payment');
 if($path==='/traffic/item/batchGetSourceItemLogisticPrice'){
  if($referenceError)throw new ApiError('API_CAN_NOT_USE',502);
  check(!array_intersect(['item_ids','sku_id','quantity'],array_keys($params)),'Unsupported shipping inputs');
  $address=json_decode($params['address_info'],true);check($address===['country'=>'中国','state'=>'内蒙古自治区','city'=>'锡林郭勒盟','district'=>'二连浩特市'],'Wrong address levels');
  $rows=[];foreach(json_decode($params['mi_id_list'],true) as $mi)$rows[]=['item_resource'=>'taobao','item_id'=>substr($mi,3),'mi_id'=>'rotated-'.$mi,'success'=>true,'currency'=>'CNY','post_fee'=>1000];
  if($missing)array_pop($rows);return ['code'=>'0','data'=>array_reverse($rows)];
 }
 if($error)throw new ApiError('Read failed',502);
 if(in_array($path,['/product/get','/traffic/item/get'],true)){
  $id=substr($params['mi_id'],3);$p=$products[$id];$skus=[];
  foreach($p['skus'] as $idSku=>$sku)$skus[]=['sku_id'=>(string)$idSku,'mp_skuId'=>$sku['mp'],'status'=>'active','quantity'=>20,'price'=>$sku['price']];
  $data=['item_id'=>$id,'mi_id'=>'mi-'.$id,'mp_id'=>$p['mp'],'shop_id'=>$p['seller'],'shop_name'=>'Fixture','title'=>'Storage box','status'=>'active','sku_list'=>$skus];
  return ['code'=>'0','success'=>true,'data'=>$data];
 }
 if($path==='/purchase/order/render'){
  $receiver=json_decode($params['warehouse_address'],true);check($receiver['district']==='二连浩特市'&&$receiver['address']!==''&&$params['warehouse_address']===$params['receiver_address'],'Render destination mismatch');
  $groups=[];$goods=0;foreach(json_decode($params['render_item_List'],true) as $item){
   $found=null;foreach($products as $product)if($product['mp']===$item['itemId']){$found=$product;break;}check($found!==null,'Unknown mapped item');
   $sku=null;foreach($found['skus'] as $v)if($v['mp']===$item['skuId'])$sku=$v;check($sku!==null,'Wrong mapped SKU');
   $groups[$found['seller']]['qty']=($groups[$found['seller']]['qty']??0)+$item['quantity'];
   $groups[$found['seller']]['item_price_infos'][]=['mp_id'=>$item['itemId'],'sku_id'=>$wrongSku?'999':$item['skuId'],'quantity'=>$item['quantity'],'origin_price'=>['amount'=>$sku['price'],'currency'=>'CNY']];$goods+=$sku['price']*$item['quantity'];
  }
  $shipping=0;foreach($groups as &$g){$fee=$ship+($g['qty']>3?500:0);$g['mainland_shipping_fee']=['amount'=>$fee,'currency'=>'CNY'];$shipping+=$fee;unset($g['qty']);}unset($g);
  if($onRender){$fn=$onRender;$onRender=null;$fn();}
  return ['code'=>'0','result'=>['success'=>true,'data'=>['unavailable_sku_list'=>[],'total_real_pay_price'=>['amount'=>$goods+$shipping+$extraGoods,'currency'=>'CNY'],'render_item_list'=>array_values($groups)]]];
 }
 throw new RuntimeException('Unexpected read '.$path);
}
function qpay_http(string $path,array $params,string $auth):array{global $qpayCalls;$qpayCalls[]=$path;if($path==='/v2/auth/token')return ['access_token'=>'fake','expires_in'=>time()+3600];if($path==='/v2/invoice')return ['invoice_id'=>'fake-invoice','qr_image'=>'fake'];throw new RuntimeException('Unexpected QPay action');}
taoworld_store(taoworld_token_state(['access_token'=>'fake','refresh_token'=>'fake','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'fixture']));
$settings=array_replace(shipping_settings(),['catalog_provider'=>'taoworld','supplier_enabled'=>true,'api_daily_limit'=>10000,'domestic_default_cny'=>99]);db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',tw_json($settings)]);
foreach($products as $id=>$p)tw_catalog_remember(['item_id'=>(string)$id,'mi_id'=>'mi-'.$id]);
function lines(array $items):array{return checkout_items(['items'=>$items]);}
function selectItem(string $id,string $sku,int $qty=1):array{return ['id'=>'tb-'.$id,'sku'=>$sku,'qty'=>$qty];}
function expireQuote(array $lines):void{$path=tw_catalog_dir().'/domestic-'.tw_domestic_key($lines,tw_domestic_receiver()).'.json';if(is_file($path)){$c=supplier_snapshot_read($path);$c['time']=time()-121;supplier_snapshot_write($path,$c);}}
$one=[selectItem('700000000001','11')];$l=lines($one);$q=checkout_quote($l);
check($q['inputs']['domestic_cny']===10&&$q['total']===11000&&!$q['domestic_later'],'Native quote must use fen shipping, not configured 99 yuan');
check($q['domestic']['reference']['item_fees_fen']['tb-700000000001']===1000,'Reference fen mapping');
$cache=['time'=>time(),'data'=>$q['domestic']];$key=$q['domestic']['key'];$account=tw_account();$receiver=tw_domestic_receiver();
check(tw_domestic_cached($cache,$key,$account,$receiver)!==null,'Valid cache rejected');
$bad=$cache;$bad['data']['expires_at']=time()-1;check(tw_domestic_cached($bad,$key,$account,$receiver)===null,'Expired quote accepted');
$bad=$cache;$bad['data']['account']='other';check(tw_domestic_cached($bad,$key,$account,$receiver)===null,'Cross-account quote accepted');
$bad=$cache;$bad['data']['shipping_fen']=-1;check(tw_domestic_cached($bad,$key,$account,$receiver)===null,'Invalid cached money accepted');
$count=count($calls);checkout_quote($l);check(count($calls)===$count,'Fresh identical cart re-queried supplier');
$same=lines([selectItem('700000000001','11'),selectItem('700000000002','21')]);$q=checkout_quote($same);check($q['inputs']['domestic_cny']===10&&$q['inputs']['vendors']===1,'Same seller shipping double charged');
$q=checkout_quote(lines([selectItem('700000000001','11'),selectItem('700000000003','31')]));check($q['inputs']['domestic_cny']===20&&$q['inputs']['vendors']===2,'Different sellers shipping lost');
$q=checkout_quote(lines([selectItem('700000000001','11',4)]));check($q['inputs']['domestic_cny']===15,'Quantity-sensitive shipping ignored');
$count=count(array_filter($calls,fn($c)=>$c[0]==='/product/get'));checkout_quote(lines([selectItem('700000000001','11'),selectItem('700000000001','12')]));check(count(array_filter($calls,fn($c)=>$c[0]==='/product/get'))===$count+1,'Two SKUs should share the same mapping read');
$ship=0;expireQuote($l);$q=checkout_quote($l);check($q['inputs']['domestic_cny']===0&&!$q['domestic_later'],'Free shipping treated as unknown');$ship=1000;
$referenceError=true;expireQuote($l);$q=checkout_quote($l);check($q['domestic']['reference']['status']==='unavailable'&&$q['inputs']['domestic_cny']===10,'Unavailable reference blocked authoritative render');$referenceError=false;
$refs=count(array_filter($calls,fn($c)=>$c[0]==='/traffic/item/batchGetSourceItemLogisticPrice'));expireQuote($same);checkout_quote($same);check(count(array_filter($calls,fn($c)=>$c[0]==='/traffic/item/batchGetSourceItemLogisticPrice'))===$refs,'Permission failure retry was not bounded');
$_SERVER['REMOTE_ADDR']='192.0.2.89';$error=true;expireQuote($l);denied(fn()=>checkout_quote($l),502);$error=false;$wrongSku=true;denied(fn()=>checkout_quote($l),409);$wrongSku=false;$extraGoods=1;denied(fn()=>checkout_quote($l),409);$extraGoods=0;
$_SERVER['REMOTE_ADDR']='192.0.2.90';$q=checkout_quote($l);$receiver=tw_domestic_receiver();$changed=['address'=>$receiver['address'].' 2','phone'=>$receiver['mobile_phone']];check(tw_domestic_quote($l,$changed)['receiver']['address']===$changed['address'],'Address change reused old quote');denied(fn()=>tw_domestic_assert_warehouse($q,$changed),409);
$o=checkout_order(['items'=>$one,'expected_total'=>$q['total']],['id'=>'GS-SHIP','type'=>'checkout','paid'=>false,'demo'=>false,'created'=>gmdate('c'),'updated'=>gmdate('c')]);$o['warehouse']=['address'=>$receiver['address'],'phone'=>$receiver['mobile_phone']];
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$o['id'],hash('sha256','fake'),'domestic-test',tw_json($o),$o['created'],$o['created']]);
$public=public_order($o);check(!isset($public['quote']['domestic'])&&!isset($public['quote']['verified_until'])&&checkout_public_quote($q)['domestic_source']==='taoworld_render','Private shipping fields exposed');
$ship=1500;expireQuote($l);denied(fn()=>qpay_invoice($o['id']),409);check(!$qpayCalls,'Changed shipping reached QPay');
$ship=1000;expireQuote($l);$error=true;denied(fn()=>qpay_invoice($o['id']),502);$error=false;check(!$qpayCalls,'Failed render reached QPay');
$onRender=function()use($o,$changed){$v=order_row($o['id'])['order'];$v['warehouse']=$changed;save_order($v);};denied(fn()=>qpay_invoice($o['id']),409);check(!$qpayCalls,'Concurrent warehouse edit reached QPay');save_order($o);
$paid=qpay_invoice($o['id']);check($paid['invoice']['state']==='ready'&&$paid['amount']===$q['total'],'Validated shipping invoice failed');
$count=count($calls);$ship=9000;expireQuote($l);$again=qpay_invoice($o['id']);check(count($calls)===$count&&$again['amount']===$q['total']&&count($qpayCalls)===2,'Issued invoice was repriced');
$state=taoworld_state();$state['account_id']='other';taoworld_store($state);denied(fn()=>checkout_validate_payment($o),409);
echo "PASS native domestic: address/mi_id/fen, seller grouping, SKU/quantity, zero fee, cache identity, reference permission fallback/cooldown, no stale fallback, price/stock mapping, QPay shipping freshness, warehouse race, immutable issued invoice and private data.\n";
