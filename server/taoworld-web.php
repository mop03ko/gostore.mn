<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/taoworld-auth.php';
require_once __DIR__.'/taoworld-http.php';
header('Cache-Control: no-store');header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
if(!in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true)&&(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')){http_response_code(403);exit('HTTPS required.');}
session_boot('admin');
function taoworld_h(string $s): string {return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function taoworld_redirect(): never {header('Location: /api/taoworld/connect.php',true,303);exit;}
