<?php
declare(strict_types=1);

// Admin reports: sales and gross margin, CSV exports, search insights, TaoWorld API usage and the
// purchase threshold that sets TaoWorld's product pool and daily quota, and dashboard alerts.
// Days are Ulaanbaatar dates unless stated; the API budget follows TaoWorld's UTC day.
const TAOWORLD_PURCHASE_THRESHOLD_CNY = 10000;
const TAOWORLD_TRIAL_DAYS = 30;

function admin_report_range(array $q): array {
    $today=gmdate('Y-m-d',time()+8*3600);
    $to=(string)($q['to']??'')?:$today;$from=(string)($q['from']??'')?:gmdate('Y-m-d',strtotime($to.' 00:00:00 UTC')-29*86400);
    foreach([$from,$to] as $d)if(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$d)||!checkdate((int)substr($d,5,2),(int)substr($d,8,2),(int)substr($d,0,4)))fail('Огноо буруу байна.');
    if($from>$to)fail('Эхлэх огноо дуусах огнооноос хойш байна.');
    if((strtotime($to.' UTC')-strtotime($from.' UTC'))/86400>400)fail('Хамгийн ихдээ 400 хоногийн тайлан гаргана.');
    return [$from,$to,strtotime($from.' 00:00:00 +08:00'),strtotime($to.' 23:59:59 +08:00')];
}
function admin_report_day(string $iso): string {return gmdate('Y-m-d',(strtotime($iso)?:0)+8*3600);}
function admin_report_orders(int $from,int $to): array {
    $s=db()->prepare('SELECT data FROM orders WHERE created>=? AND created<=? ORDER BY created');$s->execute([gmdate('c',$from),gmdate('c',$to)]);
    return array_map(fn($r)=>json_decode($r['data'],true),$s->fetchAll());
}
// Money per order (₮). Revenue is what the customer paid, net of refunds. Supplier cost is the paid
// TaoWorld purchase (goods + domestic shipping in China) at the order's quoted rate; cargo and
// operating costs are not included, so the margin is a gross margin before those.
function admin_order_money(array $o): array {
    $s=function_exists('settlement_summary')?settlement_summary($o):['paid'=>($o['paid']??false)?(int)($o['amount']??0):0,'refunded'=>0];
    $p=$o['purchase']??null;$costCny=null;
    if(($p['provider']??'')==='taoworld'&&!empty($p['paid_child_ids'])&&($p['state']??'')!=='closed')$costCny=((int)($p['supplier_total_fen']??0))/100;
    $rate=(float)($o['quote']['rates']['cny_rate']??shipping_settings()['cny_rate']);
    $cost=$costCny===null?null:(int)round($costCny*$rate);
    return ['revenue'=>max(0,(int)$s['paid']),'refunded'=>(int)$s['refunded'],'cost_cny'=>$costCny,'cost'=>$cost,'margin'=>$cost===null?null:max(0,(int)$s['paid'])-$cost];
}
function admin_report(array $q): array {
    [$from,$to,$fromTs,$toTs]=admin_report_range($q);
    $days=[];for($t=strtotime($from.' UTC');$t<=strtotime($to.' UTC');$t+=86400)$days[gmdate('Y-m-d',$t)]=['day'=>gmdate('Y-m-d',$t),'orders'=>0,'paid'=>0,'revenue'=>0];
    $totals=['orders'=>0,'paid_orders'=>0,'revenue'=>0,'refunded'=>0,'cancelled'=>0,'demo_excluded'=>0];$statuses=[];$types=[];
    $profit=['orders'=>0,'revenue'=>0,'cost'=>0,'margin'=>0,'unknown_cost'=>0];$rows=[];
    foreach(admin_report_orders($fromTs,$toTs) as $o){
        if(!empty($o['demo'])){$totals['demo_excluded']++;continue;}
        $day=admin_report_day($o['created']);$m=admin_order_money($o);
        $totals['orders']++;$days[$day]['orders']=($days[$day]['orders']??0)+1;
        $statuses[$o['status']]=($statuses[$o['status']]??0)+1;$types[$o['type']??'']=($types[$o['type']??'']??0)+1;
        if($o['status']==='cancelled')$totals['cancelled']++;
        $totals['refunded']+=$m['refunded'];
        if($m['revenue']>0){$totals['paid_orders']++;$totals['revenue']+=$m['revenue'];$days[$day]['paid']++;$days[$day]['revenue']+=$m['revenue'];
            if($m['cost']===null)$profit['unknown_cost']++;
            else{$profit['orders']++;$profit['revenue']+=$m['revenue'];$profit['cost']+=$m['cost'];$profit['margin']+=$m['margin'];}
            $rows[]=['id'=>$o['id'],'day'=>$day,'customer'=>$o['customer']??'','status'=>$o['status'],'revenue'=>$m['revenue'],'cost'=>$m['cost'],'cost_cny'=>$m['cost_cny'],'margin'=>$m['margin']];
        }
    }
    $totals['aov']=$totals['paid_orders']?(int)round($totals['revenue']/$totals['paid_orders']):0;
    $profit['margin_pct']=$profit['revenue']?round($profit['margin']*100/$profit['revenue'],1):null;
    arsort($statuses);
    return ['from'=>$from,'to'=>$to,'totals'=>$totals,'days'=>array_values($days),'statuses'=>$statuses,'types'=>$types,'profit'=>$profit,'orders'=>array_slice(array_reverse($rows),0,100)];
}

