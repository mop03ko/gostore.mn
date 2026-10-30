<?php
declare(strict_types=1);
// Merchant V2: https://developer.qpay.mn/mn/docs/merchant?version=2.0.0
function qpay_ready(): bool {
    $q=config()['qpay']; return $q['enabled'] && $q['client_id'] && $q['client_secret'] && $q['invoice_code'];
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
    $validated=order_row($id)['order'];$verifiedUntil=PHP_INT_MAX;
    product_policy_order_assert($validated);
    if(($validated['type']??'')==='checkout'&&!isset($validated['invoice']))$verifiedUntil=checkout_validate_payment($validated);
    $db=db(); $db->exec('BEGIN IMMEDIATE');
    try {
        $o=order_row($id)['order'];
        product_policy_order_assert($o);
        if (($o['invoice']['state']??'')==='ready') { $db->exec('COMMIT'); return $o; }
        if (isset($o['invoice'])) fail('Нэхэмжлэлийн өмнөх оролдлогыг админ шалгах шаардлагатай.',409);
        if($verifiedUntil<=time())fail('Үнэ шалгах хугацаа дууссан. Дахин шалгана уу.',409);
        if(($o['type']??'')==='checkout'&&array_intersect_key($o,array_flip(['items','amount','quote','status','payment_due']))!==array_intersect_key($validated,array_flip(['items','amount','quote','status','payment_due'])))fail('Захиалга өөрчлөгдсөн байна. Дахин шалгана уу.',409);
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
        $db->exec('BEGIN IMMEDIATE');
        try{$o=order_row($id)['order'];$o['invoice']+=['id'=>$data['invoice_id'],'qr_image'=>$data['qr_image'],'qr_text'=>$data['qr_text']??'','urls'=>$data['urls']??[]];$o['invoice']['state']='ready';save_order($o);$db->exec('COMMIT');}catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}return $o;
    } catch (Throwable $e) {
        $db->exec('BEGIN IMMEDIATE');try{$o=order_row($id)['order'];if(($o['invoice']['state']??'')==='creating'){$o['invoice']['state']='review';save_order($o);}$db->exec('COMMIT');}catch(Throwable $saveError){$db->exec('ROLLBACK');throw $saveError;}throw $e;
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
        try { $fresh=order_row($id)['order']; if(!$fresh['paid']){$fresh['paid']=true;$fresh['paid_at']=gmdate('c');if($fresh['status']==='quoted'||($fresh['status']==='cancelled'&&($fresh['cancel_reason']??'')==='payment_timeout')){$fresh['status']='confirmed';unset($fresh['cancel_reason']);$fresh['history'][]=['status'=>'confirmed','at'=>gmdate('c')];}save_order($fresh);} $db->exec('COMMIT'); }
        catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        // Buying from Taobao never delays or fails the payment confirmation itself.
        if(function_exists('tw_after_payment'))tw_after_payment($id);
        if(function_exists('taobao_purchase_after_payment'))taobao_purchase_after_payment($id);
    }
    return ['ok'=>true];
}
