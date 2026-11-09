<?php
declare(strict_types=1);
// Admin reports: revenue and gross margin per order, CSV cell safety, search insights,
// API usage by kind (including rejected calls), purchase threshold, trial and dashboard alerts.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/admin-reports-test-'.bin2hex(random_bytes(5)));
require __DIR__.'/../server/bootstrap.php';
foreach(['shipping','logistics','supplier','admin-reports'] as $f)require_once __DIR__.'/../server/'.$f.'.php';
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
check($r['profit']['orders']===1&&$r['profit']['cost']===60000&&$r['profit']['margin']===40000&&$r['profit']['margin_pct']===40.0,'Gross margin uses the paid TaoWorld cost at the quoted rate');
check($r['profit']['unknown_cost']===2,'Orders without a paid supplier purchase (or closed ones) have unknown cost');
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
echo "admin-reports ok\n";
