<?php
declare(strict_types=1);
// Admin reports: revenue and gross margin per order, CSV cell safety, search insights,
// API usage by kind (including rejected calls), purchase threshold, trial and dashboard alerts.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/admin-reports-test-'.bin2hex(random_bytes(5)));
require __DIR__.'/../server/bootstrap.php';
foreach(['shipping','warehouse','logistics','supplier','admin-reports'] as $f)require_once __DIR__.'/../server/'.$f.'.php';
$_SERVER['REMOTE_ADDR']='127.0.0.1';
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
function denied(callable $f,int $code):void{try{$f();}catch(ApiError $e){check($e->getCode()===$code,'Wrong rejection '.$e->getCode().' '.$e->getMessage());return;}throw new RuntimeException('Expected rejection '.$code);}
function put_order(array $o):void{db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$o['id'],hash('sha256',$o['id']),hash('sha256',$o['id'].'k'),json_encode($o,JSON_UNESCAPED_UNICODE),$o['created'],$o['created']]);}
$today=gmdate('Y-m-d',time()+8*3600);$at=gmdate('c',time()-3600);
// Ulaanbaatar 2026-11-02 00:30 is still 2026-11-01 in UTC: the day bucket must follow Ulaanbaatar.
put_order(['id'=>'GS-A','type'=>'checkout','status'=>'confirmed','amount'=>100000,'paid'=>true,'created'=>'2026-11-01T16:30:00+00:00','customer'=>'A','phone'=>'99000001','title'=>'=SUM(A1)',
    'quote'=>['rates'=>['cny_rate'=>500]],'purchase'=>['provider'=>'taoworld','state'=>'supplier_paid','paid_child_ids'=>['1'],'supplier_total_fen'=>12000,'pay_submitted_at'=>$at]]);
put_order(['id'=>'GS-B','type'=>'checkout','status'=>'completed','amount'=>50000,'paid'=>true,'created'=>'2026-11-03T02:00:00+00:00','customer'=>'B','phone'=>'99000002','title'=>'B',
    'refunds'=>[['amount'=>5000,'note'=>'Илүү төлбөр','at'=>'2026-11-04T02:00:00+00:00']],'freight'=>['paid_amount'=>20000,'paid_at'=>'2026-11-05T02:00:00+00:00']]);
put_order(['id'=>'GS-C','type'=>'checkout','status'=>'cancelled','amount'=>30000,'paid'=>false,'created'=>'2026-11-03T03:00:00+00:00','customer'=>'C','phone'=>'1','title'=>'C']);
put_order(['id'=>'GS-D','type'=>'cart','status'=>'new','amount'=>9000,'paid'=>true,'demo'=>true,'created'=>'2026-11-03T03:00:00+00:00','customer'=>'D','phone'=>'1','title'=>'Demo']);
put_order(['id'=>'GS-E','type'=>'checkout','status'=>'confirmed','amount'=>40000,'paid'=>true,'created'=>'2026-11-04T03:00:00+00:00','customer'=>'E','phone'=>'1','title'=>'E',
    'purchase'=>['provider'=>'taoworld','state'=>'closed','paid_child_ids'=>['2'],'supplier_total_fen'=>9000]]);

