<?php
declare(strict_types=1);

function ot_operator_http(string $method, array $parameters): mixed {
    $ch = curl_init('https://otapi.net/service-json/'.$method);
    $raw = '';
    curl_setopt_array($ch, [CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>http_build_query($parameters),
        CURLOPT_HTTPHEADER=>['Accept: application/json','Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_CONNECTTIMEOUT=>10, CURLOPT_TIMEOUT=>35, CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_WRITEFUNCTION=>static function($ch, $chunk) use (&$raw) {
            if (strlen($raw)+strlen($chunk)>2000000) return 0;
            $raw.=$chunk; return strlen($chunk);
        }]);
    $ok = curl_exec($ch); $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    if ($ok === false || $status !== 200) fail('OT сервертэй холбогдож чадсангүй. Дахин шалгана уу.', 502);
    $answer = json_decode($raw, true);
    return $answer;
}
