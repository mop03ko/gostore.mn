<?php
declare(strict_types=1);
// Isolated integration test: discovery must work without any source-product detail.
$root=__DIR__.'/../tmp/discovery-feed-'.bin2hex(random_bytes(6));mkdir($root.'/server',0700,true);
foreach(glob(__DIR__.'/../server/*') as $file)if(is_file($file)&&!str_contains(basename($file),'.local.')&&preg_match('/\.(php|json)$/',$file))copy($file,$root.'/server/'.basename($file));
file_put_contents($root.'/server/taoworld.local.php',"<?php return ['app_key'=>'123456','app_secret'=>'fixture-secret-long-enough','callback_url'=>'https://example.test/callback'];");
putenv('GOSTORE_DATA_DIR='.$root.'/data');putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
foreach(['bootstrap','shipping','supplier','checkout','discovery'] as $f)require_once $root.'/server/'.$f.'.php';
$calls=[];$denyShipping=false;
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function taoworld_http_search_batch(array $queries):array{return array_map(fn($q)=>taoworld_http('/traffic/item/search',$q),$queries);}
function taoworld_http(string $path,array $params):array{
    global $calls,$denyShipping;$calls[]=$path;
    if($path==='/traffic/item/search'){
        $department=array_search($params['keyword'],tw_catalog_home_keywords(),true);check($department!==false,'Expected mixed catalog department');
        $rows=[];for($i=0;$i<20;$i++){$id=(string)(820000000000+$department*100+$i);$rows[]=['item_id'=>$id,'mi_id'=>'mi-'.$id,'title'=>'Storage box','price'=>'10.00','main_image_url'=>'https://img.alicdn.com/test.jpg'];}
        return ['code'=>'0','data'=>['data'=>$rows]];
    }
    if($path==='/traffic/item/batchGetSourceItemLogisticPrice'){
        if($denyShipping)throw new ApiError('API_CAN_NOT_USE',502);
        $ids=json_decode($params['mi_id_list'],true);check(count($ids)<=10,'Shipping batches stay bounded');
        $rows=[];foreach($ids as $mi){$id=substr($mi,3);$rows[]=['item_resource'=>'taobao','item_id'=>$id,'success'=>true,'currency'=>'CNY','post_fee'=>(int)$id%2===0?0:1000];}
        return ['code'=>'0','data'=>array_reverse($rows)];
    }
    throw new RuntimeException('Discovery must not request detail, render or purchase: '.$path);
}
taoworld_store(taoworld_token_state(['access_token'=>'fixture','refresh_token'=>'fixture-refresh','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'fixture-buyer']));
$s=array_replace(shipping_settings(),['catalog_provider'=>'taoworld','supplier_enabled'=>true,'api_daily_limit'=>1000]);db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',tw_json($s)]);
$r=discovery_free_shipping();check($r['status']==='available'&&count($r['products'])>0,'Real feed should yield verified free-shipping cards');
foreach($r['products'] as $p)check((int)substr($p['id'],3)%2===0&&$p['domestic_shipping_reference_fen']===0,'Paid cards must be excluded');
check(count(array_filter($calls,fn($p)=>$p==='/traffic/item/search'))===6,'Mixed feed uses six departments');
check(count(array_filter($calls,fn($p)=>$p==='/traffic/item/batchGetSourceItemLogisticPrice'))===2,'At most twenty candidates are quoted');
check($r['scope']==='china_to_erenhot'&&$r['indicative']===true,'Keep domestic-only scope');
$before=count($calls);check(array_column(discovery_free_shipping()['products'],'id')===array_column($r['products'],'id'),'Warm discovery must preserve cards');check(count($calls)===$before,'Warm discovery must not call provider');
foreach(glob(tw_catalog_dir().'/discovery-free-*.json') as $f){$c=supplier_snapshot_read($f);$c['time']=time()-601;supplier_snapshot_write($f,$c);}
$denyShipping=true;$r=discovery_free_shipping();check($r['status']==='unavailable'&&$r['products']===[],'Permission failure must never reuse expired free-shipping claims');
echo "PASS discovery feed: real mixed items, no fake detail, zero-only shipping, cache and unavailable provider.\n";
