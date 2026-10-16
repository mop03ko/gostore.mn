<?php
// Development only: never expose PHP's built-in server outside loopback.
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)??'/');
if (preg_match('#(?:^|/)(?:\.|server|scripts|tests|tmp|output)(?:/|$)#',$path) || str_contains($path,'..')) {http_response_code(404);exit;}
if ($path==='/api/index.php') {require __DIR__.'/../api/index.php';return true;}
if(preg_match('#^/(?:v/(?:tb-)?[0-9]{5,20}|p/[a-z0-9-]{1,60})/?$#',$path)){header('Content-Type: text/html; charset=utf-8');readfile(__DIR__.'/../index.html');return true;}
if(in_array($path,['/product-page.js','/product-page.css','/catalog-navigation.js','/catalog-navigation.css'],true))return false;
if (preg_match('#^/assets/fonts/(?:fonts\.css|arimo-variable\.ttf)$#', $path)) { return false; }
$allowed=['/','/index.html','/styles.css','/script.js','/store-server.js','/account.js','/supplier.js','/cargo.js','/checkout.js','/barcode.js','/warehouse/logistics-ui.js','/warehouse/qr.js','/assets/vendor/qrcode-generator-2.0.4.js','/assets/vendor/jsqr-1.4.0.js','/admin/','/admin/index.html','/admin/admin.css','/admin/admin.js','/warehouse/','/warehouse/index.html','/warehouse/warehouse.css','/warehouse/warehouse.js','/warehouse/i18n.js'];
if (!in_array($path,$allowed,true) && !preg_match('#^/assets/[a-zA-Z0-9/_-]+\.(?:jpg|png|webp)$#',$path)) {http_response_code(404);exit;}
return false;
