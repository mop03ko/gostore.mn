<?php
declare(strict_types=1);
// Daily cron (07:30 Ulaanbaatar): database backup (local + Google Drive when configured), then the
// operations e-mail. A failed backup is reported, never silently skipped.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
require_once __DIR__.'/shipping.php';
require_once __DIR__.'/supplier-budget.php';
require __DIR__.'/backup.php';
require __DIR__.'/daily-report.php';
$lock=fopen(config()['data_dir'].'/daily-worker.lock','c');
if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){fwrite(STDERR,"Daily worker already running.\n");exit(1);}
try{
    $backup=backup_run();
    $report=daily_report_build();$sent=in_array('--no-mail',$argv,true)?false:daily_report_send($report);
    echo json_encode(['backup_ok'=>$backup['ok'],'drive'=>$backup['drive']['ok']??null,'mail_sent'=>$sent,'warnings'=>count($report['warnings'])],JSON_UNESCAPED_UNICODE).PHP_EOL;
    exit($backup['ok']?0:1);
}finally{flock($lock,LOCK_UN);fclose($lock);}
