<?php
declare(strict_types=1);
// Token-only API for the mobile app and its web preview. Never grants admin/warehouse access.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-GOStore-Mobile-Token');
header('Access-Control-Expose-Headers: X-GOStore-Mobile-Token');
header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')==='OPTIONS'){http_response_code(204);exit;}
$get=['catalog','supplier-search','supplier-product','customer-me','customer-orders','customer-addresses','customer-notifications'];
$post=['customer-register','customer-login','customer-logout','customer-profile','customer-password','customer-delete','customer-address-save','customer-address-delete','customer-notifications-read','checkout-quote','order-create','order-get','invoice','payment-check','freight-invoice','order-photo','supplier-image-upload'];
$allowed=match($_SERVER['REQUEST_METHOD']??''){'GET'=>$get,'POST'=>$post,default=>[]};
if(!in_array($_GET['action']??'catalog',$allowed,true)){http_response_code(404);header('Content-Type: application/json');echo '{"error":"Mobile action unavailable"}';exit;}
define('GOSTORE_MOBILE_API',true);
require __DIR__.'/../server/mobile-session.php';
require __DIR__.'/index.php';
