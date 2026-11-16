<?php
// Isolated SQLite + fake QPay transport. Never uses real merchant credentials.
$fixture=__DIR__.'/../tmp/qpay-flow-'.bin2hex(random_bytes(6));
mkdir($fixture.'/server',0700,true);
foreach(['product-policy.php','bootstrap.php','qpay.php','checkout.php','staff-push.php','customer-push.php','config.example.php','seed.json'] as $file)copy(__DIR__.'/../server/'.$file,$fixture.'/server/'.$file);
file_put_contents($fixture.'/server/config.local.php','<?php return '.var_export([
    'data_dir'=>$fixture.'/data','site_url'=>'https://example.test',
    'qpay'=>['enabled'=>true,'environment'=>'sandbox','client_id'=>'test','client_secret'=>'fake','invoice_code'=>'TEST'],
],true).';');
$calls=[];$paymentRows=[];$invoiceFails=false;$checkFails=false;$cancelFails=false;$payDuringCancel=false;
putenv('GOSTORE_DATA_DIR='.$fixture.'/data');
putenv('GOSTORE_DISABLE_QPAY=0'); // Only the fake transport below is available in this process.
function qpay_http(string $path,array $payload,string $auth,string $method='POST'): array {
    global $calls,$paymentRows,$invoiceFails,$checkFails,$cancelFails,$payDuringCancel;
    $calls[]=$path;
    if($path==='/v2/auth/token')return ['access_token'=>'fake-token','expires_in'=>time()+3600];
    if($path==='/v2/invoice'){
        if($invoiceFails)throw new ApiError('Simulated timeout',502);
        if($payload['amount']!==100)throw new RuntimeException('Invoice must use the stored quote.');
        if(!str_starts_with($payload['callback_url'],'https://example.test/api/index.php?action=qpay-callback&'))throw new RuntimeException('Callback URL incorrect.');
        return ['invoice_id'=>'fake-invoice','qr_image'=>'ZmFrZQ==','urls'=>[]];
    }
    if($path==='/v2/payment/check'){
        if($checkFails)throw new ApiError('Check unavailable',502);
        if($payload['object_type']!=='INVOICE'||$payload['object_id']!=='fake-invoice')throw new RuntimeException('Wrong invoice checked.');
        return ['rows'=>$paymentRows];
    }
    if($path==='/v2/invoice/fake-invoice'){
        if($method!=='DELETE')throw new RuntimeException('Must cancel the invoice, never a payment');
        if($cancelFails)throw new ApiError('Cancel unavailable',502);
        if($payDuringCancel)$paymentRows=[['payment_id'=>'race','payment_status'=>'PAID','payment_currency'=>'MNT','payment_amount'=>'100.00']];
        return ['ok'=>true];
    }
    throw new RuntimeException('Unexpected QPay operation.');
}
require $fixture.'/server/bootstrap.php';
require $fixture.'/server/qpay.php';
require $fixture.'/server/checkout.php';
function verify_flow(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
function rejected_flow(callable $action,int $status):void {try{$action();}catch(ApiError $e){verify_flow($e->getCode()===$status,'Wrong error status');return;}throw new RuntimeException('Expected rejection');}
function seed_flow(string $id,bool $demo=false):void {
    $o=['id'=>$id,'status'=>'quoted','amount'=>100,'demo'=>$demo,'paid'=>false,'internal_note'=>''];
    db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,hash('sha256',$id),$id,json_encode($o),gmdate('c'),gmdate('c')]);
}
seed_flow('demo',true);rejected_flow(fn()=>qpay_invoice('demo'),409);
seed_flow('paid');$o=qpay_invoice('paid');qpay_invoice('paid');
verify_flow(strtotime($o['payment_due'])-strtotime($o['invoice']['issued_at'])===900,'Payment window must start when QR is ready and last 15 minutes');
verify_flow(qpay_invoice('paid')['payment_due']===$o['payment_due'],'Reopening must never extend payment time');
verify_flow(count(array_filter($calls,fn($p)=>$p==='/v2/invoice'))===1,'Repeated clicks created duplicate invoices');
verify_flow(!isset(public_order($o)['callback_token']),'Public order leaked callback secret');
$before=count($calls);rejected_flow(fn()=>qpay_callback('paid','wrong'),403);verify_flow(count($calls)===$before,'Invalid callback contacted QPay');
qpay_callback('paid',$o['callback_token']);verify_flow(!order_row('paid')['order']['paid'],'Unpaid invoice marked paid');
$paymentRows=[['payment_id'=>'one','payment_status'=>'PAID','payment_currency'=>'MNT','payment_amount'=>'60.00']];
$paymentRows[]=$paymentRows[0];qpay_callback('paid',$o['callback_token']);
verify_flow(!order_row('paid')['order']['paid'],'Duplicate partial payment counted twice');
$paymentRows[]=['payment_id'=>'two','payment_status'=>'PAID','payment_currency'=>'MNT','payment_amount'=>'40.00'];
qpay_callback('paid',$o['callback_token']);$paid=order_row('paid')['order'];
verify_flow($paid['paid']&&$paid['status']==='confirmed'&&!empty($paid['paid_at']),'Full payment not confirmed');
$before=count($calls);qpay_callback('paid',$o['callback_token']);verify_flow(count($calls)===$before,'Duplicate callback queried paid invoice again');
seed_flow('timeout');$invoiceFails=true;rejected_flow(fn()=>qpay_invoice('timeout'),502);
verify_flow(order_row('timeout')['order']['invoice']['state']==='review','Uncertain invoice must require review');
$before=count($calls);rejected_flow(fn()=>qpay_invoice('timeout'),409);verify_flow(count($calls)===$before,'Timeout retry duplicated invoice');
verify_flow(count(array_filter($calls,fn($p)=>$p==='/v2/auth/token'))===1,'Valid token was not reused');

