<?php
declare(strict_types=1);
require __DIR__.'/warehouse-notifications.php';
check(!warehouse_fcm_configured(),'Unconfigured FCM advertised as ready');
denied(fn()=>warehouse_fcm_subscribe(['fcm_token'=>str_repeat('a',150)],'erenhot'),'Unconfigured subscribe accepted');
$key=openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_RSA,'private_key_bits'=>2048,'config'=>__DIR__.'/../server/warehouse-push-openssl.cnf']);
openssl_pkey_export($key,$pem,null,['config'=>__DIR__.'/../server/warehouse-push-openssl.cnf']);
$cred=['type'=>'service_account','project_id'=>'gostore-warehouse','client_email'=>'test@gostore-warehouse.iam.gserviceaccount.com','private_key'=>$pem];
file_put_contents(config()['data_dir'].'/warehouse-fcm-service-account.json',json_encode($cred));
check(warehouse_fcm_configured(),'Configured FCM not ready');
foreach(['','https://evil.test/device',str_repeat('a',4097),str_repeat('a',40)."\nX:bad"] as $invalid)denied(fn()=>warehouse_fcm_token_value($invalid),'Invalid FCM token allowed');
$fcmToken=str_repeat('A',150);$native=warehouse_fcm_subscribe(['fcm_token'=>$fcmToken],'erenhot');
$_SERVER['HTTP_X_GOSTORE_PUSH_TOKEN']=$native['token'];$device=warehouse_push_authenticated_device();
check($device['endpoint']==='fcm:'.$fcmToken,'Native endpoint lost');
denied(fn()=>warehouse_fcm_rotate(['fcm_token'=>'bad']),'Invalid rotation accepted');
$nextToken=str_repeat('B',150);warehouse_fcm_rotate(['fcm_token'=>$nextToken]);
check(warehouse_push_authenticated_device()['endpoint']==='fcm:'.$nextToken,'Token rotation failed');
$fresh=warehouse_fcm_subscribe(['fcm_token'=>$nextToken],'erenhot');
denied(fn()=>warehouse_push_authenticated_device(),'Rebound device left old credential valid');
$_SERVER['HTTP_X_GOSTORE_PUSH_TOKEN']=$fresh['token'];$device=warehouse_push_authenticated_device();
$authCalls=0;$sendCalls=0;
$http=function($url,$headers,$body)use(&$authCalls,&$sendCalls,$key,$nextToken){
 if($url==='https://oauth2.googleapis.com/token'){
  $authCalls++;parse_str($body,$form);$parts=explode('.',$form['assertion']);
  $claims=json_decode(base64_decode(strtr($parts[1],'-_','+/')),true);
  check($claims['scope']==='https://www.googleapis.com/auth/firebase.messaging','Excessive OAuth scope');
  check($claims['aud']==='https://oauth2.googleapis.com/token'&&$claims['exp']-$claims['iat']===3600,'JWT claims wrong');
  check(openssl_verify($parts[0].'.'.$parts[1],base64_decode(strtr($parts[2],'-_','+/')),openssl_pkey_get_details($key)['key'],OPENSSL_ALGO_SHA256)===1,'FCM JWT signature invalid');
  return [200,['access_token'=>'test-access-token','expires_in'=>3600]];
 }
 $sendCalls++;check($url==='https://fcm.googleapis.com/v1/projects/gostore-warehouse/messages:send','Wrong send host/project');
 $m=json_decode($body,true);check($m['message']['token']===$nextToken,'Rotated destination not used');
 check($m['message']['data']===['type'=>'warehouse-orders'],'Provider receives order/customer/credential data');
 check($m['message']['android']['priority']==='HIGH','No background wake-up priority');
 return [200,['name'=>'projects/gostore-warehouse/messages/test']];
};
check(warehouse_fcm_send($device,$http)===200,'FCM send failed');
check(warehouse_fcm_send($device,$http)===200&&$authCalls===1&&$sendCalls===2,'OAuth token not reused');
check(warehouse_fcm_send($device,fn()=>[404,['error'=>['details'=>[['@type'=>'type.googleapis.com/google.firebase.fcm.v1.FcmError','errorCode'=>'UNREGISTERED']]]]])===410,'Expired device not removed');
check(warehouse_fcm_send($device,fn()=>[404,['error'=>['status'=>'NOT_FOUND']]])===503,'Project 404 deleted device');
check(warehouse_fcm_send($device,fn()=>[403,['error'=>['status'=>'PERMISSION_DENIED']]])===403,'Permissions failure hidden');
$o=['id'=>'GS-FCM002','status'=>'confirmed','route'=>['Эрээн','Улаанбаатар'],'history'=>[]];
db()->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$o['id'],'token2','request2',json_encode($o),gmdate('c'),gmdate('c')]);
warehouse_notice_record($o,null);
check(warehouse_push_delivery()['notifications'][0]['order_id']==='GS-FCM002','Native delivery not scoped to current orders');
warehouse_push_revoke_session();denied(fn()=>warehouse_push_delivery(),'Logout left native delivery enabled');
echo "PASS FCM: scoped registration/rotation, OAuth signature/cache, minimal payload, error classification and logout.\n";
