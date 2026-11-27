<?php
declare(strict_types=1);
require_once __DIR__.'/admin-batch-finance.php';

// Reporting-only ledger. Never changes customer invoices, paid flags or warehouse balances.
function admin_finance_entry(string $id): array {
    $q=db()->prepare('SELECT value FROM meta WHERE key=?');$q->execute(['finance:'.$id]);
    return array_replace(['version'=>0,'actual_cny_rate'=>null,'supplier_refund_cny'=>0,'transport_cost_mnt'=>null,'other_cost_mnt'=>null,'extra_cargo_mnt'=>0,'payment_date'=>'','note'=>'','complete'=>false],json_decode($q->fetchColumn()?:'{}',true)?:[]);
}
function admin_finance_save(array $b): array {
    admin_required();if(!admin_role_at_least('owner'))fail('Зөвхөн эзэмшигч санхүүгийн дүн засна.',403);
    $id=str_field($b,'id',50);$entry=[];
    foreach(['actual_cny_rate'=>100000,'supplier_refund_cny'=>1000000,'transport_cost_mnt'=>100000000,'other_cost_mnt'=>100000000,'extra_cargo_mnt'=>100000000] as $key=>$max){
        $v=$b[$key]??null;
        if($v===null||$v===''){$entry[$key]=in_array($key,['extra_cargo_mnt','supplier_refund_cny'],true)?0:null;continue;}
        if((!is_int($v)&&!is_float($v))||!is_finite((float)$v)||$v<($key==='actual_cny_rate'?0.01:0)||$v>$max||(str_ends_with($key,'_mnt')&&floor($v)!=$v))fail('Ханш эсвэл дүн буруу байна.');
        $entry[$key]=$key==='actual_cny_rate'?round((float)$v,4):($key==='supplier_refund_cny'?round((float)$v,2):(int)$v);
    }
    $entry['note']=str_field($b,'note',500,false);$entry['payment_date']=str_field($b,'payment_date',10,false);
    if($entry['payment_date']!==''&&(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$entry['payment_date'])||!checkdate((int)substr($entry['payment_date'],5,2),(int)substr($entry['payment_date'],8,2),(int)substr($entry['payment_date'],0,4))))fail('Төлсөн огноо буруу байна.');
    if($entry['extra_cargo_mnt']>0&&($entry['note']===''||$entry['payment_date']===''))fail('Гадуур төлсөн каргоны огноо, гүйлгээний тайлбарыг оруулна уу.');
    if(!is_bool($b['complete']??null))fail('Зардал бүрэн эсэхийг сонгоно уу.');$entry['complete']=$b['complete'];
    $version=int_field($b,'version',0,PHP_INT_MAX);$db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];if(!empty($o['demo']))fail('Жишээ захиалгад бодит дүн оруулахгүй.',409);
        if(finance_batch_share($id)&&($entry['transport_cost_mnt']??0)>0)fail('Багцын зардал бүртгэгдсэн. Тээврийн дүнг багцаар засна уу.',409);
        if($entry['supplier_refund_cny']>(int)($o['purchase']['supplier_total_fen']??0)/100)fail('Нийлүүлэгчийн буцаалт худалдан авсан дүнгээс их байна.');
        $old=admin_finance_entry($id);if($old['version']!==$version)fail('Өөр админ шинэчилсэн байна. Дахин нээгээд шалгана уу.',409);
        $entry['version']=$version+1;$entry['updated_at']=gmdate('c');
        $db->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['finance:'.$id,json_encode($entry,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    admin_audit_write('admin-finance-save',$id,json_encode(['before'=>$old,'after'=>$entry],JSON_UNESCAPED_UNICODE));
    return ['ok'=>true,'entry'=>$entry];
}
function admin_finance_order(array $o): array {
    $e=admin_finance_entry($o['id']);$part=!empty($o['shipment_parent']);
    $batchShare=finance_batch_share($o['id']);$transport=$batchShare['amount_mnt']??$e['transport_cost_mnt'];
    $initial=(!$part&&!empty($o['paid']))?(int)($o['amount']??0):0;
    $manual=array_sum(array_map(fn($r)=>max(0,(int)($r['amount']??0)),$o['freight_receipts']??[]));
    $balance=max(0,(int)($o['freight']['paid_amount']??0))+$manual;
    $refund=array_sum(array_map(fn($r)=>(int)($r['amount']??0),$o['refunds']??[]));
    $gross=$initial+$balance+$e['extra_cargo_mnt'];$net=$gross-$refund;
    // A balance invoice can also contain domestic delivery and service fees. Allocate cargo only
    // after the final settlement is fully paid; leave partial/unsettled balances unclassified.
    $cargo=null;$s=$o['settlement']??null;
    if($s&&$initial+$balance-$refund>=(int)$s['total'])$cargo=min(max(0,$initial+$balance-$refund),max(0,(int)($s['breakdown']['cargo_mnt']??0)));
    elseif($balance===0&&empty($o['quote']['breakdown']['cargo_mnt']))$cargo=0;
    if($cargo!==null)$cargo+=$e['extra_cargo_mnt'];
    $p=$o['purchase']??[];$supplier=null;$quoted=null;$actual=null;$fx=null;
    if($part||($o['type']??'')==='forwarding'){$supplier=0.0;$quoted=0;$actual=0;$fx=0;}
    elseif(($p['provider']??'')==='taoworld'&&!empty($p['paid_child_ids'])&&(($p['state']??'')!=='closed'||$e['complete'])&&isset($p['supplier_total_fen'])){
        $supplier=max(0,round((int)$p['supplier_total_fen']/100-$e['supplier_refund_cny'],2));
        $rate=$o['quote']['rates']['cny_rate']??null;
        if(is_numeric($rate)&&$rate>0)$quoted=(int)round($supplier*$rate);
        if($e['actual_cny_rate']!==null)$actual=(int)round($supplier*$e['actual_cny_rate']);
        if($quoted!==null&&$actual!==null)$fx=$quoted-$actual;
    }
    $missing=[];
    if($actual===null)$missing[]=$supplier===null?'Нийлүүлэгчийн төлсөн дүн':'Юань авсан бодит ханш';
    if($transport===null)$missing[]='Бодит тээврийн зардал';
    if($e['other_cost_mnt']===null)$missing[]='Бусад зардал';
    if(!$e['complete'])$missing[]='Зардал, буцаалтын тулгалт';
    $profit=$missing?null:$net-$actual-$transport-$e['other_cost_mnt'];
    return ['id'=>$o['id'],'day'=>admin_report_day($o['created']),'status'=>$o['status'],'part'=>$part,'initial'=>$initial,'balance'=>$balance,'extra_cargo'=>$e['extra_cargo_mnt'],'gross'=>$gross,'refund'=>$refund,'net'=>$net,'cargo'=>$cargo,'supplier_cny'=>$supplier,'quoted_cost'=>$quoted,'actual_cost'=>$actual,'fx'=>$fx,'transport_cost'=>$transport,'transport_batch'=>$batchShare['batch_id']??null,'other_cost'=>$e['other_cost_mnt'],'profit'=>$profit,'missing'=>$missing,'entry'=>$e];
}
function admin_finance_report(array $orders): array {
    $f=['gross'=>0,'initial'=>0,'balance'=>0,'extra_cargo'=>0,'refund'=>0,'net'=>0,'cargo'=>0,'supplier_cny'=>0,'quoted_cost'=>0,'actual_cost'=>0,'fx'=>0,'transport_cost'=>0,'other_cost'=>0,'profit'=>0,'paid_orders'=>0,'complete_orders'=>0,'shipment_parts'=>0,'missing'=>[],'rows'=>[]];
    $f['days']=[];
    foreach(['cargo','supplier_cny','quoted_cost','actual_cost','fx','transport_cost','other_cost','profit'] as $k)$f['missing'][$k]=0;
    foreach($orders as $o){if(!empty($o['demo']))continue;$r=admin_finance_order($o);
        // Include paid, refunded and cost-only orders; ignore unpaid abandoned requests.
        if(!$r['gross']&&!$r['refund']&&empty($o['purchase']['paid_child_ids'])&&$r['transport_cost']===null&&$r['other_cost']===null)continue;
        if($r['part'])$f['shipment_parts']++;elseif($r['gross']>0)$f['paid_orders']++;
        if($r['profit']!==null)$f['complete_orders']++;
        $f['days'][$r['day']]=($f['days'][$r['day']]??0)+$r['net'];
        foreach(['gross','initial','balance','extra_cargo','refund','net','cargo','supplier_cny','quoted_cost','actual_cost','fx','transport_cost','other_cost','profit'] as $k){if($r[$k]===null)$f['missing'][$k]++;else $f[$k]+=$r[$k];}
        $f['rows'][]=$r;
    }
    $f['row_count']=count($f['rows']);$f['rows']=array_slice(array_reverse($f['rows']),0,100);
    foreach($f['missing'] as $k=>$count)if($count)$f[$k]=null;
    return $f;
}