$invoiceFails=false;$paymentRows=[];
function overdue_flow(string $id):array {
    seed_flow($id);$o=qpay_invoice($id);$o['payment_due']=gmdate('c',time()-1);save_order($o);return $o;
}
$expired=overdue_flow('expired');
verify_flow(!checkout_expired($expired,strtotime($expired['payment_due'])-1)&&checkout_expired($expired,strtotime($expired['payment_due'])),'Deadline boundary must be exact');
verify_flow(public_order($expired)['invoice']===['state'=>'expired'],'Expired QR must not reach old clients');
rejected_flow(fn()=>qpay_invoice('expired'),409);
checkout_expire_order('expired');$cancelled=order_row('expired')['order'];
verify_flow($cancelled['status']==='cancelled'&&$cancelled['cancel_reason']==='payment_timeout','Unpaid order must cancel');
$before=count($calls);checkout_expire_order('expired');verify_flow(count($calls)===$before,'Expiry must be idempotent');
overdue_flow('offline');$checkFails=true;checkout_expire_order('offline');verify_flow(order_row('offline')['order']['status']==='quoted','QPay outage must defer cancellation');$checkFails=false;
$cancelFails=true;checkout_expire_order('offline');verify_flow(order_row('offline')['order']['status']==='quoted','Uncertain remote cancellation must retry');$cancelFails=false;
overdue_flow('race');$payDuringCancel=true;checkout_expire_order('race');$race=order_row('race')['order'];verify_flow($race['paid']&&$race['status']==='confirmed','Concurrent payment must win');$payDuringCancel=false;$paymentRows=[];
overdue_flow('partial');$paymentRows=[['payment_id'=>'partial','payment_status'=>'PAID','payment_currency'=>'MNT','payment_amount'=>'10.00']];$before=count(array_filter($calls,fn($p)=>$p==='/v2/invoice/fake-invoice'));checkout_expire_order('partial');
verify_flow(order_row('partial')['order']['payment_review']==='partial_payment'&&order_row('partial')['order']['status']==='quoted','Partial payment requires reconciliation');
verify_flow(count(array_filter($calls,fn($p)=>$p==='/v2/invoice/fake-invoice'))===$before,'Do not cancel an invoice with partial payment');
$paymentRows=[];checkout_expire_due(true);verify_flow(order_row('offline')['order']['status']==='cancelled','Background sweep must retry without a browser');

echo "PASS: 15-minute invoice deadline, reopen, exact boundary, redacted QR, expiry retries, partial payment protection, cancellation race, background sweep.\n";
echo "PASS: stored quote, demo blocking, token cache, single invoice, callback authorization, unpaid/partial/full payment, duplicate callback, timeout recovery guard.\n";
