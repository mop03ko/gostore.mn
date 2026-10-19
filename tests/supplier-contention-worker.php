<?php
if(PHP_SAPI!=='cli'||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')!=='1')exit(1);
foreach(['bootstrap','shipping','supplier'] as $f)require __DIR__.'/../server/'.$f.'.php';
$dir=config()['data_dir'].'/supplier-cache';$query=['language'=>'mn','item_title'=>'queue-test','page'=>1,'limit'=>50,'sort'=>'default'];$path='/v1/taobao/search';$key=supplier_cache_key($path,$query);$mode=$argv[1];
if($mode==='key'){
    $h=fopen($dir.'/'.$key.'.lock','c');flock($h,LOCK_EX);echo 'ready';fflush(STDOUT);fgets(STDIN);
    supplier_snapshot_write($dir.'/'.$key.'.json',['data'=>['Items'=>['Items'=>['Content'=>[],'TotalCount'=>0]]],'fetched'=>gmdate('c'),'expires'=>time()+600,'stale'=>false]);
    flock($h,LOCK_UN);fclose($h);exit;
}
if(in_array($mode,['slots','background-slot'],true)){
    $handles=[];foreach($mode==='slots'?[0,1]:[1] as $i){$h=fopen($dir.'/network-'.$i.'.lock','c');flock($h,LOCK_EX);$handles[]=$h;}echo 'ready';fflush(STDOUT);fgets(STDIN);foreach($handles as $h){flock($h,LOCK_UN);fclose($h);}exit;
}
try{$r=supplier_raw_request($path,$mode==='background'?array_replace($query,['item_title'=>'background-test']):$query,$mode!=='background',false,$mode==='background');echo json_encode(['ok'=>true,'fetched'=>$r['fetched']]);}
catch(ApiError $e){echo json_encode(['error'=>get_class($e),'status'=>$e->getCode()]);}
