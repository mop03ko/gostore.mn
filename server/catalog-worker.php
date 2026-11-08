<?php
declare(strict_types=1);
// Catalog cron, every 15 minutes:
// - always: rebuild the deals index from cached searches (no TaoWorld calls);
// - once a day from 06:00 Ulaanbaatar (or with --warm): pre-fetch the whole homepage rotation so the
//   morning starts with fresh lists and a full deals index. Pages 1-3 refresh when older than 30
//   minutes, deeper pages when older than six hours. Pre-fetching uses the background half of the
//   daily API budget (never the checkout reserve) and stops as soon as that share is spent.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('GOSTORE_CATALOG_WARMING',true);
require __DIR__.'/bootstrap.php';
require_once __DIR__.'/shipping.php';
require_once __DIR__.'/supplier.php';
$lock=fopen(config()['data_dir'].'/catalog-worker.lock','c');
if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))exit(0);
try{
    if(!tw_catalog_enabled()||!supplier_ready()){echo json_encode(['status'=>'disabled']).PHP_EOL;exit(0);}
    require_once __DIR__.'/taoworld-deals.php';
    $statusFile=config()['data_dir'].'/catalog-worker-status.json';$last=json_decode((string)@file_get_contents($statusFile),true)?:[];
    $local=time()+8*3600;$today=gmdate('Y-m-d',$local);$hour=(int)gmdate('G',$local);
    $warm=in_array('--warm',$argv,true)||($hour>=6&&$hour<9&&($last['warmed_on']??'')!==$today);
    $status=['time'=>gmdate('c'),'warmed_on'=>$last['warmed_on']??null,'warm'=>null];
    if($warm){
        $pages=(int)ceil(count(tw_catalog_home_keywords())/6);$before=supplier_budget_status()['used'];$done=0;$errors=0;$stopped=null;
        for($p=1;$p<=$pages;$p++){
            try{supplier_search(['q'=>'__all__','page'=>$p,'limit'=>50],$p>TW_CATALOG_HOME_DEEP_PAGE);$done++;}
            catch(ApiError $e){if($e->getCode()===429){$stopped='budget';break;}$errors++;}
        }
        $status['warm']=['pages'=>$done,'of'=>$pages,'errors'=>$errors,'stopped'=>$stopped,'api_calls'=>supplier_budget_status()['used']-$before];
        $status['warmed_on']=$today;
    }
    $status['deals']=tw_deals_index_build();
    file_put_contents($statusFile,json_encode($status,JSON_UNESCAPED_SLASHES),LOCK_EX);
    echo json_encode($status,JSON_UNESCAPED_SLASHES).PHP_EOL;
}finally{flock($lock,LOCK_UN);fclose($lock);}
