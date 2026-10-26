<?php
declare(strict_types=1);
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/supplier-batches-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
foreach(['bootstrap','shipping','supplier'] as $file)require __DIR__.'/../server/'.$file.'.php';
function check(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
function cache_batch(string $path,array $query,array $data):void {
    $dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))mkdir($dir,0700,true);
    file_put_contents($dir.'/'.supplier_cache_key($path,$query).'.json',json_encode(['data'=>$data,'expires'=>time()+3600,'fetched'=>gmdate('c'),'stale'=>false]));
}
function rows(int $start,int $count):array {return array_map(fn($i)=>['Id'=>(string)(900000000+$i),'ProviderType'=>'Taobao','Title'=>'Product '.$i,'IsSellAllowed'=>true,'Price'=>['OriginalPrice'=>20,'OriginalCurrencyCode'=>'CNY']],range($start,$start+$count-1));}
foreach([0,13,51,100,'x',1.5] as $bad){try{supplier_page_size(['limit'=>$bad]);throw new RuntimeException('Invalid limit accepted');}catch(ApiError $e){check($e->getCode()===400,'Invalid size status');}}
check(supplier_page_size([])===12&&supplier_page_size(['limit'=>'50'])===50,'Legacy default and explicit 50');
foreach([1,2,3] as $page){$count=$page===3?1:50;$query=['language'=>'mn','item_title'=>'batch-test','page'=>$page,'limit'=>50,'sort'=>'default'];cache_batch('/v1/taobao/search',$query,['Items'=>['Items'=>['Content'=>rows(($page-1)*50,$count),'TotalCount'=>101],'MaximumPageCount'=>3]]);$r=supplier_search(['q'=>'batch-test','page'=>$page,'limit'=>50]);check(count($r['products'])===$count&&$r['more']===($page<3)&&$r['pages']===3,'REST batch boundary '.$page);check($r['products'][0]['id']==='tb-'.(900000000+($page-1)*50),'No offset gaps');}
$brand=supplier_brand('nike');$q=supplier_brand_query($brand,2,'default',[],50);check($q['framePosition']===50&&$q['frameSize']===50,'Native frame offset');
$items=rows(50,50);foreach($items as &$p)$p['VendorId']=$brand['vendor'];unset($p);
$items[0]['VendorId']='wrong-shop';
cache_batch('/service-json/BatchSearchItemsFrame',$q,['Vendor'=>['Id'=>$brand['vendor'],'ProviderType'=>'Taobao','FeaturedValues'=>[['Name'=>'userId','Value'=>$brand['seller']]]],'Items'=>['Items'=>['Content'=>$items,'TotalCount'=>151],'MaximumPageCount'=>4]]);
$r=supplier_brand_search(['brand'=>'nike','page'=>2,'limit'=>50]);check(count($r['products'])===49&&$r['total']===null&&$r['more'],'Unsafe seller excluded without stopping next batch');
$records=[];$i=0;foreach(supplier_warm_queries() as $query){$items=[];foreach(rows($i,12) as $p)$items[]=supplier_card_price(supplier_normalize($p,false,'taobao'),time()+3600);$i+=12;$records[$query]=['products'=>$items,'fetched'=>gmdate('c'),'cache_expires'=>time()+3600,'more'=>true];}
supplier_snapshot_write(supplier_snapshot_dir().'/current.json',['version'=>1,'product_policy'=>PRODUCT_POLICY_VERSION,'generated_at'=>time(),'next_refresh_at'=>time()+3600,'records'=>$records]);
$a=supplier_search(['q'=>'__all__','page'=>1,'limit'=>50]);$b=supplier_search(['q'=>'__all__','page'=>2,'limit'=>50]);check(count($a['products'])===50&&count($b['products'])===50,'Home uses 50 cached cards');check(!array_intersect(array_column($a['products'],'id'),array_column($b['products'],'id')),'Home batches do not overlap');
$last=supplier_search(['q'=>'__all__','page'=>$a['pages'],'limit'=>50]);check(!$last['more']&&count($last['products'])===$a['total']-50*($a['pages']-1),'Last home batch stops');
$settings=shipping_settings();$settings['image_search_enabled']=true;db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['shipping_settings',json_encode($settings)]);
$hash=str_repeat('a',32);file_put_contents(supplier_image_search_dir().'/'.$hash.'.jpg','synthetic');
$query=['language'=>'mn','image_url'=>rtrim(config()['site_url'],'/').'/assets/uploads/search/'.$hash.'.jpg','page'=>1,'limit'=>50];
cache_batch('/v1/taobao/search',$query,['Items'=>['Items'=>['Content'=>rows(0,50),'TotalCount'=>51],'MaximumPageCount'=>2]]);
$r=supplier_image_search($hash,1,false,50);check(count($r['products'])===50&&$r['more'],'Image search uses the requested batch size');
echo "PASS batches: bounded sizes, legacy API default, REST 50/50/1, native offsets, seller exclusion and cached home batches without overlap.\n";
