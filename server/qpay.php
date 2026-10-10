<?php
declare(strict_types=1);
// Merchant V2: https://developer.qpay.mn/mn/docs/merchant?version=2.0.0
function qpay_ready(): bool {
    $q=config()['qpay']; return $q['enabled'] && $q['client_id'] && $q['client_secret'] && $q['invoice_code'];
}
function qpay_http(string $path, array $payload, string $auth): array {
    $base=config()['qpay']['environment']==='production'?'https://merchant.qpay.mn':'https://merchant-sandbox.qpay.mn';
    $ch=curl_init($base.$path);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: '.$auth],CURLOPT_POSTFIELDS=>json_encode($payload?:new stdClass())]);
    $raw=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    if ($raw===false || $status<200 || $status>=300) fail('QPay холболтын алдаа. Дахин нэхэмжлэл үүсгэхээс өмнө админ шалгана уу.',502);
    $data=json_decode($raw,true); if (!is_array($data)) fail('QPay хариу буруу байна.',502); return $data;
}
// QPay returns an absolute Unix timestamp, not a duration in seconds.
function qpay_token_expiry(array $data, ?int $now = null): int {
    $value = $data['expires_in'] ?? null;
    if ((!is_int($value) && !is_string($value)) || !preg_match('/^\d+$/', (string)$value)) {
        fail('QPay token-ий хугацаа буруу ирлээ.', 502);
    }
    $expires = filter_var($value, FILTER_VALIDATE_INT);
    if ($expires === false || $expires <= ($now ?? time())) {
        fail('QPay token-ий хугацаа дууссан байна. Серверийн цаг болон QPay тохиргоог шалгана уу.', 502);
    }
    return $expires;
}
function qpay_token(): string {
    if (!qpay_ready()) fail('QPay merchant тохиргоо хараахан хийгдээгүй.',503);
    $q=config()['qpay']; $key=hash('sha256',$q['environment'].$q['client_id'].$q['client_secret']);
    $lock=fopen(config()['data_dir'].'/qpay-token.json','c+');
    if (!$lock || !flock($lock,LOCK_EX)) fail('QPay token түр ашиглах боломжгүй.',503);
    try {
        $cached=json_decode(stream_get_contents($lock),true)?:[];
        if (($cached['key']??'')===$key && ($cached['expires']??0)>time()+60) return $cached['token'];
        $data=qpay_http('/v2/auth/token',[],'Basic '.base64_encode($q['client_id'].':'.$q['client_secret']));
        if (empty($data['access_token'])) fail('QPay token ирсэнгүй.',502);
        // QPay access token expiration is an absolute Unix timestamp.
        $expires=qpay_token_expiry($data);
        ftruncate($lock,0); rewind($lock); fwrite($lock,json_encode(['key'=>$key,'token'=>$data['access_token'],'expires'=>$expires]));
        return $data['access_token'];
    } finally { flock($lock,LOCK_UN); fclose($lock); }
}
function paid_amount(array $result): int {
    $total=0; $seen=[];
    foreach ($result['rows']??[] as $row) {
        $id=$row['payment_id']??''; $amount=(string)($row['payment_amount']??'');
        if (!$id || isset($seen[$id]) || ($row['payment_status']??'')!=='PAID' || ($row['payment_currency']??'')!=='MNT') continue;
        if (!preg_match('/^\d+(?:\.0{1,2})?$/',$amount)) continue;
        $seen[$id]=true; $total+=(int)$amount;
    }
    return $total;
}
function qpay_invoice(string $id): array {
    if (!qpay_ready()) fail('QPay merchant тохиргоо хүлээгдэж байна.',503);
    $db=db(); $db->exec('BEGIN IMMEDIATE');
    try {
        $o=order_row($id)['order'];
        if (($o['invoice']['state']??'')==='ready') { $db->exec('COMMIT'); return $o; }
        if (isset($o['invoice'])) fail('Нэхэмжлэлийн өмнөх оролдлогыг админ шалгах шаардлагатай.',409);
        if ($o['status']!=='quoted' || $o['amount']<1 || $o['demo']) fail('Бодит бараа, хүргэлтийн нийт үнийг админ баталгаажуулсны дараа төлнө.',409);
        if (!str_starts_with(config()['site_url'],'https://')) fail('QPay callback-д HTTPS домэйн шаардлагатай.',503);
        $o['callback_token']=bin2hex(random_bytes(32));
        $o['invoice']=['state'=>'creating','sender_invoice_no'=>$id.'-'.bin2hex(random_bytes(4))];
        save_order($o); $db->exec('COMMIT');
    } catch (Throwable $e) { $db->exec('ROLLBACK'); throw $e; }
    try {
        $data=qpay_http('/v2/invoice',[
            'invoice_code'=>config()['qpay']['invoice_code'],'sender_invoice_no'=>$o['invoice']['sender_invoice_no'],
            'invoice_receiver_code'=>'terminal','invoice_description'=>'GOStore '.$id,'amount'=>$o['amount'],
            'callback_url'=>rtrim(config()['site_url'],'/').'/api/index.php?action=qpay-callback&id='.rawurlencode($id).'&key='.$o['callback_token'],
        ],'Bearer '.qpay_token());
        if (empty($data['invoice_id']) || empty($data['qr_image'])) fail('Нэхэмжлэлийн мэдээлэл дутуу ирлээ.',502);
        $o['invoice']+=['id'=>$data['invoice_id'],'qr_image'=>$data['qr_image'],'qr_text'=>$data['qr_text']??'','urls'=>$data['urls']??[]];
        $o['invoice']['state']='ready'; save_order($o); return $o;
    } catch (Throwable $e) {
        $o['invoice']['state']='review'; save_order($o); throw $e;
    }
}
function qpay_callback(string $id,string $key): array {
    $o=order_row($id)['order'];
    if (empty($o['callback_token']) || !hash_equals($o['callback_token'],$key)) fail('Callback эрхгүй.',403);
    if ($o['paid']) return ['ok'=>true];
    if (($o['invoice']['state']??'')!=='ready') fail('Нэхэмжлэл бэлтгэгдэж байна.',503);
    limit_attempts('callback:'.$id,30,300);
    $result=qpay_http('/v2/payment/check',['object_type'=>'INVOICE','object_id'=>$o['invoice']['id'],'offset'=>['page_number'=>1,'page_limit'=>100]],'Bearer '.qpay_token());
    if (paid_amount($result)>=$o['amount']) {
        $db=db(); $db->exec('BEGIN IMMEDIATE');
        try { $fresh=order_row($id)['order']; $fresh['paid']=true; $fresh['paid_at']=gmdate('c'); if ($fresh['status']==='quoted') $fresh['status']='confirmed'; save_order($fresh); $db->exec('COMMIT'); }
        catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    }
    return ['ok'=>true];
}
