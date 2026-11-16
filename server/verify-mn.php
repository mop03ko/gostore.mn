<?php
declare(strict_types=1);
// Compatibility phone normalizer used by existing account modules; no provider access.
function verify_mn_phone(string $phone): string {
    $phone=preg_replace('/[ ()-]/','',trim($phone));
    if(preg_match('/^(?:\+?976)?([0-9]{8})$/D',$phone,$m))return $m[1];
    fail('Монголын 8 оронтой утасны дугаараа оруулна уу.');
}
// Retired permanently: neither environment keys nor old callers can reactivate verify.mn.
function verify_mn_environment(): string {return '';}
function verify_mn_key(): string {fail('verify.mn үйлчилгээг ашиглахаа больсон.',410);}
function verify_mn_start(array $b): array {fail('Аппаа шинэчилж, SMS кодоор баталгаажуулна уу.',426);}
function verify_mn_status(array $b): array {fail('Шинээр SMS код авч баталгаажуулна уу.',410);}