// CSV for spreadsheets: UTF-8 with BOM; cells that start like a formula are quoted with '.
function admin_csv_cell(mixed $v): string {
    if($v===null)return '';if(is_bool($v))return $v?'1':'0';$v=(string)$v;
    return preg_match('/^[=+\-@\t\r]/',$v)?"'".$v:$v;
}
function admin_export(array $q): never {
    $kind=(string)($q['kind']??'');if(!in_array($kind,['orders','payments','customers'],true))fail('Тайлангийн төрөл буруу.');
    [$from,$to,$fromTs,$toTs]=admin_report_range($q);$rows=[];
    if($kind==='orders'){
        $rows[]=['Захиалга','Огноо','Төлөв','Төрөл','Хэрэглэгч','Утас','Гарчиг','Үнийн санал ₮','Төлсөн (цэвэр) ₮','Буцаасан ₮','TaoWorld ¥','TaoWorld ₮','Нийт ашиг ₮','TaoWorld төлөв'];
        foreach(admin_report_orders($fromTs,$toTs) as $o){if(!empty($o['demo']))continue;$m=admin_order_money($o);
            $rows[]=[$o['id'],admin_report_day($o['created']),$o['status'],$o['type']??'',$o['customer']??'',$o['phone']??'',$o['title']??'',(int)($o['amount']??0),$m['revenue'],$m['refunded'],$m['cost_cny'],$m['cost'],$m['margin'],$o['purchase']['state']??''];}
    }elseif($kind==='payments'){
        $rows[]=['Захиалга','Огноо','Төрөл','Дүн ₮','Тайлбар'];
        foreach(admin_report_orders($fromTs,$toTs) as $o){if(!empty($o['demo']))continue;
            if(!empty($o['paid']))$rows[]=[$o['id'],admin_report_day($o['paid_at']??$o['created']),'QPay төлбөр',(int)($o['amount']??0),''];
            if(!empty($o['freight']['paid_amount']))$rows[]=[$o['id'],admin_report_day($o['freight']['paid_at']??$o['created']),'Тээврийн төлбөр',(int)$o['freight']['paid_amount'],''];
            foreach($o['refunds']??[] as $r)$rows[]=[$o['id'],admin_report_day($r['at']??$o['created']),'Буцаалт',-(int)($r['amount']??0),$r['note']??''];}
    }else{
        $rows[]=['Хэрэглэгч','Нэр','Имэйл','Утас','Бүртгүүлсэн','Захиалгын тоо'];
        $s=db()->prepare('SELECT c.id,c.name,c.email,c.phone,c.created,(SELECT COUNT(*) FROM customer_orders o WHERE o.customer_id=c.id) AS orders FROM customers c WHERE c.created>=? AND c.created<=? ORDER BY c.created');
        $s->execute([gmdate('c',$fromTs),gmdate('c',$toTs)]);
        foreach($s->fetchAll() as $c)$rows[]=[$c['id'],$c['name'],$c['email'],$c['phone'],admin_report_day($c['created']),(int)$c['orders']];
    }
    if(function_exists('admin_audit_write'))admin_audit_write('admin-export',$kind,$from.' – '.$to.' · '.(count($rows)-1).' мөр');
    http_response_code(200);header('Content-Type: text/csv; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
    header('Content-Disposition: attachment; filename="gostore-'.$kind.'-'.$from.'_'.$to.'.csv"');
    $out=fopen('php://output','w');fwrite($out,"\xEF\xBB\xBF");foreach($rows as $row)fputcsv($out,array_map('admin_csv_cell',$row),',','"','');fclose($out);exit;
}

// Search insights: page-one searches with their result counts (no shopper identity is stored).
function search_log_schema(): void {
    static $done=false;if($done)return;
    db()->exec('CREATE TABLE IF NOT EXISTS search_log (day TEXT NOT NULL, q TEXT NOT NULL, hits INTEGER NOT NULL, zero INTEGER NOT NULL, PRIMARY KEY(day,q))');$done=true;
}
function search_log_normalize(string $q): string {
    $q=mb_strtolower(trim(preg_replace('/\s+/u',' ',$q)??''));return mb_substr($q,0,80);
}
function search_log_record(string $q,int $results): void {
    try{
        $q=search_log_normalize($q);if($q===''||$q==='__all__'||mb_strlen($q)<2)return;
        search_log_schema();$db=db();$day=gmdate('Y-m-d',time()+8*3600);
        $new=$db->prepare('INSERT OR IGNORE INTO search_log VALUES (?,?,0,0)');$new->execute([$day,$q]);
        $db->prepare('UPDATE search_log SET hits=hits+1,zero=zero+? WHERE day=? AND q=?')->execute([$results===0?1:0,$day,$q]);
        if($new->rowCount()===1&&random_int(1,50)===1)$db->prepare('DELETE FROM search_log WHERE day<?')->execute([gmdate('Y-m-d',time()-180*86400)]);
    }catch(Throwable $e){error_log('GOStore search log skipped: '.get_class($e));}
}
function admin_search_insights(array $q): array {
    $days=(int)($q['days']??30);if(!in_array($days,[7,30,90],true))fail('Хугацаа буруу.');
    search_log_schema();$since=gmdate('Y-m-d',time()+8*3600-($days-1)*86400);
    $top=db()->prepare('SELECT q,SUM(hits) AS hits,SUM(zero) AS zero FROM search_log WHERE day>=? GROUP BY q ORDER BY hits DESC,q LIMIT 40');$top->execute([$since]);
    $zero=db()->prepare('SELECT q,SUM(hits) AS hits,SUM(zero) AS zero FROM search_log WHERE day>=? GROUP BY q HAVING SUM(zero)>0 ORDER BY zero DESC,q LIMIT 40');$zero->execute([$since]);
    $sum=db()->prepare('SELECT COALESCE(SUM(hits),0) AS hits,COALESCE(SUM(zero),0) AS zero,COUNT(DISTINCT q) AS terms FROM search_log WHERE day>=?');$sum->execute([$since]);
    $cast=fn($r)=>['q'=>$r['q'],'hits'=>(int)$r['hits'],'zero'=>(int)$r['zero']];
    $t=$sum->fetch();
    return ['days'=>$days,'since'=>$since,'searches'=>(int)$t['hits'],'zero'=>(int)$t['zero'],'terms'=>(int)$t['terms'],'top'=>array_map($cast,$top->fetchAll()),'zero_results'=>array_map($cast,$zero->fetchAll())];
}

// TaoWorld usage and purchase threshold.
function admin_quota_settings(): array {
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['taoworld_quota']);
    return array_replace(['trial_started'=>'','external_cny'=>0,'known_daily_quota'=>0,'note'=>''],json_decode($s->fetchColumn()?:'{}',true)?:[]);
}
function admin_quota_save(array $b): array {
    $trial=str_field($b,'trial_started',10,false);
    if($trial!==''&&(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$trial)||!checkdate((int)substr($trial,5,2),(int)substr($trial,8,2),(int)substr($trial,0,4))))fail('Туршилт эхэлсэн огноо буруу.');
    $external=$b['external_cny']??0;if(!is_int($external)&&!is_float($external)||$external<0||$external>100000000)fail('Гаднаас худалдан авсан дүн буруу.');
    $quota=$b['known_daily_quota']??0;if(!is_int($quota)||$quota<0||$quota>10000000)fail('Өдрийн лимит буруу.');
    $value=['trial_started'=>$trial,'external_cny'=>round((float)$external,2),'known_daily_quota'=>$quota,'note'=>str_field($b,'note',300,false),'updated'=>gmdate('c')];
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['taoworld_quota',json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    return admin_api_usage();
}
function admin_taoworld_purchases(): array {
    $total=0;$recent=0;$count=0;$since=time()-30*86400;
    foreach(db()->query('SELECT data FROM orders')->fetchAll() as $r){
        $o=json_decode($r['data'],true);$p=$o['purchase']??null;
        if(($p['provider']??'')!=='taoworld'||empty($p['paid_child_ids'])||($p['state']??'')==='closed')continue;
        $fen=(int)($p['supplier_total_fen']??0);$total+=$fen;$count++;
        if((strtotime($p['pay_submitted_at']??$p['submitted_at']??$o['created'])?:0)>=$since)$recent+=$fen;
    }
    return ['orders'=>$count,'total_cny'=>round($total/100,2),'last30_cny'=>round($recent/100,2)];
}
function admin_api_usage(): array {
    supplier_budget_schema();
    $status=supplier_budget_status();$since=gmdate('Y-m-d',time()-29*86400);
    $s=db()->prepare('SELECT day,kind,hits FROM supplier_budget_daily WHERE day>=? ORDER BY day');$s->execute([$since]);
    $days=[];for($t=time()-29*86400;$t<=time();$t+=86400)$days[gmdate('Y-m-d',$t)]=['day'=>gmdate('Y-m-d',$t),'total'=>0,'background'=>0,'rejected'=>0,'kinds'=>[]];
    foreach($s->fetchAll() as $r){
        $d=&$days[$r['day']];$d??=['day'=>$r['day'],'total'=>0,'background'=>0,'rejected'=>0,'kinds'=>[]];$hits=(int)$r['hits'];
        if($r['kind']==='rejected'){$d['rejected']+=$hits;unset($d);continue;}
        $kind=$r['kind'];if(str_starts_with($kind,'bg:')){$d['background']+=$hits;$kind=substr($kind,3);}
        $d['total']+=$hits;$d['kinds'][$kind]=($d['kinds'][$kind]??0)+$hits;unset($d);
    }
    $settings=admin_quota_settings();$purchases=admin_taoworld_purchases();
    $counted=$purchases['total_cny']+(float)$settings['external_cny'];
    $trialEnd=$settings['trial_started']!==''?gmdate('Y-m-d',strtotime($settings['trial_started'].' UTC')+TAOWORLD_TRIAL_DAYS*86400):null;
    $daysLeft=$trialEnd===null?null:(int)floor((strtotime($trialEnd.' UTC')-strtotime(gmdate('Y-m-d',time()+8*3600).' UTC'))/86400);
    return ['status'=>$status,'days'=>array_values($days),'settings'=>$settings,'purchases'=>$purchases,
        'threshold'=>['cny'=>TAOWORLD_PURCHASE_THRESHOLD_CNY,'counted_cny'=>round($counted,2),'percent'=>min(100.0,round($counted*100/TAOWORLD_PURCHASE_THRESHOLD_CNY,1)),'reached'=>$counted>=TAOWORLD_PURCHASE_THRESHOLD_CNY,
            // TaoWorld's own example: CNY 10,000 per day on average → up to 70,000 calls per day.
            'estimated_daily_calls'=>$counted>=TAOWORLD_PURCHASE_THRESHOLD_CNY?(int)floor($purchases['last30_cny']/30*7):null],
        'trial'=>['started'=>$settings['trial_started']?:null,'ends'=>$trialEnd,'days_left'=>$daysLeft,'daily_calls'=>10000]];
}
// Dashboard alerts: each has a level (error/warning/info), text and the admin page that resolves it.
function admin_alerts(): array {
    $alerts=[];$u=admin_api_usage();$b=$u['status'];
    if($b['browse_limit']>0&&$b['used']>=$b['browse_limit'])$alerts[]=['level'=>'error','text'=>'Өнөөдрийн TaoWorld API лимит дууссан ('.$b['used'].'/'.$b['limit'].'). Шинэ хайлт хоосон харагдана.','page'=>'taoworld'];
    elseif($b['browse_limit']>0&&$b['used']>=0.8*$b['browse_limit'])$alerts[]=['level'=>'warning','text'=>'Өнөөдрийн TaoWorld API лимитийн '.round($b['used']*100/max(1,$b['limit'])).'% ашиглагдсан ('.$b['used'].'/'.$b['limit'].').','page'=>'taoworld'];
    $today=end($u['days']);if($today&&$today['rejected']>0)$alerts[]=['level'=>'warning','text'=>'Өнөөдөр лимитээс болж '.$today['rejected'].' хүсэлт татгалзсан.','page'=>'taoworld'];
    if($u['trial']['days_left']===null)$alerts[]=['level'=>'info','text'=>'TaoWorld-ийн 30 хоногийн туршилт эхэлсэн огноог оруулбал дуусахаас өмнө сануулна.','page'=>'taoworld'];
    elseif($u['trial']['days_left']<=7&&!$u['threshold']['reached'])$alerts[]=['level'=>$u['trial']['days_left']<0?'error':'warning','text'=>$u['trial']['days_left']<0?'TaoWorld-ийн туршилтын хугацаа дууссан. Худалдан авалт 10,000 юаньд хүрээгүй тул лимит хязгаарлагдана.':'TaoWorld-ийн туршилт '.$u['trial']['days_left'].' хоногийн дараа дуусна. Худалдан авалт: '.number_format($u['threshold']['counted_cny'],0,'.',',').' / 10,000 юань.','page'=>'taoworld'];
    $review=0;$refunds=0;
    foreach(db()->query('SELECT data FROM orders')->fetchAll() as $r){$o=json_decode($r['data'],true);$p=$o['purchase']??[];
        if(($p['provider']??'')==='taoworld'&&in_array($p['state']??'',['review','preflight_review'],true))$review++;
        foreach($p['refunds']??[] as $f)if(in_array((int)($f['status']??0),[10,20,30],true))$refunds++;}
    if($review)$alerts[]=['level'=>'warning','text'=>$review.' TaoWorld захиалга шалгах шаардлагатай байна.','page'=>'links'];
    if($refunds)$alerts[]=['level'=>'info','text'=>$refunds.' нийлүүлэгчийн буцаалт шийдвэрлэгдэхийг хүлээж байна.','page'=>'links'];
    return ['alerts'=>$alerts];
}
