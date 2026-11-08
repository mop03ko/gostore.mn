<?php
declare(strict_types=1);

// Daily operations e-mail: backup result, last-24-hour orders/customers, supplier API budget, push
// queues, disk space and grouped PHP errors. Counts and error kinds only; never customer data.
function daily_report_error_log(): string {
    return (string)(config()['php_error_log']??dirname(__DIR__,2).'/logs/gostore_mn.php.error.log');
}
// Groups PHP error-log entries from the last 24 hours by message (timestamps removed).
function daily_report_errors(int $since,?string $path=null): array {
    $path??=daily_report_error_log();if(!is_readable($path))return ['readable'=>false,'total'=>0,'kinds'=>[]];
    $size=filesize($path);$fh=fopen($path,'rb');if(!$fh)return ['readable'=>false,'total'=>0,'kinds'=>[]];
    if($size>2000000)fseek($fh,$size-2000000);$kinds=[];$total=0;
    while(($line=fgets($fh))!==false){
        if(!preg_match('/^\[(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2}) ([A-Za-z\/_+-]+)\] (.+)$/',rtrim($line),$m))continue;
        $time=strtotime($m[1].' '.$m[2]);if($time===false||$time<$since)continue;
        $message=preg_replace('/\b\d{4,}\b/','#',substr($m[3],0,160));$kinds[$message]=($kinds[$message]??0)+1;$total++;
    }
    fclose($fh);arsort($kinds);return ['readable'=>true,'total'=>$total,'kinds'=>array_slice($kinds,0,8,true)];
}
function daily_report_count(string $sql,array $args=[]): ?int {
    try{$q=db()->prepare($sql);$q->execute($args);return (int)$q->fetchColumn();}catch(Throwable){return null;}
}
function daily_report_build(?int $now=null): array {
    $now??=time();$since=$now-86400;$sinceIso=gmdate('c',$since);$warnings=[];
    $backup=backup_status();$latest=backup_latest();
    if(empty($backup['ok']))$warnings[]='Өгөгдлийн сангийн нөөц амжилтгүй: '.($backup['error']??'мэдээлэл алга');
    if(isset($backup['drive'])&&empty($backup['drive']['ok']))$warnings[]='Google Drive руу хуулж чадсангүй: '.($backup['drive']['error']??'');
    if(!isset($backup['drive'])||empty($backup['drive']['configured']))$warnings[]='Google Drive нөөц тохируулагдаагүй (зөвхөн серверт хадгалагдаж байна).';
    $orders=daily_report_count('SELECT COUNT(*) FROM orders WHERE created>=?',[$sinceIso]);$customers=daily_report_count("SELECT COUNT(*) FROM customers WHERE created>=? AND email NOT LIKE 'deleted-%@invalid.example'",[$sinceIso]);
    $budget=null;if(function_exists('supplier_budget_status')){try{$budget=supplier_budget_status();}catch(Throwable){}}
    if($budget&&$budget['used']>=$budget['browse_limit'])$warnings[]='TaoWorld өдрийн API лимит дууссан ('.$budget['used'].'/'.$budget['limit'].').';
    $push=['devices'=>daily_report_count('SELECT COUNT(*) FROM customer_push_devices WHERE expires>?',[$now]),'message_pending'=>daily_report_count("SELECT COUNT(*) FROM customer_message_push WHERE status IN ('pending','sent')")];
    $catalog=json_decode((string)@file_get_contents(config()['data_dir'].'/catalog-worker-status.json'),true);
    if(is_array($catalog)&&strtotime((string)($catalog['time']??''))<$now-3600)$warnings[]='Каталогийн worker (хямдралын индекс) 1 цагаас дээш ажиллаагүй.';
    $errors=daily_report_errors($since);if($errors['total']>=20)$warnings[]='Сүүлийн 24 цагт '.$errors['total'].' PHP алдаа бүртгэгдсэн.';
    $free=@disk_free_space(config()['data_dir']);if($free!==false&&$free<500*1024*1024)$warnings[]='Серверийн дискний сул зай бага: '.round($free/1048576).' MB.';
    $date=gmdate('Y-m-d',$now+8*3600);$lines=['gostore.mn өдрийн тайлан — '.$date.' (Улаанбаатар)',''];
    if($warnings){$lines[]='АНХААРАХ:';foreach($warnings as $w)$lines[]='  • '.$w;$lines[]='';}
    $lines[]='Нөөц: '.(!empty($backup['ok'])?'амжилттай, '.($backup['name']??'').', '.round(($backup['bytes']??0)/1024).' KB':'амжилтгүй').($latest?' · серверт '.$latest['count'].' хуулбар':'').(!empty($backup['drive']['id'])?' · Google Drive-д хуулсан':'');
    $lines[]='Сүүлийн 24 цаг: '.($orders??'?').' шинэ захиалга, '.($customers??'?').' шинэ хэрэглэгч.';
    if($budget)$lines[]='TaoWorld API (UTC '.$budget['date'].'): '.$budget['used'].'/'.$budget['limit'].' ашигласан, үзэлтийн хязгаар '.$budget['browse_limit'].'.';
    if(is_array($catalog))$lines[]='Хямдралын индекс: '.(int)($catalog['deals']['items']??0).' бараа'.(isset($catalog['warm']['pages'])?' · өглөөний татаж авалт '.$catalog['warm']['pages'].'/'.$catalog['warm']['of'].' хуудас, '.$catalog['warm']['api_calls'].' API дуудлага'.($catalog['warm']['stopped']==='budget'?' (лимит хүрэлцээгүй)':''):'').'.';
    $lines[]='Утасны push: '.($push['devices']??0).' идэвхтэй төхөөрөмж, '.($push['message_pending']??0).' мэдэгдэл дараалалд.';
    if($free!==false)$lines[]='Дискний сул зай: '.round($free/1073741824,1).' GB.';
    $lines[]='PHP алдаа (24 цаг): '.($errors['readable']?$errors['total']:'лог уншигдсангүй');
    foreach($errors['kinds'] as $message=>$count)$lines[]='  '.$count.' × '.$message;
    return ['subject'=>($warnings?'⚠ ':'').'gostore.mn өдрийн тайлан '.$date,'body'=>implode("\n",$lines)."\n",'warnings'=>$warnings];
}
function daily_report_send(array $report,?callable $mail=null): bool {
    $to=(string)(config()['report_email']??'shop@gostore.mn');if(!filter_var($to,FILTER_VALIDATE_EMAIL))return false;
    $mail??='mail';$headers="From: gostore.mn <no-reply@gostore.mn>\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\nMIME-Version: 1.0";
    return (bool)$mail($to,mb_encode_mimeheader($report['subject'],'UTF-8','B'),$report['body'],$headers);
}
