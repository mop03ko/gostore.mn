<?php
declare(strict_types=1);
require_once __DIR__.'/sms-orders.php';

function sms_usage_schema(): void {
    sms_orders_schema();
    db()->exec('CREATE TABLE IF NOT EXISTS sms_otp_usage(id INTEGER PRIMARY KEY AUTOINCREMENT,purpose TEXT NOT NULL,phone_mask TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,cost INTEGER,verified_at INTEGER);
        CREATE INDEX IF NOT EXISTS sms_otp_usage_created ON sms_otp_usage(created);
        CREATE INDEX IF NOT EXISTS sms_order_queue_created ON sms_order_queue(created);');
    db()->prepare('INSERT OR IGNORE INTO meta(key,value) VALUES (?,?)')->execute(['sms_otp_usage_started',gmdate('c')]);
}
// No OTP, challenge, message, full phone number or provider credentials are retained here.
function sms_usage_otp_start(string $purpose,string $phone): int {
    sms_usage_schema();
    db()->prepare('INSERT INTO sms_otp_usage(purpose,phone_mask,state,created,updated) VALUES (?,?,?,?,?)')->execute([$purpose,substr($phone,0,2).'****'.substr($phone,-2),'sending',time(),time()]);
    return (int)db()->lastInsertId();
}
function sms_usage_otp_result(int $id,string $state,?int $cost=null,bool $verified=false): void {
    if($id<=0)return;
    // A reporting failure must never cause a second send or reject a correct OTP.
    try{
        if($verified)db()->prepare('UPDATE sms_otp_usage SET verified_at=?,updated=? WHERE id=? AND verified_at IS NULL')->execute([time(),time(),$id]);
        else db()->prepare('UPDATE sms_otp_usage SET state=?,cost=?,updated=? WHERE id=?')->execute([$state,$cost,time(),$id]);
    }catch(Throwable $e){error_log('GOStore SMS usage: result storage unavailable');}
}
function admin_sms_usage(array $q): array {
    admin_required();
    [$from,$to,$start,$end]=admin_report_range($q);
    $kind=$q['kind']??'all';if(!in_array($kind,['all','otp','order'],true))fail('SMS төрөл буруу.');
    $page=filter_var($q['page']??1,FILTER_VALIDATE_INT);if($page===false||$page<1||$page>100000)fail('Хуудасны дугаар буруу.');
    sms_usage_schema();$db=db();$cutoff=time()-300;
    $union="SELECT 'otp' AS kind,id,purpose AS event,phone_mask,'' AS order_id,state,created,updated,cost,verified_at FROM sms_otp_usage UNION ALL SELECT 'order',id,event,substr(phone,1,2)||'****'||substr(phone,-2),order_id,state,created,updated,cost,NULL FROM sms_order_queue";
    // Interrupted requests are unknown, never reported as delivered or automatically retried.
    $source="(SELECT kind,id,event,phone_mask,order_id,CASE WHEN state='sending' AND updated<$cutoff THEN 'uncertain' ELSE state END AS state,created,cost,verified_at FROM ($union) WHERE created>=? AND created<=?".($kind==='all'?'':' AND kind=?').')';
    $args=[$start,$end];if($kind!=='all')$args[]=$kind;
    $stmt=$db->prepare("SELECT state,COUNT(*) AS count FROM $source GROUP BY state");$stmt->execute($args);
    $counts=array_fill_keys(['pending','sending','accepted','failed','uncertain','cancelled'],0);foreach($stmt->fetchAll() as $r)$counts[$r['state']]=(int)$r['count'];
    $stmt=$db->prepare("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN state='accepted' AND cost>=0 THEN cost ELSE 0 END),0) AS known_cost,SUM(CASE WHEN state='accepted' AND (cost IS NULL OR cost<0) THEN 1 ELSE 0 END) AS unknown_cost,SUM(CASE WHEN verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified FROM $source");$stmt->execute($args);$summary=array_map('intval',$stmt->fetch());
    $stmt=$db->prepare("SELECT kind,id,event,phone_mask,order_id,state,created,cost,verified_at FROM $source ORDER BY created DESC,kind,id DESC LIMIT 50 OFFSET ".(($page-1)*50));$stmt->execute($args);$rows=$stmt->fetchAll();
    foreach($rows as &$r){$r['created']=gmdate('c',(int)$r['created']);$r['cost']=$r['cost']===null||$r['cost']<0?null:(int)$r['cost'];$r['verified_at']=$r['verified_at']?gmdate('c',(int)$r['verified_at']):null;}unset($r);
    $meta=$db->prepare('SELECT value FROM meta WHERE key=?');$meta->execute(['sms_worker_last']);$worker=$meta->fetchColumn()?:null;$meta->execute(['sms_otp_usage_started']);$since=$meta->fetchColumn();
    return ['from'=>$from,'to'=>$to,'kind'=>$kind,'page'=>$page,'pages'=>max(1,(int)ceil($summary['total']/50)),'summary'=>$summary,'states'=>$counts,'rows'=>$rows,'otp_recorded_since'=>$since,'service'=>['enabled'=>sendsms_enabled('otp')||sendsms_enabled('orders'),'otp_enabled'=>sendsms_enabled('otp'),'orders_enabled'=>sendsms_enabled('orders'),'type'=>sendsms_settings()['type'],'worker_last'=>$worker,'worker_healthy'=>$worker&&strtotime($worker)>=time()-300],'provider_balance'=>null];
}
