<?php
declare(strict_types=1);
// A copied application with fake credentials and fake QPay transport; no real payments.
$root=__DIR__.'/../tmp/checkout-freshness-'.bin2hex(random_bytes(5));mkdir($root.'/server',0700,true);
foreach(['bootstrap','shipping','supplier','supplier-brands','supplier-titles','supplier-budget','supplier-snapshot','checkout','qpay','config.example'] as $f)copy(__DIR__.'/../server/'.$f.'.php',$root.'/server/'.$f.'.php');
copy(__DIR__.'/../server/seed.json',$root.'/server/seed.json');
file_put_contents($root.'/server/config.local.php','<?php return '.var_export(['data_dir'=>$root.'/data','site_url'=>'https://example.test','otcommerce'=>['api_key'=>'fake'],'qpay'=>['enabled'=>true,'environment'=>'sandbox','client_id'=>'fake','client_secret'=>'fake','invoice_code'=>'TEST']],true).';');
putenv('GOSTORE_DATA_DIR='.$root.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');putenv('GOSTORE_DISABLE_QPAY=0');
foreach(['bootstrap','shipping','supplier','checkout','qpay'] as $f)require $root.'/server/'.$f.'.php';
$calls=[];
function qpay_http(string $path,array $payload,string $auth):array{global $calls;$calls[]=$path;if($path==='/v2/auth/token')return ['access_token'=>'fake','expires_in'=>time()+3600];if($path==='/v2/invoice')return ['invoice_id'=>'fake-invoice','qr_image'=>'fake'];throw new RuntimeException('Unexpected fake QPay call');}
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function denied(callable $f,int $code):void{try{$f();}catch(ApiError $e){check($e->getCode()===$code,'Unexpected error '.$e->getCode());return;}throw new RuntimeException('Expected rejection');}
$dir=config()['data_dir'].'/supplier-cache';db();mkdir($dir,0700,true);$file=$dir.'/'.supplier_cache_key('/v1/taobao/product/123456789',['language'=>'mn']).'.json';
function seed(float $price,int $stock,int $age=0):void{global $file;file_put_contents($file,json_encode(['data'=>['Item'=>['Id'=>'123456789','ProviderType'=>'Taobao','Title'=>'Bag','IsSellAllowed'=>true,'Price'=>['OriginalPrice'=>$price,'OriginalCurrencyCode'=>'CNY'],'ConfiguredItems'=>[['Id'=>'one','Quantity'=>$stock,'Price'=>['OriginalPrice'=>$price,'OriginalCurrencyCode'=>'CNY']]]]],'fetched'=>gmdate('c',time()-$age),'expires'=>time()+21600,'stale'=>false]));if(is_file($file.'.retry'))unlink($file.'.retry');}
seed(10,5);$items=[['id'=>'tb-123456789','sku'=>'one','qty'=>2]];$total=checkout_quote(checkout_items(['items'=>$items]))['total'];
$o=checkout_order(['items'=>$items,'expected_total'=>$total],['id'=>'GS-FRESH','type'=>'checkout','paid'=>false,'demo'=>false,'created'=>gmdate('c'),'updated'=>gmdate('c')]);
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$o['id'],hash('sha256','token'),'freshness-key',json_encode($o),$o['created'],$o['created']]);
seed(10,5,3600);denied(fn()=>qpay_invoice('GS-FRESH'),409);check(!$calls&&!isset(order_row('GS-FRESH')['order']['invoice']),'Old cache creates no invoice');
seed(11,5);denied(fn()=>qpay_invoice('GS-FRESH'),409);check(!$calls,'Changed price does not reach QPay');
seed(10,1);denied(fn()=>qpay_invoice('GS-FRESH'),400);check(!$calls,'Insufficient stock does not reach QPay');
seed(10,5);$ready=qpay_invoice('GS-FRESH');check($ready['invoice']['state']==='ready'&&$ready['amount']===$total&&count($calls)===2,'Validated invoice uses agreed total');
seed(20,0,3600);$again=qpay_invoice('GS-FRESH');check($again['invoice']['id']==='fake-invoice'&&count($calls)===2,'Existing invoice remains idempotent and unchanged');
echo "PASS invoice freshness: old data, changed price and insufficient stock block before QPay; current agreed price creates one invoice; issued invoice is immutable.\n";
