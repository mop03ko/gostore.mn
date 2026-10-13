<?php
declare(strict_types=1);

function config(): array {
    static $value;
    if ($value !== null) return $value;
    $value = require __DIR__ . '/config.example.php';
    if (is_file(__DIR__ . '/config.local.php')) $value = array_replace_recursive($value, require __DIR__ . '/config.local.php');
    if (getenv('GOSTORE_DATA_DIR')) $value['data_dir'] = getenv('GOSTORE_DATA_DIR');
    if (getenv('GOSTORE_ADMIN_HASH')) $value['admin_password_hash'] = getenv('GOSTORE_ADMIN_HASH');
    if (getenv('GOSTORE_DISABLE_QPAY') === '1') $value['qpay']['enabled'] = false;
    if (getenv('GOSTORE_LOCAL_PRODUCTS_ENABLED') === '1') $value['local_products_enabled'] = true;
    return $value;
}
function fail(string $message, int $status = 400): never { throw new ApiError($message, $status); }
class ApiError extends RuntimeException {}
function json_out(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); exit;
}
function db(): PDO {
    static $db;
    if ($db) return $db;
    $dir = config()['data_dir'];
    if (!is_dir($dir) && !mkdir($dir, 0700, true)) fail('Өгөгдлийн хавтас үүсгэж чадсангүй.', 503);
    $db = new PDO('sqlite:' . $dir . '/gostore.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    $db->exec('CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, request_key TEXT UNIQUE NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, password_hash TEXT NOT NULL, auth_version INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL, updated TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS customer_orders (order_id TEXT PRIMARY KEY REFERENCES orders(id), customer_id TEXT NOT NULL REFERENCES customers(id), created TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS customer_orders_owner ON customer_orders(customer_id, created);
        CREATE TABLE IF NOT EXISTS shipment_batches (id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS shipment_batch_orders (order_id TEXT PRIMARY KEY REFERENCES orders(id), batch_id TEXT NOT NULL REFERENCES shipment_batches(id));
        CREATE INDEX IF NOT EXISTS shipment_batch_members ON shipment_batch_orders(batch_id);
        CREATE TABLE IF NOT EXISTS order_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES orders(id),kind TEXT NOT NULL,message TEXT NOT NULL,created TEXT NOT NULL,read_at TEXT);
        CREATE INDEX IF NOT EXISTS order_notifications_order ON order_notifications(order_id,id);
        CREATE TABLE IF NOT EXISTS warehouse_exceptions (id INTEGER PRIMARY KEY AUTOINCREMENT,location TEXT NOT NULL,code TEXT NOT NULL,kind TEXT NOT NULL,note TEXT NOT NULL,state TEXT NOT NULL,created TEXT NOT NULL,resolution TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS warehouse_exception_photos (id TEXT PRIMARY KEY,exception_id INTEGER NOT NULL REFERENCES warehouse_exceptions(id),created TEXT NOT NULL);');
    if (!$db->query("SELECT value FROM meta WHERE key='seeded'")->fetchColumn()) {
        $db->beginTransaction();
        try {
            foreach (json_decode(file_get_contents(__DIR__.'/seed.json'), true, 512, JSON_THROW_ON_ERROR) as $p) {
                $stmt=$db->prepare('INSERT OR IGNORE INTO products VALUES (?, ?, ?)');
                $stmt->execute([$p['id'],json_encode($p,JSON_UNESCAPED_UNICODE),gmdate('c')]);
            }
            $db->exec("INSERT OR IGNORE INTO meta VALUES ('seeded','1')"); $db->commit();
        } catch (Throwable $e) { $db->rollBack(); throw $e; }
    }
    return $db;
}
function limit_attempts(string $key, int $max, int $seconds): void {
    $db=db(); $key=hash('sha256',$key); $now=time();
    $db->prepare('DELETE FROM limits WHERE expires < ?')->execute([$now]);
    // cPanel can expose SQLite 3.7.x, which predates UPSERT syntax.
    $db->prepare('INSERT OR IGNORE INTO limits VALUES (?,0,?)')->execute([$key,$now+$seconds]);
    $db->prepare('UPDATE limits SET hits=hits+1 WHERE key=?')->execute([$key]);
    $s=$db->prepare('SELECT hits FROM limits WHERE key=?'); $s->execute([$key]);
    if ((int)$s->fetchColumn()>$max) fail('Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.',429);
}
function session_boot(string $realm = 'admin'): void {
    if (session_status()===PHP_SESSION_ACTIVE) return;
    session_name(match($realm){'customer'=>'gostore_customer','warehouse'=>'gostore_warehouse',default=>'gostore_session'});
    ini_set('session.use_strict_mode','1'); ini_set('session.use_only_cookies','1');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Lax']);
    session_start();
    if (isset($_SESSION['last']) && time()-$_SESSION['last']>1800) { $_SESSION=[]; session_regenerate_id(true); }
    $_SESSION['last']=time(); $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}
function admin_password_hash(): string {
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['admin_password_hash']);
    return $s->fetchColumn() ?: config()['admin_password_hash'];
}
function admin_authenticated(): bool {
    return !empty($_SESSION['admin']) && hash_equals(hash('sha256',admin_password_hash()),(string)($_SESSION['admin_version']??''));
}
function admin_required(): void { session_boot(); if (!admin_authenticated()) fail('Админаар нэвтэрнэ үү.',401); }
function admin_password_change(array $b): array {
    admin_required();limit_attempts('admin-password:'.($_SERVER['REMOTE_ADDR']??'cli'),8,900);
    $current=$b['current_password']??null;$next=$b['new_password']??null;$confirm=$b['password_confirm']??null;
    if(!is_string($current)||strlen($current)>1000||!is_string($next)||mb_strlen($next)<12||strlen($next)>72)fail('Шинэ нууц үг 12-оос доошгүй тэмдэгт, 72 байтаас хэтрэхгүй байна.');
    if(!is_string($confirm)||!hash_equals($next,$confirm))fail('Шинэ нууц үгийн давталт таарахгүй байна.');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try {
        admin_required();$hash=admin_password_hash();
        if(!password_verify($current,$hash))fail('Одоогийн нууц үг буруу байна.',422);
        if(password_verify($next,$hash))fail('Өмнөхөөс өөр шинэ нууц үг сонгоно уу.');
        $newHash=password_hash($next,PASSWORD_BCRYPT,['cost'=>12]);
        $db->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['admin_password_hash',$newHash]);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    session_regenerate_id(true);$_SESSION['admin_version']=hash('sha256',$newHash);$_SESSION['csrf']=bin2hex(random_bytes(32));
    return ['ok'=>true,'csrf'=>$_SESSION['csrf']];
}
function csrf_required(): void {
    session_boot();
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN']??'')) fail('Хуудас шинэчлээд дахин оролдоно уу.',403);
}
function body(): array {
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>65536) fail('Хүсэлт хэт том байна.',413);
    try { $b=json_decode(file_get_contents('php://input',false,null,0,65537),true,32,JSON_THROW_ON_ERROR); }
    catch (JsonException) { fail('JSON хүсэлт буруу байна.'); }
    if (!is_array($b)) fail('Хүсэлт буруу байна.'); return $b;
}
function str_field(array $b,string $key,int $max,bool $required=true): string {
    $v=$b[$key]??''; if (!is_string($v)) fail("Талбар буруу: $key"); $v=trim($v);
    if (($required && $v==='') || mb_strlen($v)>$max) fail("Талбарын утга буруу: $key"); return $v;
}
function int_field(array $b,string $key,int $min,int $max): int {
    $v=$b[$key]??null; if (!is_int($v) || $v<$min || $v>$max) fail("Тоо буруу: $key"); return $v;
}
function products(bool $all=false): array {
    $rows=db()->query('SELECT data FROM products ORDER BY rowid')->fetchAll();
    $items=array_map(fn($r)=>json_decode($r['data'],true),$rows);
    return array_values(array_filter($items,fn($p)=>empty($p['deleted_at']) && ($all || ($p['active']&&($p['type']!=='local'||config()['local_products_enabled'])))));
}
function order_row(string $id): array {
    $s=db()->prepare('SELECT * FROM orders WHERE id=?'); $s->execute([$id]); $r=$s->fetch();
    if (!$r) fail('Захиалга олдсонгүй.',404); $r['order']=json_decode($r['data'],true); return $r;
}
function save_order(array $o): void {
    $old=function_exists('logistics_notify')?order_row($o['id'])['order']:null;
    db()->prepare('UPDATE orders SET data=?,updated=? WHERE id=?')->execute([json_encode($o,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),gmdate('c'),$o['id']]);
    if(function_exists('logistics_notify'))logistics_notify($o,$old);
}
function public_order(array $o): array {
    if(function_exists('logistics_public'))$o['cargo']=logistics_public($o);
    if(function_exists('warehouse_profile')&&($o['fulfillment']['method']??'')==='pickup')$o['pickup_warehouse']=warehouse_profile('ulaanbaatar');
    unset($o['internal_note'],$o['callback_token'],$o['customer'],$o['phone'],$o['batch_id'],$o['logistics'],$o['pickup_code'],$o['freight'],$o['settlement']);
    if(isset($o['history']))$o['history']=array_map(fn($h)=>array_intersect_key($h,array_flip(['status','at'])),$o['history']);
    if(isset($o['fulfillment']))$o['fulfillment']=array_intersect_key($o['fulfillment'],array_flip(['method']));
    if (isset($o['invoice'])) unset($o['invoice']['raw']); return $o;
}
function product_link(string $url): bool {
    $p=parse_url($url); if (!$p || !in_array($p['scheme']??'',['http','https'],true) || isset($p['user']) || isset($p['pass']) || isset($p['port'])) return false;
    $h=strtolower($p['host']??''); foreach (['taobao.com','tmall.com','1688.com','tb.cn'] as $d) if ($h===$d || str_ends_with($h,'.'.$d)) return true; return false;
}
