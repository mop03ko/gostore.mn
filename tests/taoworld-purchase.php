<?php
declare(strict_types=1);
// Full procurement lifecycle with isolated config/SQLite and fake provider + QPay transports.
$fixture=__DIR__.'/../tmp/tw-purchase-'.bin2hex(random_bytes(6));mkdir($fixture.'/server',0700,true);
foreach(glob(__DIR__.'/../server/*') as $file)if(is_file($file)&&!str_contains(basename($file),'.local.')&&preg_match('/\.(php|json)$/',$file))copy($file,$fixture.'/server/'.basename($file));
file_put_contents($fixture.'/server/config.local.php','<?php return '.var_export(['data_dir'=>$fixture.'/data','qpay'=>['enabled'=>true,'client_id'=>'fake','client_secret'=>'fake','invoice_code'=>'fake']],true).';');
file_put_contents($fixture.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-long-enough','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
putenv('GOSTORE_DATA_DIR='.$fixture.'/data');putenv('GOSTORE_DISABLE_QPAY=0');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
foreach(['bootstrap','shipping','warehouse','taobao-purchase','taoworld-auth','taoworld-purchase','qpay'] as $file)require $fixture.'/server/'.$file.'.php';
$calls=[];$responses=[];$stock=20;$missingSku=false;$renderCost=1221;$badRender=false;$createTimeout=false;$queryMode='missing';$nativeStatus='WAIT_BUYER_P';$currentId='';$paymentCalls=0;
function taoworld_http(string $path,array $params): array {
    global $calls,$stock,$missingSku,$renderCost,$badRender,$createTimeout,$queryMode,$nativeStatus,$currentId,$paymentCalls;
    $calls[]=[$path,$params];
    if($path==='/auth/token/refresh')return ['access_token'=>'refreshed','refresh_token'=>'new-refresh','expires_in'=>3600,'refresh_expires_in'=>3600,'account_id'=>'fixture-buyer'];
    if($path==='/product/get')return ['code'=>'0','success'=>true,'data'=>['item_id'=>'538452788616','mp_id'=>'2048019433468296','status'=>'active','title'=>'Paper labels','sku_list'=>[['sku_id'=>$missingSku?'999':'3368335904668','mp_skuId'=>'387743580552','status'=>'active','quantity'=>$stock,'price'=>380]]]];
    if($path==='/purchase/order/render')return ['code'=>'0','result'=>['success'=>true,'data'=>['unavailable_sku_list'=>[],'total_real_pay_price'=>['amount'=>$renderCost,'currency'=>'CNY'],'render_item_list'=>[['mainland_shipping_fee'=>['amount'=>1000,'currency'=>'CNY'],'item_price_infos'=>[['mp_id'=>'2048019433468296','sku_id'=>$badRender?'999':'387743580552','quantity'=>2,'origin_price'=>['amount'=>380,'currency'=>'CNY']]]]]]]];
    if($path==='/purchase/order/create'){if($createTimeout)throw new ApiError('fixture timeout',502);return ['code'=>'0','success'=>false,'error_code'=>'ASYNC_PENDING'];}
    if($path==='/purchase/orders/query'){
        if($queryMode==='missing')return ['code'=>'0','success'=>false,'error_code'=>'B-50-10-001'];
        $purchase=order_row($currentId)['order']['purchase'];$parents=[];
        for($i=1;$i<=($queryMode==='partial'?1:2);$i++){
            $parents[]=['outer_purchase_id'=>$queryMode==='foreign'?'WRONG':$purchase['outer_purchase_id'],'purchase_id'=>(string)(2000000000000+$i),'purchase_currency'=>'CNY','purchase_amount'=>600,'status'=>$nativeStatus,
                'sub_purchase_orders'=>[['sub_purchase_order_id'=>(string)(3000000000000+$i),'item_id'=>'2048019433468296','sku_id'=>'387743580552','quantity'=>1,'status'=>$nativeStatus,'purchase_order_outer_id'=>'999999999999999999999'.$i,
                    'logistic_orders'=>$nativeStatus==='WAIT_BUYER_CONFIRM_GOODS'?[['logistic_company_name'=>'SF','logistic_number'=>'SF123456789'.$i],['logistic_company_name'=>'ZT','logistic_number'=>'ZT123456789'.$i]]:[]]]];
        }
        if($queryMode==='pages'){$page=(int)$params['page_no'];return ['code'=>'0','success'=>true,'data'=>['results_total'=>2,'purchase_orders'=>[$parents[$page-1]]]];}
        return ['code'=>'0','success'=>true,'data'=>['results_total'=>count($parents),'purchase_orders'=>$parents]];
    }
    if($path==='/purchase/order/batch/pay'){$paymentCalls++;throw new ApiError('fixture payment timeout',502);}
    if($path==='/logistics/express/freight/estimate')return ['code'=>'0','success'=>true,'data'=>'"2500.25"'];
    if($path==='/product/logisticsProperties/get')return ['code'=>'0','success'=>true,'data'=>['logistics_properties_list'=>[['key'=>'magnetic','name'=>'Magnetic']]]];
    $mp='2048019433468296';
    $reference=match($path){
        '/product/spus/get'=>['results_total'=>11,'product_list'=>[['item_id'=>$mp,'title'=>'Paper labels','status'=>'NORMAL']]],
        '/account/subaccount/query'=>['results_total'=>0,'sub_account_infos'=>[]],
        '/product/details/query'=>['goods_info_list'=>[['mp_id'=>$mp,'title'=>'Paper labels','success'=>true,'inventory'=>6,'skus'=>[['sku_id'=>'387743580552']]]]],
        '/batch/src/products/check'=>['mpProducts'=>[],'noMpProductItemIds'=>['538452788616'],'noMpReasonList'=>[['itemId'=>'538452788616','reason'=>'Fixture unavailable']]],
        '/product/recommend'=>[['item_id'=>'538452788616','title'=>'Same item'],['item_id'=>'538452788617','title'=>'Alternate label','status'=>'active'],['item_id'=>'538452788617','title'=>'Duplicate']],
        '/traffic/item/logisticPrice/get'=>['item_id'=>'538452788616','item_resource'=>'taobao','currency'=>'CNY','post_fee'=>0],
        '/product/batchGetProductLogisticPrice'=>[['mp_id'=>$mp,'currency'=>'CNY','success'=>true,'post_fee'=>750]],
        '/product/rebate/general/query'=>['item_commission_rates'=>[['item_id'=>$mp,'sku_id'=>'387743580552','commission_rate'=>'0.01']]],
        '/product/sensitiveword/identification'=>['success_product_list'=>[['mp_id'=>$mp,'sensitiveword_detail_list'=>[['word'=>'demo']]]]],
        default=>null,
    };
    if($reference!==null)return ['code'=>'0','result'=>['success'=>true,'data'=>$reference]]+($path==='/traffic/item/logisticPrice/get'?['data'=>$reference]:[]);
    throw new RuntimeException('Unexpected API '.$path);
}
function qpay_http(string $path,array $payload,string $auth): array {
    if($path==='/v2/auth/token')return ['access_token'=>'fake-qpay','expires_in'=>time()+3600];
    if($path==='/v2/payment/check')return ['rows'=>[['payment_id'=>'paid-fixture','payment_status'=>'PAID','payment_currency'=>'MNT','payment_amount'=>10000]]];
    throw new RuntimeException('Unexpected QPay call');
}
function check(bool $ok,string $msg): void {if(!$ok)throw new RuntimeException($msg);}
function expect(callable $fn,int $status): void {try{$fn();}catch(ApiError $e){check($e->getCode()===$status,'Wrong error: '.$e->getMessage());return;}throw new RuntimeException('Expected rejection');}
function count_calls(string $path): int {global $calls;return count(array_filter($calls,fn($c)=>$c[0]===$path));}
function seed(string $id,bool $paid=true): void {
    global $currentId;$currentId=$id;
    $o=['id'=>$id,'type'=>'checkout','status'=>$paid?'confirmed':'quoted','paid'=>$paid,'amount'=>10000,'demo'=>false,'title'=>'Paper labels','customer'=>'Fixture','phone'=>'99112233','history'=>[],'route'=>['Эрээн','Замын-Үүд','Улаанбаатар'],'created'=>gmdate('c'),
        'warehouse'=>['address'=>'内蒙古锡林郭勒盟二连浩特市环宇商贸城10-16号','phone'=>'18047981132'],
        'items'=>[['id'=>'tb-538452788616','url'=>'https://item.taobao.com/item.htm?id=538452788616','sku'=>'3368335904668','qty'=>2,'name'=>'Paper labels','variant'=>'White','goods_cny'=>2.86]],'quote'=>['inputs'=>['goods_cny'=>2.86,'domestic_cny'=>0]],
        'invoice'=>['id'=>'fake-invoice','state'=>'ready'],'callback_token'=>'private-callback'];
    db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,hash('sha256',$id),$id,tw_json($o),gmdate('c'),gmdate('c')]);
}
function settings(bool $enabled,bool $pay=false): void {db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['taoworld_procurement',tw_json(['enabled'=>$enabled,'auto_pay'=>$pay,'enabled_at'=>time(),'channel'=>'PANAMA_DG'])]);}
taoworld_store(taoworld_token_state(['access_token'=>'fake-access','refresh_token'=>'fake-refresh','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'fixture-buyer']));

// QPay confirmation saves a durable job; duplicate callbacks do not create or pay remotely.
seed('GS-FLOW',false);settings(true,true);qpay_callback('GS-FLOW','private-callback');$o=order_row('GS-FLOW')['order'];
check($o['paid']&&$o['status']==='confirmed'&&$o['purchase']['state']==='queued','Payment did not queue procurement');
check(warehouse_order_visible($o,'erenhot')&&in_array($o['status'],['confirmed','shipping'],true),'Paid order absent from Erenhot waiting');
$outer=$o['purchase']['outer_purchase_id'];qpay_callback('GS-FLOW','private-callback');tw_queue('GS-FLOW');check(order_row('GS-FLOW')['order']['purchase']['outer_purchase_id']===$outer,'Duplicate callback changed external id');
check(count_calls('/purchase/order/create')===0,'Payment callback made a synchronous purchase');
$o=tw_run_order('GS-FLOW');check($o['purchase']['state']==='preflight_review'&&$o['purchase']['quote']['total_fen']===1221&&count_calls('/purchase/order/create')===0,'Cost over budget must hold');
tw_update('GS-FLOW',function(&$o){$o['purchase']['budget_fen']=1500;$o['purchase']['state']='queued';});
$createTimeout=true;$o=tw_run_order('GS-FLOW');check($o['purchase']['state']==='reconciling'&&!empty($o['purchase']['submitted_at']),'Lost create response must reconcile');
$create=array_values(array_filter($calls,fn($c)=>$c[0]==='/purchase/order/create'))[0][1];
check($create['outer_purchase_id']===$outer&&$create['purchase_amount']==='1221','Stable key/fen total');
$receiver=json_decode($create['receiver'],true);check($receiver['district']==='二连浩特市'&&$receiver['name']==='GS-FLOW GOStore'&&$create['warehouse_address_info']===$create['receiver'],'Wrong Erenhot receiver');
$lines=json_decode($create['order_line_list'],true);check($lines[0]['itemId']==='2048019433468296'&&$lines[0]['skuId']==='387743580552'&&$lines[0]['quantity']===2,'Native SKU mapping failed');
$o=tw_run_order('GS-FLOW');check($o['purchase']['state']==='review'&&count_calls('/purchase/order/create')===1,'Missing query result must never resubmit');
expect(fn()=>taobao_purchase_create('GS-FLOW'),409);expect(fn()=>taobao_purchase_resolve('GS-FLOW',['outcome'=>'failed']),409);
$queryMode='partial';$o=tw_run_order('GS-FLOW');check($o['purchase']['state']==='review','Partial order should hold');
$queryMode='foreign';$o=tw_run_order('GS-FLOW');check($o['purchase']['state']==='review','Foreign external id accepted');
$queryMode='pages';$o=tw_run_order('GS-FLOW');check($o['purchase']['state']==='awaiting_payment'&&count($o['purchase']['children'])===2,'Paginated split orders missing');
$o=tw_run_order('GS-FLOW',true);check($o['purchase']['state']==='paying'&&$paymentCalls===1,'Payment intent not persisted');
check($o['purchase']['payment_result']===['success'=>null,'code'=>'TRANSPORT_UNCERTAIN'],'Uncertain payment outcome not recorded safely');
tw_run_order('GS-FLOW',true);check($paymentCalls===1,'Uncertain payment repeated');
$nativeStatus='WAIT_SELLER_SEND_GOODS';$o=tw_run_order('GS-FLOW');check($o['purchase']['state']==='supplier_paid'&&$o['paid']===true,'Supplier/customer payment conflated');
$nativeStatus='WAIT_BUYER_CONFIRM_GOODS';$o=tw_run_order('GS-FLOW');$o=tw_run_order('GS-FLOW');
check($o['purchase']['state']==='shipped'&&count($o['inbound']['numbers'])===4,'All parcels must merge once');
check($o['purchase']['children'][0]['taobao_order_id']==='9999999999999999999991','Large provider id lost precision');
check($o['status']==='confirmed'&&!isset(public_order($o)['purchase']),'Shipment must not confirm warehouse receipt or leak procurement');
check(inbound_public($o)['trackable'],'Warehouse refresh unavailable');
check(count_calls('/purchase/order/create')===1,'Reconciliation created duplicate purchase');
// A stale unpaid response must not re-enable payment after payment was observed, including website payments.
tw_update('GS-FLOW',function(&$o){unset($o['purchase']['pay_submitted_at']);});$nativeStatus='WAIT_BUYER_P';$payBefore=$paymentCalls;
$o=tw_run_order('GS-FLOW');check($o['purchase']['state']==='review','Regressed supplier state re-enabled payment');tw_run_order('GS-FLOW',true);check($paymentCalls===$payBefore,'Already observed payment was repeated');

seed('GS-NOSKU');tw_queue('GS-NOSKU');$missingSku=true;$o=tw_run_order('GS-NOSKU');check($o['purchase']['state']==='preflight_review','SKU substitution allowed');$missingSku=false;
seed('GS-STOCK');tw_queue('GS-STOCK');$stock=1;$o=tw_run_order('GS-STOCK');check($o['purchase']['state']==='preflight_review','Insufficient stock accepted');$stock=20;
seed('GS-RENDER');tw_queue('GS-RENDER');$badRender=true;$o=tw_run_order('GS-RENDER');check($o['purchase']['state']==='preflight_review','Wrong render SKU accepted');$badRender=false;
seed('GS-ACCOUNT');tw_queue('GS-ACCOUNT');$saved=taoworld_state();$switched=$saved;$switched['account_id']='other-buyer';taoworld_store($switched);$before=count($calls);$o=tw_run_order('GS-ACCOUNT');check(count($calls)===$before&&$o['purchase']['state']==='preflight_review','Cross-account purchase');taoworld_store($saved);
seed('GS-ADDRESS');tw_queue('GS-ADDRESS');tw_update('GS-ADDRESS',function(&$o){$o['warehouse']['address']='Changed';});$before=count($calls);tw_run_order('GS-ADDRESS');check(count($calls)===$before,'Changed address used for purchase');
seed('GS-CANCEL');tw_queue('GS-CANCEL');tw_update('GS-CANCEL',function(&$o){$o['status']='cancelled';});$before=count($calls);tw_run_order('GS-CANCEL');check(count($calls)===$before,'Cancelled order purchased');
seed('GS-UNPAID',false);expect(fn()=>tw_queue('GS-UNPAID'),409);
seed('GS-OT');tw_update('GS-OT',function(&$o){$o['purchase']=['state'=>'review'];});expect(fn()=>tw_queue('GS-OT'),409);
seed('GS-LOCK');tw_queue('GS-LOCK');tw_order_lock('GS-LOCK',fn()=>expect(fn()=>tw_run_order('GS-LOCK'),409));
settings(false);seed('GS-OFF',false);qpay_callback('GS-OFF','private-callback');check(!isset(order_row('GS-OFF')['order']['purchase']),'Disabled mode queued an order');
// Refresh rotates once and does not switch the bound buyer.
$saved=taoworld_state();$saved['expires_at']=time();taoworld_store($saved);check(taoworld_access_token()==='refreshed','Worker failed to rotate expired token');
check(count_calls('/auth/token/refresh')===1,'Refresh repeated');
// A worker processes persisted jobs across separate invocations, including a crash boundary.
foreach(db()->query('SELECT id FROM orders')->fetchAll() as $row)tw_update($row['id'],function(&$o){if(isset($o['purchase']))$o['purchase']['next_at']=0;});
settings(true,true);seed('GS-WORKER',false);tw_update('GS-WORKER',function(&$o){$o['quote']['inputs']['goods_cny']=20;});
$currentId='GS-WORKER';$queryMode='pages';$nativeStatus='WAIT_BUYER_P';$createTimeout=false;
qpay_callback('GS-WORKER','private-callback');$before=count_calls('/purchase/order/create');check(tw_worker()===['GS-WORKER'],'Worker did not process queued order');
check(count_calls('/purchase/order/create')===$before+1,'Worker did not submit');
tw_update('GS-WORKER',function(&$o){$o['purchase']['state']='submitting';$o['purchase']['next_at']=time();});$before=count_calls('/purchase/order/create');$payBefore=$paymentCalls;
check(tw_worker()===['GS-WORKER'],'Worker did not recover crash');check(count_calls('/purchase/order/create')===$before&&$paymentCalls===$payBefore+1,'Crash caused duplicate create or missed authorized auto payment');
tw_update('GS-WORKER',function(&$o){$o['purchase']['next_at']=time();});tw_worker();check($paymentCalls===$payBefore+1,'Worker repeated uncertain auto payment');
check(!isset(order_row('GS-OFF')['order']['purchase']),'Worker backfilled payment from before activation');
foreach(db()->query('SELECT id FROM orders')->fetchAll() as $row)tw_update($row['id'],function(&$o){if(isset($o['purchase']))$o['purchase']['next_at']=0;});
foreach(['GS-LATER','GS-OVERDUE'] as $id){seed($id);tw_update($id,function(&$o){$o['quote']['inputs']['goods_cny']=20;});tw_queue($id);}
tw_update('GS-OVERDUE',function(&$o){$o['purchase']['next_at']=time()-120;});check(tw_worker(1)===['GS-OVERDUE'],'Recurring old polls starved an overdue job');
require_once $fixture.'/server/supplier.php';require_once $fixture.'/server/taoworld-catalog.php';
check(tw_submission_result(['success'=>false,'error_code'=>'B-1','error_msg'=>'private-token'])===['success'=>false,'code'=>'B-1'],'Payment outcome must retain only safe business codes');
check(tw_submission_result(['result'=>['success'=>false,'error_code'=>'unsafe / token']])===['success'=>false,'code'=>null],'Unsafe provider code leaked');
tw_catalog_remember(['item_id'=>'538452788616','mi_id'=>'native-source-mi']);seed('GS-NATIVE-SOURCE');$o=order_row('GS-NATIVE-SOURCE')['order'];$o['items'][0]['catalog_provider']='taoworld';
tw_map($o);$last=end($calls);check($last[0]==='/product/get'&&($last[1]['mi_id']??'')==='native-source-mi'&&!isset($last[1]['item_url']),'Native checkout must use persisted mi_id even after catalog setting changes');
require_once $fixture.'/server/taoworld-insights.php';
$input=['id'=>'GS-FLOW','line'=>0];
$before=order_row('GS-FLOW')['order'];
check(tw_insights(['mode'=>'distribution','page'=>1])['more']===true,'Distribution page lost pagination');
check(tw_insights(['mode'=>'accounts'])===['total'=>0],'Empty subaccounts mishandled');
check(tw_insights($input+['mode'=>'availability'])===['available'=>false,'reasons'=>['Fixture unavailable']],'Availability result missing');
$p=tw_insights($input+['mode'=>'alternatives'])['alternatives'];
check(count($p)===1&&$p[0]['id']==='538452788617','Alternative did not exclude current or duplicate');
tw_insights($input+['mode'=>'alternatives']);check(count_calls('/product/recommend')===1,'Repeated click missed buyer-scoped cache');
check(tw_insights($input+['mode'=>'delivery'])===['source_fee_fen'=>0,'distribution_fee_fen'=>750],'Reference fees mixed or missing');
check(tw_insights($input+['mode'=>'freight','first_mnt'=>1000,'extra_mnt'=>2500])===['amount_mnt'=>'2500.25'],'Scalar freight estimate was not validated');
expect(fn()=>tw_insights($input+['mode'=>'freight','first_mnt'=>1000,'extra_mnt'=>-2]),400);
check(tw_insights($input+['mode'=>'detail'])['product']['stock']===6,'Mapped details absent');
check(tw_insights($input+['mode'=>'properties'])===['properties'=>['Magnetic']],'Supplier shipping properties missing');
check(tw_insight_properties_data(['success'=>false,'error_code'=>'ITEM_LOGISTICS_PROPERTY_NOT_FOUND'])===['properties'=>null],'Missing properties treated as absence of restrictions');
check(tw_insights($input+['mode'=>'rebate'])===['rebate'=>['rate'=>'0.01']],'Wrong SKU rebate');
check(tw_insights($input+['mode'=>'keywords','words'=>' demo ,demo,test'])===['matches'=>1],'Keyword check result missing');
$keywordParams=end($calls)[1];check(json_decode($keywordParams['items'],true)[0]['sensitive_words']===['demo','test'],'Keyword validation or deduplication failed');
expect(fn()=>tw_insights(['id'=>'GS-NATIVE-SOURCE','line'=>0,'mode'=>'detail']),409);
expect(fn()=>tw_insights(['id'=>'GS-FLOW','line'=>1,'mode'=>'detail']),422);
expect(fn()=>tw_insights($input+['mode'=>'pay']),422);
check(order_row('GS-FLOW')['order']===$before,'Read-only insight changed order');
echo "PASS: TaoWorld distribution, subaccounts, availability, alternatives, delivery, mapped details, rebate, keywords, cache and read-only behavior.\n";
echo "PASS: QPay durable queue, Erenhot waiting/address, native SKU/stock/render, budget hold, stable idempotency, timeout/crash recovery, split/paginated orders, one payment attempt, all parcel deduplication, account/address/provider guards, locks, cancellation, disabled mode, token rotation, native catalog mi_id.\n";
