<?php
// No bootstrap, database, authentication or session access in this isolated demo.
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header("Content-Security-Policy: connect-src 'none'; worker-src 'none'; form-action 'none'; img-src 'self' data: blob:");
header('X-Robots-Tag: noindex, nofollow');
$html=file_get_contents(__DIR__.'/index.html');
$html=str_replace('<head>', '<head><script src="/warehouse/review-demo.js?v=20261107-demo1"></script>', $html);
// Demo never registers or changes the real warehouse's push subscription.
$html=preg_replace('#<script src="notifications\.js[^\"]*" defer></script>#','',$html);
echo $html;
