<?php
declare(strict_types=1);

// New catalog uses Taobao. Explicit local prefixes keep legacy 1688 IDs unambiguous.
function supplier_identity(string $id): array {
    if(!preg_match('/^(abb|tb)-(\d{5,20})$/D',$id,$m))fail('Нийлүүлэгчийн барааны дугаар буруу.');
    return ['provider'=>$m[1]==='tb'?'taobao':'alibaba1688','number'=>$m[2],'label'=>$m[1]==='tb'?'Taobao':'1688'];
}
function supplier_ready(): bool { return !empty(config()['otcommerce']['api_key']) && shipping_settings()['supplier_enabled']; }
function supplier_cache_key(string $path,array $query): string { ksort($query);return hash('sha256',$path.'?'.http_build_query($query)); }
// At most one post-response refresh runs across all PHP workers.
function supplier_schedule_refresh(string $path,array $query,string $dir): void {
    if(!function_exists('fastcgi_finish_request'))return;
    $retry=$dir.'/'.supplier_cache_key($path,$query).'.json.retry';
    if(is_file($retry)&&(int)file_get_contents($retry)>time())return;
    $lock=fopen($dir.'/background.lock','c');if(!$lock)return;
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return;}
    register_shutdown_function(static function()use($path,$query,$lock){
        ignore_user_abort(true);
        if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
        fastcgi_finish_request();
        try {supplier_request($path,$query,false,true);}catch(Throwable $e){error_log('GOStore supplier background refresh deferred');}
        finally {flock($lock,LOCK_UN);fclose($lock);}
    });
}
// Warm only fixed storefront departments, after the visitor has received their response.
function supplier_warm_queries(): array {return ['home storage','electronics','bag','men shoes','accessories','beauty','lamp','men clothing','women clothing','kids clothing','women shoes','kids shoes','kitchen utensils','home appliances','furniture','home decoration','baby products','toys','sports equipment','camping equipment','car accessories','tools','garden supplies','pet supplies','office supplies','personal care'];}
function supplier_schedule_warm(): void {
    if(!function_exists('fastcgi_finish_request')||!supplier_ready())return;
    $dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))return;
    $pause=$dir.'/warm.retry';if(is_file($pause)&&(int)file_get_contents($pause)>time())return;
    $lock=fopen($dir.'/background.lock','c');if(!$lock)return;
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return;}
    $next=null;
    foreach(supplier_warm_queries() as $q){
        $query=['language'=>'mn','item_title'=>$q,'page'=>1,'limit'=>12,'sort'=>'default'];$file=$dir.'/'.supplier_cache_key('/v1/taobao/search',$query).'.json';
        $v=is_file($file)?json_decode(file_get_contents($file),true):null;
        if(is_array($v)&&is_array($v['data']??null)&&($v['expires']??0)>time())continue;
        if(is_file($file.'.retry')&&(int)file_get_contents($file.'.retry')>time())continue;
        $next=$query;break;
    }
    if($next===null){flock($lock,LOCK_UN);fclose($lock);return;}
    register_shutdown_function(static function()use($next,$lock,$pause){
        ignore_user_abort(true);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();fastcgi_finish_request();
        try{
            // Leave at least half the configured daily budget for actual browsing and orders.
            limit_attempts('supplier-warm:'.gmdate('Y-m-d'),(int)floor(shipping_settings()['api_daily_limit']/2),86400);
            supplier_request('/v1/taobao/search',$next,false,false,true);
        }catch(Throwable $e){file_put_contents($pause,(string)(time()+($e->getCode()===429?3600:300)),LOCK_EX);}
        finally{flock($lock,LOCK_UN);fclose($lock);}
    });
}
function supplier_public_json(array $data): never {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    $ttl=min(60,(int)($data['cache_ttl']??0));
    header('Cache-Control: '.($ttl>0?'public, max-age='.$ttl.', must-revalidate':'no-store'));
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
}
function supplier_request(string $path,array $query,bool $display=false,bool $force=false,bool $warming=false): array {
    if(!supplier_ready())fail('Нийлүүлэгчийн каталог түр идэвхгүй байна. Дараа дахин оролдоно уу.',503);
    $dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))mkdir($dir,0700,true);
    $key=supplier_cache_key($path,$query);$file=$dir.'/'.$key.'.json';
    $read=static function()use($file){$v=is_file($file)?json_decode(file_get_contents($file),true):null;return is_array($v)&&isset($v['data'],$v['fetched'],$v['expires'])&&is_array($v['data'])&&is_numeric($v['expires'])?$v:null;};
    $cached=$read();
    if($cached&&$cached['expires']>time()&&!$force){
        if($display&&$cached['expires']-time()<1800)supplier_schedule_refresh($path,$query,$dir);
        return $cached;
    }
    // Browsing may use one day's stale data; ordering uses the strict path below.
    if($display&&$cached&&$cached['expires']>time()-86400){supplier_schedule_refresh($path,$query,$dir);$cached['stale']=true;return $cached;}
    $retry=$file.'.retry';
    if(is_file($retry)&&(int)file_get_contents($retry)>time()){
        if($cached&&!$display){$cached['stale']=$cached['expires']<=time();return $cached;}
        fail('Нийлүүлэгчийн мэдээллийг шинэчилж байна. Түр хүлээгээд дахин оролдоно уу.',503);
    }
    $lock=fopen($dir.'/'.$key.'.lock','c');if(!$lock)fail('Нийлүүлэгчийн холболт завгүй байна.',503);
    if(!flock($lock,LOCK_EX|(($display||$force||$warming)?LOCK_NB:0))){fclose($lock);if($cached&&$force)return $cached;fail('Нийлүүлэгчийн холболт завгүй байна. Түр хүлээгээд дахин оролдоно уу.',503);}
    try {
        $cached=$read();if($cached&&$cached['expires']>time()&&(!$force||$cached['expires']-time()>=1800))return $cached;
        if(is_file($retry)&&(int)file_get_contents($retry)>time()){if($cached){$cached['stale']=$cached['expires']<=time();return $cached;}fail('Нийлүүлэгчийн холболтыг түр хүлээнэ үү.',503);}
        // Deduplicate each cache key; at most two independent provider requests run at once.
        $slot=null;for($i=0;$i<2;$i++){$candidate=fopen($dir.'/network-'.$i.'.lock','c');if($candidate&&flock($candidate,LOCK_EX|LOCK_NB)){$slot=$candidate;break;}if($candidate)fclose($candidate);}
        if(!$slot)fail('Нийлүүлэгчийн холболт завгүй байна. Түр хүлээгээд дахин оролдоно уу.',503);
        try {
            if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')fail('Туршилтын орчинд нийлүүлэгчийн дуудлагыг хаасан.',503);
            if(!$warming)limit_attempts('supplier-ip:'.($_SERVER['REMOTE_ADDR']??'cli'),10,3600);
            limit_attempts('supplier-budget:'.gmdate('Y-m-d'),shipping_settings()['api_daily_limit'],86400);
            $ch=curl_init('https://rest.otapi.net'.$path.'?'.http_build_query($query));$raw='';
            curl_setopt_array($ch,[CURLOPT_HTTPHEADER=>['X-Api-Key: '.config()['otcommerce']['api_key'],'Accept: application/json'],CURLOPT_ENCODING=>'',CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>35,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>12000000)return 0;$raw.=$chunk;return strlen($chunk);}]);
            $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
            $response=json_decode($raw,true);
            if(!$ok||$status!==200||!is_array($response)||($response['ErrorCode']??'')!=='Ok'||!isset($response['Result']))fail('Нийлүүлэгчийн мэдээлэл одоогоор авах боломжгүй. API эрх эсвэл лимитийг админ шалгана уу.',503);
            $cached=['data'=>$response['Result'],'fetched'=>gmdate('c'),'expires'=>time()+21600,'stale'=>false];
            $tmp=tempnam($dir,'write-');if($tmp===false)fail('Cache хадгалж чадсангүй.',503);
            try {if(file_put_contents($tmp,json_encode($cached,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX)===false)fail('Cache хадгалж чадсангүй.',503);chmod($tmp,0600);if(!rename($tmp,$file))fail('Cache хадгалж чадсангүй.',503);}finally{if(is_file($tmp))unlink($tmp);}
            if(is_file($retry))unlink($retry);
            return $cached;
        } catch(ApiError $e) {
            file_put_contents($retry,(string)(time()+300),LOCK_EX);chmod($retry,0600);
            if($cached&&(!$display||$cached['expires']>time()-86400)){$cached['stale']=$cached['expires']<=time();return $cached;}throw $e;
        } finally {flock($slot,LOCK_UN);fclose($slot);}
    } finally {flock($lock,LOCK_UN);fclose($lock);}
}
function supplier_cny(array $p): ?float {
    if(($p['OriginalCurrencyCode']??'')!=='CNY'||!is_numeric($p['OriginalPrice']??null))return null;
    $v=(float)$p['OriginalPrice'];return is_finite($v)&&$v>0&&$v<=1000000?$v:null;
}
function supplier_image(string $url): string {
    $url=preg_replace('#^(?:http:)?//#','https://',$url);$p=parse_url($url);$host=strtolower($p['host']??'');
    if(($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['port']))return '';
    foreach(['alicdn.com','otcommerce.com','otapi.net'] as $domain)if($host===$domain||str_ends_with($host,'.'.$domain))return $url;
    return '';
}
// Public product information only; provider markup is never rendered as HTML.
function supplier_text(mixed $value,int $limit=500): string {
    if(!is_scalar($value))return '';
    $text=preg_replace('#<(script|style|iframe)\b[^>]*>.*?</\1>#is','',(string)$value);
    $text=preg_replace('#<br\s*/?>|</(?:p|div|li|h[1-6])>#i',"\n",$text);
    return mb_substr(trim(html_entity_decode(strip_tags($text),ENT_QUOTES|ENT_HTML5,'UTF-8')),0,$limit);
}
function supplier_count(mixed $value): ?int {
    $n=filter_var($value,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>9007199254740991]]);
    return $n===false?null:$n;
}
function supplier_description_images(string $html): array {
    preg_match_all("#<img\b[^>]*\bsrc\s*=\s*(?:\"([^\"<>]*)\"|'([^'<>]*)'|([^\s<>]+))#i",substr($html,0,1000000),$matches,PREG_SET_ORDER);
    $images=[];foreach($matches as $m){$url=supplier_image(html_entity_decode($m[1]?:($m[2]?:($m[3]??'')),ENT_QUOTES|ENT_HTML5,'UTF-8'));if($url!=='')$images[]=$url;}
    return array_slice(array_values(array_unique($images)),0,80);
}
function supplier_video(string $url): string {
    $url=preg_replace('#^(?:http:)?//#','https://',$url);$p=parse_url($url);$host=strtolower($p['host']??'');
    if(($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['port']))return '';
    return $host==='cloud.video.taobao.com'||$host==='video.alicdn.com'||str_ends_with($host,'.video.taobao.com')?$url:'';
}
function supplier_normalize(array $p,bool $detail=false,string $provider='alibaba1688'): array {
    $rawId=(string)($p['Id']??'');$taobao=$provider==='taobao';
    if(!preg_match($taobao?'/^\d{5,20}$/D':'/^abb-\d{5,20}$/D',$rawId)||!empty($p['HasError'])||(!empty($p['ProviderType'])&&$p['ProviderType']!==($taobao?'Taobao':'Alibaba1688')))fail('Нийлүүлэгчийн барааны мэдээлэл буруу.',503);
    $id=$taobao?'tb-'.$rawId:$rawId;$identity=supplier_identity($id);
    $price=supplier_cny($p['Price']??[]);$rate=shipping_settings()['cny_rate'];
    $r=['id'=>$id,'provider'=>$identity['provider'],'provider_label'=>$identity['label'],'name'=>mb_substr(trim((string)($p['Title']??''))?:((string)($p['OriginalTitle']??$id)),0,300),'image'=>supplier_image((string)($p['MainPictureUrl']??'')),'cny'=>$price,'mnt'=>$price===null?null:(int)ceil($price*$rate),'url'=>$taobao?'https://item.taobao.com/item.htm?id='.$identity['number']:'https://detail.1688.com/offer/'.$identity['number'].'.html','min_qty'=>max(1,(int)($p['FirstLotQuantity']??1)),'step'=>max(1,(int)($p['NextLotQuantity']??1)),'sellable'=>($p['IsSellAllowed']??false)===true&&!($p['IsFiltered']??false),'variants'=>[]];
    $sold=filter_var($p['Volume']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>9007199254740991]]);
    $r['sold_count']=$sold===false?null:$sold;
    $featured=[];foreach($p['FeaturedValues']??[] as $feature)if(is_array($feature))$featured[(string)($feature['Name']??'')]=$feature['Value']??null;
    if($r['sold_count']===null){$total=supplier_count($featured['TotalSales']??null);if($total>0)$r['sold_count']=$total;}
    $r['sales_30_days']=supplier_count($featured['SalesInLast30Days']??null); // OT uses zero when sales volume is unknown.
    if($detail){
        $pictures=[$r['image']];foreach($p['Pictures']??[] as $picture){if(is_array($picture))$pictures[]=supplier_image((string)($picture['Url']??''));}
        $r['images']=array_slice(array_values(array_unique(array_filter($pictures))),0,20);
        $r['vendor_name']=supplier_text($p['VendorDisplayName']??$p['VendorName']??'',200);
        $r['original_name']=supplier_text($p['OriginalTitle']??'',500);
        $r['brand']=supplier_text($p['BrandName']??'',200);
        $r['category_id']=supplier_text($p['CategoryId']??'',100);
        $r['condition']=supplier_text($p['StuffStatus']??'',50);
        $r['stock']=supplier_count($p['MasterQuantity']??null);
        $r['location']=[];foreach(['Country','State','City'] as $key){$value=supplier_text($p['Location'][$key]??'',100);if($value!=='')$r['location'][]=$value;}
        $r['unavailable_reason']=supplier_text($p['SellDisallowReason']??'',500);
        $r['weight_kg']=null;$weight=$p['ActualWeightInfo']['Weight']??null;
        if(is_numeric($weight)&&is_finite((float)$weight)&&(float)$weight>0)$r['weight_kg']=(float)$weight;
        $r['weight_type']=supplier_text($p['ActualWeightInfo']['DisplayName']??'',100);
        $r['videos']=[];foreach(array_slice($p['Videos']??[],0,6) as $video){if(!is_array($video))continue;$url=supplier_video((string)($video['Url']??''));if($url!=='')$r['videos'][]=['url'=>$url,'poster'=>supplier_image((string)($video['PreviewUrl']??''))];}
        $r['description_images']=supplier_description_images((string)($p['Description']??''));
        $r['attributes']=[];foreach(array_slice($p['Attributes']??[],0,200) as $attribute){$name=mb_substr((string)($attribute['PropertyName']??''),0,120);$value=mb_substr((string)($attribute['Value']??''),0,300);if($name!==''&&$value!=='')$r['attributes'][]=['name'=>$name,'value'=>$value];}
        $variantImages=[];foreach($p['Attributes']??[] as $a){$url=supplier_image((string)($a['ImageUrl']??''));if($url!=='')$variantImages[($a['Pid']??'').'|'.($a['Vid']??'')]=$url;}
        $attrs=[];foreach($p['Attributes']??[] as $a)$attrs[($a['Pid']??'').'|'.($a['Vid']??'')]=($a['PropertyName']??$a['Pid']??'').': '.($a['Value']??$a['Vid']??'');
        foreach($p['ConfiguredItems']??[] as $v){$variantImage='';foreach($v['Configurators']??[] as $a){$variantImage=$variantImages[($a['Pid']??'').'|'.($a['Vid']??'')]??$variantImage;}$labels=[];foreach($v['Configurators']??[] as $a)$labels[]=$attrs[($a['Pid']??'').'|'.($a['Vid']??'')]??($a['Vid']??'');$vp=supplier_cny($v['Price']??[]);$r['variants'][]=['id'=>(string)$v['Id'],'label'=>mb_substr(implode(' / ',$labels)?:'Стандарт',0,300),'cny'=>$vp,'image'=>$variantImage,'stock'=>supplier_count($v['Quantity']??null)];}
        if(!$r['variants'])$r['variants'][]=['id'=>'standard','label'=>'Стандарт · админ баталгаажуулна','cny'=>$price,'image'=>$r['image'],'stock'=>supplier_count($p['MasterQuantity']??null)];
        $r['description']=supplier_text($p['Description']??'',30000);
        $r['tiers']=[];foreach($p['QuantityRanges']??[] as $tier){$v=supplier_cny($tier['Price']??[]);if($v!==null)$r['tiers'][]=['qty'=>(int)$tier['MinQuantity'],'cny'=>$v];}
    }
    return $r;
}
function supplier_search(array $b,bool $display=false): array {
    $q=mb_strtolower(preg_replace('/\s+/u',' ',str_field($b,'q',100,false)?:'bag'));$page=int_field($b,'page',1,100);$sort=str_field($b,'sort',20,false)?:'default';
    if(!in_array($sort,['default','price','-price','-volume'],true))fail('Эрэмбэ буруу.');
    $c=supplier_request('/v1/taobao/search',['language'=>'mn','item_title'=>$q,'page'=>$page,'limit'=>12,'sort'=>$sort],$display);
    $block=$c['data']['Items']??[];$items=[];foreach($block['Items']['Content']??[] as $p){try{$items[]=supplier_normalize($p,false,'taobao');}catch(ApiError){}}
    if($display)supplier_schedule_warm();
    return ['products'=>$items,'page'=>$page,'more'=>count($items)===12&&$page<min(100,(int)($block['MaximumPageCount']??100))&&$page*12<(int)($block['Items']['TotalCount']??PHP_INT_MAX),'fetched'=>$c['fetched'],'stale'=>$c['stale'],'cache_expires'=>(int)$c['expires'],'cache_ttl'=>$c['stale']?0:max(0,(int)$c['expires']-time()),'shipping'=>shipping_public()];
}
function supplier_detail(string $id,bool $display=false): array {
    $identity=supplier_identity($id);
    $c=supplier_request('/v1/'.$identity['provider'].'/product/'.$identity['number'],['language'=>'mn'],$display);
    $p=supplier_normalize($c['data']['Item']??[],true,$identity['provider']);if($p['id']!==$id)fail('Барааны дугаар таарахгүй байна.',503);
    $p['category_path']=[];foreach(array_reverse($c['data']['RootPath']['Content']??[]) as $category){$name=supplier_text($category['Name']??'',150);if($name!=='')$p['category_path'][]=$name;}
    $p['related']=[];$seen=[$p['id']=>true];foreach(array_merge($c['data']['VendorItems']['Content']??[],$c['data']['RecommendedItems']['Content']??[]) as $item){try{$related=supplier_normalize($item,false,$identity['provider']);if(!isset($seen[$related['id']])){$seen[$related['id']]=true;$p['related'][]=$related;}if(count($p['related'])>=12)break;}catch(ApiError){}}
    return ['product'=>$p,'fetched'=>$c['fetched'],'stale'=>$c['stale'],'cache_expires'=>(int)$c['expires'],'cache_ttl'=>$c['stale']?0:max(0,(int)$c['expires']-time()),'shipping'=>shipping_public()];
}
function supplier_order(array $b): array {
    $d=supplier_detail(str_field($b,'product_id',50));$p=$d['product'];
    if($d['stale']||!$p['sellable'])fail('Барааны худалдаалах нөхцөлийг шинэчилж чадсангүй. Дараа дахин оролдоно уу.',409);
    $sku=str_field($b,'sku',150);$variant=null;foreach($p['variants'] as $v)if($v['id']===$sku)$variant=$v;
    if(!$variant||$variant['cny']===null)fail('Барааны хувилбар эсвэл үнэ тодорхойгүй байна.',409);
    $qty=int_field($b,'qty',1,9999);if($qty<$p['min_qty']||($qty-$p['min_qty'])%$p['step']!==0||($variant['stock']!==null&&$qty>$variant['stock']))fail('Багцын тоо эсвэл үлдэгдлийг шалгана уу.');
    // Supplier variants and quantity discounts require an operator's final quote.
    return ['id'=>$p['id'],'provider'=>$p['provider'],'sku'=>$sku,'name'=>$p['name'],'variant'=>$variant['label'],'qty'=>$qty,'unit_cny'=>$variant['cny'],'goods_cny'=>round($variant['cny']*$qty,2),'url'=>$p['url'],'image'=>$p['image'],'fetched'=>$d['fetched'],'rate'=>shipping_settings()['cny_rate']];
}
