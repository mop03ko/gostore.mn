<?php
declare(strict_types=1);

// Daily database backup. A consistent copy of the live SQLite database (see backup_snapshot; safe
// while the site writes), integrity-checked and gzipped under <data_dir>/backups/daily, newest 30 kept.
// Off-server copy: Google Drive through an owner-authorised OAuth refresh token (drive.file scope)
// in <data_dir>/backup-drive.json. Service accounts cannot own files in a personal Drive, so the
// token belongs to the owner's Google account; the server never stores a Google password.
const BACKUP_KEEP=30;
const BACKUP_DRIVE_KEEP_DAYS=90;
function backup_dir(): string {
    $dir=config()['data_dir'].'/backups/daily';
    if(!is_dir($dir)&&!mkdir($dir,0700,true))throw new RuntimeException('Backup directory unavailable');
    return $dir;
}
// The production host's SQLite predates VACUUM INTO (3.27), so the method depends on what is
// available: VACUUM INTO, else SQLite's online backup API through ext/sqlite3, else a copy of the
// database and its WAL taken while holding the write lock (readers continue, writers wait briefly).
function backup_snapshot(string $tmp,?string $method=null): string {
    $method??=version_compare((string)db()->query('SELECT sqlite_version()')->fetchColumn(),'3.27.0','>=')?'vacuum':(class_exists('SQLite3')?'backup-api':'locked-copy');
    $live=config()['data_dir'].'/gostore.sqlite';
    if($method==='vacuum'){db()->exec('VACUUM INTO '.db()->quote($tmp));return $method;}
    if($method==='backup-api'){
        $src=new SQLite3($live);$src->busyTimeout(10000);$dst=new SQLite3($tmp);
        try{if(!$src->backup($dst))throw new RuntimeException('SQLite backup API failed');}finally{$dst->close();$src->close();}
    }else{
        $db=db();$db->exec('BEGIN IMMEDIATE');
        try{if(!copy($live,$tmp)||(is_file($live.'-wal')&&!copy($live.'-wal',$tmp.'-wal')))throw new RuntimeException('Database copy failed');}
        finally{$db->exec('ROLLBACK');}
    }
    // Fold any copied WAL into the copy and leave WAL mode, so the backup is one self-contained file.
    $copy=new PDO('sqlite:'.$tmp,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$copy->query('PRAGMA wal_checkpoint(TRUNCATE)')->fetchAll();$copy->query('PRAGMA journal_mode=DELETE')->fetchAll();$copy=null;
    return $method;
}
function backup_create(?int $now=null,?string $method=null): array {
    $now??=time();$dir=backup_dir();$name='gostore-'.gmdate('Ymd-His',$now).'.sqlite';$tmp=$dir.'/.'.$name.'.tmp';$gz=$dir.'/'.$name.'.gz';
    $temps=[$tmp,$tmp.'-wal',$tmp.'-shm',$tmp.'-journal',$gz.'.part'];foreach($temps as $f)if(is_file($f))unlink($f);
    try{
        $used=backup_snapshot($tmp,$method);
        $copy=new PDO('sqlite:'.$tmp,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $check=(string)$copy->query('PRAGMA integrity_check')->fetchColumn();$tables=(int)$copy->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")->fetchColumn();$copy=null;
        if($check!=='ok'||$tables<1)throw new RuntimeException('Backup copy failed its integrity check');
        $in=fopen($tmp,'rb');$out=gzopen($gz.'.part','wb6');if(!$in||!$out)throw new RuntimeException('Backup file unavailable');
        try{while(!feof($in)){$chunk=fread($in,1<<20);if($chunk===false||gzwrite($out,$chunk)===false)throw new RuntimeException('Backup write failed');}}
        finally{fclose($in);gzclose($out);}
        chmod($gz.'.part',0600);if(!rename($gz.'.part',$gz))throw new RuntimeException('Backup publish failed');
    }finally{foreach($temps as $f)if(is_file($f))unlink($f);}
    return ['name'=>basename($gz),'file'=>$gz,'bytes'=>filesize($gz),'sha256'=>hash_file('sha256',$gz),'tables'=>$tables,'method'=>$used,'created'=>gmdate('c',$now)];
}
// Keeps the newest BACKUP_KEEP daily copies; returns how many were removed.
function backup_prune(int $keep=BACKUP_KEEP): int {
    $files=glob(backup_dir().'/gostore-*.sqlite.gz')?:[];rsort($files,SORT_STRING);$removed=0;
    foreach(array_slice($files,$keep) as $f)if(unlink($f))$removed++;
    return $removed;
}
function backup_latest(): ?array {
    $files=glob(backup_dir().'/gostore-*.sqlite.gz')?:[];if(!$files)return null;rsort($files,SORT_STRING);
    return ['name'=>basename($files[0]),'bytes'=>filesize($files[0]),'age_hours'=>round((time()-filemtime($files[0]))/3600,1),'count'=>count($files)];
}
function backup_drive_config(): ?array {
    $path=config()['data_dir'].'/backup-drive.json';if(!is_file($path))return null;
    $c=json_decode((string)file_get_contents($path),true);
    foreach(['client_id','client_secret','refresh_token','folder_id'] as $k)if(!is_string($c[$k]??null)||$c[$k]==='')throw new RuntimeException('Drive backup configuration incomplete');
    if(!preg_match('/^[A-Za-z0-9_-]{10,100}$/D',$c['folder_id']))throw new RuntimeException('Drive folder ID invalid');
    return $c;
}
// HTTP for Google APIs: returns [status, response headers (lower-case), body].
function backup_http(string $method,string $url,array $headers,?string $body=null): array {
    $h=[];$curl=curl_init($url);
    curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>120,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>$headers,
        CURLOPT_HEADERFUNCTION=>function($c,$line)use(&$h){$p=strpos($line,':');if($p!==false)$h[strtolower(trim(substr($line,0,$p)))]=trim(substr($line,$p+1));return strlen($line);}]+($body!==null?[CURLOPT_POSTFIELDS=>$body]:[]));
    $raw=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
    return [$status,$h,is_string($raw)?$raw:''];
}
function backup_drive_token(array $c,callable $http): string {
    [$status,,$body]=$http('POST','https://oauth2.googleapis.com/token',['Content-Type: application/x-www-form-urlencoded'],http_build_query(['grant_type'=>'refresh_token','client_id'=>$c['client_id'],'client_secret'=>$c['client_secret'],'refresh_token'=>$c['refresh_token']]));
    $r=json_decode($body,true);if($status!==200||!is_string($r['access_token']??null))throw new RuntimeException('Drive authorisation failed ('.$status.' '.substr((string)($r['error']??''),0,40).')');
    return $r['access_token'];
}
// Resumable upload into the configured folder; the stored MD5 must match the local file.
function backup_drive_upload(array $backup,?callable $http=null): array {
    $c=backup_drive_config();if(!$c)return ['configured'=>false];$http??='backup_http';$token=backup_drive_token($c,$http);$auth='Authorization: Bearer '.$token;
    $meta=json_encode(['name'=>$backup['name'],'parents'=>[$c['folder_id']],'mimeType'=>'application/gzip','description'=>'gostore.mn database backup, sha256 '.$backup['sha256']],JSON_THROW_ON_ERROR);
    [$status,$h]=$http('POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,md5Checksum',[$auth,'Content-Type: application/json; charset=UTF-8','X-Upload-Content-Type: application/gzip','X-Upload-Content-Length: '.$backup['bytes']],$meta);
    $session=$h['location']??'';if($status!==200||!str_starts_with($session,'https://www.googleapis.com/upload/drive/v3/files'))throw new RuntimeException('Drive upload could not start ('.$status.')');
    [$status,,$body]=$http('PUT',$session,['Content-Type: application/gzip','Content-Length: '.$backup['bytes']],(string)file_get_contents($backup['file']));
    $f=json_decode($body,true);if(!in_array($status,[200,201],true)||!is_string($f['id']??null))throw new RuntimeException('Drive upload failed ('.$status.')');
    if(($f['md5Checksum']??'')!==md5_file($backup['file']))throw new RuntimeException('Drive copy checksum mismatch');
    return ['configured'=>true,'id'=>$f['id'],'removed'=>backup_drive_prune($c,$auth,$http)];
}
// Removes this app's own backup files older than BACKUP_DRIVE_KEEP_DAYS (drive.file sees only those).
function backup_drive_prune(array $c,string $auth,callable $http): int {
    $before=gmdate('Y-m-d\TH:i:s',time()-BACKUP_DRIVE_KEEP_DAYS*86400);
    $q="'".$c['folder_id']."' in parents and name contains 'gostore-' and createdTime < '".$before."' and trashed = false";
    [$status,,$body]=$http('GET','https://www.googleapis.com/drive/v3/files?'.http_build_query(['q'=>$q,'fields'=>'files(id,name)','pageSize'=>100]),[$auth],null);
    if($status!==200)return 0;$removed=0;
    foreach(json_decode($body,true)['files']??[] as $f){if(!preg_match('/^gostore-\d{8}-\d{6}\.sqlite\.gz$/D',(string)($f['name']??'')))continue;[$s]=$http('DELETE','https://www.googleapis.com/drive/v3/files/'.rawurlencode($f['id']),[$auth],null);if($s===204)$removed++;}
    return $removed;
}
function backup_status_path(): string {return config()['data_dir'].'/backup-status.json';}
function backup_status(): array {$s=json_decode((string)@file_get_contents(backup_status_path()),true);return is_array($s)?$s:[];}
// One daily run: local copy and pruning must succeed; the Drive copy is attempted and reported.
function backup_run(?callable $http=null): array {
    $status=['time'=>gmdate('c'),'ok'=>false];
    try{
        $b=backup_create();$status+=['name'=>$b['name'],'method'=>$b['method'],'bytes'=>$b['bytes'],'sha256'=>$b['sha256'],'tables'=>$b['tables'],'pruned'=>backup_prune()];$status['ok']=true;
        try{$status['drive']=backup_drive_upload($b,$http)+['ok'=>true];}catch(Throwable $e){$status['drive']=['configured'=>true,'ok'=>false,'error'=>substr($e->getMessage(),0,120)];}
    }catch(Throwable $e){$status['error']=substr($e->getMessage(),0,160);}
    file_put_contents(backup_status_path(),json_encode($status,JSON_UNESCAPED_SLASHES),LOCK_EX);@chmod(backup_status_path(),0600);
    return $status;
}
