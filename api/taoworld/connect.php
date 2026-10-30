<?php
declare(strict_types=1);
require __DIR__.'/../../server/taoworld-web.php';
$notice=$_SESSION['taoworld_notice']??'';unset($_SESSION['taoworld_notice']);
$authenticated=admin_authenticated();$state=null;
if(!$authenticated)http_response_code(401);
else try{
    if(($_SERVER['REQUEST_METHOD']??'')==='POST'){
        if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf']))fail('Хуудсаа шинэчлээд дахин оролдоно уу.',403);
        limit_attempts('taoworld-admin:'.($_SERVER['REMOTE_ADDR']??'cli'),20,900);
        if(($_POST['action']??'')==='authorize'){header('Location: '.taoworld_authorize_url(),true,303);exit;}
        if(($_POST['action']??'')==='refresh'){taoworld_refresh();$_SESSION['taoworld_notice']='TaoWorld token шинэчлэгдлээ.';taoworld_redirect();}
        fail('Үйлдэл олдсонгүй.',400);
    }
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET')fail('Хүсэлтийн арга буруу.',405);
    $state=taoworld_public();
}catch(ApiError $e){http_response_code($e->getCode()?:400);$notice=$e->getMessage();}
catch(Throwable $e){http_response_code(503);$notice='TaoWorld холболтыг одоогоор шалгаж чадсангүй.';}
header('Content-Type: text/html; charset=utf-8');
?><!doctype html>
<html lang="mn"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>GOStore - TaoWorld холболт</title>
<style>body{font:16px/1.6 Arial,sans-serif;background:#f4f5f8;color:#262261;margin:0;padding:32px 20px}main{max-width:680px;margin:36px auto;background:#fff;padding:32px;border-radius:16px}h1{font-size:28px;line-height:1.25}h2{font-size:18px}a{color:#262261}button{background:#f16522;color:#fff;border:0;border-radius:8px;padding:13px 22px;font:inherit;cursor:pointer}form{margin:18px 0}aside{padding:16px;background:#f4f5f8;border-radius:8px}code{overflow-wrap:anywhere}small{color:#536078}@media(max-width:480px){main{padding:22px;margin:8px auto}h1{font-size:24px}}</style>
<main><a href="/admin/">GOStore админ</a><h1>TaoWorld дансны холболт</h1>
<?php if($notice):?><aside role="status"><?=taoworld_h($notice)?></aside><?php endif;?>
<?php if(!$authenticated):?>
<p>Эхлээд <a href="/admin/">GOStore админд нэвтэрнэ үү</a>. Дараа нь энэ хуудсыг дахин нээнэ.</p>
<?php elseif($state):?>
<p>App түлхүүр: <strong><?=$state['configured']?'тохируулсан':'тохируулаагүй'?></strong><br>Данс: <strong><?=$state['connected']?'холбогдсон':'authorization шаардлагатай'?></strong></p>
<?php if($state['expires_at']):?><p><small>Access token хугацаа: <?=taoworld_h(gmdate('Y-m-d H:i:s',$state['expires_at']))?> UTC</small></p><?php endif;?>
<p>TaoWorld-ийн худалдан авагчийн дансаар зөвшөөрөл олгоно. Developer console-ийн данс өөр байж болно.</p>
<?php if($state['configured']):?><form method="post"><input type="hidden" name="csrf" value="<?=taoworld_h($_SESSION['csrf'])?>"><button name="action" value="authorize"><?=$state['connected']?'Дансаа дахин холбох':'TaoWorld дансаа холбох'?></button></form><?php endif;?>
<?php if($state['refreshable']):?><form method="post"><input type="hidden" name="csrf" value="<?=taoworld_h($_SESSION['csrf'])?>"><button name="action" value="refresh">Token шинэчлэх</button></form><?php endif;?>
<h2>App Console дахь Callback URL</h2><p><code>https://gostore.mn/api/taoworld/callback.php</code></p>
<aside>Энэ хэсэг дансны зөвшөөрөл, token шинэчлэлтийг хариуцна. Бараа худалдан авах, төлбөр хийх үйлдэл идэвхжүүлэхгүй.</aside>
<?php endif;?></main></html>
