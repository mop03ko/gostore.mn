<?php
declare(strict_types=1);

// Expose job status only. Credentials, order IDs, SMS contents and provider responses remain private.
function operations_worker_state(bool $enabled,?string $last,int $allowed,int $now,?int $oldest=null): string {
    if(!$enabled)return 'disabled';
    $at=$last?strtotime($last):false;
    if($at===false||$at>$now+60)return 'missing';
    if($now-$at>$allowed)return 'delayed';
    if($oldest&&$now-$oldest>$allowed)return 'backlog';
    return 'ok';
}
function operations_workers(PDO $db): array {
    $read=$db->prepare('SELECT value FROM meta WHERE key=?');
    $meta=static function(string $key)use($read): ?string{
        $read->execute([$key]);
        $value=$read->fetchColumn();
        $read->closeCursor();
        return is_string($value)?$value:null;
    };
    $sms=sendsms_enabled('orders');
    $oldest=null;
    if($sms&&$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sms_order_queue'")->fetchColumn()){
        $due=$db->query("SELECT MIN(created) FROM sms_order_queue WHERE state IN ('pending','sending')")->fetchColumn();
        $oldest=is_numeric($due)?(int)$due:null;
    }
    $tw=json_decode($meta('taoworld_worker')??'',true);
    $now=time();
    return [
        'sms'=>operations_worker_state($sms,$meta('sms_worker_last'),300,$now,$oldest),
        'qpay_expiry'=>operations_worker_state(qpay_ready(),$meta('checkout_expiry_worker_last'),300,$now),
        'taoworld'=>operations_worker_state(!empty(tw_settings()['enabled']),$tw['last_run']??null,600,$now,isset($tw['oldest_due'])?(int)$tw['oldest_due']:null),
    ];
}
