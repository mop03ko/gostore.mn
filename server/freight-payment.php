<?php
declare(strict_types=1);

// The original purchase invoice remains immutable. This invoice only collects the final balance.
function freight_invoice(string $id): array {
    if(!qpay_ready())fail('QPay merchant тохиргоо хүлээгдэж байна.',503);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];$summary=settlement_summary($o);
        if(($o['freight']['invoice']['state']??'')==='ready'){$db->exec('COMMIT');return $o;}
        if(isset($o['freight']['invoice']))fail('Нэхэмжлэлийн өмнөх оролдлогыг админ шалгах шаардлагатай.',409);
        if(!$summary['finalized']||$summary['due']<1||$o['demo']||in_array($o['status'],['cancelled','completed'],true))fail('Эцсийн төлбөрийн нэхэмжлэл үүсгэх боломжгүй.',409);
        if(!str_starts_with(config()['site_url'],'https://'))fail('QPay callback-д HTTPS домэйн шаардлагатай.',503);
        $f=['amount'=>$summary['due'],'paid_amount'=>0,'callback_token'=>bin2hex(random_bytes(32)),'invoice'=>['state'=>'creating','sender_invoice_no'=>$id.'-F-'.bin2hex(random_bytes(4))]];
        $o['freight']=$f;save_order($o);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    try{
        $data=qpay_http('/v2/invoice',['invoice_code'=>config()['qpay']['invoice_code'],'sender_invoice_no'=>$f['invoice']['sender_invoice_no'],'invoice_receiver_code'=>'terminal','invoice_description'=>'GOStore '.$id.' final balance','amount'=>$f['amount'],'callback_url'=>rtrim(config()['site_url'],'/').'/api/index.php?action=freight-callback&id='.rawurlencode($id).'&key='.$f['callback_token']],'Bearer '.qpay_token());
        if(empty($data['invoice_id'])||empty($data['qr_image']))fail('Нэхэмжлэлийн мэдээлэл дутуу ирлээ.',502);
        $invoice=['state'=>'ready','sender_invoice_no'=>$f['invoice']['sender_invoice_no'],'id'=>$data['invoice_id'],'qr_image'=>$data['qr_image'],'urls'=>$data['urls']??[]];
    }catch(Throwable $e){$error=$e;$invoice=$f['invoice'];$invoice['state']='review';}
    $db->exec('BEGIN IMMEDIATE');
    try{$o=order_row($id)['order'];$o['freight']['invoice']=$invoice;save_order($o);$db->exec('COMMIT');}catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    if(isset($error))throw $error;return $o;
}
function freight_callback(string $id,string $key): array {
    $o=order_row($id)['order'];$f=$o['freight']??[];
    if(empty($f['callback_token'])||!hash_equals($f['callback_token'],$key))fail('Callback эрхгүй.',403);
    if(($f['paid_amount']??0)>=$f['amount'])return ['ok'=>true];
    if(($f['invoice']['state']??'')!=='ready')fail('Нэхэмжлэл бэлтгэгдэж байна.',503);
    limit_attempts('freight-callback:'.$id,30,300);
    $result=qpay_http('/v2/payment/check',['object_type'=>'INVOICE','object_id'=>$f['invoice']['id'],'offset'=>['page_number'=>1,'page_limit'=>100]],'Bearer '.qpay_token());
    $paid=paid_amount($result);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];
        if($o['freight']['invoice']['id']!==$f['invoice']['id'])fail('Нэхэмжлэл өөрчлөгдсөн байна.',409);
        $o['freight']['paid_amount']=max($o['freight']['paid_amount']??0,$paid);
        if($paid>=$f['amount'])$o['freight']['paid_at']=gmdate('c');
        save_order($o);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return ['ok'=>true];
}
