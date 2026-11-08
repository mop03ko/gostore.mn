<?php
declare(strict_types=1);
require_once __DIR__.'/taoworld-auth.php';
require_once __DIR__.'/taoworld-brands.php';
require_once __DIR__.'/official-stores.php';
require_once __DIR__.'/taoworld-home.php';
if(!function_exists('taoworld_http'))require_once __DIR__.'/taoworld-http.php';
const TW_CATALOG_SEARCH_TTL = 1800;
const TW_CATALOG_SEARCH_MAX_AGE = 3600;
// Product details: refreshed in the background after 30 minutes and shown up to an hour old (TaoWorld
// API budget); checkout always re-reads details at most 120 seconds old before payment.
const TW_CATALOG_DETAIL_REFRESH = 1800;
const TW_CATALOG_DETAIL_DISPLAY_MAX = 3600;
// Homepage pages after the third (each costs six department searches) refresh every six hours.
const TW_CATALOG_HOME_DEEP_PAGE = 3;
const TW_CATALOG_HOME_DEEP_MAX_AGE = 21600;
// Discounts, coupons and promotions on list cards stay visible for six hours after the list was
// fetched (Taobao promotions usually run for days); checkout re-reads the real price within 120 s.
const TW_CATALOG_OFFER_DISPLAY = 21600;
const TW_CATALOG_DISPLAY_FALLBACK = 86400;
function tw_catalog_require_ready(): void {
    if(!shipping_settings()['supplier_enabled']||empty(taoworld_state()['access_token']))fail('Нийлүүлэгчийн каталог түр идэвхгүй байна. Дараа дахин оролдоно уу.',503);
}

