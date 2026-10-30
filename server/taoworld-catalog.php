<?php
declare(strict_types=1);
require_once __DIR__.'/taoworld-auth.php';
if(!function_exists('taoworld_http'))require_once __DIR__.'/taoworld-http.php';
const TW_CATALOG_SEARCH_TTL = 1800;
const TW_CATALOG_SEARCH_MAX_AGE = 3600;
function tw_catalog_require_ready(): void {
    if(!shipping_settings()['supplier_enabled']||empty(taoworld_state()['access_token']))fail('Нийлүүлэгчийн каталог түр идэвхгүй байна. Дараа дахин оролдоно уу.',503);
}

function tw_catalog_dir(): string {
    $dir=taoworld_dir().'/catalog-'.substr(hash('sha256',taoworld_binding().':'.(taoworld_state()['account_id']??'')),0,16);
    if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))fail('Каталог хадгалах боломжгүй.',503);
    return $dir;
}
function tw_catalog_call(string $path,array $params,bool $purchase=false): array {
    supplier_limits(false,$purchase);
    $r=taoworld_http($path,$params+['access_token'=>taoworld_access_token()]);
    return tw_catalog_data($r);
}
function tw_catalog_data(array $r): array {
    if(!in_array($r['biz_error_code']??null,[null,'','null'],true)||!is_array($r['data']??null))fail('TaoWorld барааны мэдээлэл авах боломжгүй. Дахин оролдоно уу.',502);
    return $r['data'];
}
function tw_catalog_fresh(?array $c,int $ttl): bool {return is_array($c)&&is_array($c['data']??null)&&is_int($c['time']??null)&&$c['time']<=time()&&$c['time']>time()-$ttl;}
// A separate cache prevents any OT payload from being reused as native product data.
// Checkout never accepts stale data. Concurrent requests share one provider lookup.
function tw_catalog_cached(string $path,array $params,bool $purchase=false,?array $keyParams=null,bool $display=false): array {
    $keyParams??=$params;
    $file=tw_catalog_dir().'/'.supplier_cache_key($path,$keyParams).'.json';$ttl=$purchase?SUPPLIER_PURCHASE_MAX_AGE:($path==='/traffic/item/get'?300:TW_CATALOG_SEARCH_TTL);
    if($display&&!$purchase&&$path==='/traffic/item/search')$ttl=TW_CATALOG_SEARCH_MAX_AGE;
    // Atomic rename makes complete fresh snapshots safe to read while a writer holds the lock.
    $c=supplier_snapshot_read($file);if(tw_catalog_fresh($c,$ttl))return $c;
    $h=supplier_acquire_lock([$file.'.lock'],microtime(true)+2);
    if(!$h)throw new SupplierBusy();
    try{
        $c=supplier_snapshot_read($file);if(tw_catalog_fresh($c,$ttl))return $c;
        $data=tw_catalog_call($path,$params,$purchase);$c=['time'=>time(),'data'=>$data];supplier_snapshot_write($file,$c);return $c;
    }finally{flock($h,LOCK_UN);fclose($h);}
}
// First page is fetched separately to stop empty/short searches without spending extra quota.
// Remaining page locks are acquired in numeric order and all released on any failure.
function tw_catalog_search_pages(array $params,int $first,int $last,bool $display=false): array {
    $pages=[];$pending=[];$locks=[];$deadline=microtime(true)+2;
    $ttl=$display?TW_CATALOG_SEARCH_MAX_AGE:TW_CATALOG_SEARCH_TTL;
    try{
        for($n=$first;$n<=$last;$n++){
            $query=$params+['page_no'=>(string)$n,'page_size'=>'20'];$file=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',$query).'.json';
            $c=supplier_snapshot_read($file);
            if(!tw_catalog_fresh($c,$ttl)){
                $h=supplier_acquire_lock([$file.'.lock'],$deadline);if(!$h)throw new SupplierBusy();$locks[]=$h;
                $c=supplier_snapshot_read($file);
                if(!tw_catalog_fresh($c,$ttl)){$pending[$n]=['query'=>$query,'file'=>$file];continue;}
            }
            $pages[$n]=$c;if(count($c['data']['data']??[])<20)break;
        }
        if($pending){
            $token=taoworld_access_token();$db=db();$db->exec('SAVEPOINT tw_catalog_batch_budget');
            try{foreach($pending as $_)supplier_limits(false);$db->exec('RELEASE SAVEPOINT tw_catalog_batch_budget');}
            catch(Throwable $e){$db->exec('ROLLBACK TO SAVEPOINT tw_catalog_batch_budget');$db->exec('RELEASE SAVEPOINT tw_catalog_batch_budget');throw $e;}
            $queries=array_map(fn($v)=>$v['query']+['access_token'=>$token],array_values($pending));$responses=taoworld_http_search_batch($queries);$failure=null;
            foreach(array_keys($pending) as $i=>$n){
                try{
                    $r=$responses[$i]??null;if($r instanceof ApiError)throw $r;if(!is_array($r))fail('TaoWorld хайлтын хариу дутуу.',502);
                    $data=tw_catalog_data($r);if(!is_array($data['data']??null))fail('TaoWorld хайлтын хариу дутуу.',502);
                    $pages[$n]=['time'=>time(),'data'=>$data];supplier_snapshot_write($pending[$n]['file'],$pages[$n]);
                }catch(ApiError $e){$failure??=$e;}
            }
            if($failure)throw $failure;
        }
        ksort($pages,SORT_NUMERIC);return $pages;
    }finally{foreach($locks as $h){flock($h,LOCK_UN);fclose($h);}}
}
// Search rows carry the shop rating, ship-from region and fast-dispatch flag; details do not.
// The item mapping keeps them so the product page can show them. Unchanged mappings are not rewritten.
function tw_catalog_seller_info(array $p): array {
    $info=[];
    if(is_numeric($p['shopDsr']??null)&&(float)$p['shopDsr']>0&&(float)$p['shopDsr']<=5)$info['shop_rating']=round((float)$p['shopDsr'],2);
    if(is_string($p['shippingOrigin']??null)&&$p['shippingOrigin']!=='')$info['ship_from']=mb_substr($p['shippingOrigin'],0,30);
    if(($p['deliveryTimes']??null)==='48shipping')$info['ships_48h']=true;
    return $info;
}
function tw_catalog_remember(array $p,?int $fetched=null): string {
    $id=(string)($p['item_id']??'');$mi=(string)($p['mi_id']??'');
    if(!preg_match('/^\d{5,20}$/D',$id)||$mi===''||strlen($mi)>500)fail('TaoWorld барааны таних мэдээлэл дутуу.',502);
    $file=tw_catalog_dir().'/item-'.$id.'.json';$old=supplier_snapshot_read($file)??[];$fetched??=time();
    $next=$old;$seller=tw_catalog_seller_info($p);
    if(($old['time']??0)<$fetched||(($old['time']??0)===$fetched&&($old['mi_id']??'')!==$mi))$next=['mi_id'=>$mi,'time'=>$fetched]+$seller+array_intersect_key($old,['shop_rating'=>1,'ship_from'=>1,'ships_48h'=>1]);
    elseif($seller)$next=$seller+$old;
    if($seller&&!isset($seller['ships_48h']))unset($next['ships_48h']);
    ksort($next);ksort($old);if($next!==$old)supplier_snapshot_write($file,$next);return 'tb-'.$id;
}
// Mongolian names for the province at the start of TaoWorld's Chinese ship-from text.
function tw_catalog_ship_from(string $origin): string {
    if($origin==='')return '';if(str_contains($origin,'多仓'))return 'Хятад, олон агуулахаас';
    $provinces=['内蒙古'=>'Өвөр Монгол','黑龙江'=>'Хэйлунцзян','北京'=>'Бээжин','天津'=>'Тяньжин','上海'=>'Шанхай','重庆'=>'Чунцин','河北'=>'Хэбэй','山西'=>'Шаньси','辽宁'=>'Ляонин','吉林'=>'Гирин','江苏'=>'Жянсу','浙江'=>'Жэжян','安徽'=>'Аньхуй','福建'=>'Фүжянь','江西'=>'Жянси','山东'=>'Шаньдун','河南'=>'Хэнань','湖北'=>'Хубэй','湖南'=>'Хунань','广东'=>'Гуандун','广西'=>'Гуанси','海南'=>'Хайнань','四川'=>'Сычуань','贵州'=>'Гуйжоу','云南'=>'Юньнань','西藏'=>'Төвд','陕西'=>'Шэньси','甘肃'=>'Ганьсу','青海'=>'Хөх нуур','宁夏'=>'Нинся','新疆'=>'Шинжаан','香港'=>'Хонконг','澳门'=>'Макао','台湾'=>'Тайвань'];
    foreach($provinces as $zh=>$mn)if(str_starts_with($origin,$zh))return 'Хятад, '.$mn;
    return '';
}
function tw_catalog_resource(string $id): array {
    $identity=supplier_identity($id);
    if($identity['provider']!=='taobao')fail('Энэ барааг TaoWorld хайлтаас дахин сонгоно уу.',409);
    $r=supplier_snapshot_read(tw_catalog_dir().'/item-'.$identity['number'].'.json');
    if(!$r||($r['time']??0)<time()-89*86400||empty($r['mi_id']))fail('Барааны холбоосын хугацаа дууссан. TaoWorld хайлтаас дахин сонгоно уу.',409);
    return ['mi_id'=>$r['mi_id']];
}
function tw_catalog_price(array $p,bool $detail): ?float {
    // Coupons can be conditional; do not promise them as the checkout price.
    $v=$detail?($p['promotion_price']??$p['price']??null):($p['price']??null);
    if(!is_numeric($v)||!is_finite((float)$v)||(float)$v<=0)return null;
    return round((float)$v/($detail?100:1),2);
}
function tw_catalog_product(array $p,bool $detail=false,?int $fetched=null): array {
    product_policy_assert(['id'=>'tb-'.($p['item_id']??''),'name'=>$p['title']??'','original_name'=>$p['multi_language_info']['title']??'','description'=>$p['description']??'','category_path'=>$p['category_path']??'','variants'=>$p['sku_list']??[]]);
    $id=tw_catalog_remember($p,$fetched);$price=tw_catalog_price($p,$detail);$rate=shipping_settings()['cny_rate'];
    $title=$p['multi_language_info']['title']??$p['title']??$id;
    $image=supplier_image((string)($p['main_image_url']??$p['pic_urls'][0]??''));
    $r=['id'=>$id,'provider'=>'taobao','catalog_provider'=>'taoworld','provider_label'=>'Taobao','name'=>supplier_text($title,300),'original_name'=>supplier_text($p['title']??'',500),'image'=>$image,'url'=>'/v/'.$id,'min_qty'=>1,'step'=>1,'sellable'=>true,'variants'=>[],'sold_count'=>null,'sales_30_days'=>null,'cny'=>null,'mnt'=>null,'approx_cny'=>$price,'approx_mnt'=>$price===null?null:(int)ceil($price*$rate),'price_status'=>'unverified','card_discount'=>null];
    $r['shop_rating']=tw_catalog_seller_info($p)['shop_rating']??null;
    if(!$detail)return $r;
    $meta=supplier_snapshot_read(tw_catalog_dir().'/item-'.substr($id,3).'.json')??[];
    $r['shop_rating']=is_numeric($meta['shop_rating']??null)?(float)$meta['shop_rating']:null;$r['ship_from']=tw_catalog_ship_from((string)($meta['ship_from']??''));$r['ships_48h']=!empty($meta['ships_48h']);
    $translated=[];foreach($p['multi_language_info']['sku_properties']??[] as $v)$translated[(string)($v['sku_id']??'')]=$v['properties']??[];
    foreach($p['sku_list']??[] as $v){
        $sku=(string)($v['sku_id']??'');if(!preg_match('/^\d{1,30}$/D',$sku))continue;
        $labels=[];foreach($translated[$sku]??$v['properties']??[] as $a)$labels[]=supplier_text(($a['prop_name']??'').': '.($a['value_name']??$a['value_desc']??''),300);
        $stock=supplier_count($v['quantity']??null);
        $r['variants'][]=['id'=>$sku,'label'=>implode(' / ',$labels)?:'Стандарт','image'=>supplier_image((string)($v['pic_url']??'')),'cny'=>$stock===null?null:tw_catalog_price($v,true),'stock'=>$stock];
    }
    $prices=[];foreach($r['variants'] as $v)if(($v['stock']??0)>0&&$v['cny']!==null)$prices[]=$v['cny'];
    $r['cny']=$prices?min($prices):null;$r['mnt']=$r['cny']===null?null:(int)ceil($r['cny']*$rate);$r['sellable']=(bool)$prices;$r['price_status']=$prices?'available':'unavailable';
    $r['images']=array_values(array_unique(array_filter(array_map('supplier_image',$p['pic_urls']??[$image]))));
    $r['vendor_name']=supplier_text($p['shop_name']??'',200);$r['vendor_id']=(string)($p['shop_id']??'');
    $r['attributes']=[];foreach($p['multi_language_info']['properties']??$p['properties']??[] as $a)$r['attributes'][]=['name'=>supplier_text($a['prop_name']??'',120),'value'=>supplier_text($a['value_name']??'',300)];
    $r+=['stock'=>null,'brand'=>'','category_id'=>(string)($p['category_id']??''),'category_path'=>[],'condition'=>'','location'=>[],'weight_kg'=>null,'weight_type'=>'','videos'=>[],'tiers'=>[],'related'=>[],'unavailable_reason'=>'','description'=>supplier_text($p['description']??'',30000),'description_images'=>supplier_description_images($p['description']??'')];
    return $r;
}
function tw_catalog_response(array $data,int $time,int $ttl): array {return $data+['fetched'=>gmdate('c',$time),'stale'=>false,'cache_expires'=>$time+$ttl,'cache_ttl'=>max(0,$time+$ttl-time()),'shipping'=>shipping_public()];}
function tw_catalog_detail(string $id,bool $purchase=false,string $brand=''): array {
    tw_catalog_require_ready();
    if($brand!=='')supplier_brand($brand);
    product_policy_assert(['id'=>$id]);$resource=tw_catalog_resource($id);
    $c=tw_catalog_cached('/traffic/item/get',$resource+['item_resource'=>'taobao','language'=>'en'],$purchase,['id'=>$id,'language'=>'en']);
    if('tb-'.($c['data']['item_id']??'')!==$id)fail('Барааны дугаар зөрлөө.',502);
    $p=tw_catalog_product($c['data'],true,$c['time']);$p['price_expires']=$c['time']+($purchase?120:300);
    return tw_catalog_response(['product'=>$p],$c['time'],$purchase?120:300);
}
function tw_catalog_cards(array $rows,?int $fetched=null): array {
    $cards=[];foreach($rows as $p){if(!is_array($p))continue;try{$cards[]=tw_catalog_product($p,false,$fetched);}catch(ApiError){}}
    return $cards;
}
function tw_catalog_departments(): array {
    return ['home storage'=>'收纳盒','electronics'=>'数码配件','bag'=>'包','men shoes'=>'男鞋','jewelry accessories'=>'饰品','beauty'=>'美妆','lamp'=>'灯具','men clothing'=>'男装','women clothing'=>'女装','kids clothing'=>'童装','women shoes'=>'女鞋','kitchen utensils'=>'厨房用品','home appliances'=>'家电','furniture'=>'家具','home decoration'=>'家居装饰','baby products'=>'母婴用品','toys'=>'玩具','sports equipment'=>'运动用品','camping equipment'=>'露营装备','car accessories'=>'汽车用品','tools'=>'工具','garden supplies'=>'园艺用品','pet supplies'=>'宠物用品','office supplies'=>'办公用品','personal care'=>'个人护理'];
}
// «Танд санал болгох» under a product: first pages of every department, interleaved so no single
// category dominates and the product's own category gets no preference. Only display-fresh cached
// pages are read; when fewer than 12 products are cached, one uncached department (chosen by the
// product ID) is fetched, which also warms it for later visitors. Failures leave the list shorter.
function tw_catalog_recommend(string $id,int $limit=24): array {
    if(!preg_match('/^tb-\d{5,20}$/D',$id))fail('Барааны дугаар буруу.');
    tw_catalog_require_ready();product_policy_assert(['id'=>$id]);
    $keywords=array_values(array_unique(tw_catalog_departments()));$count=count($keywords);
    $start=hexdec(substr(hash('sha256',$id),0,6))%$count;$query=fn(string $k)=>['keyword'=>$k,'language'=>'en','page_no'=>'1','page_size'=>'20'];
    $lists=[];$missing=[];$time=time();
    for($i=0;$i<$count;$i++){
        $k=$keywords[($start+$i)%$count];$c=supplier_snapshot_read(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/search',$query($k)).'.json');
        if(tw_catalog_fresh($c,TW_CATALOG_SEARCH_MAX_AGE)&&is_array($c['data']['data']??null)){$lists[]=$c['data']['data'];$time=min($time,$c['time']);}else $missing[]=$k;
    }
    if($missing&&array_sum(array_map('count',$lists))<12){
        try{$c=tw_catalog_cached('/traffic/item/search',$query($missing[0]),false,null,true);if(is_array($c['data']['data']??null)){$lists[]=$c['data']['data'];$time=min($time,$c['time']);}}
        catch(ApiError){}
    }
    $rows=[];$seen=[substr($id,3)=>true];
    for($j=0;count($rows)<$limit*2&&$lists;$j++){
        $active=false;
        foreach($lists as $list){if(!isset($list[$j]))continue;$active=true;$item=(string)($list[$j]['item_id']??'');if($item===''||isset($seen[$item]))continue;$seen[$item]=true;$rows[]=$list[$j];}
        if(!$active)break;
    }
    // Blocked listings are dropped while building cards, so a few spare rows are taken above.
    return tw_catalog_response(['products'=>array_slice(tw_catalog_cards($rows,$time),0,$limit)],$time,TW_CATALOG_SEARCH_TTL);
}
function tw_catalog_search(array $b,bool $display=false): array {
    tw_catalog_require_ready();
    $limit=supplier_page_size($b);$page=int_field($b,'page',1,100);$q=str_field($b,'q',100,false)?:'home storage';
    $refresh=isset($b['refresh'])?int_field($b,'refresh',0,1):0;
    $preview=isset($b['preview'])?int_field($b,'preview',0,1):0;
    $display=$display&&!$refresh;
    $partial=$preview&&$page===1&&$limit===50;
    if(($b['brand']??'')!=='')$q=supplier_brand(str_field($b,'brand',30))['name'];
    if($q==='__all__')$q='home storage';
    $sort=str_field($b,'sort',20,false)?:'default';$sorts=['default'=>'','price'=>'PRICE_ASC','-price'=>'PRICE_DESC','-volume'=>'SALE_QTY_DESC','-updated_time'=>''];
    if(!isset($sorts[$sort]))fail('Эрэмбэ буруу.');
    $range=supplier_price_range($b);$filters=[];$rate=shipping_settings()['cny_rate'];
    foreach(['price_min'=>'min_price','price_max'=>'max_price'] as $k=>$v)if(isset($range[$k]))$filters[]=$v.':'.(int)round($range[$k]*100/$rate);
    if(product_policy_text_blocked($q))return tw_catalog_response(['products'=>[],'page'=>$page,'total'=>0,'pages'=>$page,'more'=>false],time(),0);
    $departments=tw_catalog_departments();
    $params=['keyword'=>$departments[mb_strtolower($q)]??$q,'language'=>'en'];if($sorts[$sort]!=='')$params['sort']=$sorts[$sort];if($filters)$params['filters']=json_encode($filters,JSON_THROW_ON_ERROR);
    // Native pages contain at most 20 items. Keep the storefront's 12/50-item contract.
    $start=($page-1)*$limit;$first=(int)floor($start/20)+1;$last=(int)floor(($start+$limit-1)/20)+1;$rows=[];$time=time();
    if($partial)$last=$first;
    $c=tw_catalog_cached('/traffic/item/search',$params+['page_no'=>(string)$first,'page_size'=>'20'],false,null,$display);$time=min($time,$c['time']);$rows=$c['data']['data']??null;if(!is_array($rows))fail('TaoWorld хайлтын хариу дутуу.',502);
    $partial=$partial&&count($rows)===20;
    if(count($rows)===20&&$first<$last)foreach(tw_catalog_search_pages($params,$first+1,$last,$display) as $c){$time=min($time,$c['time']);$part=$c['data']['data']??null;if(!is_array($part))fail('TaoWorld хайлтын хариу дутуу.',502);$rows=array_merge($rows,$part);if(count($part)<20)break;}
    $rows=array_slice($rows,$start%20,$limit);$more=count($rows)===$limit&&$page<100;
    $stale=$time<=time()-TW_CATALOG_SEARCH_TTL;
    return tw_catalog_response(['products'=>tw_catalog_cards($rows,$time),'page'=>$page,'total'=>null,'pages'=>$page+($more?1:0),'more'=>$more,'partial'=>$partial,'stale'=>$stale,'revalidate'=>$stale],$time,TW_CATALOG_SEARCH_TTL);
}
function tw_catalog_image(string $hash,int $page,int $limit): array {
    tw_catalog_require_ready();
    $cache=tw_catalog_dir().'/image-'.$hash.'.json';$c=supplier_snapshot_read($cache);$h=null;
    try{
        if(!tw_catalog_fresh($c,600)){
            $h=supplier_acquire_lock([$cache.'.lock'],microtime(true)+2);if(!$h)throw new SupplierBusy();$c=supplier_snapshot_read($cache);
        }
        if(!tw_catalog_fresh($c,600)){
            // Upload re-encoded bytes, never an arbitrary URL or the user's original EXIF.
            $jpeg=file_get_contents(supplier_image_search_dir().'/'.$hash.'.jpg');
            if(strlen($jpeg)>3*1024*1024)fail('Хайлтын зураг 3 MB-аас бага байх ёстой.');
            $up=tw_catalog_call('/upload/image',['image_base64'=>base64_encode($jpeg)]);$image=(string)($up['image_id']??'');if(!preg_match('/^\d{1,40}$/D',$image))fail('TaoWorld зураг хүлээж авсангүй.',502);
            $rows=tw_catalog_call('/traffic/item/imgsearch',['image_id'=>$image,'language'=>'en']);$c=['time'=>time(),'data'=>tw_catalog_cards($rows)];supplier_snapshot_write($cache,$c);
        }
        $rows=$c['data'];$total=count($rows);return tw_catalog_response(['products'=>array_slice($rows,($page-1)*$limit,$limit),'page'=>$page,'total'=>$total,'pages'=>max(1,(int)ceil($total/$limit)),'more'=>$page*$limit<$total,'image'=>$hash],$c['time'],600);
    }finally{if($h){flock($h,LOCK_UN);fclose($h);}}
}
