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
    return finance_bank_reference($bank, $date, $fetch);
}

function finance_bank_reference(string $bank, string $date, ?callable $fetch = null): array {
    $day = admin_fx_day($date);
    $key = 'finance-fx-reference:'.$bank.':'.$date;
    $cached = finance_meta_read($key);
    if (($cached['expires'] ?? 0) > time()) return $cached['result'];
    if ($bank === 'KhanBank' && finance_khan_day_final($date, $cached)) return $cached['result'];

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
    // Keep an earlier same-day quote if the bank stops returning a usable rate.
    $result = $rate === null && isset($cached['result']['rate'])
        ? $cached['result']
        : ['bank' => ADMIN_FX_BANKS[$bank], 'date' => $date, 'rate' => $rate];
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute([
        $key, json_encode([
            'expires' => time() + ($rate !== null ? 3600 : 900),
            'fetched_at' => $rate !== null ? time() : ($cached['fetched_at'] ?? null),
            'result' => $result,
        ], JSON_THROW_ON_ERROR),
    ]);
    return $result;
}

function finance_khan_day_final(string $date, array $cached): bool {
    $fetched = $cached['fetched_at'] ?? 0;
    return isset($cached['result']['rate']) && $fetched > 0 && gmdate('Y-m-d', $fetched + 8 * 3600) > $date;
}

function finance_khan_rate(string $day): ?float {
    $cached = finance_meta_read('finance-fx-reference:KhanBank:'.$day);
    return isset($cached['result']['rate']) ? (float)$cached['result']['rate'] : null;
}

// Runs from the existing CLI worker. Bank traffic stays outside checkout and report requests.
function finance_khan_refresh_order_days(?callable $fetch = null): int {
    $days = db()->query(
        "SELECT DISTINCT date(created,'+8 hours') AS day FROM orders
         WHERE created >= datetime('now','-401 days')
           AND COALESCE(json_extract(data,'$.demo'),0)=0
           AND json_extract(data,'$.purchase.provider')='taoworld'
           AND json_array_length(data,'$.purchase.paid_child_ids')>0
         ORDER BY day DESC"
    )->fetchAll(PDO::FETCH_COLUMN);
    $today = gmdate('Y-m-d', time() + 8 * 3600);
    $updated = 0;
    foreach (array_unique([$today,...$days]) as $day) {
        if (!$day || $day > $today) continue;
        $key = 'finance-fx-reference:KhanBank:'.$day;
        $cached = finance_meta_read($key);
        if (($cached['expires'] ?? 0) > time() || finance_khan_day_final($day, $cached)) continue;
        try {
            finance_bank_reference('KhanBank', $day, $fetch);
        } catch (ApiError $e) {
            if ($e->getCode() !== 502) throw $e;
            $cached['expires'] = time() + 900;
            $cached['result'] ??= ['bank' => ADMIN_FX_BANKS['KhanBank'], 'date' => $day, 'rate' => null];
            db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute([
                $key, json_encode($cached, JSON_THROW_ON_ERROR),
            ]);
            break;
        }
        if (++$updated >= 6) break;
    }
    return $updated;
}
