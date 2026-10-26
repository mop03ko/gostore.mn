<?php
declare(strict_types=1);
$root=__DIR__.'/../tmp/ot-test-'.bin2hex(random_bytes(6));mkdir($root.'/server',0700,true);
foreach(['product-policy.php','bootstrap.php','config.example.php','seed.json'] as $file)copy(__DIR__.'/../server/'.$file,$root.'/server/'.$file);
file_put_contents($root.'/server/config.local.php','<?php return '.var_export(['data_dir'=>$root.'/data','otcommerce'=>['api_key'=>'fake-key']],true).';');
putenv('GOSTORE_DATA_DIR');
require $root.'/server/bootstrap.php';require __DIR__.'/../server/ot-operator.php';
$mode='ok';$calls=[];
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function reject(callable $fn,int $status):void{try{$fn();}catch(ApiError $e){check($e->getCode()===$status,'Expected error status');check(!str_contains($e->getMessage(),'SECRET'),'No upstream secret in errors');return;}throw new RuntimeException('Expected rejection');}
function ot_operator_http(string $method,array $parameters):mixed{
    global $mode,$calls;$calls[]=$method;
    check($parameters['instanceKey']==='fake-key','Server-owned instance key');
    if($mode==='bad')return ['ErrorCode'=>'InvalidSession','ErrorDescription'=>'SECRET'];
    if($mode==='invalid')return null;
    if($method==='AuthenticateInstanceOperator'){
        check($parameters['userPassword']===' password with spaces ','Exact password preserved');
        return ['ErrorCode'=>'Ok','SessionId'=>['Value'=>'SECRET-SESSION']];
    }
    if($method==='GetEnabledFeatures')return ['ErrorCode'=>'Ok','Result'=>['Content'=>$mode==='disabled'?[]:['Order','Alibaba1688OrdersIntegration']]];
    if($method==='GetProviderOrdersIntegrationSessionInfoList'){
        check($parameters['sessionId']==='SECRET-SESSION','Operator session passed server-side');
        check($parameters['providerType']==='Alibaba1688','Correct provider');
        return ['ErrorCode'=>'Ok','Result'=>['Content'=>$mode==='empty'?[]:[['Id'=>'SECRET-BUYER','Name'=>'Buyer']]]];
    }
    throw new RuntimeException('Unexpected method');
}
check(!ot_operator_public()['configured'],'Initially disconnected');
$b=['login'=>'operator','password'=>' password with spaces '];
$p=ot_operator_connect($b);check($p['configured']&&!$p['verified'],'Connected does not imply buyer verified');
check(!str_contains(json_encode(ot_operator_state()),'password'),'Password never persisted');
$p=ot_operator_check();check($p['verified']&&$p['buyer_count']===1&&$p['business_logic']&&$p['autopurchase'],'Verified entitlements and buyer list');
check(!$p['purchasing_enabled'],'Connecting cannot enable purchases');
check(!str_contains(json_encode($p),'SECRET'),'No sessions or buyer IDs in status');
$mode='bad';reject(fn()=>ot_operator_connect($b),422);check(ot_operator_state()['session']==='SECRET-SESSION','Failed login preserves working connection');
reject(fn()=>ot_operator_check(),422);check(!ot_operator_public()['verified']&&ot_operator_public()['buyer_count']===null,'Failed check clears stale success');
$mode='invalid';reject(fn()=>ot_operator_check(),502);
reject(fn()=>ot_operator_answer(['ErrorCode'=>'LoginFailed','ErrorDescription'=>'SECRET-password','RequestId'=>'SECRET-session'],'AuthenticateInstanceOperator'),422);
$error=ot_operator_public()['last_error'];check($error['code']==='LoginFailed'&&$error['method']==='AuthenticateInstanceOperator','Exact allowed diagnostic persisted');
check(!str_contains(json_encode($error),'SECRET'),'No provider description, password, or request ID in diagnostics');
reject(fn()=>ot_operator_answer(['ErrorCode'=>'SECRET-unknown','ErrorDescription'=>'SECRET'],'SECRET-method'),422);
$error=ot_operator_public()['last_error'];check($error['code']==='UnknownError'&&$error['method']==='UnknownMethod','Unknown diagnostic values redacted');
$mode='empty';check(ot_operator_check()['buyer_count']===0,'No buyer is not ready');
check(ot_operator_public()['last_error']===null,'Successful check clears prior error');
$mode='disabled';$p=ot_operator_check();check(!$p['business_logic']&&!$p['autopurchase'],'Disabled rights represented truthfully');
$count=count($calls);reject(fn()=>ot_operator_request('RunOrderExportingToProvider'),400);check(count($calls)===$count,'No purchase request reaches transport');
check(ot_operator_session(['SessionId'=>'scalar'])==='scalar','Scalar session response supported');
reject(fn()=>ot_operator_session(['SessionId'=>[]]),502);
check(ot_operator_auth_url('https://login.1688.com/auth?code=example')==='https://login.1688.com/auth?code=example','Approved HTTPS authorization URL');
foreach(['https://1688.com.evil.test/','https://evil.test/','javascript:alert(1)','http://1688.com/','https://user@1688.com/','https://1688.com:444/'] as $url)reject(fn()=>ot_operator_auth_url($url),502);
echo "PASS: operator login, exact password, server-only session, failed login preservation, stale status reset, empty buyers, disabled rights, malformed responses, authorization URL validation and no purchase methods.\n";
