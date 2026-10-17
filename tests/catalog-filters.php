<?php
declare(strict_types=1);
// Catalog price filter (MNT → CNY for OT), newest sort and result totals with synthetic cached data.
putenv('GOSTORE_DATA_DIR='.__DIR__.'/../tmp/catalog-filters-'.bin2hex(random_bytes(5)));
putenv('GOSTORE_DISABLE_SUPPLIER_NETWORK=1');
foreach(['bootstrap','shipping','supplier'] as $file)require __DIR__.'/../server/'.$file.'.php';
function expect_error(callable $call,int $status):void { try{$call();}catch(ApiError $e){if($e->getCode()===$status)return;throw $e;} throw new RuntimeException('Expected HTTP '.$status); }
function check(bool $ok,string $message):void { if(!$ok)throw new RuntimeException($message); }
check(supplier_price_range([])===[]&&supplier_price_range(['price_min'=>'','price_max'=>null])===[],'Empty bounds must be ignored');
check(supplier_price_range(['price_min'=>'10000','price_max'=>'50000'])===['price_min'=>10000,'price_max'=>50000],'Bounds not parsed');
foreach([['price_min'=>'-1'],['price_max'=>'1e5'],['price_min'=>'abc'],['price_min'=>'60000','price_max'=>'50000']] as $bad)expect_error(fn()=>supplier_price_range($bad),400);
expect_error(fn()=>supplier_search(['q'=>'bag','sort'=>'newest']),400);
$dir=config()['data_dir'].'/supplier-cache';mkdir($dir,0700,true);
$item=fn(string $id,float $cny)=>['Id'=>$id,'ProviderType'=>'Taobao','Title'=>'Бараа '.$id,'MainPictureUrl'=>'https://img.alicdn.com/'.$id.'.jpg','IsSellAllowed'=>true,'Price'=>['OriginalPrice'=>$cny,'OriginalCurrencyCode'=>'CNY']];
// At the default 550₮ rate, 10,000–50,000₮ is sent to OT as 18.18–90.91¥ with the newest-first sort.
$query=['language'=>'mn','item_title'=>'bag','page'=>1,'limit'=>12,'sort'=>'-updated_time','price_min'=>'18.18','price_max'=>'90.91'];
$data=['Items'=>['Items'=>['Content'=>array_map(fn($i)=>$item((string)(100000+$i),20+$i),range(1,12)),'TotalCount'=>250],'MaximumPageCount'=>50]];
file_put_contents($dir.'/'.supplier_cache_key('/v1/taobao/search',$query).'.json',json_encode(['data'=>$data,'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false]));
$r=supplier_search(['q'=>'bag','page'=>1,'sort'=>'-updated_time','price_min'=>'10000','price_max'=>'50000']);
check(count($r['products'])===12&&$r['total']===250&&$r['pages']===21&&$r['more']===true,'Filtered search totals changed');
// Search rows have no SKU stock: the listed price is exposed only as an approximate "from" price.
check($r['products'][0]['price_status']==='unverified'&&$r['products'][0]['mnt']===null&&$r['products'][0]['approx_mnt']===(int)ceil(21*550),'Approximate card price missing');
$data['Items']['Items']['TotalCount']=5000;file_put_contents($dir.'/'.supplier_cache_key('/v1/taobao/search',$query).'.json',json_encode(['data'=>$data,'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false]));
check(supplier_search(['q'=>'bag','page'=>1,'sort'=>'-updated_time','price_min'=>'10000','price_max'=>'50000'])['pages']===50,'Pages must respect the provider maximum');
// Default view: relevant results are shown cheapest first, unknown prices last, ties keep relevance order.
$mixed=['Items'=>['Items'=>['Content'=>[$item('200001',30),$item('200002',10),['Id'=>'200003','ProviderType'=>'Taobao','Title'=>'Үнэгүй','IsSellAllowed'=>true],$item('200004',20),$item('200005',10)],'TotalCount'=>5],'MaximumPageCount'=>1]];
file_put_contents($dir.'/'.supplier_cache_key('/v1/taobao/search',['language'=>'mn','item_title'=>'shoes','page'=>1,'limit'=>12,'sort'=>'default']).'.json',json_encode(['data'=>$mixed,'fetched'=>gmdate('c'),'expires'=>time()+3600,'stale'=>false]));
check(array_column(supplier_search(['q'=>'shoes','page'=>1])['products'],'id')===['tb-200002','tb-200005','tb-200004','tb-200001','tb-200003'],'Default order must be cheapest first');
check(supplier_price_order([['id'=>'a','price_status'=>'available','mnt'=>9000],['id'=>'b','price_status'=>'unverified','approx_mnt'=>5000]])[0]['id']==='b','Approximate prices take part in ordering');
// Items the supplier will not sell still show their listed price, but sort after orderable ones.
$blocked=$item('300001',5);$blocked['IsSellAllowed']=false;$blocked['SellDisallowReason']='IsAuction';
$n=supplier_card_price(supplier_normalize($blocked,false,'taobao'),time()+3600);
check($n['price_status']==='unavailable'&&$n['approx_mnt']===(int)ceil(5*550),'Unavailable item keeps its listed price');
check(array_column(supplier_price_order([$n,['id'=>'x','price_status'=>'available','mnt'=>99000]]),'id')===['x','tb-300001'],'Unavailable items sort last');
// Title cleanup on real machine-translated names; Cyrillic letters must survive edge trimming.
foreach([
    ['[Өөртөө ажилладаг] Zwilling хутганы иж бүрдэл','Zwilling хутганы иж бүрдэл'],
    ['贝肽斯 Хүүхдийн зуны пижама','Хүүхдийн зуны пижама'],
    ['Labi Baby Baby Baby Boys Boys Boys Keysuit','Labi Baby Boys Keysuit'],
    ['Файл файл хадгалах хадгалах хайрцаг','Файл хадгалах хайрцаг'],
    ['Мини юбка, юбка, даашинз','Мини юбка, даашинз'],
    ['Үнэгүй хүргэлт JONSANTY хархын хоол','JONSANTY хархын хоол'],
    ["Коридорын шат, хүний \u{200B}\u{200B}мэдрэгч",'Коридорын шат, хүний мэдрэгч'],
    ['спорт гутал, пүүз','Спорт гутал, пүүз'],
    ['MARIUS шаргал даашинз·','MARIUS шаргал даашинз'],
    ['[Хувьцааны боловсруулалт дууссан] 8см болор чимэглэл','8см болор чимэглэл'],
    ['[Дээд ба доод хоолойн температурын бие даасан хяналт] Оу Нин зуух','Дээд ба доод хоолойн температурын бие даасан хяналт, Оу Нин зуух'],
    ['[Оролдох [Kyocka хутга','Оролдох Kyocka хутга'],
    ['Цаг (ус нэвтэрдэггүй) эрэгтэй','Цаг (ус нэвтэрдэггүй) эрэгтэй'],
] as [$in,$out]){$got=supplier_clean_title($in);check($got===$out,"Title cleanup: $in => $got");check(supplier_clean_title($got)===$got,'Cleanup must be idempotent');}
check(supplier_clean_title('【】')==='【】','Never returns an empty title');
echo "PASS: catalog price bounds validation, MNT→CNY conversion for OT, newest sort, result total and page count.\n";
