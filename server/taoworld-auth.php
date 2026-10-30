<?php
declare(strict_types=1);

function taoworld_config(): array {
    $cfg=require __DIR__.'/taoworld-config.example.php';
    if(is_file(__DIR__.'/taoworld.local.php'))$cfg=array_replace($cfg,require __DIR__.'/taoworld.local.php');
    return $cfg;
}
function taoworld_require_config(): void {
    $cfg=taoworld_config();
    if(!is_string($cfg['app_key'])||!preg_match('/^[A-Za-z0-9]{4,64}$/D',$cfg['app_key'])||!is_string($cfg['app_secret'])||strlen($cfg['app_secret'])<16||strlen($cfg['app_secret'])>128)fail('TaoWorld түлхүүр тохируулагдаагүй.',503);
    if($cfg['callback_url']!=='https://gostore.mn/api/taoworld/callback.php')fail('TaoWorld callback тохиргоог шалгана уу.',503);
}
function taoworld_binding(): string { $c=taoworld_config();return hash('sha256',$c['app_key']."\0".$c['app_secret']); }
function taoworld_dir(): string {
    $dir=config()['data_dir'].'/taoworld';
    if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))fail('TaoWorld хадгалалт бэлэн биш.',503);
    return $dir;
}
function taoworld_state(): array {
    $file=taoworld_dir().'/auth.json';if(!is_file($file))return [];
    $s=json_decode((string)file_get_contents($file),true);
    return is_array($s)&&hash_equals(taoworld_binding(),(string)($s['app_binding']??''))?$s:[];
}
function taoworld_store(array $state): void {
    $dir=taoworld_dir();$tmp=tempnam($dir,'auth-');if($tmp===false)fail('TaoWorld хадгалалт амжилтгүй.',503);
    try{
        if(!chmod($tmp,0600)||file_put_contents($tmp,json_encode($state,JSON_THROW_ON_ERROR),LOCK_EX)===false||!rename($tmp,$dir.'/auth.json'))fail('TaoWorld хадгалалт амжилтгүй.',503);
    }finally{if(is_file($tmp))unlink($tmp);}
}
function taoworld_locked(callable $operation): mixed {
    $h=fopen(taoworld_dir().'/auth.lock','c');if(!$h)fail('TaoWorld хадгалалт бэлэн биш.',503);
    try{if(!flock($h,LOCK_EX|LOCK_NB))fail('TaoWorld холболтыг шинэчилж байна. Түр хүлээнэ үү.',409);return $operation();}
    finally{flock($h,LOCK_UN);fclose($h);}
}
function taoworld_token_state(array $data,?array $old=null): array {
    if(!is_string($data['access_token']??null)||$data['access_token']===''||strlen($data['access_token'])>8192)fail('TaoWorld token хариу дутуу.',502);
    $ttl=filter_var($data['expires_in']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>31536000]]);
    $refresh=filter_var($data['refresh_expires_in']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>31536000]]);
    if($ttl===false||$refresh===false)fail('TaoWorld token хугацаа тодорхойгүй.',502);
    $refreshToken=$data['refresh_token']??'';
    if(!is_string($refreshToken)||strlen($refreshToken)>8192||($refresh>0&&$refreshToken===''))fail('TaoWorld refresh token дутуу.',502);
    $account=$data['account_id']??$data['seller_id']??$data['seller_Id']??'';
    if((!is_string($account)&&!is_int($account))||strlen((string)$account)>100)fail('TaoWorld дансны мэдээлэл буруу.',502);
    $account=(string)$account;
    if($old&&!empty($old['account_id'])&&$account!==$old['account_id'])fail('TaoWorld дансны мэдээлэл өөрчлөгдсөн.',409);
    $refreshExpiry=$refresh>0?time()+$refresh:0;
    if($old&&$refreshExpiry>0)$refreshExpiry=min($refreshExpiry,(int)$old['refresh_expires_at']);
    return ['app_binding'=>taoworld_binding(),'access_token'=>$data['access_token'],'refresh_token'=>$refreshToken,
        'expires_at'=>time()+$ttl,'refresh_expires_at'=>$refreshExpiry,'account_id'=>$account,'updated_at'=>time()];
}
function taoworld_public(): array {
    $s=taoworld_state();return ['configured'=>strlen((string)taoworld_config()['app_secret'])>=16,
        'connected'=>!empty($s['access_token'])&&($s['expires_at']??0)>time(),
        'expires_at'=>(int)($s['expires_at']??0),'refreshable'=>!empty($s['refresh_token'])&&($s['refresh_expires_at']??0)>time()];
}
function taoworld_authorize_url(): string {
    admin_required();taoworld_require_config();$state=bin2hex(random_bytes(32));
    $_SESSION['taoworld_oauth']=['hash'=>hash('sha256',$state),'expires'=>time()+600,'binding'=>taoworld_binding()];
    return 'https://api.taobao.global/oauth/authorize?'.http_build_query(['response_type'=>'code','redirect_uri'=>taoworld_config()['callback_url'],'force_auth'=>'true','client_id'=>taoworld_config()['app_key'],'state'=>$state],'','&',PHP_QUERY_RFC3986);
}
function taoworld_callback(array $query): void {
    admin_required();taoworld_require_config();$attempt=$_SESSION['taoworld_oauth']??[];
    // The admin session and one-use state must both survive the provider round trip.
    if(!is_string($query['state']??null)||!preg_match('/^[a-f0-9]{64}$/D',$query['state'])||empty($attempt['hash'])||($attempt['expires']??0)<=time()||!hash_equals($attempt['hash'],hash('sha256',$query['state']))||!hash_equals($attempt['binding']??'',taoworld_binding()))fail('Зөвшөөрлийн хүсэлт хүчингүй эсвэл хугацаа дууссан. Дахин холбоно уу.',403);
    unset($_SESSION['taoworld_oauth']);
    if(isset($query['error'])||!is_string($query['code']??null)||$query['code']===''||strlen($query['code'])>4096)fail('TaoWorld зөвшөөрөл цуцлагдсан эсвэл код дутуу.',400);
    taoworld_locked(static function()use($query){$data=taoworld_http('/auth/token/create',['code'=>$query['code']]);taoworld_store(taoworld_token_state($data));});
}
function taoworld_refresh(): void {
    admin_required();taoworld_require_config();
    taoworld_locked(static function(){
        $s=taoworld_state();if(empty($s['refresh_token'])||($s['refresh_expires_at']??0)<=time())fail('TaoWorld дансаа дахин холбоно уу.',409);
        $data=taoworld_http('/auth/token/refresh',['refresh_token'=>$s['refresh_token']]);
        taoworld_store(taoworld_token_state($data,$s));
    });
}
