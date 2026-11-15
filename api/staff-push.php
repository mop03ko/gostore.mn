<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
require __DIR__.'/../server/admin-users.php';
require __DIR__.'/../server/shipping.php';
require __DIR__.'/../server/warehouse.php';
require __DIR__.'/../server/staff-push.php';
try{
    if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')fail('HTTPS шаардлагатай.',403);
    $variant=$_GET['variant']??'';if(!in_array($variant,['admin','warehouse'],true))fail('Аппын төрөл буруу.',422);
    session_boot($variant);if($variant==='warehouse')warehouse_device_resume();
    $identity=staff_push_identity($variant);
    if($_SERVER['REQUEST_METHOD']==='GET')json_out(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
    if($_SERVER['REQUEST_METHOD']!=='POST')fail('Зөвшөөрөөгүй хүсэлт.',405);
    csrf_required();json_out(staff_push_action($identity,(string)($_GET['action']??''),body()));
}catch(ApiError $e){json_out(['error'=>$e->getMessage()],$e->getCode()?:400);}
catch(Throwable){error_log('GOStore staff push request failed');json_out(['error'=>'Мэдэгдлийн холболт түр боломжгүй.'],503);}
