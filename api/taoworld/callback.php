<?php
declare(strict_types=1);
require __DIR__.'/../../server/taoworld-web.php';
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET')fail('Зөвшөөрлийн хүсэлтийн арга буруу.',405);
    taoworld_callback($_GET);$_SESSION['taoworld_notice']='TaoWorld данс холбогдлоо. Каталогийн API эрхийг тусад нь шалгана.';
}catch(ApiError $e){$_SESSION['taoworld_notice']=$e->getMessage();}
catch(Throwable $e){error_log('GOStore TaoWorld authorization failed');$_SESSION['taoworld_notice']='TaoWorld холболтыг хадгалж чадсангүй. Дахин холбоно уу.';}
// Remove the authorization code from the address bar before showing any UI.
taoworld_redirect();
