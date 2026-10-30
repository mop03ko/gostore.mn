<?php
declare(strict_types=1);

// Dedicated session files and bearer transport: browser/admin cookies are never accepted.
function mobile_session_boot(): void {
    $dir=config()['data_dir'].'/mobile-sessions';
    if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))fail('Нэвтрэх үйлчилгээ түр боломжгүй.',503);
    $token=$_SERVER['HTTP_X_GOSTORE_MOBILE_TOKEN']??'';
    if(!is_string($token)||($token!==''&&!preg_match('/^[a-zA-Z0-9,-]{26,128}$/D',$token)))fail('Дахин нэвтэрнэ үү.',401);
    ini_set('session.use_cookies','0');ini_set('session.use_only_cookies','1');ini_set('session.use_strict_mode','1');
    // PHP 8.4 deprecates SID tuning. Use the runtime's cryptographically generated IDs.
    session_name('gostore_mobile');session_save_path($dir);if($token!=='')session_id($token);
    session_start();
    if($token!==''&&!hash_equals($token,session_id())){$_SESSION=[];session_destroy();fail('Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү.',401);}
    if(isset($_SESSION['last'])&&time()-$_SESSION['last']>1800){$_SESSION=[];session_regenerate_id(true);}
    $_SESSION['last']=time();$_SESSION['csrf']??=bin2hex(random_bytes(32));
}
