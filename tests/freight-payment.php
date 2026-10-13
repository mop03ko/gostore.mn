<?php
declare(strict_types=1);
$root=__DIR__.'/../tmp/freight-test-'.bin2hex(random_bytes(6));mkdir($root.'/server',0700,true);
foreach(['bootstrap.php','qpay.php','logistics.php','freight-payment.php','config.example.php','seed.json'] as $file)copy(__DIR__.'/../server/'.$file,$root.'/server/'.$file);
file_put_contents($root.'/server/config.local.php','<?php return '.var_export(['data_dir'=>$root.'/data','site_url'=>'https://example.test','qpay'=>['enabled'=>true,'environment'=>'sandbox','client_id'=>'fake','client_secret'=>'fake','invoice_code'=>'TEST']],true).';');
putenv('GOSTORE_DATA_DIR');putenv('GOSTORE_DISABLE_QPAY=0');
$rows=[];$creates=0;$timeout=false;
function qpay_http(string $path,array $body,string $auth):array {
    global $rows,$creates,$timeout;
    if($path==='/v2/auth/token')return ['access_token'=>'fake','expires_in'=>time()+3600];
    if($path==='/v2/payment/check')return ['rows'=>$rows];
    if($path==='/v2/invoice'){$creates++;if($timeout)throw new ApiError('Fake timeout',502);check($body['amount']===300,'Only outstanding balance is invoiced');check(str_contains($body['callback_url'],'action=freight-callback'),'Separate callback');$o=order_row('GS-FAKE')['order'];$o['logistics']['shelf']='CONCURRENT';save_order($o);return ['invoice_id'=>'fake','qr_image'=>'ZmFrZQ==','urls'=>[]];}
    throw new RuntimeException('Unexpected transport');
}
require $root.'/server/bootstrap.php';require $root.'/server/qpay.php';require $root.'/server/logistics.php';require $root.'/server/freight-payment.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function reject(callable $fn,int $code):void{try{$fn();}catch(ApiError $e){check($e->getCode()===$code,'Error code');return;}throw new RuntimeException('Expected rejection');}
function seed(string $id):void{$o=['id'=>$id,'status'=>'ready_pickup','paid'=>true,'amount'=>1000,'demo'=>false,'settlement'=>['total'=>1300,'breakdown'=>[],'confirmed_at'=>gmdate('c')]];db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$id,$id,$id,json_encode($o),gmdate('c'),gmdate('c')]);}
seed('GS-FAKE');$o=freight_invoice('GS-FAKE');check($o['logistics']['shelf']==='CONCURRENT','Invoice save preserves concurrent changes');freight_invoice('GS-FAKE');check($creates===1,'No duplicate invoice');
reject(fn()=>freight_callback('GS-FAKE','wrong'),403);$key=$o['freight']['callback_token'];freight_callback('GS-FAKE',$key);check(settlement_summary(order_row('GS-FAKE')['order'])['due']===300,'Unpaid check');
$rows=[['payment_id'=>'p1','payment_status'=>'PAID','payment_currency'=>'MNT','payment_amount'=>'100']];$rows[]=$rows[0];freight_callback('GS-FAKE',$key);check(settlement_summary(order_row('GS-FAKE')['order'])['due']===200,'Deduplicated partial payment');
$rows[]=['payment_id'=>'p2','payment_status'=>'PAID','payment_currency'=>'MNT','payment_amount'=>'200'];freight_callback('GS-FAKE',$key);freight_callback('GS-FAKE',$key);$o=order_row('GS-FAKE')['order'];check(settlement_summary($o)['due']===0,'Fully settled');check($o['amount']===1000&&$o['paid'],'Original purchase intact');check(!str_contains(json_encode(public_order($o)),$key),'No callback secret leak');
seed('GS-TIMEOUT');$timeout=true;reject(fn()=>freight_invoice('GS-TIMEOUT'),502);$before=$creates;reject(fn()=>freight_invoice('GS-TIMEOUT'),409);check($before===$creates,'Unknown result cannot duplicate charge');
echo "PASS: final balance invoice, partial/full payment, deduplication, callback auth, concurrent edit preservation, privacy, uncertain invoice retry guard.\n";