function tw_catalog_dir(): string {
    $dir=taoworld_dir().'/catalog-'.substr(hash('sha256',taoworld_binding().':'.(taoworld_state()['account_id']??'')),0,16);
    if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))fail('Каталог хадгалах боломжгүй.',503);
    return $dir;
}
// The catalog cron pre-fetches with the background share of the daily budget (no per-IP limits).
function tw_catalog_warming(): bool {return defined('GOSTORE_CATALOG_WARMING');}
function tw_catalog_call(string $path,array $params,bool $purchase=false): array {
    supplier_limits(tw_catalog_warming()&&!$purchase,$purchase);
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
    // Display reads show the last snapshot (up to a day old) instead of an error when the provider
    // is busy, failing or over quota; callers see its age and mark it stale. Purchases never do.
    $fallback=$display&&!$purchase&&tw_catalog_fresh($c,TW_CATALOG_DISPLAY_FALLBACK)?$c:null;
    $h=supplier_acquire_lock([$file.'.lock'],microtime(true)+2);
    if(!$h){if($fallback)return $fallback;throw new SupplierBusy();}
    try{
        $c=supplier_snapshot_read($file);if(tw_catalog_fresh($c,$ttl))return $c;
        try{$data=tw_catalog_call($path,$params,$purchase);}catch(ApiError $e){if($fallback)return $fallback;throw $e;}
        $c=['time'=>time(),'data'=>$data];supplier_snapshot_write($file,$c);return $c;
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
                $old=$display&&tw_catalog_fresh($c,TW_CATALOG_DISPLAY_FALLBACK)?$c:null;
                $h=supplier_acquire_lock([$file.'.lock'],$deadline);
                if(!$h){if(!$old)throw new SupplierBusy();$pages[$n]=$old;if(count($old['data']['data']??[])<20)break;continue;}
                $locks[]=$h;$c=supplier_snapshot_read($file);
                if(!tw_catalog_fresh($c,$ttl)){$pending[$n]=['query'=>$query,'file'=>$file,'old'=>$old];continue;}
            }
            $pages[$n]=$c;if(count($c['data']['data']??[])<20)break;
        }
        if($pending){
            $token=taoworld_access_token();$db=db();$db->exec('SAVEPOINT tw_catalog_batch_budget');
            try{foreach($pending as $_)supplier_limits(tw_catalog_warming());$db->exec('RELEASE SAVEPOINT tw_catalog_batch_budget');}
            catch(Throwable $e){
                $db->exec('ROLLBACK TO SAVEPOINT tw_catalog_batch_budget');$db->exec('RELEASE SAVEPOINT tw_catalog_batch_budget');
                // Over quota: display pages that still have a day-old snapshot show it instead.
                if(!$e instanceof ApiError||in_array(null,array_column($pending,'old'),true))throw $e;
                foreach($pending as $n=>$p)$pages[$n]=$p['old'];ksort($pages,SORT_NUMERIC);return $pages;
            }
            $queries=array_map(fn($v)=>$v['query']+['access_token'=>$token],array_values($pending));$responses=taoworld_http_search_batch($queries);$failure=null;
            foreach(array_keys($pending) as $i=>$n){
                try{
                    $r=$responses[$i]??null;if($r instanceof ApiError)throw $r;if(!is_array($r))fail('TaoWorld хайлтын хариу дутуу.',502);
                    $data=tw_catalog_data($r);if(!is_array($data['data']??null))fail('TaoWorld хайлтын хариу дутуу.',502);
                    $pages[$n]=['time'=>time(),'data'=>$data];supplier_snapshot_write($pending[$n]['file'],$pages[$n]);
                }catch(ApiError $e){if($pending[$n]['old'])$pages[$n]=$pending[$n]['old'];else $failure??=$e;}
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
function tw_catalog_discount(array $p,int $expires): ?array {
    $current=tw_catalog_price($p,true);
    $original=tw_catalog_price(['price'=>$p['price']??null],true);
    if($expires<=time()||$current===null||$original===null||$original<=$current)return null;
    $rate=shipping_settings()['cny_rate'];
    return ['current_mnt'=>(int)ceil($current*$rate),'was_mnt'=>(int)ceil($original*$rate),'percent'=>(int)floor(round(($original-$current)/$original*100,8)),'expires'=>$expires];
}
function tw_catalog_offers(array $p,bool $detail,int $expires): array {
    $promotions=[];
    foreach($p['promotion_displays']??[] as $group)foreach($group['promotion_info_list']??[] as $promotion){
        $name=supplier_text($promotion['promotion_name']??'',300);
        if($name!=='')$promotions[$name]=['name'=>$name];
    }
    $current=tw_catalog_price($p,$detail);
    $coupon=tw_catalog_price(['price'=>$p['coupon_price']??null],$detail);
    // Keep the coupon tied to its own source price; the cheapest SKU may have a different price.
    $valid=$expires>time()&&$coupon!==null&&$current!==null&&$coupon>0&&$coupon<$current;
    $rate=shipping_settings()['cny_rate'];
    return ['expires'=>$expires,'promotions'=>array_slice(array_values($promotions),0,8),
        'coupon_mnt'=>$valid?(int)ceil($coupon*$rate):null,
        'coupon_base_mnt'=>$valid?(int)ceil($current*$rate):null,
        'coupon_percent'=>$valid?(int)floor(round(($current-$coupon)/$current*100,8)):null];
}
function tw_catalog_product(array $p,bool $detail=false,?int $fetched=null): array {
    product_policy_assert(['id'=>'tb-'.($p['item_id']??''),'name'=>$p['title']??'','original_name'=>$p['multi_language_info']['title']??'','description'=>$p['description']??'','category_path'=>$p['category_path']??'','variants'=>$p['sku_list']??[]]);
    $id=tw_catalog_remember($p,$fetched);$price=tw_catalog_price($p,$detail);$rate=shipping_settings()['cny_rate'];
    $title=$p['multi_language_info']['title']??$p['title']??$id;
    $image=supplier_image((string)($p['main_image_url']??$p['pic_urls'][0]??''));
    $r=['id'=>$id,'provider'=>'taobao','catalog_provider'=>'taoworld','provider_label'=>'Taobao','name'=>supplier_text($title,300),'original_name'=>supplier_text($p['title']??'',500),'image'=>$image,'url'=>'/v/'.$id,'min_qty'=>1,'step'=>1,'sellable'=>true,'variants'=>[],'sold_count'=>null,'sales_30_days'=>null,'cny'=>null,'mnt'=>null,'approx_cny'=>$price,'approx_mnt'=>$price===null?null:(int)ceil($price*$rate),'price_status'=>'unverified','card_discount'=>null];
    $r['shop_rating']=tw_catalog_seller_info($p)['shop_rating']??null;
    $expires=($fetched??time())+($detail?TW_CATALOG_DETAIL_REFRESH:TW_CATALOG_OFFER_DISPLAY);
    $r['offers']=tw_catalog_offers($p,$detail,$expires);
    if(!$detail)return $r;
    $meta=supplier_snapshot_read(tw_catalog_dir().'/item-'.substr($id,3).'.json')??[];
    $r['shop_rating']=is_numeric($meta['shop_rating']??null)?(float)$meta['shop_rating']:null;$r['ship_from']=tw_catalog_ship_from((string)($meta['ship_from']??''));$r['ships_48h']=!empty($meta['ships_48h']);
    $translated=[];foreach($p['multi_language_info']['sku_properties']??[] as $v)$translated[(string)($v['sku_id']??'')]=$v['properties']??[];
    foreach($p['sku_list']??[] as $v){
        $sku=(string)($v['sku_id']??'');if(!preg_match('/^\d{1,30}$/D',$sku))continue;
        $labels=[];foreach($translated[$sku]??$v['properties']??[] as $a)$labels[]=supplier_text(($a['prop_name']??'').': '.($a['value_name']??$a['value_desc']??''),300);
        $stock=supplier_count($v['quantity']??null);
        $r['variants'][]=['id'=>$sku,'label'=>implode(' / ',$labels)?:'Стандарт','image'=>supplier_image((string)($v['pic_url']??'')),'cny'=>$stock===null?null:tw_catalog_price($v,true),'stock'=>$stock,'card_discount'=>$stock!==null&&$stock>0?tw_catalog_discount($v,$expires):null];
    }
    $prices=[];foreach($r['variants'] as $v)if(($v['stock']??0)>0&&$v['cny']!==null)$prices[]=$v['cny'];
    $r['cny']=$prices?min($prices):null;$r['mnt']=$r['cny']===null?null:(int)ceil($r['cny']*$rate);$r['sellable']=(bool)$prices;$r['price_status']=$prices?'available':'unavailable';
    // The card's original price belongs to the same cheapest available SKU.
    foreach($r['variants'] as $v)if(($v['stock']??0)>0&&$v['cny']===$r['cny']){$r['card_discount']=$v['card_discount'];break;}
    $r['offers']['discount']=$r['card_discount'];
    $r['images']=array_values(array_unique(array_filter(array_map('supplier_image',$p['pic_urls']??[$image]))));
    $r['vendor_name']=supplier_text($p['shop_name']??'',200);$r['vendor_id']=(string)($p['shop_id']??'');
    $r['attributes']=[];foreach($p['multi_language_info']['properties']??$p['properties']??[] as $a)$r['attributes'][]=['name'=>supplier_text($a['prop_name']??'',120),'value'=>supplier_text($a['value_name']??'',300)];
    $r+=['stock'=>null,'brand'=>'','category_id'=>(string)($p['category_id']??''),'category_path'=>[],'condition'=>'','location'=>[],'weight_kg'=>null,'weight_type'=>'','videos'=>[],'tiers'=>[],'related'=>[],'unavailable_reason'=>'','description'=>supplier_text($p['description']??'',30000),'description_images'=>supplier_description_images($p['description']??'')];
    return $r;
}
function tw_catalog_response(array $data,int $time,int $ttl): array {return $data+['fetched'=>gmdate('c',$time),'stale'=>false,'cache_expires'=>$time+$ttl,'cache_ttl'=>max(0,$time+$ttl-time()),'shipping'=>shipping_public()];}
// After the visitor has received the cached page, one PHP-FPM worker refreshes it. A failed
// refresh pauses that product's refreshes for five minutes; the cached page keeps being served.
function tw_catalog_schedule_refresh(string $path,array $params,array $key): void {
    if(!function_exists('fastcgi_finish_request')||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')return;
    $retry=tw_catalog_dir().'/'.supplier_cache_key($path,$key).'.retry';if(is_file($retry)&&(int)file_get_contents($retry)>time())return;
    $lock=fopen(tw_catalog_dir().'/background.lock','c');if(!$lock)return;
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return;}
    register_shutdown_function(static function()use($path,$params,$key,$retry,$lock){
        ignore_user_abort(true);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();fastcgi_finish_request();
        try{tw_catalog_cached($path,$params,false,$key);if(is_file($retry))unlink($retry);}
        catch(Throwable){file_put_contents($retry,(string)(time()+300),LOCK_EX);error_log('GOStore TaoWorld background refresh deferred');}
        finally{flock($lock,LOCK_UN);fclose($lock);}
    });
}
function tw_catalog_detail(string $id,bool $purchase=false,string $brand='',bool $display=false): array {
    tw_catalog_require_ready();
    if($brand!=='')supplier_brand($brand);
    product_policy_assert(['id'=>$id]);$resource=tw_catalog_resource($id);
    $params=$resource+['item_resource'=>'taobao','language'=>'en'];$key=['id'=>$id,'language'=>'en'];$c=null;
    // Product pages may show a detail up to an hour old; after 30 minutes it refreshes in the background;
    // checkout still re-reads details at most 120 seconds old, so prices are re-verified before payment.
    if($display&&!$purchase){
        $old=supplier_snapshot_read(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',$key).'.json');
        if(tw_catalog_fresh($old,TW_CATALOG_DETAIL_DISPLAY_MAX)&&'tb-'.($old['data']['item_id']??'')===$id){$c=$old;if(!tw_catalog_fresh($old,TW_CATALOG_DETAIL_REFRESH))tw_catalog_schedule_refresh('/traffic/item/get',$params,$key);}
    }
    $c??=tw_catalog_cached('/traffic/item/get',$params,$purchase,$key,$display&&!$purchase);
    if('tb-'.($c['data']['item_id']??'')!==$id)fail('Барааны дугаар зөрлөө.',502);
    if($brand!==''&&!tw_catalog_product_brand_matches($c['data'],$brand))fail('Энэ барааны брэнд сонгосон брэндтэй тохирохгүй байна.',409);
    $p=tw_catalog_product($c['data'],true,$c['time']);$p['price_expires']=$c['time']+($purchase?120:TW_CATALOG_DETAIL_REFRESH);
    // A snapshot older than the display allowance (shown because TaoWorld is unavailable) is stale:
    // the page shows it with a refresh prompt and ordering stays disabled.
    return tw_catalog_response(['product'=>$p]+($c['time']<=time()-TW_CATALOG_DETAIL_DISPLAY_MAX?['stale'=>true]:[]),$c['time'],$purchase?120:300);
}
// shop_id is a store identity, not the numeric seller/user ID. Search is scoped by
// the documented shop_id parameter; names and any returned IDs must also agree.
// Details always carry shop_id and must match it before a branded page is shown.
function tw_catalog_brand_matches(array $item,array $brand,bool $detail=false): bool {
    if(($item['shop_name']??'')!==$brand['vendor'])return false;
    if($detail||isset($item['shop_id']))return (string)($item['shop_id']??'')===$brand['shop_id'];
    return true;
}
function tw_catalog_cards(array $rows,?int $fetched=null): array {
    $cards=[];foreach($rows as $p){if(!is_array($p))continue;try{
        $card=tw_catalog_product($p,false,$fetched);
        $cached=supplier_snapshot_read(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>$card['id'],'language'=>'en']).'.json');
        if(tw_catalog_fresh($cached,TW_CATALOG_DETAIL_REFRESH)&&'tb-'.($cached['data']['item_id']??'')===$card['id']){
            $detail=tw_catalog_product($cached['data'],true,$cached['time']);
            foreach(['cny','mnt','approx_cny','approx_mnt','price_status','sellable','card_discount','offers'] as $key)$card[$key]=$detail[$key];
            $card['price_expires']=$cached['time']+TW_CATALOG_DETAIL_REFRESH;
        }
        $cards[]=$card;
    }catch(ApiError){}}
    return $cards;
}
function tw_catalog_deals(array $params): array {
    $page=filter_var($params['page']??1,FILTER_VALIDATE_INT);
    if($page===false||$page<1||$page>100)fail('Хуудасны дугаар буруу.');
    // Prefer the deals index built from every recent search; fall back to the homepage sample.
    require_once __DIR__.'/taoworld-deals.php';
    if($indexed=tw_deals_from_index($page))return $indexed;
    $query=['q'=>'__all__','page'=>$page,'limit'=>50];
    try {
        $result=tw_catalog_search($query);
    } catch(ApiError $error) {
        if(!in_array($error->getCode(),[429,502,503],true))throw $error;
        // Display cache can retain fresh detail offers during a temporary upstream failure.
        // The offer-expiry filter below still excludes expired promotions.
        $result=tw_catalog_search($query,true);
    }
    $result['products']=array_values(array_filter($result['products'],static function($p){
        return ($p['sellable']??true)&&($p['offers']['expires']??0)>time()&&(!empty($p['card_discount'])||!empty($p['offers']['coupon_mnt'])||!empty($p['offers']['promotions']));
    }));
    $result['scope']='catalog_sample';
    return $result;
}
// A pasted product link or item number. TaoWorld details need the account's mi_id, which only its
// searches issue (item numbers are no longer accepted), so: a product seen in a search within 89 days
// opens directly (single result plus a redirect); otherwise the share text's title is searched and the
// product opens if it is among the results, else similar products are shown; a bare link without a
// title explains how to find the item. Budget and outage errors still surface.
function tw_catalog_search_product(string $id,int $page,string $title,array $b,bool $display): array {
    $empty=['products'=>[],'page'=>$page,'total'=>0,'pages'=>$page,'more'=>false,'partial'=>false];
    $known=true;try{tw_catalog_resource($id);}catch(ApiError){$known=false;}
    if($known&&$page===1){
        try{$d=tw_catalog_detail($id,false,'',true);return tw_catalog_response(['products'=>[$d['product']],'page'=>1,'total'=>1,'pages'=>1,'more'=>false,'partial'=>false,'redirect'=>'/v/'.$id],time(),300);}
        catch(ApiError $e){if(in_array($e->getCode(),[429,503],true))throw $e;}
    }
    if($title!==''){
        $r=tw_catalog_search(['q'=>$title,'page'=>$page]+array_intersect_key($b,array_flip(['limit','sort','price_min','price_max','preview','refresh'])),$display);
        if($page===1&&in_array($id,array_column($r['products'],'id'),true))return $r+['redirect'=>'/v/'.$id];
        return $r+['notice'=>'Холбоосын бараа шууд олдсонгүй. Ижил нэртэй бараануудыг харуулж байна.'];
    }
    if($known)return tw_catalog_response($empty,time(),0);
    return tw_catalog_response($empty+['notice'=>'Энэ холбоосын барааг шууд нээх боломжгүй. Барааны нэр эсвэл зургаар хайна уу.'],time(),0);
}
function tw_catalog_departments(): array {
    return ['home storage'=>'收纳盒','electronics'=>'数码配件','bag'=>'包','men shoes'=>'男鞋','jewelry accessories'=>'饰品','beauty'=>'美妆','lamp'=>'灯具','men clothing'=>'男装','women clothing'=>'女装','kids clothing'=>'童装','women shoes'=>'女鞋','kitchen utensils'=>'厨房用品','home appliances'=>'家电','furniture'=>'家具','home decoration'=>'家居装饰','baby products'=>'母婴用品','toys'=>'玩具','sports equipment'=>'运动用品','camping equipment'=>'露营装备','fishing tackle'=>'渔具','car accessories'=>'汽车用品','tools'=>'工具','building materials'=>'建筑材料','garden supplies'=>'园艺用品','pet supplies'=>'宠物用品','office supplies'=>'办公用品','personal care'=>'个人护理'];
}
// Homepage mix: the 27 departments plus popular Taobao categories (85 keywords, all checked against
// the product policy), so scrolling covers far more of the catalog than the original departments.
function tw_catalog_home_keywords(): array {
    return array_values(array_unique(array_merge(array_values(tw_catalog_departments()),['手机壳','数据线','蓝牙耳机','充电宝','智能手表','键盘鼠标','手机支架','连衣裙','卫衣','牛仔裤','羽绒服','衬衫','T恤','外套','运动鞋','休闲鞋','帆布鞋','双肩包','行李箱','钱包','帽子','围巾','袜子','睡衣','太阳镜','发饰','护肤品','洗面奶','床上用品','毛巾','收纳袋','保温杯','餐具','清洁用品','装饰画','抱枕','地毯','窗帘','积木','文具','笔记本','书包','瑜伽垫','健身器材','自行车配件','户外背包','宠物玩具','汽车座垫','五金配件','电动工具','厨房收纳','浴室用品','儿童鞋','女包','男包','手表','耳环','项链'])));
}
// The starting department rotates every Ulaanbaatar day, so the first screens differ day to day while
// each department's cached pages are shared by every rotation.
function tw_catalog_home_order(?int $now=null): array {
    $k=tw_catalog_home_keywords();$offset=intdiv(($now??time())+8*3600,86400)*6%count($k);
    return array_merge(array_slice($k,$offset),array_slice($k,0,$offset));
}
// Recommendations use the viewed product's leaf category, never the mixed home feed.
function tw_catalog_recommend_query(array $product): string {
    $valid=static function($value): string {
        if(!is_string($value))return '';
        $value=trim(supplier_text($value,100));
        return in_array(mb_strtolower($value),['','null','other','others','其他','其它'],true)?'':$value;
    };
    $category=$valid($product['category_name']??null);
    if($category!=='')return $category;
    $path=$product['category_path']??null;
    if(is_string($path)){
        $parts=preg_split('/(?:->|>|\x{2192})/u',html_entity_decode($path,ENT_QUOTES|ENT_HTML5,'UTF-8'));
        $category=$valid(end($parts));
        if($category!=='')return $category;
    }
    // Some suppliers omit taxonomy. A product-title search stays item-specific.
    return $valid($product['title']??null)?:$valid($product['multi_language_info']['title']??null);
}
function tw_catalog_recommend(string $id,int $limit=24,int $page=1): array {
    if(!preg_match('/^tb-\d{5,20}$/D',$id))fail('Барааны дугаар буруу.');
    if($page<1||$page>100)fail('Хуудасны дугаар буруу.');
    if($limit<1||$limit>120)fail('Барааны тоо буруу.');
    tw_catalog_require_ready();
    product_policy_assert(['id'=>$id]);
    // Reuses the product page's cached detail; no per-card detail requests.
    tw_catalog_detail($id,false,'',true);
    $source=supplier_snapshot_read(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>$id,'language'=>'en']).'.json');
    $product=$source['data']??[];$query=tw_catalog_recommend_query($product);
    $empty=['products'=>[],'page'=>$page,'total'=>null,'pages'=>$page,'more'=>false];
    if($query===''||product_policy_text_blocked($query))return tw_catalog_response($empty,time(),0);
    // The traffic search API accepts keywords, not category_id. Preserve the raw
    // window when excluding cards so scrolling cannot skip or repeat a page.
    $params=['keyword'=>$query,'language'=>'en'];
    $start=($page-1)*$limit;$first=intdiv($start,20)+1;$last=intdiv($start+$limit-1,20)+1;
    $rows=[];$fetched=time();
    for($n=$first;$n<=$last;$n++){
        $c=tw_catalog_cached('/traffic/item/search',$params+['page_no'=>(string)$n,'page_size'=>'20']);
        $part=$c['data']['data']??null;
        if(!is_array($part))fail('TaoWorld хайлтын хариу дутуу.',502);
        $fetched=min($fetched,$c['time']);$rows=array_merge($rows,$part);
        if(count($part)<20)break;
    }
    $rows=array_slice($rows,$start%20,$limit);$more=count($rows)===$limit&&$page<100;
    $seen=[$id=>true];$eligible=[];$category=(string)($product['category_id']??'');
    foreach($rows as $row){
        if(!is_array($row))continue;
        $candidate='tb-'.($row['item_id']??'');
        if(isset($seen[$candidate]))continue;
        $seen[$candidate]=true;
        $detail=supplier_snapshot_read(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>$candidate,'language'=>'en']).'.json');
        $candidateCategory=(string)($row['category_id']??'');
        if($candidateCategory===''&&tw_catalog_fresh($detail,TW_CATALOG_DETAIL_DISPLAY_MAX))$candidateCategory=(string)($detail['data']['category_id']??'');
        if($category!==''&&$candidateCategory!==''&&$category!==$candidateCategory)continue;
        $eligible[]=$row;
    }
    $products=array_values(array_filter(tw_catalog_cards($eligible,$fetched),static function($p){
        $price=$p['mnt']??$p['approx_mnt']??null;
        return ($p['sellable']??true)&&is_numeric($price)&&$price>0;
    }));
    return tw_catalog_response(['products'=>$products,'page'=>$page,'total'=>null,'pages'=>$page+($more?1:0),'more'=>$more],$fetched,TW_CATALOG_SEARCH_TTL);
}
function tw_catalog_search(array $b,bool $display=false): array {
    if(!empty($b['shop']))return official_store_products($b,$display&&empty($b['refresh']));
    tw_catalog_require_ready();
    $limit=supplier_page_size($b);$page=int_field($b,'page',1,100);$q=str_field($b,'q',100,false)?:'home storage';
    // Pasted links, item numbers and share texts open the product; other text is normalised.
    if($q!=='__all__'&&str_field($b,'brand',30,false)===''){
        require_once __DIR__.'/search-query.php';$intent=search_query_intent($q);
        if($intent['type']==='product')return tw_catalog_search_product($intent['id'],$page,$intent['title'],$b,$display);
        if($intent['type']==='empty')return tw_catalog_response(['products'=>[],'page'=>$page,'total'=>0,'pages'=>$page,'more'=>false],time(),0);
        $q=$intent['q'];
    }
    $refresh=isset($b['refresh'])?int_field($b,'refresh',0,1):0;
    $preview=isset($b['preview'])?int_field($b,'preview',0,1):0;
    $display=$display&&!$refresh;
    $partial=$preview&&$page===1&&$limit===50;
    $brandId=str_field($b,'brand',30,false);
    // Older app builds send only the exact brand name. Keep those visits scoped
    // too; ordinary queries such as "nike shoes" remain general searches.
    if($brandId==='')foreach(supplier_brands() as $candidate=>$entry){
        if(in_array(mb_strtolower(trim($q)),[mb_strtolower($entry['name']),$candidate],true)){$brandId=$candidate;break;}
    }
    $brand=$brandId!==''?supplier_brand($brandId):null;
    // Brand selection supplies its own query and verifies detail attributes.
    if($brand)$q='';
    $sort=str_field($b,'sort',20,false)?:'default';$sorts=['default'=>'','price'=>'PRICE_ASC','-price'=>'PRICE_DESC','-volume'=>'SALE_QTY_DESC','-updated_time'=>''];
    if(!isset($sorts[$sort]))fail('Эрэмбэ буруу.');
    $range=supplier_price_range($b);$filters=[];$rate=shipping_settings()['cny_rate'];
    foreach(['price_min'=>'min_price','price_max'=>'max_price'] as $k=>$v)if(isset($range[$k]))$filters[]=$v.':'.(int)round($range[$k]*100/$rate);
    if($brand)return tw_catalog_brand_selection($brandId,$page,$sort,$filters,$display);
    if($q==='__all__')return tw_catalog_home($page,$limit,$sorts[$sort],$filters,$display);
    if(product_policy_text_blocked($q))return tw_catalog_response(['products'=>[],'page'=>$page,'total'=>0,'pages'=>$page,'more'=>false],time(),0);
    $keywords=tw_catalog_departments()+[
        'загасчлал'=>'渔具', 'загасчлалын хэрэгсэл'=>'渔具',
        'fishing rod'=>'鱼竿', 'загасны уурга'=>'鱼竿',
        'fishing reel'=>'渔轮', 'дамар'=>'渔轮',
        'fishing line'=>'鱼线', 'загасны утас'=>'鱼线',
        'fishing hooks'=>'鱼钩', 'дэгээ'=>'鱼钩',
        'fishing lures'=>'路亚饵', 'хиймэл өгөөш'=>'路亚饵',
        'fishing float'=>'浮漂', 'хөвүүр'=>'浮漂',
        'fishing tackle box'=>'钓鱼配件盒', 'хэрэгслийн хайрцаг'=>'钓鱼配件盒',
        'fishing landing net'=>'抄网', 'загасны тор'=>'抄网',
        'барилгын материал'=>'建筑材料',
        'барилгын материалууд'=>'建筑材料',
        'барилгын материалиуд'=>'建筑材料',
        'ceramic tiles'=>'瓷砖', 'плита'=>'瓷砖',
        'wall panels'=>'墙面装饰板', 'ханын хавтан'=>'墙面装饰板',
        'flooring materials'=>'地板', 'шалны материал'=>'地板',
        'insulation materials'=>'建筑保温板', 'дулаалгын материал'=>'建筑保温板',
        'waterproofing materials'=>'防水材料', 'ус тусгаарлах материал'=>'防水材料',
        'plumbing fittings'=>'水管配件', 'сантехникийн материал'=>'水管配件',
        'electrical supplies'=>'电线电缆', 'цахилгааны материал'=>'电线电缆',
        'fasteners'=>'紧固件', 'бэхэлгээ'=>'紧固件',
    ];
    $params=['keyword'=>$keywords[mb_strtolower($q)]??$q,'language'=>'en'];if($sorts[$sort]!=='')$params['sort']=$sorts[$sort];if($filters)$params['filters']=json_encode($filters,JSON_THROW_ON_ERROR);
    // Native pages contain at most 20 items. Keep the storefront's 12/50-item contract.
    $start=($page-1)*$limit;$first=(int)floor($start/20)+1;$last=(int)floor(($start+$limit-1)/20)+1;$rows=[];$time=time();
    if($partial)$last=$first;
    $c=tw_catalog_cached('/traffic/item/search',$params+['page_no'=>(string)$first,'page_size'=>'20'],false,null,$display);$time=min($time,$c['time']);$rows=$c['data']['data']??null;if(!is_array($rows))fail('TaoWorld хайлтын хариу дутуу.',502);
    $partial=$partial&&count($rows)===20;
    if(count($rows)===20&&$first<$last)foreach(tw_catalog_search_pages($params,$first+1,$last,$display) as $c){$time=min($time,$c['time']);$part=$c['data']['data']??null;if(!is_array($part))fail('TaoWorld хайлтын хариу дутуу.',502);$rows=array_merge($rows,$part);if(count($part)<20)break;}
    $rows=array_slice($rows,$start%20,$limit);$more=count($rows)===$limit&&$page<100;
    $stale=$time<=time()-TW_CATALOG_SEARCH_TTL;
    $data=['products'=>tw_catalog_cards($rows,$time),'page'=>$page,'total'=>null,'pages'=>$page+($more?1:0),'more'=>$more,'partial'=>$partial,'stale'=>$stale,'revalidate'=>$stale];
    return tw_catalog_response($data,$time,TW_CATALOG_SEARCH_TTL);
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
