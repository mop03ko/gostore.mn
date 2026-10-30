<?php
declare(strict_types=1);
require_once __DIR__.'/taoworld-auth.php';
if(!function_exists('taoworld_http'))require_once __DIR__.'/taoworld-http.php';

function tw_catalog_dir(): string {
    $dir=taoworld_dir().'/catalog-'.substr(hash('sha256',taoworld_binding().':'.(taoworld_state()['account_id']??'')),0,16);
    if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))fail('Каталог хадгалах боломжгүй.',503);
    return $dir;
}
function tw_catalog_call(string $path,array $params,bool $purchase=false): array {
    supplier_budget_take(false,$purchase);
    $r=taoworld_http($path,$params+['access_token'=>taoworld_access_token()]);
    if(!in_array($r['biz_error_code']??null,[null,'','null'],true)||!is_array($r['data']??null))fail('TaoWorld барааны мэдээлэл авах боломжгүй. Дахин оролдоно уу.',502);
    return $r['data'];
}
// A separate cache prevents any OT payload from being reused as native product data.
// Checkout never accepts stale data. Concurrent requests share one provider lookup.
function tw_catalog_cached(string $path,array $params,bool $purchase=false,?array $keyParams=null): array {
    $keyParams??=$params;
    $file=tw_catalog_dir().'/'.supplier_cache_key($path,$keyParams).'.json';$h=supplier_acquire_lock([$file.'.lock'],microtime(true)+2);
    if(!$h)throw new SupplierBusy();
    try{
        $c=supplier_snapshot_read($file);$ttl=$purchase?SUPPLIER_PURCHASE_MAX_AGE:($path==='/traffic/item/get'?300:600);
        if(is_array($c)&&($c['time']??0)>time()-$ttl)return $c;
        $data=tw_catalog_call($path,$params,$purchase);$c=['time'=>time(),'data'=>$data];supplier_snapshot_write($file,$c);return $c;
    }finally{flock($h,LOCK_UN);fclose($h);}
}
function tw_catalog_remember(array $p,?int $fetched=null): string {
    $id=(string)($p['item_id']??'');$mi=(string)($p['mi_id']??'');
    if(!preg_match('/^\d{5,20}$/D',$id)||$mi===''||strlen($mi)>500)fail('TaoWorld барааны таних мэдээлэл дутуу.',502);
    $file=tw_catalog_dir().'/item-'.$id.'.json';$old=supplier_snapshot_read($file);$fetched??=time();
    if(($old['time']??0)<=$fetched)supplier_snapshot_write($file,['mi_id'=>$mi,'time'=>$fetched]);return 'tb-'.$id;
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
    if(!$detail)return $r;
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
function tw_catalog_search(array $b): array {
    $limit=supplier_page_size($b);$page=int_field($b,'page',1,100);$q=str_field($b,'q',100,false)?:'home storage';
    if(($b['brand']??'')!=='')$q=supplier_brand(str_field($b,'brand',30))['name'];
    if($q==='__all__')$q='home storage';
    $sort=str_field($b,'sort',20,false)?:'default';$sorts=['default'=>'','price'=>'PRICE_ASC','-price'=>'PRICE_DESC','-volume'=>'SALE_QTY_DESC','-updated_time'=>''];
    if(!isset($sorts[$sort]))fail('Эрэмбэ буруу.');
    $range=supplier_price_range($b);$filters=[];$rate=shipping_settings()['cny_rate'];
    foreach(['price_min'=>'min_price','price_max'=>'max_price'] as $k=>$v)if(isset($range[$k]))$filters[]=$v.':'.(int)round($range[$k]*100/$rate);
    if(product_policy_text_blocked($q))return tw_catalog_response(['products'=>[],'page'=>$page,'total'=>0,'pages'=>$page,'more'=>false],time(),0);
    $departments=['home storage'=>'收纳盒','electronics'=>'数码配件','bag'=>'包','men shoes'=>'男鞋','jewelry accessories'=>'饰品','beauty'=>'美妆','lamp'=>'灯具','men clothing'=>'男装','women clothing'=>'女装','kids clothing'=>'童装','women shoes'=>'女鞋','kitchen utensils'=>'厨房用品','home appliances'=>'家电','furniture'=>'家具','home decoration'=>'家居装饰','baby products'=>'母婴用品','toys'=>'玩具','sports equipment'=>'运动用品','camping equipment'=>'露营装备','car accessories'=>'汽车用品','tools'=>'工具','garden supplies'=>'园艺用品','pet supplies'=>'宠物用品','office supplies'=>'办公用品','personal care'=>'个人护理'];
    $params=['keyword'=>$departments[mb_strtolower($q)]??$q,'language'=>'en'];if($sorts[$sort]!=='')$params['sort']=$sorts[$sort];if($filters)$params['filters']=json_encode($filters,JSON_THROW_ON_ERROR);
    // Native pages contain at most 20 items. Keep the storefront's 12/50-item contract.
    $start=($page-1)*$limit;$first=(int)floor($start/20)+1;$last=(int)floor(($start+$limit-1)/20)+1;$rows=[];$time=time();
    for($n=$first;$n<=$last;$n++){$c=tw_catalog_cached('/traffic/item/search',$params+['page_no'=>(string)$n,'page_size'=>'20']);$time=min($time,$c['time']);$part=$c['data']['data']??null;if(!is_array($part))fail('TaoWorld хайлтын хариу дутуу.',502);$rows=array_merge($rows,$part);if(count($part)<20)break;}
    $rows=array_slice($rows,$start%20,$limit);$more=count($rows)===$limit&&$page<100;
    return tw_catalog_response(['products'=>tw_catalog_cards($rows,$time),'page'=>$page,'total'=>null,'pages'=>$page+($more?1:0),'more'=>$more],$time,600);
}
function tw_catalog_image(string $hash,int $page,int $limit): array {
    // Upload re-encoded bytes, never an arbitrary URL or the user's original EXIF.
    $file=supplier_image_search_dir().'/'.$hash.'.jpg';$jpeg=file_get_contents($file);
    if(strlen($jpeg)>3*1024*1024)fail('Хайлтын зураг 3 MB-аас бага байх ёстой.');
    $cache=tw_catalog_dir().'/image-'.$hash.'.json';$h=supplier_acquire_lock([$cache.'.lock'],microtime(true)+2);if(!$h)throw new SupplierBusy();
    try{
        $c=supplier_snapshot_read($cache);
        if(!$c||($c['time']??0)<time()-600){
            $up=tw_catalog_call('/upload/image',['image_base64'=>base64_encode($jpeg)]);$image=(string)($up['image_id']??'');if(!preg_match('/^\d{1,40}$/D',$image))fail('TaoWorld зураг хүлээж авсангүй.',502);
            $rows=tw_catalog_call('/traffic/item/imgsearch',['image_id'=>$image,'language'=>'en']);$c=['time'=>time(),'data'=>tw_catalog_cards($rows)];supplier_snapshot_write($cache,$c);
        }
        $rows=$c['data'];$total=count($rows);return tw_catalog_response(['products'=>array_slice($rows,($page-1)*$limit,$limit),'page'=>$page,'total'=>$total,'pages'=>max(1,(int)ceil($total/$limit)),'more'=>$page*$limit<$total,'image'=>$hash],$c['time'],600);
    }finally{flock($h,LOCK_UN);fclose($h);}
}
