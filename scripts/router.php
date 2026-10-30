<?php
// Development only: never expose PHP's built-in server outside loopback.
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)??'/');
if (preg_match('#(?:^|/)(?:\.|server|scripts|tests|tmp|output)(?:/|$)#',$path) || str_contains($path,'..')) {http_response_code(404);exit;}
if ($path==='/api/index.php') {require __DIR__.'/../api/index.php';return true;}
if(in_array($path,['/api/taoworld/connect.php','/api/taoworld/callback.php'],true)){require __DIR__.'/..'.$path;return true;}
if($path==='/admin/taoworld.js')return false;
if(preg_match('#^/(?:v/(?:tb-)?[0-9]{5,20}|p/[a-z0-9-]{1,60}|account(?:/[a-z]{1,20})?|cart|help|brands/(?:nike|adidas|puma|newbalance|uniqlo|zara|hm|thenorthface|sony|xiaomi|lego|ikea))/?$#',$path)){header('Content-Type: text/html; charset=utf-8');readfile(__DIR__.'/../index.html');return true;}
if(in_array($path,['/product-policy.js','/product-page.js','/product-page.css','/catalog-navigation.js','/catalog-navigation.css','/brand-page.js','/brand-page.css'],true))return false;
if (preg_match('#^/assets/fonts/(?:fonts\.css|arimo-variable\.(?:ttf|woff2))$#', $path)) { return false; }
$allowed=['/app.js','/app.css','/commerce-ui.js','/commerce-ui.css','/customer-sync.js','/','/index.html','/styles.css','/script.js','/store-server.js','/account.js','/supplier.js','/cargo.js','/checkout.js','/shop-tools.js','/account-page.js','/store-pages.js','/barcode.js','/warehouse/logistics-ui.js','/warehouse/qr.js','/assets/vendor/qrcode-generator-2.0.4.js','/assets/vendor/jsqr-1.4.0.js','/admin/','/admin/index.html','/admin/admin.css','/admin/admin.js','/warehouse/','/warehouse/index.html','/warehouse/warehouse.css','/warehouse/warehouse.js','/warehouse/i18n.js'];
if (!in_array($path,$allowed,true) && !preg_match('#^/assets/[a-zA-Z0-9/_-]+\.(?:jpg|png|webp|svg)$#',$path)) {http_response_code(404);exit;}
return false;
