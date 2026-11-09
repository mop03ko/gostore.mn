<?php
declare(strict_types=1);

// Admin staff accounts, roles, two-step sign-in (TOTP) and the admin audit log.
// The built-in owner is the configured administrator (config admin_email + admin_password_hash) and
// cannot be disabled here. Staff accounts live in admin_users. Roles: owner > operator > viewer.
const ADMIN_ROLES = ['viewer'=>1,'operator'=>2,'owner'=>3];
const ADMIN_ROLE_LABELS = ['viewer'=>'Зөвхөн харах','operator'=>'Оператор','owner'=>'Эзэмшигч'];

function admin_users_schema(): void {
    static $done=false;if($done)return;
    db()->exec('CREATE TABLE IF NOT EXISTS admin_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, totp_secret TEXT, totp_last_step INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, auth_version INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL, updated TEXT NOT NULL, last_login TEXT);
        CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor_id TEXT NOT NULL, actor TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL, ip TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS admin_audit_at ON admin_audit(at);');
    $done=true;
}
function admin_meta(string $key): array {$s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute([$key]);return json_decode($s->fetchColumn()?:'{}',true)?:[];}
function admin_meta_put(string $key,array $value): void {db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute([$key,json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);}
function admin_staff(string $id): ?array {
    admin_users_schema();$s=db()->prepare('SELECT * FROM admin_users WHERE id=?');$s->execute([$id]);$u=$s->fetch();return $u?:null;
}
function admin_staff_by_email(string $email): ?array {
    admin_users_schema();$s=db()->prepare('SELECT * FROM admin_users WHERE email=? COLLATE NOCASE');$s->execute([$email]);$u=$s->fetch();return $u?:null;
}
function admin_owner_record(): array {
    $t=admin_meta('admin_owner_totp');
    return ['id'=>'owner','email'=>(string)config()['admin_email'],'name'=>'Эзэмшигч','role'=>'owner','password_hash'=>admin_password_hash(),'totp_secret'=>$t['secret']??null,'totp_last_step'=>(int)($t['last_step']??0),'active'=>1,'auth_version'=>1,'builtin'=>true];
}
// Session binding: a password change, reset, deactivation or role removal ends the account's sessions.
function admin_session_version(array $u): string {
    return !empty($u['builtin'])?hash('sha256',$u['password_hash']):hash('sha256',$u['password_hash'].'|'.$u['auth_version']);
}
function admin_current(): ?array {
    if(session_status()!==PHP_SESSION_ACTIVE||empty($_SESSION['admin']))return null;
    $id=(string)($_SESSION['admin_user']??'owner');
    if($id==='owner'){$u=admin_owner_record();if(!$u['password_hash'])return null;}
    else{$u=admin_staff($id);if(!$u||!(int)$u['active']||!isset(ADMIN_ROLES[$u['role']]))return null;}
    return hash_equals(admin_session_version($u),(string)($_SESSION['admin_version']??''))?$u:null;
}
function admin_current_public(): ?array {
    $u=admin_current();if(!$u)return null;
    return ['id'=>$u['id'],'email'=>$u['email'],'name'=>$u['name'],'role'=>$u['role'],'role_label'=>ADMIN_ROLE_LABELS[$u['role']],'builtin'=>!empty($u['builtin']),'totp'=>!empty($u['totp_secret'])];
}
function admin_role_at_least(string $role): bool {
    $u=admin_current();return $u&&ADMIN_ROLES[$u['role']]>=ADMIN_ROLES[$role];
}
// Minimal role for each admin action. Unknown actions need the owner.
function admin_action_role(string $action,string $method): string {
    if(in_array($action,['session','login','logout','admin-password-change','admin-totp-setup','admin-totp-enable','admin-totp-disable'],true))return 'viewer';
    if($method==='GET'){
        if(in_array($action,['admin-users','admin-audit'],true))return 'owner';
        if($action==='admin-export')return ($_GET['kind']??'')==='customers'?'owner':'operator';
        if(in_array($action,['admin-customers','admin-customer'],true))return 'operator';
        return 'viewer';
    }
    if(in_array($action,['shipping-save','taoworld-settings','taoworld-pay','taoworld-budget','warehouse-create','warehouse-profile-save','warehouse-account-save','admin-user-save','admin-quota-save'],true)
        ||str_starts_with($action,'taobao-buyer-')||str_starts_with($action,'ot-operator-'))return 'owner';
    if(in_array($action,['order-update','order-refund','product-save','product-delete','image-upload','review-moderate','admin-customer-save','admin-promo-popup-save','shipping-calculate','warehouse-assign-order','catalog-controls-save','catalog-stores-save','catalog-store-test'],true)
        ||str_starts_with($action,'admin-message')||str_starts_with($action,'taoworld-')||str_starts_with($action,'taobao-purchase-'))return 'operator';
    return 'owner';
}
function admin_authorize(string $action,string $method): void {
    $u=admin_current();if(!$u)return;
    if(ADMIN_ROLES[$u['role']]<ADMIN_ROLES[admin_action_role($action,$method)])fail('Таны эрх энэ үйлдэлд хүрэлцэхгүй.',403);
}

// RFC 6238 time-based codes (SHA-1, 30 seconds, 6 digits), as used by authenticator apps.
function totp_secret_new(): string {
    $alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';$bytes=random_bytes(20);$bits='';
    foreach(str_split($bytes) as $c)$bits.=str_pad(decbin(ord($c)),8,'0',STR_PAD_LEFT);
    $out='';foreach(str_split($bits,5) as $chunk)$out.=$alphabet[bindec(str_pad($chunk,5,'0'))];return $out;
}
function totp_base32_decode(string $s): string {
    $alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';$s=strtoupper(preg_replace('/[\s=]/','',$s));$bits='';
    foreach(str_split($s) as $c){$i=strpos($alphabet,$c);if($i===false)return '';$bits.=str_pad(decbin($i),5,'0',STR_PAD_LEFT);}
    $out='';foreach(str_split($bits,8) as $byte)if(strlen($byte)===8)$out.=chr(bindec($byte));return $out;
}
function totp_code(string $secret,int $step): string {
    $key=totp_base32_decode($secret);$h=hash_hmac('sha1',pack('N2',intdiv($step,4294967296),$step%4294967296),$key,true);
    $o=ord($h[19])&15;$v=((ord($h[$o])&127)<<24)|(ord($h[$o+1])<<16)|(ord($h[$o+2])<<8)|ord($h[$o+3]);
    return str_pad((string)($v%1000000),6,'0',STR_PAD_LEFT);
}
// Returns the matched time step, or null. One step of clock drift either way; a used step is rejected.
function totp_match(string $secret,mixed $code,int $lastStep,?int $now=null): ?int {
    if(!is_string($code)||!preg_match('/^\d{6}$/D',$code=preg_replace('/\s+/','',$code)??''))return null;
    $step=intdiv($now??time(),30);
    foreach([0,-1,1] as $d)if($step+$d>$lastStep&&hash_equals(totp_code($secret,$step+$d),$code))return $step+$d;
    return null;
}
function totp_uri(string $secret,string $email): string {
    return 'otpauth://totp/'.rawurlencode('GOStore:'.$email).'?secret='.$secret.'&issuer=GOStore&algorithm=SHA1&digits=6&period=30';
}
function admin_totp_store(array $u,?string $secret,int $step=0): void {
    if(!empty($u['builtin'])){admin_meta_put('admin_owner_totp',$secret?['secret'=>$secret,'last_step'=>$step,'enabled_at'=>gmdate('c')]:[]);return;}
    db()->prepare('UPDATE admin_users SET totp_secret=?,totp_last_step=?,updated=? WHERE id=?')->execute([$secret,$step,gmdate('c'),$u['id']]);
}
function admin_totp_used(array $u,int $step): void {
    if(!empty($u['builtin'])){$t=admin_meta('admin_owner_totp');$t['last_step']=$step;admin_meta_put('admin_owner_totp',$t);return;}
    db()->prepare('UPDATE admin_users SET totp_last_step=? WHERE id=?')->execute([$step,$u['id']]);
}

// Only failed attempts count, so several staff behind one office address can sign in;
// guessing is limited per address (20) and per account (8) for 15 minutes.
function admin_login_keys(string $email): array {
    return [['login-fail:'.($_SERVER['REMOTE_ADDR']??''),20],['login-fail-account:'.mb_strtolower($email),8]];
}
function admin_login_guard(string $email): void {
    $s=db()->prepare('SELECT hits FROM limits WHERE key=? AND expires>=?');
    foreach(admin_login_keys($email) as [$key,$max]){$s->execute([hash('sha256',$key),time()]);$hits=(int)$s->fetchColumn();$s->closeCursor();if($hits>=$max)fail('Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.',429);}
}
function admin_login_failed(string $email,string $detail,?array $actor=null): void {
    foreach(admin_login_keys($email) as [$key])limit_attempts($key,PHP_INT_MAX,900);
    admin_audit_write('login-failed',mb_substr(mb_strtolower($email),0,120),$detail,$actor??['id'=>'-','email'=>mb_substr($email,0,120),'role'=>'-']);
}
function admin_login(array $b): array {
    $email=str_field($b,'email',200);$password=$b['password']??'';admin_login_guard($email);
    if(!is_string($password)||$password===''||strlen($password)>1000)fail('Имэйл эсвэл нууц үг буруу байна.',401);
    $u=hash_equals(strtolower((string)config()['admin_email']),strtolower($email))?admin_owner_record():admin_staff_by_email($email);
    if(!$u||!$u['password_hash']||!(int)$u['active']||!password_verify($password,$u['password_hash'])){
        admin_login_failed($email,'');
        fail('Имэйл эсвэл нууц үг буруу байна.',401);
    }
    if(!empty($u['totp_secret'])){
        $code=$b['code']??'';
        if($code===''||$code===null)json_out(['totp_required'=>true,'error'=>'Баталгаажуулах апп дээрх 6 оронтой кодоо оруулна уу.'],401);
        $db=db();$db->exec('BEGIN IMMEDIATE');
        try{
            $fresh=!empty($u['builtin'])?admin_owner_record():admin_staff($u['id']);
            $step=totp_match((string)$fresh['totp_secret'],$code,(int)$fresh['totp_last_step']);
            if($step===null){$db->exec('ROLLBACK');admin_login_failed($email,'totp',$u);json_out(['totp_required'=>true,'error'=>'Баталгаажуулах код буруу эсвэл хугацаа нь дууссан байна.'],401);}
            admin_totp_used($fresh,$step);$db->exec('COMMIT');
        }catch(Throwable $e){if($db->inTransaction())$db->exec('ROLLBACK');throw $e;}
    }
    session_regenerate_id(true);$_SESSION['admin']=true;$_SESSION['admin_user']=$u['id'];$_SESSION['admin_version']=admin_session_version($u);$_SESSION['csrf']=bin2hex(random_bytes(32));
    if(empty($u['builtin']))db()->prepare('UPDATE admin_users SET last_login=? WHERE id=?')->execute([gmdate('c'),$u['id']]);
    admin_audit_write('login','','',$u);
    return ['ok'=>true,'csrf'=>$_SESSION['csrf'],'admin'=>admin_current_public()];
}
function admin_staff_password_change(array $b): array {
    $u=admin_current();if(!$u||!empty($u['builtin']))fail('Админаар нэвтэрнэ үү.',401);
    limit_attempts('admin-password:'.($_SERVER['REMOTE_ADDR']??'cli'),8,900);
    $current=$b['current_password']??null;$next=$b['new_password']??null;$confirm=$b['password_confirm']??null;
    if(!is_string($current)||strlen($current)>1000)fail('Одоогийн нууц үг буруу байна.',422);
    admin_password_rules($next,$confirm);
    if(!password_verify($current,$u['password_hash']))fail('Одоогийн нууц үг буруу байна.',422);
    if(password_verify($next,$u['password_hash']))fail('Өмнөхөөс өөр шинэ нууц үг сонгоно уу.');
    $hash=password_hash($next,PASSWORD_BCRYPT,['cost'=>12]);
    db()->prepare('UPDATE admin_users SET password_hash=?,auth_version=auth_version+1,updated=? WHERE id=?')->execute([$hash,gmdate('c'),$u['id']]);
    $u=admin_staff($u['id']);session_regenerate_id(true);$_SESSION['admin_version']=admin_session_version($u);$_SESSION['csrf']=bin2hex(random_bytes(32));
    return ['ok'=>true,'csrf'=>$_SESSION['csrf']];
}
function admin_password_rules(mixed $next,mixed $confirm): void {
    if(!is_string($next)||str_contains($next,"\0")||mb_strlen($next)<12||strlen($next)>72)fail('Шинэ нууц үг 12-оос доошгүй тэмдэгт, 72 байтаас хэтрэхгүй байна.');
    if(!is_string($confirm)||!hash_equals($next,$confirm))fail('Шинэ нууц үгийн давталт таарахгүй байна.');
}
// Two-step sign-in for the signed-in account: setup → confirm with a code → (later) disable with password + code.
function admin_totp_post(string $action,array $b): array {
    $u=admin_current();if(!$u)fail('Админаар нэвтэрнэ үү.',401);
    if($action==='admin-totp-setup'){
        if(!empty($u['totp_secret']))fail('Хоёр алхмын баталгаажуулалт аль хэдийн асаалттай.',409);
        $_SESSION['admin_totp_pending']=['secret'=>totp_secret_new(),'at'=>time()];$secret=$_SESSION['admin_totp_pending']['secret'];
        return ['secret'=>$secret,'uri'=>totp_uri($secret,$u['email'])];
    }
    limit_attempts('admin-totp:'.($_SERVER['REMOTE_ADDR']??'cli'),10,900);
    if($action==='admin-totp-enable'){
        $p=$_SESSION['admin_totp_pending']??null;if(!$p||$p['at']<time()-900)fail('Тохиргоог дахин эхлүүлнэ үү.',409);
        $step=totp_match($p['secret'],$b['code']??null,0);if($step===null)fail('Код таарсангүй. Апп дээрх шинэ кодыг оруулна уу.',422);
        admin_totp_store($u,$p['secret'],$step);unset($_SESSION['admin_totp_pending']);return ['ok'=>true,'admin'=>admin_current_public()];
    }
    if($action==='admin-totp-disable'){
        if(empty($u['totp_secret']))fail('Хоёр алхмын баталгаажуулалт асаагүй байна.',409);
        $password=$b['password']??'';if(!is_string($password)||strlen($password)>1000||!password_verify($password,$u['password_hash']))fail('Нууц үг буруу байна.',422);
        if(totp_match($u['totp_secret'],$b['code']??null,(int)$u['totp_last_step'])===null)fail('Код таарсангүй.',422);
        admin_totp_store($u,null);return ['ok'=>true,'admin'=>admin_current_public()];
    }
    fail('Үйлдэл олдсонгүй.',404);
}

function admin_users_list(): array {
    admin_users_schema();$o=admin_owner_record();
    $rows=[['id'=>'owner','email'=>$o['email'],'name'=>$o['name'],'role'=>'owner','active'=>true,'totp'=>!empty($o['totp_secret']),'builtin'=>true,'created'=>null,'last_login'=>null]];
    foreach(db()->query('SELECT * FROM admin_users ORDER BY created')->fetchAll() as $u)
        $rows[]=['id'=>$u['id'],'email'=>$u['email'],'name'=>$u['name'],'role'=>$u['role'],'active'=>(bool)$u['active'],'totp'=>!empty($u['totp_secret']),'builtin'=>false,'created'=>$u['created'],'last_login'=>$u['last_login']];
    return ['users'=>$rows,'roles'=>ADMIN_ROLE_LABELS];
}
function admin_user_save(array $b): array {
    admin_users_schema();
    $id=str_field($b,'id',40,false);$email=mb_strtolower(str_field($b,'email',120));$name=str_field($b,'name',80);$role=str_field($b,'role',20);
    if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Имэйл хаяг буруу байна.');
    if(!isset(ADMIN_ROLES[$role]))fail('Эрхийн түвшин буруу.');
    if(!is_bool($b['active']??null))fail('Төлөв буруу.');
    if(hash_equals(strtolower((string)config()['admin_email']),$email))fail('Энэ имэйл эзэмшигчийн данс байна.',409);
    $password=$b['password']??'';$now=gmdate('c');$db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $dup=admin_staff_by_email($email);if($dup&&$dup['id']!==$id)fail('Энэ имэйлээр данс бүртгэлтэй байна.',409);
        if($id===''){
            admin_password_rules($password,$b['password_confirm']??$password);
            $id='adm-'.bin2hex(random_bytes(6));
            $db->prepare('INSERT INTO admin_users (id,email,name,role,password_hash,active,created,updated) VALUES (?,?,?,?,?,?,?,?)')->execute([$id,$email,$name,$role,password_hash($password,PASSWORD_BCRYPT,['cost'=>12]),$b['active']?1:0,$now,$now]);
        }else{
            $old=admin_staff($id);if(!$old)fail('Админ олдсонгүй.',404);
            $bump=$old['role']!==$role||(int)$old['active']!==($b['active']?1:0)||$old['email']!==$email;
            $db->prepare('UPDATE admin_users SET email=?,name=?,role=?,active=?,updated=? WHERE id=?')->execute([$email,$name,$role,$b['active']?1:0,$now,$id]);
            if(is_string($password)&&$password!==''){admin_password_rules($password,$b['password_confirm']??$password);$db->prepare('UPDATE admin_users SET password_hash=? WHERE id=?')->execute([password_hash($password,PASSWORD_BCRYPT,['cost'=>12]),$id]);$bump=true;}
            if(($b['reset_totp']??false)===true){$db->prepare('UPDATE admin_users SET totp_secret=NULL,totp_last_step=0 WHERE id=?')->execute([$id]);$bump=true;}
            if($bump)$db->prepare('UPDATE admin_users SET auth_version=auth_version+1 WHERE id=?')->execute([$id]);
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return admin_users_list();
}

// Audit log: who changed what. Secrets, passwords and codes are never stored.
function admin_audit_write(string $action,string $target,string $detail,?array $actor=null): void {
    try{
        admin_users_schema();$actor??=admin_current();
        db()->prepare('INSERT INTO admin_audit (at,actor_id,actor,role,action,target,detail,ip) VALUES (?,?,?,?,?,?,?,?)')->execute([gmdate('c'),(string)($actor['id']??'-'),mb_substr((string)($actor['email']??'-'),0,120),(string)($actor['role']??'-'),mb_substr($action,0,60),mb_substr($target,0,120),mb_substr($detail,0,2000),mb_substr((string)($_SERVER['REMOTE_ADDR']??'cli'),0,64)]);
    }catch(Throwable $e){error_log('GOStore admin audit write failed: '.get_class($e));}
}
function admin_audit_fields(array $b): string {
    $parts=[];
    foreach($b as $k=>$v){
        if(!is_string($k)||preg_match('/pass|secret|token|totp|csrf|code|key|image_base64/i',$k))continue;
        if(is_bool($v))$v=$v?'true':'false';elseif(is_array($v))$v=mb_substr(json_encode($v,JSON_UNESCAPED_UNICODE)?:'',0,160);elseif(!is_scalar($v)&&$v!==null)continue;
        $parts[]=$k.'='.mb_substr(trim((string)$v),0,160);if(count($parts)>=14)break;
    }
    return implode('; ',$parts);
}
// Registers a write after a successful admin POST (2xx). Order changes record the before → after values.
function admin_audit_on_success(string $action): void {
    $raw=(string)file_get_contents('php://input',false,null,0,65537);$b=json_decode($raw,true);if(!is_array($b))$b=[];
    $target=(string)($b['id']??$b['order_id']??$b['email']??$b['refund_id']??'');
    $before=null;
    if(in_array($action,['order-update','order-refund'],true)||str_starts_with($action,'taoworld-')){
        try{$before=order_row(mb_substr($target,0,50))['order'];}catch(Throwable){$before=null;}
    }
    register_shutdown_function(static function()use($action,$b,$target,$before){
        $code=http_response_code();if(!is_int($code)||$code<200||$code>=300)return;
        // The admin already has the answer; write the audit row after it is sent (PHP-FPM). The actor is
        // read before the session is released.
        $actor=admin_current();
        if(function_exists('fastcgi_finish_request')){if(session_status()===PHP_SESSION_ACTIVE)session_write_close();fastcgi_finish_request();}
        $detail=admin_audit_fields($b);
        if($before){
            try{$after=order_row($before['id'])['order'];
                $changes=[];foreach(['status','amount','paid'] as $k)if(($before[$k]??null)!==($after[$k]??null))$changes[]=$k.': '.json_encode($before[$k]??null).' → '.json_encode($after[$k]??null);
                if(count($after['refunds']??[])>count($before['refunds']??[]))$changes[]='буцаалт: '.json_encode(end($after['refunds'])['amount']??null);
                $bp=$before['purchase']['state']??null;$ap=$after['purchase']['state']??null;if($bp!==$ap)$changes[]='TaoWorld: '.json_encode($bp).' → '.json_encode($ap);
                if($changes)$detail=implode('; ',$changes).($detail?' | '.$detail:'');
            }catch(Throwable){}
        }
        admin_audit_write($action,$target,$detail,$actor);
    });
}
function admin_audit_list(array $q): array {
    admin_users_schema();$page=max(1,min(500,(int)($q['page']??1)));$term=mb_substr(trim((string)($q['q']??'')),0,80);
    $where='';$args=[];
    if($term!==''){
        $like='%'.str_replace(['\\','%','_'],['\\\\','\%','\_'],$term).'%';$args=[$like,$like,$like,$like];
        $where="WHERE actor LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR target LIKE ? ESCAPE '\\' OR detail LIKE ? ESCAPE '\\'";
    }
    $count=db()->prepare('SELECT COUNT(*) FROM admin_audit '.$where);$count->execute($args);$total=(int)$count->fetchColumn();
    $s=db()->prepare('SELECT at,actor,role,action,target,detail,ip FROM admin_audit '.$where.' ORDER BY id DESC LIMIT 50 OFFSET '.(($page-1)*50));$s->execute($args);
    return ['rows'=>$s->fetchAll(),'page'=>$page,'pages'=>max(1,(int)ceil($total/50)),'total'=>$total];
}
