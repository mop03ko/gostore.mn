<?php
declare(strict_types=1);
// HTTPS transport is separate so payment workflows can be tested without real charges.
function qpay_http(string $path, array $payload, string $auth, string $method='POST'): array {
    if(!in_array($method,['POST','DELETE'],true))throw new InvalidArgumentException('Unsupported QPay method');
    $base=config()['qpay']['environment']==='production'?'https://merchant.qpay.mn':'https://merchant-sandbox.qpay.mn';
    $ch=curl_init($base.$path);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: '.$auth],CURLOPT_POSTFIELDS=>json_encode($payload?:new stdClass())]);
    if($method==='DELETE')curl_setopt($ch,CURLOPT_CUSTOMREQUEST,'DELETE');
    $raw=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    // Repeating invoice cancellation after a lost response must be safe. Never applies to payment refunds.
    if($raw!==false&&$method==='DELETE'&&str_starts_with($path,'/v2/invoice/')&&($status===404||($status>=200&&$status<300)))return ['ok'=>true];
    if ($raw===false || $status<200 || $status>=300) fail('QPay холболтын алдаа. Дахин нэхэмжлэл үүсгэхээс өмнө админ шалгана уу.',502);
    $data=json_decode($raw,true); if (!is_array($data)) fail('QPay хариу буруу байна.',502); return $data;
}
