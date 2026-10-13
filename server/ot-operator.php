<?php
declare(strict_types=1);

// Only connection/read methods are permitted here. No ordering or payment methods.
function ot_operator_request(string $method, array $parameters = []): array {
    if (!in_array($method, ['AuthenticateInstanceOperator','GetEnabledFeatures','GetProviderOrdersIntegrationSessionInfoList','GetProviderOrdersIntegrationSessionAuthenticationInfo'], true)) fail('OT үйлдэл зөвшөөрөгдөөгүй.', 400);
    $key = config()['otcommerce']['api_key'] ?? '';
    if ($key === '') fail('OT API түлхүүр тохируулаагүй.', 503);
    $parameters = array_merge($parameters, ['instanceKey'=>$key, 'language'=>'en']);
    return ot_operator_answer(ot_operator_http($method, $parameters), $method);
}
function ot_operator_error_messages(): array {
    // GeneralErrorCode values from OT's official schema. Never display upstream descriptions.
    return [
        'LoginFailed'=>'OT операторын нэр эсвэл нууц үгийг OT баталгаажуулсангүй. Энэ API түлхүүрт харьяалагдах Full OTAPI операторын эрхээ шалгана уу.',
        'AccessDenied'=>'Энэ OT операторт хүссэн үйлдлийн эрх олгоогүй байна. OT дэмжлэгээр операторын эрхийг шалгуулна уу.',
        'IncorrectKey'=>'OT API түлхүүрийг OT хүлээн зөвшөөрсөнгүй. Серверийн түлхүүрийн тохиргоог шалгана уу.',
        'InstanceKeyBan'=>'OT API түлхүүр хаагдсан байна. OT дэмжлэгтэй холбогдоно уу.',
        'AccountIsBanned'=>'OT аккаунт хаагдсан байна. OT дэмжлэгтэй холбогдоно уу.',
        'SessionExpired'=>'OT нэвтрэлтийн хугацаа дууссан. Оператороор дахин нэвтэрнэ үү.',
        'ValidationError'=>'OT хүсэлтийн мэдээллийг баталгаажуулсангүй. OT дэмжлэгээр оператор болон түлхүүрийн тохиргоог шалгуулна уу.',
        'ContractViolation'=>'OT хүсэлтийн параметр эсвэл тохиргоо шаардлага хангахгүй байна. Холболтын тохиргоог шалгах шаардлагатай.',
        'NotFound'=>'OT шаардлагатай бүртгэлийг олсонгүй. Оператор энэ API түлхүүрт харьяалагдаж буйг шалгуулна уу.',
        'NotAvailable'=>'Энэ OT үйлдэл одоогоор боломжгүй байна. Тухайн үйлчилгээний эрхийг OT дэмжлэгээр шалгуулна уу.',
        'InternalError'=>'OT серверийн дотоод алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
        'TechnicalProblems'=>'OT үйлчилгээний техникийн алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
        'BusinessLogicError'=>'OT Business Logic хүсэлтийг гүйцэтгэсэнгүй. Тохиргоог OT дэмжлэгээр шалгуулна уу.',
        'TopapiProtocolError'=>'1688 үйлчилгээний холболтын алдаа гарлаа. Түр хүлээгээд дахин шалгана уу.',
        'TopapiBusinessError'=>'1688 үйлчилгээ хүсэлтийг зөвшөөрсөнгүй. Худалдан авагчийн аккаунтын тохиргоог шалгана уу.',
        'TopapiUnknownError'=>'1688 үйлчилгээ танигдаагүй алдаа буцаалаа. OT дэмжлэгээр шалгуулна уу.',
        'AlreadyExists'=>'OT дээр энэ бүртгэл аль хэдийн байна.',
        'PaymentError'=>'OT төлбөртэй холбоотой алдаа буцаалаа. Үйлчилгээний эрх, үлдэгдлээ OT дэмжлэгээр шалгуулна уу.',
        'EmailConfirmationFailed'=>'OT имэйл баталгаажуулалт амжилтгүй байна.',
        'BatchError'=>'OT хүсэлтийн зарим хэсэг амжилтгүй боллоо.',
        'Waiting'=>'OT хүсэлт хүлээгдэж байна. Түр хүлээгээд дахин шалгана уу.',
        'UnknownError'=>'OT танигдаагүй алдаа буцаалаа. OT дэмжлэгээр холболтыг шалгуулах шаардлагатай.',
    ];
}
function ot_operator_answer(mixed $answer, string $method = ''): array {
    if (!is_array($answer) || !is_string($answer['ErrorCode'] ?? null)) fail('OT хариуны бүтэц танигдсангүй.', 502);
    if ($answer['ErrorCode'] !== 'Ok') {
        $messages=ot_operator_error_messages();
        $code=array_key_exists($answer['ErrorCode'],$messages)?$answer['ErrorCode']:'UnknownError';
        // Persist only allowlisted codes/methods; never credentials, descriptions, or raw responses.
        $method=in_array($method,['AuthenticateInstanceOperator','GetEnabledFeatures','GetProviderOrdersIntegrationSessionInfoList','GetProviderOrdersIntegrationSessionAuthenticationInfo'],true)?$method:'UnknownMethod';
        db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['ot_operator_last_error',json_encode(['code'=>$code,'method'=>$method,'at'=>gmdate('c')],JSON_THROW_ON_ERROR)]);
        fail($messages[$code].' (OT: '.$code.')', 422);
    }
    return $answer;
}
function ot_operator_state(): array {
    $s = db()->prepare('SELECT value FROM meta WHERE key=?'); $s->execute(['ot_operator']);
    return json_decode($s->fetchColumn() ?: '{}', true) ?: [];
}
function ot_operator_store(array $state): void {
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['ot_operator',json_encode($state, JSON_THROW_ON_ERROR)]);
}
function ot_operator_public(): array {
    $s = ot_operator_state();
    $q=db()->prepare('SELECT value FROM meta WHERE key=?');$q->execute(['ot_operator_last_error']);$error=json_decode($q->fetchColumn()?:'null',true);
    return ['configured'=>!empty($s['session']), 'login'=>$s['login'] ?? '',
        'verified'=>$s['verified'] ?? false, 'checked_at'=>$s['checked_at'] ?? null,
        'business_logic'=>$s['business_logic'] ?? false, 'autopurchase'=>$s['autopurchase'] ?? false,
        'buyer_count'=>$s['buyer_count'] ?? null, 'purchasing_enabled'=>false, 'last_error'=>$error];
}
function ot_operator_session(array $answer): string {
    $session = $answer['SessionId'] ?? null;
    if (is_array($session)) $session = $session['Value'] ?? null;
    if (!is_string($session) || $session === '' || strlen($session)>4096) fail('OT нэвтрэлтийн хариу танигдсангүй.', 502);
    return $session;
}
function ot_operator_check(): array {
    $s = ot_operator_state();
    if (empty($s['session'])) fail('Эхлээд OT оператороор нэвтэрнэ үү.', 409);
    $s['verified'] = false; $s['checked_at'] = null; $s['buyer_count'] = null;
    $s['business_logic'] = false; $s['autopurchase'] = false;
    ot_operator_store($s);
    $features = ot_operator_request('GetEnabledFeatures')['Result']['Content'] ?? null;
    if (!is_array($features) || !array_is_list($features)) fail('OT эрхийн мэдээлэл танигдсангүй.', 502);
    $buyers = ot_operator_request('GetProviderOrdersIntegrationSessionInfoList', ['sessionId'=>$s['session'], 'providerType'=>'Alibaba1688'])['Result']['Content'] ?? null;
    if (!is_array($buyers) || !array_is_list($buyers)) fail('1688 аккаунтын мэдээлэл танигдсангүй.', 502);
    $s['business_logic'] = in_array('Order', $features, true);
    $s['autopurchase'] = in_array('Alibaba1688OrdersIntegration', $features, true);
    $s['buyer_count'] = count($buyers); $s['verified'] = true; $s['checked_at'] = gmdate('c');
    ot_operator_store($s);
    db()->prepare('DELETE FROM meta WHERE key=?')->execute(['ot_operator_last_error']);
    return ot_operator_public();
}
function ot_operator_auth_url(string $url): string {
    $p = parse_url($url); $host = strtolower($p['host'] ?? '');
    $allowed = false;
    foreach (['otapi.net','otcommerce.com','1688.com','alibaba.com'] as $domain) {
        if ($host === $domain || str_ends_with($host, '.'.$domain)) $allowed = true;
    }
    if (!$allowed || ($p['scheme'] ?? '') !== 'https' || isset($p['user']) || isset($p['pass']) || (isset($p['port']) && $p['port'] !== 443)) fail('1688 нэвтрэх холбоосыг баталгаажуулж чадсангүй.', 502);
    return $url;
}
function ot_operator_post(string $action, array $b): never {
    admin_required();
    limit_attempts('ot-operator:'.($_SERVER['REMOTE_ADDR'] ?? 'cli'), 12, 900);
    if ($action === 'ot-operator-connect') {
        json_out(['ot_operator'=>ot_operator_connect($b)]);
    }
    if ($action === 'ot-operator-check') json_out(['ot_operator'=>ot_operator_check()]);
    if ($action === 'ot-operator-disconnect') {
        db()->prepare('DELETE FROM meta WHERE key=?')->execute(['ot_operator']);
        json_out(['ot_operator'=>ot_operator_public()]);
    }
    if ($action === 'ot-operator-authorize') {
        $s = ot_operator_state();
        if (empty($s['session'])) fail('Эхлээд OT оператороор нэвтэрнэ үү.', 409);
        $answer = ot_operator_request('GetProviderOrdersIntegrationSessionAuthenticationInfo', [
            'sessionId'=>$s['session'], 'providerType'=>'Alibaba1688',
            'returnUrl'=>rtrim(config()['site_url'], '/').'/admin/']);
        $url = $answer['Result']['RedirectUrl'] ?? '';
        if (!is_string($url)) fail('1688 нэвтрэх холбоос танигдсангүй.', 502);
        json_out(['url'=>ot_operator_auth_url($url)]);
    }
    fail('Үйлдэл олдсонгүй.', 404);
}

function ot_operator_connect(array $b): array {
    $login = str_field($b, 'login', 200);
    // Passwords must not be trimmed, persisted, logged, or returned to the browser.
    $password = $b['password'] ?? null;
    if (!is_string($password) || $password === '' || strlen($password)>1000) fail('OT операторын нууц үгээ оруулна уу.');
    $answer = ot_operator_request('AuthenticateInstanceOperator', ['userLogin'=>$login, 'userPassword'=>$password]);
    ot_operator_store(['login'=>$login, 'session'=>ot_operator_session($answer), 'verified'=>false]);
    db()->prepare('DELETE FROM meta WHERE key=?')->execute(['ot_operator_last_error']);
    return ot_operator_public();
}
