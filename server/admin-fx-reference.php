<?php
declare(strict_types=1);

const ADMIN_FX_BANKS = ['KhanBank' => 'ХААН Банк', 'XacBank' => 'ХасБанк'];

function admin_fx_day(string $date): DateTimeImmutable {
    $zone = new DateTimeZone('Asia/Ulaanbaatar');
    $day = preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)
        ? DateTimeImmutable::createFromFormat('!Y-m-d', $date, $zone)
        : false;
    if (!$day || $day->format('Y-m-d') !== $date || $day > new DateTimeImmutable('today', $zone) || $date < '1900-01-01') {
        fail('Юань авсан огноог зөв оруулна уу.');
    }
    return $day;
}

function admin_fx_bank_json(string $url): array {
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_MAXFILESIZE => 262144,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    $data = is_string($body) ? json_decode($body, true) : null;
    if ($status !== 200 || !is_array($data)) {
        fail('Банкны ханш авахад алдаа гарлаа. Дахин оролдоно уу.', 502);
    }
    return $data;
}

function admin_fx_reference(array $input, ?callable $fetch = null): array {
    admin_required();
    if (!admin_role_at_least('owner')) fail('Зөвхөн эзэмшигч лавлах ханш харна.', 403);
    $bank = str_field($input, 'bank', 20);
    if (!isset(ADMIN_FX_BANKS[$bank])) fail('Банкаа сонгоно уу.');
    $date = str_field($input, 'date', 10);
    $day = admin_fx_day($date);
    $key = 'finance-fx-reference:'.$bank.':'.$date;
    $cached = finance_meta_read($key);
    if (($cached['expires'] ?? 0) > time()) return $cached['result'];

    $fetch ??= 'admin_fx_bank_json';
    if ($bank === 'KhanBank') {
        $source = 'https://www.khanbank.com/api/back/rates?date='.$date;
        $rows = $fetch($source);
        $currencyKey = 'currency';
        $sellKey = 'sellRate';
    } else {
        $utc = new DateTimeZone('UTC');
        $source = 'https://xacbank.mn/api/currencies?'.http_build_query([
            'where[code][equals]' => 'CNY',
            'where[date][greater_than_equal]' => $day->setTimezone($utc)->format('Y-m-d\TH:i:s.000\Z'),
            'where[date][less_than]' => $day->modify('+1 day')->setTimezone($utc)->format('Y-m-d\TH:i:s.000\Z'),
            'sort' => '-updatedAt',
            'limit' => 1,
        ]);
        $response = $fetch($source);
        $rows = $response['docs'] ?? null;
        if (!is_array($rows)) fail('Банкны ханш авахад алдаа гарлаа. Дахин оролдоно уу.', 502);
        $currencyKey = 'code';
        $sellKey = 'sell';
    }
    $rate = null;
    foreach ($rows as $row) {
        if (!is_array($row) || ($row[$currencyKey] ?? '') !== 'CNY') continue;
        if (is_numeric($row[$sellKey] ?? null) && is_finite((float)$row[$sellKey]) && $row[$sellKey] > 0) {
            $rate = (float)$row[$sellKey];
            break;
        }
    }
    $result = ['bank' => ADMIN_FX_BANKS[$bank], 'date' => $date, 'rate' => $rate];
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute([
        $key, json_encode(['expires' => time() + ($rate !== null ? 3600 : 300), 'result' => $result], JSON_THROW_ON_ERROR),
    ]);
    return $result;
}