$r=admin_report(['from'=>'2026-11-01','to'=>'2026-11-05']);
check($r['totals']['orders']===4&&$r['totals']['demo_excluded']===1,'Demo orders are excluded');
check($r['totals']['paid_orders']===3,'Paid orders counted');
check($r['totals']['revenue']===100000+65000+40000,'Revenue is paid + freight − refunds: '.$r['totals']['revenue']);
check($r['totals']['refunded']===5000&&$r['totals']['cancelled']===1,'Refunds and cancellations');
$days=array_column($r['days'],null,'day');check($days['2026-11-02']['revenue']===100000&&$days['2026-11-01']['orders']===0,'Ulaanbaatar day bucket');
check($r['profit']['orders']===0&&$r['profit']['margin_pct']===null,'Gross margin stays unknown before the bank rate or transaction cost is available');
check($r['profit']['unknown_cost']===3,'Unpaid, closed and unpriced supplier costs stay unknown');
check(count($r['days'])===5,'One row per day');
denied(fn()=>admin_report(['from'=>'2026-11-05','to'=>'2026-11-01']),400);
denied(fn()=>admin_report(['from'=>'2024-01-01','to'=>'2026-11-01']),400);
denied(fn()=>admin_report(['from'=>'2026-02-30','to'=>'2026-03-01']),400);
check(admin_csv_cell('=SUM(A1)')==="'=SUM(A1)"&&admin_csv_cell('-5')==="'-5"&&admin_csv_cell('Бат')==='Бат'&&admin_csv_cell(null)==='','CSV cells cannot start a formula');

// Search insights.
foreach([['Даашинз ',5],['даашинз',0],['  ДААШИНЗ',3],['цүнх',0],['цүнх',0],['__all__',0],['a',0]] as [$q,$n])search_log_record($q,$n);
$s=admin_search_insights(['days'=>7]);
check($s['searches']===5&&$s['terms']===2,'Normalized terms; __all__ and one-letter queries are skipped');
check($s['top'][0]['q']==='даашинз'&&$s['top'][0]['hits']===3&&$s['top'][0]['zero']===1,'Top search');
check($s['zero_results'][0]['q']==='цүнх'&&$s['zero_results'][0]['zero']===2,'Zero-result searches');
denied(fn()=>admin_search_insights(['days'=>5]),400);

// API usage history by kind.
function tw_catalog_call(string $path,array $p): void {supplier_budget_take(false);}
function official_stores_directory(): void {supplier_budget_take(false);}
function tw_catalog_search_pages(): void {supplier_budget_take(false);}
tw_catalog_call('/traffic/item/search',[]);tw_catalog_call('/traffic/item/get',[]);tw_catalog_call('/traffic/item/get',[]);official_stores_directory();tw_catalog_search_pages();
supplier_budget_take(true);supplier_budget_take(false,true);
$u=admin_api_usage();$todayRow=end($u['days']);
check($todayRow['total']===7&&$todayRow['kinds']['detail']===2&&$todayRow['kinds']['search']===2&&$todayRow['kinds']['official']===1&&$todayRow['kinds']['checkout']===1&&$todayRow['background']===1,'Kinds: '.json_encode($todayRow));
check($u['status']['used']===7,'The shared budget counted every call');
check(count($u['days'])>=30,'Thirty days of history');
// Rejections are counted once the browse limit is reached.
db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping',json_encode(shipping_settings()+[],JSON_THROW_ON_ERROR)]);
$limit=shipping_settings()['api_daily_limit'];db()->prepare('UPDATE limits SET hits=? WHERE key=?')->execute([$limit,hash('sha256','supplier-budget:'.gmdate('Y-m-d'))]);
denied(fn()=>supplier_limits(false),429);denied(fn()=>supplier_limits(true),429);$u=admin_api_usage();check(end($u['days'])['rejected']===1,'Shopper calls refused by the limit are recorded; background refreshes are not');

// Purchase threshold and trial.
check($u['purchases']['orders']===1&&$u['purchases']['total_cny']===120.0&&$u['purchases']['last30_cny']===120.0,'Closed purchases do not count: '.json_encode($u['purchases']));
denied(fn()=>admin_quota_save(['trial_started'=>'2026-13-01']),400);
denied(fn()=>admin_quota_save(['trial_started'=>'','external_cny'=>-1]),400);
$trial=gmdate('Y-m-d',time()+8*3600-25*86400);
$u=admin_quota_save(['trial_started'=>$trial,'external_cny'=>9900,'known_daily_quota'=>10000,'note'=>'Account manager']);
check($u['threshold']['counted_cny']===10020.0&&$u['threshold']['reached']===true&&$u['threshold']['percent']===100.0,'Threshold counts API and outside purchases');
check($u['threshold']['estimated_daily_calls']===28,'Quota estimate follows TaoWorld example (CNY 120 / 30 days × 7)');
check($u['trial']['ends']===gmdate('Y-m-d',strtotime($trial.' UTC')+30*86400)&&$u['trial']['days_left']===5,'Trial end: '.json_encode($u['trial']));

