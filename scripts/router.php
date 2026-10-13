<?php
// Development only: never expose PHP's built-in server outside loopback.
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)??'/');
if (preg_match('#(?:^|/)(?:\.|server|scripts|tests|tmp|output)(?:/|$)#',$path) || str_contains($path,'..')) {http_response_code(404);exit;}
if ($path==='/api/index.php') {require __DIR__.'/../api/index.php';return true;}
if (preg_match('#^/assets/fonts/(?:fonts\.css|arimo-variable\.ttf)$#', $path)) { return false; }
$allowed=['/','/index.html','/styles.css','/script.js','/store-server.js','/account.js','/supplier.js','/admin/','/admin/index.html','/admin/admin.css','/admin/admin.js','/warehouse/','/warehouse/index.html','/warehouse/warehouse.css','/warehouse/warehouse.js'];
if (!in_array($path,$allowed,true) && !preg_match('#^/assets/[a-zA-Z0-9/_-]+\.(?:jpg|png|webp)$#',$path)) {http_response_code(404);exit;}
return false;
