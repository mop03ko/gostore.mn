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
    if(!empty(shipping_settings()['catalog_snapshot_enabled'])){supplier_snapshot_schedule();return;}
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
function supplier_response(string $path,bool $ok,int $status,string $raw): array {
    $response=json_decode($raw,true);
    // A missing product is not a temporary gateway failure or an API-key problem.
    if($ok&&$status===404&&($response['error']??null)==='not_found'&&preg_match('#^/v1/(?:taobao|alibaba1688)/product/\d+$#D',$path)){
        fail('Нийлүүлэгчээс энэ барааны мэдээлэл олдсонгүй. Каталогоос өөр бараа сонгоно уу.',404);
    }
    if(!$ok||$status!==200||!is_array($response)||($response['ErrorCode']??'')!=='Ok'||!is_array($response['Result']??null))fail('Нийлүүлэгчийн мэдээлэл одоогоор авах боломжгүй. API эрх эсвэл лимитийг админ шалгана уу.',503);
    return $response['Result'];
}
function supplier_limits(bool $warming): void {
    if(!$warming){
        $ip=$_SERVER['REMOTE_ADDR']??'cli';
        try {
            limit_attempts('supplier-ip-minute:'.$ip,30,60);
            limit_attempts('supplier-ip:'.$ip,120,3600);
        } catch(ApiError $e){
            if($e->getCode()!==429)throw $e;
            fail('Богино хугацаанд олон шинэ бараа нээсэн байна. Түр хүлээгээд дахин оролдоно уу. Хадгалсан мэдээлэлтэй барааг үргэлжлүүлэн үзэж болно.',429);
        }
    }
    try {limit_attempts('supplier-budget:'.gmdate('Y-m-d'),shipping_settings()['api_daily_limit'],86400);}
    catch(ApiError $e){
        if($e->getCode()!==429)throw $e;
        fail('Сайтын шинэ мэдээлэл авах өдрийн API лимит дууссан байна. Хадгалсан мэдээлэлтэй барааг үргэлжлүүлэн үзэж болно.',429);
    }
}
function supplier_request(string $path,array $query,bool $display=false,bool $force=false,bool $warming=false,?int $refreshAge=null): array {
    if(!supplier_ready())fail('Нийлүүлэгчийн каталог түр идэвхгүй байна. Дараа дахин оролдоно уу.',503);
    $dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))mkdir($dir,0700,true);
    $key=supplier_cache_key($path,$query);$file=$dir.'/'.$key.'.json';
    $missing=$file.'.missing';
    if(is_file($missing)&&(int)file_get_contents($missing)>time())fail('Нийлүүлэгчээс энэ барааны мэдээлэл олдсонгүй. Каталогоос өөр бараа сонгоно уу.',404);
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
        if(is_file($missing)&&(int)file_get_contents($missing)>time())fail('Нийлүүлэгчээс энэ барааны мэдээлэл олдсонгүй. Каталогоос өөр бараа сонгоно уу.',404);
        $cached=$read();if($cached&&$cached['expires']>time()&&(!$force||($refreshAge===null?$cached['expires']-time()>=1800:strtotime((string)$cached['fetched'])>time()-$refreshAge)))return $cached;
        if(is_file($retry)&&(int)file_get_contents($retry)>time()){if($cached){$cached['stale']=$cached['expires']<=time();return $cached;}fail('Нийлүүлэгчийн холболтыг түр хүлээнэ үү.',503);}
        // Deduplicate each cache key; at most two independent provider requests run at once.
        $slot=null;for($i=0;$i<2;$i++){$candidate=fopen($dir.'/network-'.$i.'.lock','c');if($candidate&&flock($candidate,LOCK_EX|LOCK_NB)){$slot=$candidate;break;}if($candidate)fclose($candidate);}
        if(!$slot)fail('Нийлүүлэгчийн холболт завгүй байна. Түр хүлээгээд дахин оролдоно уу.',503);
        try {
            supplier_limits($warming);
            if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')fail('Туршилтын орчинд нийлүүлэгчийн дуудлагыг хаасан.',503);
            $ch=curl_init('https://rest.otapi.net'.$path.'?'.http_build_query($query));$raw='';
            curl_setopt_array($ch,[CURLOPT_HTTPHEADER=>['X-Api-Key: '.config()['otcommerce']['api_key'],'Accept: application/json'],CURLOPT_ENCODING=>'',CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>35,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>12000000)return 0;$raw.=$chunk;return strlen($chunk);}]);
            $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
            $result=supplier_response($path,$ok!==false,$status,$raw);
            $cached=['data'=>$result,'fetched'=>gmdate('c'),'expires'=>time()+21600,'stale'=>false];
            $tmp=tempnam($dir,'write-');if($tmp===false)fail('Cache хадгалж чадсангүй.',503);
            try {if(file_put_contents($tmp,json_encode($cached,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX)===false)fail('Cache хадгалж чадсангүй.',503);chmod($tmp,0600);if(!rename($tmp,$file))fail('Cache хадгалж чадсангүй.',503);}finally{if(is_file($tmp))unlink($tmp);}
            if(is_file($retry))unlink($retry);
            if(is_file($missing))unlink($missing);
            return $cached;
        } catch(ApiError $e) {
            // A caller's local limit must never poison this product's shared cache.
            if($e->getCode()===429)throw $e;
            if($e->getCode()===404){
                file_put_contents($missing,(string)(time()+300),LOCK_EX);chmod($missing,0600);
                // Confirmed missing items must not be ordered from an earlier cached price.
                if(is_file($file))unlink($file);
                if(is_file($retry))unlink($retry);
                throw $e;
            }
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
// OT marks items whose stock it cannot read as IsUnknownQuantity; they are still on sale and
// SKU stock is validated at order time, so only other reasons block ordering.
function supplier_sellable(array $p): bool {
    if($p['IsFiltered']??false)return false;
    return ($p['IsSellAllowed']??false)===true||($p['SellDisallowReason']??'')==='IsUnknownQuantity';
}
// A search minimum may belong to a sold-out SKU. Advertise only a known purchasable price.
function supplier_stock_price(array $p,bool $detail=true): array {
    $min=max(1,(int)($p['FirstLotQuantity']??1));$prices=[];$unknown=false;
    if(!supplier_sellable($p))return ['cny'=>null,'price_status'=>'unavailable'];
    $variants=$p['ConfiguredItems']??[];
    if(!$variants&&!$detail)return ['cny'=>null,'price_status'=>'unverified'];
    if(!$variants)$variants=[['Price'=>$p['Price']??[],'Quantity'=>$p['MasterQuantity']??null]];
    foreach($variants as $v){
        if(($v['IsSellAllowed']??true)!==true)continue;
        $price=supplier_cny($v['Price']??[]);$stock=supplier_count($v['Quantity']??null);
        if($stock===null||$price===null){$unknown=true;continue;}
        if($stock>=$min&&$price>0)$prices[]=$price;
    }
    return ['cny'=>$prices?min($prices):null,'price_status'=>$prices?'available':($unknown?'unverified':'unavailable')];
}
// Read existing detail cache only: projecting a card never spends an API call.
function supplier_card_price(array $p,int $expires): array {
    try{$identity=supplier_identity($p['id']);}catch(ApiError){return $p;}
    $file=config()['data_dir'].'/supplier-cache/'.supplier_cache_key('/v1/'.$identity['provider'].'/product/'.$identity['number'],['language'=>'mn']).'.json';
    $cache=is_file($file)?json_decode(file_get_contents($file),true):null;
    if(is_array($cache)&&($cache['expires']??0)>time()&&empty($cache['stale'])&&isset($cache['data']['Item'])&&(string)($cache['data']['Item']['Id']??'')===($identity['provider']==='taobao'?$identity['number']:$p['id'])){
        $p=array_replace($p,supplier_stock_price($cache['data']['Item']));$expires=(int)$cache['expires'];
    }elseif(!isset($p['price_status'])||($p['price_expires']??$expires)<=time()){
        $p['cny']=null;$p['price_status']='unverified';
    }
    $p['price_expires']=$expires;$p['mnt']=$p['cny']===null?null:(int)ceil($p['cny']*shipping_settings()['cny_rate']);
    return $p;
}
function supplier_normalize(array $p,bool $detail=false,string $provider='alibaba1688'): array {
    $rawId=(string)($p['Id']??'');$taobao=$provider==='taobao';
    if(!preg_match($taobao?'/^\d{5,20}$/D':'/^abb-\d{5,20}$/D',$rawId)||!empty($p['HasError'])||(!empty($p['ProviderType'])&&$p['ProviderType']!==($taobao?'Taobao':'Alibaba1688')))fail('Нийлүүлэгчийн барааны мэдээлэл буруу.',503);
    $id=$taobao?'tb-'.$rawId:$rawId;$identity=supplier_identity($id);
    $price=supplier_cny($p['Price']??[]);$rate=shipping_settings()['cny_rate'];
    $r=['id'=>$id,'provider'=>$identity['provider'],'provider_label'=>$identity['label'],'name'=>mb_substr(trim((string)($p['Title']??''))?:((string)($p['OriginalTitle']??$id)),0,300),'image'=>supplier_image((string)($p['MainPictureUrl']??'')),'cny'=>$price,'mnt'=>$price===null?null:(int)ceil($price*$rate),'url'=>$taobao?'https://item.taobao.com/item.htm?id='.$identity['number']:'https://detail.1688.com/offer/'.$identity['number'].'.html','min_qty'=>max(1,(int)($p['FirstLotQuantity']??1)),'step'=>max(1,(int)($p['NextLotQuantity']??1)),'sellable'=>supplier_sellable($p),'variants'=>[]];
    $sold=filter_var($p['Volume']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>9007199254740991]]);
    $r['sold_count']=$sold===false?null:$sold;
    $featured=[];foreach($p['FeaturedValues']??[] as $feature)if(is_array($feature))$featured[(string)($feature['Name']??'')]=$feature['Value']??null;
    if($r['sold_count']===null){$total=supplier_count($featured['TotalSales']??null);if($total>0)$r['sold_count']=$total;}
    $r['sales_30_days']=supplier_count($featured['SalesInLast30Days']??null); // OT uses zero when sales volume is unknown.
    if($detail){
        $pictures=[$r['image']];foreach($p['Pictures']??[] as $picture){if(is_array($picture))$pictures[]=supplier_image((string)($picture['Url']??''));}
        $r['images']=array_slice(array_values(array_unique(array_filter($pictures))),0,20);
        $r['vendor_name']=supplier_text($p['VendorDisplayName']??$p['VendorName']??'',200);
        $r['vendor_id']=supplier_text($p['VendorId']??'',100);
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
        foreach($p['ConfiguredItems']??[] as $v){$variantImage='';foreach($v['Configurators']??[] as $a){$variantImage=$variantImages[($a['Pid']??'').'|'.($a['Vid']??'')]??$variantImage;}$labels=[];foreach($v['Configurators']??[] as $a)$labels[]=$attrs[($a['Pid']??'').'|'.($a['Vid']??'')]??($a['Vid']??'');$vp=($v['IsSellAllowed']??true)===true?supplier_cny($v['Price']??[]):null;$r['variants'][]=['id'=>(string)$v['Id'],'label'=>mb_substr(implode(' / ',$labels)?:'Стандарт',0,300),'cny'=>$vp,'image'=>$variantImage,'stock'=>supplier_count($v['Quantity']??null)];}
        if(!$r['variants'])$r['variants'][]=['id'=>'standard','label'=>'Стандарт · админ баталгаажуулна','cny'=>$price,'image'=>$r['image'],'stock'=>supplier_count($p['MasterQuantity']??null)];
        $r['description']=supplier_text($p['Description']??'',30000);
        $r['tiers']=[];foreach($p['QuantityRanges']??[] as $tier){$v=supplier_cny($tier['Price']??[]);if($v!==null)$r['tiers'][]=['qty'=>(int)$tier['MinQuantity'],'cny'=>$v];}
    }
    $r=array_replace($r,supplier_stock_price($p,$detail));$r['mnt']=$r['cny']===null?null:(int)ceil($r['cny']*$rate);
    return $r;
}
function supplier_search(array $b,bool $display=false): array {
    $q=mb_strtolower(preg_replace('/\s+/u',' ',str_field($b,'q',100,false)?:'bag'));$page=int_field($b,'page',1,100);$sort=str_field($b,'sort',20,false)?:'default';
    if(!in_array($sort,['default','price','-price','-volume'],true))fail('Эрэмбэ буруу.');
    if($q==='__all__'){if($display)supplier_snapshot_schedule();return supplier_snapshot_all($page,$sort);}
    if($display){$snapshot=supplier_snapshot_search($q,$page,$sort);if($snapshot!==null){supplier_snapshot_schedule();return $snapshot;}}
    $c=supplier_request('/v1/taobao/search',['language'=>'mn','item_title'=>$q,'page'=>$page,'limit'=>12,'sort'=>$sort],$display);
    if($display)supplier_schedule_warm();
    return supplier_search_result($c,$page);
}
// Image search: OT fetches the photo by URL, so a re-encoded JPEG is published under a content hash for 7 days.
function supplier_image_search_dir(): string { return dirname(__DIR__).'/assets/uploads/search'; }
function supplier_image_search_upload(): array {
    if(!supplier_ready()||!shipping_settings()['image_search_enabled'])fail('Зургаар хайх үйлчилгээ түр идэвхгүй байна.',503);
    limit_attempts('supplier-image-upload:'.($_SERVER['REMOTE_ADDR']??'cli'),20,3600);
    $f=$_FILES['image']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||$f['size']>5*1024*1024)fail('5 MB хүртэл зураг сонгоно уу.');
    $info=@getimagesize($f['tmp_name']);if(!$info||!in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true)||$info[0]*$info[1]>12000000)fail('JPEG, PNG, WebP зураг (12 MP хүртэл) оруулна уу.');
    if(!function_exists('imagecreatefromstring'))fail('Серверт GD өргөтгөл шаардлагатай.',503);
    $image=@imagecreatefromstring(file_get_contents($f['tmp_name']));if(!$image)fail('Зураг уншигдсангүй.');
    $scale=min(1,800/max(imagesx($image),imagesy($image)));$width=max(1,(int)round(imagesx($image)*$scale));$height=max(1,(int)round(imagesy($image)*$scale));
    $canvas=imagecreatetruecolor($width,$height);imagefill($canvas,0,0,imagecolorallocate($canvas,255,255,255));imagecopyresampled($canvas,$image,0,0,0,0,$width,$height,imagesx($image),imagesy($image));
    ob_start();$ok=imagejpeg($canvas,null,85);$jpeg=(string)ob_get_clean();imagedestroy($canvas);imagedestroy($image);
    if(!$ok||$jpeg==='')fail('Зураг хадгалагдсангүй.',503);
    $dir=supplier_image_search_dir();if(!is_dir($dir)&&!mkdir($dir,0755,true))fail('Зураг хадгалагдсангүй.',503);
    foreach(array_slice(glob($dir.'/*.jpg')?:[],0,500) as $old)if(filemtime($old)<time()-604800)@unlink($old);
    $hash=substr(hash('sha256',$jpeg),0,32);$path=$dir.'/'.$hash.'.jpg';
    if(!is_file($path)){$tmp=tempnam($dir,'write-');if($tmp===false||file_put_contents($tmp,$jpeg,LOCK_EX)===false||!chmod($tmp,0644)||!rename($tmp,$path)){if($tmp&&is_file($tmp))unlink($tmp);fail('Зураг хадгалагдсангүй.',503);}}
    else touch($path);
    return ['image'=>$hash];
}
function supplier_image_search(string $hash,int $page,bool $display=false): array {
    if(!preg_match('/^[a-f0-9]{32}$/D',$hash))fail('Зургийн дугаар буруу.');
    if(!shipping_settings()['image_search_enabled'])fail('Зургаар хайх үйлчилгээ түр идэвхгүй байна.',503);
    if(!is_file(supplier_image_search_dir().'/'.$hash.'.jpg'))fail('Хайлтын зургийн хугацаа дууссан. Зургаа дахин оруулна уу.',404);
    if($page<1||$page>100)fail('Хуудасны дугаар буруу.');
    $c=supplier_request('/v1/taobao/search',['language'=>'mn','image_url'=>rtrim(config()['site_url'],'/').'/assets/uploads/search/'.$hash.'.jpg','page'=>$page,'limit'=>12],$display);
    return supplier_search_result($c,$page)+['image'=>$hash];
}
function supplier_search_result(array $c,int $page): array {
    $block=$c['data']['Items']??[];$items=[];foreach($block['Items']['Content']??[] as $p){try{$items[]=supplier_card_price(supplier_normalize($p,false,'taobao'),(int)$c['expires']);}catch(ApiError){}}
    return ['products'=>$items,'page'=>$page,'more'=>count($items)===12&&$page<min(100,(int)($block['MaximumPageCount']??100))&&$page*12<(int)($block['Items']['TotalCount']??PHP_INT_MAX),'fetched'=>$c['fetched'],'stale'=>$c['stale'],'cache_expires'=>(int)$c['expires'],'cache_ttl'=>$c['stale']?0:max(0,(int)$c['expires']-time()),'shipping'=>shipping_public()];
}
function supplier_detail(string $id,bool $display=false): array {
    $identity=supplier_identity($id);
    $c=supplier_request('/v1/'.$identity['provider'].'/product/'.$identity['number'],['language'=>'mn'],$display);
    $p=supplier_normalize($c['data']['Item']??[],true,$identity['provider']);if($p['id']!==$id)fail('Барааны дугаар таарахгүй байна.',503);
    $p['price_expires']=(int)$c['expires'];
    $p['category_path']=[];foreach(array_reverse($c['data']['RootPath']['Content']??[]) as $category){$name=supplier_text($category['Name']??'',150);if($name!=='')$p['category_path'][]=$name;}
    $p['related']=[];$seen=[$p['id']=>true];foreach(array_merge($c['data']['VendorItems']['Content']??[],$c['data']['RecommendedItems']['Content']??[]) as $item){try{$related=supplier_card_price(supplier_normalize($item,false,$identity['provider']),(int)$c['expires']);if(!isset($seen[$related['id']])){$seen[$related['id']]=true;$p['related'][]=$related;}if(count($p['related'])>=12)break;}catch(ApiError){}}
    return ['product'=>$p,'fetched'=>$c['fetched'],'stale'=>$c['stale'],'cache_expires'=>(int)$c['expires'],'cache_ttl'=>$c['stale']?0:max(0,(int)$c['expires']-time()),'shipping'=>shipping_public()];
}
function supplier_order(array $b): array {
    $d=supplier_detail(str_field($b,'product_id',50));$p=$d['product'];
    if($d['stale']||!$p['sellable'])fail('Барааны худалдаалах нөхцөлийг шинэчилж чадсангүй. Дараа дахин оролдоно уу.',409);
    $sku=str_field($b,'sku',150);$variant=null;foreach($p['variants'] as $v)if($v['id']===$sku)$variant=$v;
    if(!$variant||$variant['cny']===null)fail('Барааны хувилбар эсвэл үнэ тодорхойгүй байна.',409);
    $qty=int_field($b,'qty',1,9999);if($qty<$p['min_qty']||($qty-$p['min_qty'])%$p['step']!==0||($variant['stock']!==null&&$qty>$variant['stock']))fail('Багцын тоо эсвэл үлдэгдлийг шалгана уу.');
    // Supplier variants and quantity discounts require an operator's final quote.
    return ['id'=>$p['id'],'provider'=>$p['provider'],'sku'=>$sku,'name'=>$p['name'],'variant'=>$variant['label'],'qty'=>$qty,'unit_cny'=>$variant['cny'],'goods_cny'=>round($variant['cny']*$qty,2),'url'=>$p['url'],'image'=>$p['image'],'vendor_id'=>$p['vendor_id']??'','fetched'=>$d['fetched'],'rate'=>shipping_settings()['cny_rate']];
}

require_once __DIR__.'/supplier-snapshot.php';