// Alerts: limit reached, rejections and orders that need review.
put_order(['id'=>'GS-R','type'=>'checkout','status'=>'confirmed','amount'=>1,'paid'=>true,'created'=>$at,'customer'=>'R','phone'=>'1','title'=>'R','purchase'=>['provider'=>'taoworld','state'=>'review','refunds'=>[['status'=>10]]]]);
$texts=array_column(admin_alerts()['alerts'],'text');
check((bool)preg_grep('/лимит дууссан/u',$texts)&&(bool)preg_grep('/татгалзсан/u',$texts)&&(bool)preg_grep('/шалгах шаардлагатай/u',$texts)&&(bool)preg_grep('/буцаалт/u',$texts),'Alerts: '.json_encode($texts,JSON_UNESCAPED_UNICODE));
admin_quota_save(['trial_started'=>$trial,'external_cny'=>0]);$texts=array_column(admin_alerts()['alerts'],'text');
check((bool)preg_grep('/5 хоногийн дараа дуусна/u',$texts),'Trial reminder while below the threshold');
// Finance ledger: actual FX/cargo costs, unknowns, refunds, split shipments and write safety.
$a=order_row('GS-A')['order'];
$a['freight']=['paid_amount'=>20000];$a['settlement']=['total'=>120000,'breakdown'=>['cargo_mnt'=>20000]];
$f=admin_finance_order($a);
check($f['gross']===120000&&$f['cargo']===20000&&$f['profit']===null&&$f['actual_cost']===null,'Unknown costs must never become zero profit/cost');
$partial=$a;$partial['freight']['paid_amount']=10000;check(admin_finance_order($partial)['cargo']===null,'Partial balance is not assumed to be cargo');
$manual=$a;$manual['freight']['paid_amount']=15000;$manual['freight_receipts']=[['amount'=>5000,'recorded_at'=>'2026-11-05T00:00:00+00:00']];check(admin_finance_order($manual)['balance']===20000&&admin_finance_order($manual)['gross']===120000&&admin_finance_order($manual)['cargo']===20000,'Existing manual freight receipts count exactly once alongside QPay');
require_once __DIR__.'/../server/admin-users.php';
session_boot();admin_users_schema();putenv('GOSTORE_ADMIN_SECURITY_ENFORCED=0');
$hash=password_hash('Finance-Tests-2026!',PASSWORD_BCRYPT);
foreach(['owner','operator','viewer'] as $role){$id='finance-'.$role;db()->prepare('INSERT INTO admin_users (id,email,name,role,password_hash,created,updated) VALUES (?,?,?,?,?,?,?)')->execute([$id,$id.'@example.invalid',$role,$role,$hash,gmdate('c'),gmdate('c')]);}
$login=function(string $role):void{$u=admin_staff('finance-'.$role);$_SESSION=['admin'=>true,'admin_user'=>$u['id'],'admin_version'=>admin_session_version($u)];};
$body=['id'=>'GS-A','version'=>0,'actual_cny_rate'=>480,'supplier_refund_cny'=>0,'transport_cost_mnt'=>10000,'other_cost_mnt'=>2000,'extra_cargo_mnt'=>5000,'payment_date'=>'2026-11-05','note'=>'Bank receipt 123','complete'=>true];
$login('viewer');denied(fn()=>admin_finance_save($body),403);$login('operator');denied(fn()=>admin_finance_save($body),403);$login('owner');
check(admin_action_role('admin-finance-save','POST')==='owner','Finance edits are owner-only');
denied(fn()=>admin_finance_save(array_replace($body,['actual_cny_rate'=>-1])),400);
denied(fn()=>admin_finance_save(array_replace($body,['transport_cost_mnt'=>0.5])),400);
denied(fn()=>admin_finance_save(array_replace($body,['actual_cny_rate'=>'480'])),400);
denied(fn()=>admin_finance_save(array_replace($body,['payment_date'=>'2026-02-30'])),400);
denied(fn()=>admin_finance_save(array_replace($body,['note'=>''])),400);
denied(fn()=>admin_finance_save(array_replace($body,['supplier_refund_cny'=>121])),400);
$before=order_row('GS-A')['data'];$saved=admin_finance_save($body);
check(order_row('GS-A')['data']===$before,'Reporting entries cannot change customer invoice/payment status');
check($saved['entry']['version']===1,'Finance version increments');
denied(fn()=>admin_finance_save($body),409);
$f=admin_finance_order($a);
check($f['gross']===125000&&$f['cargo']===25000&&$f['actual_cost']===57600&&$f['fx']===2400&&$f['profit']===55400,'Actual profit already contains FX gain, and includes extra cargo only once');
$again=admin_finance_save(array_replace($body,['version'=>1]));check(admin_finance_order($a)['gross']===125000,'Repeated edit replaces cumulative extra cargo rather than adding it');
$refunded=$a;$refunded['refunds']=[['amount'=>5000]];
check(admin_finance_order($refunded)['net']===120000&&admin_finance_order($refunded)['profit']===50400,'Customer refunds reduce net profit');
admin_finance_save(array_replace($body,['version'=>2,'supplier_refund_cny'=>20]));
$f=admin_finance_order($a);check($f['supplier_cny']==100&&$f['actual_cost']===48000&&$f['fx']===2000&&$f['profit']===65000,'Supplier refunds reduce cost and FX basis');
$part=['id'=>'GS-PART','created'=>$a['created'],'status'=>'erenhot','type'=>'forwarding','shipment_parent'=>'GS-A','paid'=>true,'amount'=>100000,'purchase'=>$a['purchase'],'freight'=>['paid_amount'=>5000]];
$p=admin_finance_order($part);check($p['initial']===0&&$p['supplier_cny']==0&&$p['actual_cost']===0&&$p['net']===5000,'Split part never duplicates goods revenue or supplier cost');
$report=admin_finance_report([$a,$part]);check($report['gross']===130000&&$report['paid_orders']===1&&$report['shipment_parts']===1&&$report['profit']===null,'Incomplete totals are not presented as complete net profit');
$report=admin_finance_report([$a]);check($report['profit']===65000&&$report['complete_orders']===1&&$report['days']['2026-11-02']===125000,'Complete report totals and day buckets');
$e=admin_finance_entry('GS-A');admin_finance_save(array_replace($body,['version'=>$e['version'],'actual_cny_rate'=>600,'transport_cost_mnt'=>100000,'other_cost_mnt'=>0]));check(admin_finance_order($a)['profit']===-47000&&admin_finance_order($a)['fx']===-12000,'Losses and unfavorable FX must stay negative');
check((int)db()->query("SELECT COUNT(*) FROM admin_audit WHERE action='admin-finance-save'")->fetchColumn()===4,'Finance changes are audited');
check(admin_finance_report([array_replace($a,['demo'=>true])])['gross']===0,'Demo revenue excluded');
// Browser fixture uses synthetic data only.
$batch=['id'=>'GB-FINANCE','status'=>'dispatched','version'=>3];
db()->prepare('INSERT INTO shipment_batches VALUES (?,?,?,?)')->execute([$batch['id'],'finance-batch-key',json_encode($batch),gmdate('c')]);
foreach(['GS-A','GS-B'] as $id)db()->prepare('INSERT INTO shipment_batch_orders VALUES (?,?)')->execute([$id,$batch['id']]);
$batchBody=['id'=>$batch['id'],'version'=>0,'batch_version'=>3,'amount_mnt'=>100001,'paid_date'=>'2026-11-28','note'=>'Carrier transfer 001','confirmed'=>true,'allocations'=>['GS-A'=>33334,'GS-B'=>66667]];
$login('operator');denied(fn()=>finance_batch_save($batchBody),403);$login('owner');
denied(fn()=>finance_batch_save(array_replace($batchBody,['allocations'=>['GS-A'=>33333,'GS-B'=>66667]])),400);
denied(fn()=>finance_batch_save(array_replace($batchBody,['allocations'=>['GS-A'=>33334,'GS-X'=>66667]])),409);
denied(fn()=>finance_batch_save($batchBody),409); // Existing per-order cost would double count.
$e=admin_finance_entry('GS-A');admin_finance_save(array_replace($body,['version'=>$e['version'],'transport_cost_mnt'=>null,'extra_cargo_mnt'=>0]));
$beforeA=order_row('GS-A')['data'];finance_batch_save($batchBody);
check(order_row('GS-A')['data']===$beforeA,'Batch accounting never changes customer orders');
check(admin_finance_order($a)['transport_cost']===33334&&admin_finance_order(order_row('GS-B')['order'])['transport_cost']===66667,'Batch cost allocated exactly, with no rounding loss');
check(admin_finance_report([$a,order_row('GS-B')['order']])['transport_cost']===100001,'Batch total appears once across its orders');
check(admin_finance_report([$a])['transport_cost']===33334,'Date-filtered subset includes only its allocated share');
denied(fn()=>finance_batch_save($batchBody),409);
$e=admin_finance_entry('GS-A');denied(fn()=>admin_finance_save(array_replace($body,['version'=>$e['version'],'transport_cost_mnt'=>1000])),409);
$batchBody['version']=1;$batchBody['amount_mnt']=60000;$batchBody['allocations']=['GS-A'=>20000,'GS-B'=>40000];finance_batch_save($batchBody);
check(admin_finance_report([$a,order_row('GS-B')['order']])['transport_cost']===60000,'Batch correction replaces prior cost, never accumulates');
$batch['status']='ready';db()->prepare('UPDATE shipment_batches SET data=? WHERE id=?')->execute([json_encode($batch),$batch['id']]);$batchBody['version']=2;denied(fn()=>finance_batch_save($batchBody),409);
check(admin_action_role('admin-finance-batch-save','POST')==='owner','Batch finance is owner-only');
$batch['status']='dispatched';
$batch['dispatched_at']='2026-11-26T17:00:00+00:00';
db()->prepare('UPDATE shipment_batches SET created=?, data=? WHERE id=?')->execute(['2026-11-24T02:00:00+00:00',json_encode($batch),$batch['id']]);
foreach([['GB-READY','ready','erenhot'],['GB-CANCELLED','cancelled','erenhot'],['GB-OTHER','dispatched','ulaanbaatar']] as [$id,$status,$source]){
    $at='2026-11-27T02:00:00+00:00';
    $data=array_replace($batch,['id'=>$id,'status'=>$status,'source'=>$source,'dispatched_at'=>null,'ready_at'=>$at]);
    db()->prepare('INSERT INTO shipment_batches VALUES (?,?,?,?)')->execute([$id,$id,json_encode($data),$at]);
}
$batchRange=['from'=>'2026-11-27','to'=>'2026-11-27'];
$list=finance_batch_report_list($batchRange);
check(array_column($list['batches'],'id')===['GB-READY','GB-FINANCE'],'Dispatch/ready date follows local time; cancelled and other origins are excluded');
check($list['batches'][0]['amount_mnt']===null&&$list['batches'][1]['amount_mnt']===60000&&$list['batches'][1]['order_count']===2,'List uses the batch ledger once and includes all member orders');
$detail=finance_batch_get('GB-FINANCE',true);
check(array_column($detail['orders'],'id')===['GS-A','GS-B']&&array_column($detail['orders'],'transport_cost')===[20000,40000],'Batch contains all members even outside the dispatch date range and their allocated cost');
check(!array_key_exists('customer',$detail['orders'][0]),'Batch finance detail only returns fields the view needs');
check(finance_batch_report_list($batchRange+['offset'=>1])['batches'][0]['id']==='GB-FINANCE','Batch pagination is stable');
$fxInput=['bank'=>'KhanBank','date'=>'2026-01-23'];
$khanRates=fn($url)=>[['currency'=>'USD','sellRate'=>3500],['currency'=>'CNY','buyRate'=>500,'cashSellRate'=>515,'sellRate'=>510.25]];
$login('operator');denied(fn()=>admin_fx_reference($fxInput,$khanRates),403);$login('owner');
denied(fn()=>admin_fx_reference(array_replace($fxInput,['date'=>'2026-02-30']),$khanRates),400);
denied(fn()=>admin_fx_reference(array_replace($fxInput,['bank'=>'unknown']),$khanRates),400);
check(admin_fx_reference($fxInput,$khanRates)['rate']===510.25,'Select CNY noncash sell rate');
check(admin_fx_reference($fxInput,fn()=>throw new RuntimeException('Unexpected repeated fetch'))['rate']===510.25,'Bank/date lookup cached');
check(admin_fx_reference(['bank'=>'XacBank','date'=>'2026-01-23'],fn()=>['docs'=>[]])['rate']===null,'Missing daily rate stays unknown');
$e=admin_finance_entry('GS-A');
admin_finance_save(array_replace($body,['version'=>$e['version'],'transport_cost_mnt'=>null,'fx_bank'=>'KhanBank','fx_purchase_date'=>'2026-01-23']));
$record=admin_finance_order($a);
check($record['entry']['fx_purchase_date']==='2026-01-23'&&$record['entry']['fx_bank']==='KhanBank','Reference selection persists');
check((float)$record['entry']['actual_cny_rate']===480.0&&$record['actual_cost']===57600,'Reference rate cannot replace the entered transaction rate');
$requestedDays=[];
$fakeBank=function(string $url)use(&$requestedDays):array {
    $requestedDays[]=substr($url,-10);
    return [['currency'=>'CNY','sellRate'=>540,'cashSellRate'=>550]];
};
check(finance_khan_refresh_order_days($fakeBank)>0&&in_array('2026-11-02',$requestedDays,true),'Worker fetches the order date in Ulaanbaatar');
check(count($requestedDays)===count(array_unique($requestedDays))&&count($requestedDays)<=6,'Worker fetches each day once and bounds requests');
check(finance_khan_refresh_order_days($fakeBank)===0,'Fresh and final daily rates are reused');
$record=admin_finance_order($a);
check($record['actual_cost']===57600&&$record['bank_fx']===-4800&&$record['sale_cny_rate']===500.0,'Historical selling rate and transaction cost are preserved');
$e=admin_finance_entry('GS-A');
admin_finance_save(array_replace($body,['version'=>$e['version'],'transport_cost_mnt'=>null,'actual_cny_rate'=>null,'extra_cargo_mnt'=>0]));
$new=$a;$new['quote']['rates']['cny_rate']=580;
$record=admin_finance_order($new);
check($record['bank_cny_rate']===540.0&&$record['cost_source']==='khanbank'&&$record['actual_cost']===64800&&$record['bank_fx']===4800,'580 selling rate generates a 4,800 MNT spread on 120 CNY');
check($record['profit']===33200,'Bank spread is included in profit through cost');
check(admin_finance_report([$new,$part])['bank_fx']===4800,'Split shipments do not repeat the FX gain');
file_put_contents(__DIR__.'/../tmp/finance-ui-fixture.json',json_encode(['finance'=>admin_finance_report([$a,$part])],JSON_UNESCAPED_UNICODE));
echo "admin-reports ok: actual FX, cargo, refunds, split isolation, missing costs, loss, owner authorization, concurrency and audit\n";
