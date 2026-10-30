<?php
declare(strict_types=1);
// Isolated fake credentials and transport; never reads local TaoWorld secrets.
$root=__DIR__.'/../tmp/taoworld-auth-'.bin2hex(random_bytes(5));mkdir($root.'/server',0700,true);
foreach(['bootstrap.php','product-policy.php','config.example.php','seed.json','taoworld-auth.php','taoworld-config.example.php'] as $file)copy(__DIR__.'/../server/'.$file,$root.'/server/'.$file);
putenv('GOSTORE_DATA_DIR='.$root.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
file_put_contents($root.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-only-123456','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
require $root.'/server/bootstrap.php';require $root.'/server/taoworld-auth.php';
session_boot();$hash=password_hash('fixture-password',PASSWORD_BCRYPT);db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['admin_password_hash',$hash]);
$_SESSION['admin']=true;$_SESSION['admin_version']=hash('sha256',$hash);
$calls=[];$response=['code'=>'0','access_token'=>'access-sentinel','refresh_token'=>'refresh-sentinel','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'123'];
function taoworld_http(string $path,array $params): array {global $calls,$response;$calls[]=[$path,$params];if($response instanceof Throwable)throw $response;return $response;}
function check(bool $ok,string $msg):void{if(!$ok)throw new RuntimeException($msg);}
function denied(callable $fn,int $status):void{try{$fn();}catch(ApiError $e){check($e->getCode()===$status,'Wrong status '.$e->getCode());return;}throw new RuntimeException('Expected rejection');}
$start=function(){parse_str(parse_url(taoworld_authorize_url(),PHP_URL_QUERY),$q);return $q;};
$q=$start();check($q['redirect_uri']==='https://gostore.mn/api/taoworld/callback.php'&&strlen($q['state'])===64,'Exact callback and random state');
check(!str_contains(json_encode($q),'fixture-secret'),'No secret in authorization URL');
denied(fn()=>taoworld_callback(['state'=>str_repeat('0',64),'code'=>'code']),403);check(!$calls,'Invalid state makes no network call');
$_SESSION['taoworld_oauth']['expires']=time()-1;denied(fn()=>taoworld_callback(['state'=>$q['state'],'code'=>'code']),403);
$q=$start();$_SESSION['admin']=false;denied(fn()=>taoworld_callback(['state'=>$q['state'],'code'=>'code']),401);$_SESSION['admin']=true;
$q=$start();taoworld_callback(['state'=>$q['state'],'code'=>'one-use-code']);check(count($calls)===1&&taoworld_public()['connected'],'Code exchanged and saved');
denied(fn()=>taoworld_callback(['state'=>$q['state'],'code'=>'one-use-code']),403);check(count($calls)===1,'Replay blocked');
check(!str_contains(json_encode(taoworld_public()),'sentinel'),'Public state redacts tokens');
$old=taoworld_state();$response['access_token']='rotated-access';$response['refresh_token']='rotated-refresh';taoworld_refresh();$new=taoworld_state();
check($new['access_token']==='rotated-access'&&$new['refresh_token']==='rotated-refresh','Rotated tokens saved together');
check($new['refresh_expires_at']<=$old['refresh_expires_at'],'Refresh lifetime never extended');
$response=new ApiError('synthetic failure',502);denied(fn()=>taoworld_refresh(),502);check(taoworld_state()===$new,'Failure preserves existing token state');
$response=['access_token'=>'x','refresh_token'=>'y','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'other'];denied(fn()=>taoworld_refresh(),409);check(taoworld_state()===$new,'Refresh cannot switch accounts');
$lock=fopen(taoworld_dir().'/auth.lock','c');flock($lock,LOCK_EX);denied(fn()=>taoworld_refresh(),409);flock($lock,LOCK_UN);fclose($lock);
$response=['access_token'=>'x','expires_in'=>3600,'refresh_expires_in'=>0];check(taoworld_token_state($response)['refresh_expires_at']===0,'Non-refreshable tokens supported');
foreach([[],['access_token'=>'x','expires_in'=>0,'refresh_expires_in'=>0],['access_token'=>'x','expires_in'=>3600,'refresh_expires_in'=>50]] as $bad)denied(fn()=>taoworld_token_state($bad),502);
$q=$start();denied(fn()=>taoworld_callback(['state'=>$q['state'],'error'=>'access_denied']),400);check(!isset($_SESSION['taoworld_oauth']),'Provider cancellation consumes state');
$q=$start();file_put_contents($root.'/server/taoworld.local.php',"<?php return ['app_key'=>'654321','app_secret'=>'another-fixture-secret-123','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
check(taoworld_state()===[],'Different app cannot reuse old tokens');denied(fn()=>taoworld_callback(['state'=>$q['state'],'code'=>'code']),403);
echo "PASS: admin authorization, exact callback, one-use state, expiry/replay, token rotation, locks, account/app binding and redaction.\n";
