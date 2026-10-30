<?php
declare(strict_types=1);
require_once __DIR__.'/product-policy.php';
require_once __DIR__.'/supplier-brands.php';
require_once __DIR__.'/supplier-titles.php';
require_once __DIR__.'/supplier-budget.php';
function tw_catalog_enabled(): bool {
    if((shipping_settings()['catalog_provider']??'otcommerce')!=='taoworld')return false;
    require_once __DIR__.'/taoworld-catalog.php';return true;
}
const SUPPLIER_PURCHASE_MAX_AGE = 120;
class SupplierBusy extends ApiError {
    public function __construct(){parent::__construct('Барааны мэдээлэл ачаалахад удаж байна. Дахин ачаална уу.',503);}
}
// Wait briefly for an existing lookup instead of failing concurrent visitors immediately.
// A single deadline bounds the combined cache-key and provider-slot wait.
function supplier_acquire_lock(array $paths,float $deadline) {
    $handles=[];
    try{
        foreach($paths as $path){$h=fopen($path,'c');if(!$h)fail('Барааны мэдээлэл түр авах боломжгүй байна.',503);$handles[]=$h;}
        do{
            foreach($handles as $i=>$h)if(flock($h,LOCK_EX|LOCK_NB)){unset($handles[$i]);clearstatcache();return $h;}
            if(microtime(true)>=$deadline)return null;
            usleep(50000);
        }while(true);
    }finally{foreach($handles as $h)fclose($h);}
}

// New catalog uses Taobao. Explicit local prefixes keep legacy 1688 IDs unambiguous.
function supplier_identity(string $id): array {
    if(!preg_match('/^(abb|tb)-(\d{5,20})$/D',$id,$m))fail('Нийлүүлэгчийн барааны дугаар буруу.');
    return ['provider'=>$m[1]==='tb'?'taobao':'alibaba1688','number'=>$m[2],'label'=>$m[1]==='tb'?'Taobao':'1688'];
}
// Language for OT titles and attributes. The OT key must have the language enabled; otherwise OT keeps returning Mongolian.
function supplier_language(): string { return (shipping_settings()['catalog_language']??'mn')==='en'?'en':'mn'; }
function supplier_ready(): bool { return shipping_settings()['supplier_enabled'] && (tw_catalog_enabled()? !empty(taoworld_state()['access_token']):!empty(config()['otcommerce']['api_key'])); }
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
        try {supplier_request($path,$query,false,true,true);}catch(Throwable $e){error_log('GOStore supplier background refresh deferred');}
        finally {flock($lock,LOCK_UN);fclose($lock);}
    });
}
// Warm only fixed storefront departments, after the visitor has received their response.
function supplier_warm_queries(): array {return ['home storage','electronics','bag','men shoes','jewelry accessories','beauty','lamp','men clothing','women clothing','kids clothing','women shoes','kitchen utensils','home appliances','furniture','home decoration','baby products','toys','sports equipment','camping equipment','car accessories','tools','garden supplies','pet supplies','office supplies','personal care'];}
function supplier_schedule_warm(): void {
    if(!empty(shipping_settings()['catalog_snapshot_enabled'])){supplier_snapshot_schedule();return;}
    if(!function_exists('fastcgi_finish_request')||!supplier_ready())return;
    $dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))return;
    $pause=$dir.'/warm.retry';if(is_file($pause)&&(int)file_get_contents($pause)>time())return;
    $lock=fopen($dir.'/background.lock','c');if(!$lock)return;
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return;}
    $next=null;
    foreach(supplier_warm_queries() as $q){
        $query=['language'=>supplier_language(),'item_title'=>$q,'page'=>1,'limit'=>12,'sort'=>'default'];$file=$dir.'/'.supplier_cache_key('/v1/taobao/search',$query).'.json';
        $v=is_file($file)?json_decode(file_get_contents($file),true):null;
        if(is_array($v)&&is_array($v['data']??null)&&($v['expires']??0)>time())continue;
        if(is_file($file.'.retry')&&(int)file_get_contents($file.'.retry')>time())continue;
        $next=$query;break;
    }
    if($next===null){flock($lock,LOCK_UN);fclose($lock);return;}
    register_shutdown_function(static function()use($next,$lock,$pause){
        ignore_user_abort(true);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();fastcgi_finish_request();
        try{
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
    // Optional offer lookup failure must not hide an otherwise verified product.
    if($ok&&$status===200&&$path==='/service-json/BatchGetItemFullInfo'&&($response['ErrorCode']??'')==='BatchError'&&is_array($response['Result']['Item']??null)&&!empty($response['Result']['PromotionsError'])&&empty($response['Result']['ItemError'])&&empty($response['Result']['VendorError'])&&empty($response['Result']['Item']['HasError'])){
        $response['Result']['Item']['Promotions']=[];$response['Result']['Item']['IsValidPromotions']=false;return $response['Result'];
    }
    // A missing product is not a temporary gateway failure or an API-key problem.
    if($ok&&$status===404&&($response['error']??null)==='not_found'&&preg_match('#^/v1/(?:taobao|alibaba1688)/product/\d+$#D',$path)){
        fail('Нийлүүлэгчээс энэ барааны мэдээлэл олдсонгүй. Каталогоос өөр бараа сонгоно уу.',404);
    }
    if(!$ok||$status!==200||!is_array($response)||($response['ErrorCode']??'')!=='Ok'||!is_array($response['Result']??null))fail('Нийлүүлэгчийн мэдээлэл одоогоор авах боломжгүй. API эрх эсвэл лимитийг админ шалгана уу.',503);
    return $response['Result'];
}
function supplier_limits(bool $warming,bool $purchase=false): void {
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
    try {supplier_budget_take($warming,$purchase);}
    catch(ApiError $e){
        if($e->getCode()!==429)throw $e;
        fail('Сайтын шинэ мэдээлэл авах өдрийн API лимит дууссан байна. Хадгалсан мэдээлэлтэй барааг үргэлжлүүлэн үзэж болно.',429);
    }
}
function supplier_request(string $path,array $query,bool $display=false,bool $force=false,bool $warming=false,?int $refreshAge=null,bool $purchase=false): array {
    $cache=supplier_raw_request($path,$query,$display,$force,$warming,$refreshAge,$purchase);
    return supplier_english_titles($cache,$path,$query,$display,$warming);
}
function supplier_raw_request(string $path,array $query,bool $display=false,bool $force=false,bool $warming=false,?int $refreshAge=null,bool $purchase=false): array {
    $native=in_array($path,['/service-json/BatchSearchItemsFrame','/service-json/BatchGetItemFullInfo'],true);$refreshWindow=$native?60:1800;
    if(!supplier_ready())fail('Нийлүүлэгчийн каталог түр идэвхгүй байна. Дараа дахин оролдоно уу.',503);
    $dir=config()['data_dir'].'/supplier-cache';if(!is_dir($dir))mkdir($dir,0700,true);
    $key=supplier_cache_key($path,$query);$file=$dir.'/'.$key.'.json';
    $missing=$file.'.missing';
    if(is_file($missing)&&(int)file_get_contents($missing)>time())fail('Нийлүүлэгчээс энэ барааны мэдээлэл олдсонгүй. Каталогоос өөр бараа сонгоно уу.',404);
    $read=static function()use($file){clearstatcache(true,$file);$v=is_file($file)?json_decode(file_get_contents($file),true):null;return is_array($v)&&isset($v['data'],$v['fetched'],$v['expires'])&&is_array($v['data'])&&is_numeric($v['expires'])?$v:null;};
    $cached=$read();
    if($cached&&$cached['expires']>time()&&!$force){
        if($display&&$cached['expires']-time()<$refreshWindow)supplier_schedule_refresh($path,$query,$dir);
        return $cached;
    }
    // Browsing may use one day's stale data; ordering uses the strict path below.
    if($display&&$cached&&$cached['expires']>time()-86400){supplier_schedule_refresh($path,$query,$dir);$cached['stale']=true;return $cached;}
    $retry=$file.'.retry';
    if(is_file($retry)&&(int)file_get_contents($retry)>time()){
        if($cached&&!$display){$cached['stale']=$cached['expires']<=time();return $cached;}
        fail('Нийлүүлэгчийн мэдээллийг шинэчилж байна. Түр хүлээгээд дахин оролдоно уу.',503);
    }
    $deadline=microtime(true)+($warming?0:8);
    $lock=supplier_acquire_lock([$dir.'/'.$key.'.lock'],$deadline);
    if(!$lock){if($cached&&$force)return $cached;throw new SupplierBusy();}
    try {
        if(is_file($missing)&&(int)file_get_contents($missing)>time())fail('Нийлүүлэгчээс энэ барааны мэдээлэл олдсонгүй. Каталогоос өөр бараа сонгоно уу.',404);
        $cached=$read();if($cached&&$cached['expires']>time()&&(!$force||($refreshAge===null?$cached['expires']-time()>=$refreshWindow:strtotime((string)$cached['fetched'])>time()-$refreshAge)))return $cached;
        if(is_file($retry)&&(int)file_get_contents($retry)>time()){if($cached){$cached['stale']=$cached['expires']<=time();return $cached;}fail('Нийлүүлэгчийн холболтыг түр хүлээнэ үү.',503);}
        // Background refresh/translation uses only slot 1, leaving slot 0 for shoppers.
        // Still at most two provider calls globally, with no quota charged while waiting.
        $slot=supplier_acquire_lock(array_map(fn($i)=>$dir.'/network-'.$i.'.lock',$warming?[1]:[0,1]),$deadline);
        if(!$slot){if($cached&&$force)return $cached;throw new SupplierBusy();}
        try {
            supplier_limits($warming,$purchase);
            if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')fail('Туршилтын орчинд нийлүүлэгчийн дуудлагыг хаасан.',503);
            $ch=curl_init($native?'https://otapi.net'.$path:'https://rest.otapi.net'.$path.'?'.http_build_query($query));$raw='';
            curl_setopt_array($ch,[CURLOPT_HTTPHEADER=>['X-Api-Key: '.config()['otcommerce']['api_key'],'Accept: application/json'],CURLOPT_ENCODING=>'',CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>35,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>12000000)return 0;$raw.=$chunk;return strlen($chunk);}]);
            if($native)curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($query+['instanceKey'=>config()['otcommerce']['api_key']]),CURLOPT_HTTPHEADER=>['Accept: application/json','Content-Type: application/x-www-form-urlencoded']]);
            $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
            $result=supplier_response($path,$ok!==false,$status,$raw);
            $cached=['data'=>$result,'fetched'=>gmdate('c'),'expires'=>time()+($native?600:21600),'stale'=>false];
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
// Machine-translated Taobao titles: drop store tags, Chinese fragments, ad phrases and repeated words.
// Idempotent, so names already stored in snapshots are cleaned again when read.
function supplier_clean_title(string $title): string {
    $t=preg_replace('/[\x{200B}-\x{200D}\x{2060}\x{FEFF}]/u','',$title)??$title;
    $t=preg_replace('/^\s*[\[【(（][^\[\]【】()（）]{1,40}[\]】)）]\s*/u','',$t)??$t;          // [Өөртөө ажилладаг], 【…】
    $t=preg_replace('/^\s*[\[【]([^\[\]【】]{41,120})[\]】]\s*/u','$1, ',$t)??$t;             // long feature note: keep it as text
    $t=preg_replace('/[\[【](?![^\[\]【】]*[\]】])/u','',$t)??$t;                                // unclosed opening bracket
    $t=preg_replace('/[\x{3000}-\x{303F}\x{3400}-\x{9FFF}\x{FF00}-\x{FFEF}]+/u',' ',$t)??$t; // Chinese characters and punctuation
    $t=preg_replace('/үнэгүй\s+хүргэлт(?:тэй)?/iu','',$t)??$t;
    $t=preg_replace('/(*UCP)(?<!\S)(\S+)(?:[\s,]+\1(?!\S))+/iu','$1',$t)??$t;               // Stent Stent Stent → Stent
    $t=preg_replace('/\s+/u',' ',$t)??$t;
    // trim() works on bytes and would cut Cyrillic letters sharing a byte with «·», so edges are trimmed by regex.
    $edge=static fn(string $s,string $chars)=>preg_replace('/^['.$chars.']+|['.$chars.']+$/u','',$s)??$s;
    $segments=[];foreach(explode(',',$t) as $s){$s=$edge($s,'\s\-\/·');$k=mb_strtolower($s);if($s!==''&&!isset($segments[$k]))$segments[$k]=$s;}
    $t=implode(', ',$segments);
    $t=$edge($t,'\s,.\-\/·');
    return $t===''?trim($title):mb_strtoupper(mb_substr($t,0,1)).mb_substr($t,1);
}
// Keep the provider's comparable price pair in CNY so snapshots can apply today's rate.
function supplier_discount_source(array $item): ?array {
    $price=$item['Price']??[];
    $current=supplier_cny($price);$original=supplier_cny($price['PriceWithoutDiscountAndDelivery']??[]);
    return $current!==null&&$original!==null&&$original>$current?['current_cny'=>$current,'original_cny'=>$original]:null;
}
function supplier_card_price(array $p,int $expires): array {
    product_policy_assert($p);
    $p['discount_expires']=$p['discount_expires']??$expires;
    $english=supplier_title_read((string)($p['id']??''));
    if($english!==null)$p['name']=$english;
    product_policy_assert($p);
    if(isset($p['name'])&&is_string($p['name']))$p['name']=supplier_clean_title($p['name']);
    try{$identity=supplier_identity($p['id']);}catch(ApiError){return $p;}
    $file=config()['data_dir'].'/supplier-cache/'.supplier_cache_key('/v1/'.$identity['provider'].'/product/'.$identity['number'],['language'=>supplier_language()]).'.json';
    $cache=is_file($file)?json_decode(file_get_contents($file),true):null;
    if(is_array($cache['data']['Item']??null))product_policy_assert($cache['data']['Item']);
    if(is_array($cache)&&($cache['expires']??0)>time()&&empty($cache['stale'])&&isset($cache['data']['Item'])&&(string)($cache['data']['Item']['Id']??'')===($identity['provider']==='taobao'?$identity['number']:$p['id'])){
        $p=array_replace($p,supplier_stock_price($cache['data']['Item']));$expires=(int)$cache['expires'];
        $p['discount_source']=supplier_discount_source($cache['data']['Item']);$p['discount_expires']=$expires;
    }elseif(!isset($p['price_status'])||($p['price_expires']??$expires)<=time()){
        $p['cny']=null;$p['price_status']='unverified';
    }
    $p['price_expires']=$expires;$rate=shipping_settings()['cny_rate'];$p['mnt']=$p['cny']===null?null:(int)ceil($p['cny']*$rate);
    $p['approx_mnt']=($p['price_status']??'')!=='available'&&($p['approx_cny']??0)>0?(int)ceil($p['approx_cny']*$rate):null;
    $p['card_discount']=null;$source=$p['discount_source']??null;
    $shown=($p['price_status']??'')==='available'?$p['cny']:($p['approx_cny']??null);
    // A base-price promotion must never be attached to a different in-stock SKU price.
    if($source&&$p['discount_expires']>time()&&($p['price_status']??'')!=='unavailable'&&$shown!==null&&(float)$shown===(float)$source['current_cny']){
        $current=(int)ceil($source['current_cny']*$rate);$original=(int)ceil($source['original_cny']*$rate);
        if($original>$current)$p['card_discount']=['current_mnt'=>$current,'was_mnt'=>$original,'percent'=>(int)floor(round(($source['original_cny']-$source['current_cny'])/$source['original_cny']*100,8)),'expires'=>(int)$p['discount_expires']];
    }
    return $p;
}
function supplier_normalize(array $p,bool $detail=false,string $provider='alibaba1688'): array {
    product_policy_assert($p);
    $rawId=(string)($p['Id']??'');$taobao=$provider==='taobao';
    if(!preg_match($taobao?'/^\d{5,20}$/D':'/^abb-\d{5,20}$/D',$rawId)||!empty($p['HasError'])||(!empty($p['ProviderType'])&&$p['ProviderType']!==($taobao?'Taobao':'Alibaba1688')))fail('Нийлүүлэгчийн барааны мэдээлэл буруу.',503);
    $id=$taobao?'tb-'.$rawId:$rawId;$identity=supplier_identity($id);
    $price=supplier_cny($p['Price']??[]);$rate=shipping_settings()['cny_rate'];
    $r=['id'=>$id,'provider'=>$identity['provider'],'provider_label'=>$identity['label'],'name'=>mb_substr(supplier_clean_title(trim((string)($p['Title']??''))?:((string)($p['OriginalTitle']??$id))),0,300),'image'=>supplier_image((string)($p['MainPictureUrl']??'')),'cny'=>$price,'mnt'=>$price===null?null:(int)ceil($price*$rate),'url'=>$taobao?'https://item.taobao.com/item.htm?id='.$identity['number']:'https://detail.1688.com/offer/'.$identity['number'].'.html','min_qty'=>max(1,(int)($p['FirstLotQuantity']??1)),'step'=>max(1,(int)($p['NextLotQuantity']??1)),'sellable'=>supplier_sellable($p),'variants'=>[]];
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
    // Search results lack per-SKU stock; their listed price is shown only as an approximate "from" price.
    $r['approx_cny']=$r['cny']===null?supplier_cny($p['Price']??[]):null;
    $r['discount_source']=supplier_discount_source($p);
    return $r;
}
// Optional MNT price bounds; OT filters in CNY, so they are converted with the current rate.
function supplier_price_range(array $b): array {
    $range=[];
    foreach(['price_min','price_max'] as $key){
        $v=$b[$key]??'';if($v===''||$v===null)continue;
        $n=filter_var($v,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>100000000]]);if($n===false)fail('Үнийн шүүлтүүр буруу.');$range[$key]=$n;
    }
    if(isset($range['price_min'],$range['price_max'])&&$range['price_min']>$range['price_max'])fail('Доод үнэ дээд үнээс их байна.');
    return $range;
}
function supplier_page_size(array $b): int {
    $limit=filter_var($b['limit']??12,FILTER_VALIDATE_INT);
    if(!in_array($limit,[12,50],true))fail('Барааны тоо буруу.');
    return $limit;
}
function supplier_search(array $b,bool $display=false): array {
    if(tw_catalog_enabled())return tw_catalog_search($b,$display);
    $limit=supplier_page_size($b);
    if(($b['brand']??'')!=='')return supplier_brand_search($b,$display);
    $q=mb_strtolower(preg_replace('/\s+/u',' ',str_field($b,'q',100,false)?:'bag'));$page=int_field($b,'page',1,100);$sort=str_field($b,'sort',20,false)?:'default';
    if(!in_array($sort,['default','price','-price','-volume','-updated_time'],true))fail('Эрэмбэ буруу.');
    $range=supplier_price_range($b);
    if(product_policy_text_blocked($q))return ['products'=>[],'page'=>$page,'total'=>0,'pages'=>$page,'more'=>false,'fetched'=>gmdate('c'),'stale'=>false,'cache_expires'=>0,'cache_ttl'=>0,'shipping'=>shipping_public()];
    if($q==='__all__'){if($display)supplier_snapshot_schedule();return supplier_snapshot_all($page,$sort,$range,$limit);}
    if($display&&!$range&&$limit===12){$snapshot=supplier_snapshot_search($q,$page,$sort);if($snapshot!==null){supplier_snapshot_schedule();return supplier_price_order_result($snapshot,$sort);}}
    $query=['language'=>supplier_language(),'item_title'=>$q,'page'=>$page,'limit'=>$limit,'sort'=>$sort];$rate=shipping_settings()['cny_rate'];
    if(isset($range['price_min']))$query['price_min']=number_format($range['price_min']/$rate,2,'.','');
    if(isset($range['price_max']))$query['price_max']=number_format($range['price_max']/$rate,2,'.','');
    $c=supplier_request('/v1/taobao/search',$query,$display);
    if($display)supplier_schedule_warm();
    return supplier_price_order_result(supplier_search_result($c,$page,$limit),$sort);
}
// The shown price: verified SKU price first, otherwise the approximate search price; unknown is null.
function supplier_display_price(array $p): ?int {
    return ($p['price_status']??'')==='available'?($p['mnt']??null):($p['approx_mnt']??null);
}
// Explicit ascending price sort. The default keeps supplier relevance.
function supplier_price_order(array $products): array {
    foreach($products as $i=>&$p)$p['_order']=$i;unset($p);
    usort($products,static function($a,$b){
        $ua=($a['price_status']??'')==='unavailable';$ub=($b['price_status']??'')==='unavailable';if($ua!==$ub)return $ua?1:-1; // not orderable: last
        $pa=supplier_display_price($a);$pb=supplier_display_price($b);
        if(($pa===null)!==($pb===null))return $pa===null?1:-1;return ($pa<=>$pb)?:($a['_order']<=>$b['_order']);});
    foreach($products as &$p)unset($p['_order']);unset($p);
    return $products;
}
function supplier_price_order_result(array $r,string $sort): array {
    if($sort==='price')$r['products']=supplier_price_order($r['products']??[]);
    return $r;
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
function supplier_image_search(string $hash,int $page,bool $display=false,int $limit=12): array {
    $limit=supplier_page_size(['limit'=>$limit]);
    if(!preg_match('/^[a-f0-9]{32}$/D',$hash))fail('Зургийн дугаар буруу.');
    if(!shipping_settings()['image_search_enabled'])fail('Зургаар хайх үйлчилгээ түр идэвхгүй байна.',503);
    if(!is_file(supplier_image_search_dir().'/'.$hash.'.jpg'))fail('Хайлтын зургийн хугацаа дууссан. Зургаа дахин оруулна уу.',404);
    if($page<1||$page>100)fail('Хуудасны дугаар буруу.');
    if(tw_catalog_enabled())return tw_catalog_image($hash,$page,$limit);
    $c=supplier_request('/v1/taobao/search',['language'=>supplier_language(),'image_url'=>rtrim(config()['site_url'],'/').'/assets/uploads/search/'.$hash.'.jpg','page'=>$page,'limit'=>$limit],$display);
    return supplier_search_result($c,$page,$limit)+['image'=>$hash];
}
function supplier_search_result(array $c,int $page,int $limit=12): array {
    $block=$c['data']['Items']??[];$items=[];foreach($block['Items']['Content']??[] as $p){try{
        $card=supplier_normalize($p,false,'taobao');$card['discount_expires']=empty($c['stale'])?(int)$c['expires']:0;
        $items[]=supplier_card_price($card,(int)$c['expires']);
    }catch(ApiError){}}
    $total=filter_var($block['Items']['TotalCount']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>0]]);
    $pages=min(100,max($page,(int)($block['MaximumPageCount']??100)),$total===false?100:max($page,(int)ceil($total/$limit)));
    return ['products'=>$items,'page'=>$page,'total'=>$total===false?null:$total,'pages'=>$pages,'more'=>count($block['Items']['Content']??[])===$limit&&$page<min(100,(int)($block['MaximumPageCount']??100))&&$page*$limit<(int)($block['Items']['TotalCount']??PHP_INT_MAX),'fetched'=>$c['fetched'],'stale'=>$c['stale'],'cache_expires'=>(int)$c['expires'],'cache_ttl'=>$c['stale']?0:max(0,(int)$c['expires']-time()),'shipping'=>shipping_public()];
}
// The OT catalog already returns related items inside the product detail.
function supplier_recommend(string $id): array {
    if(tw_catalog_enabled())return tw_catalog_recommend($id);
    return ['products'=>[],'fetched'=>gmdate('c'),'stale'=>false,'cache_ttl'=>0,'shipping'=>shipping_public()];
}
function supplier_detail(string $id,bool $display=false,string $brandId='',bool $purchase=false): array {
    if(tw_catalog_enabled())return tw_catalog_detail($id,$purchase,$brandId);
    $identity=supplier_identity($id);
    product_policy_assert(['id'=>$id]);
    if($brandId!==''){
        $brand=supplier_brand($brandId);if($identity['provider']!=='taobao')fail('Брэндийн барааны дугаар буруу.');
        $c=supplier_request('/service-json/BatchGetItemFullInfo',['language'=>supplier_language(),'itemId'=>$identity['number'],'blockList'=>'Promotions,Vendor,RootPath,Description,MostPopularVendorItems16'],$display);
        supplier_brand_assert_vendor($c['data']['Vendor']??[],$brand);
        if(!supplier_brand_item_matches($c['data']['Item']??[],$brand))fail('Энэ бараа сонгосон дэлгүүрт хамаарахгүй байна.',404);
    }else $c=supplier_request('/v1/'.$identity['provider'].'/product/'.$identity['number'],['language'=>supplier_language()],$display,$purchase,false,$purchase?SUPPLIER_PURCHASE_MAX_AGE:null,$purchase);
    // Backoff, lock contention and network errors may return display cache. Never order from that fallback.
    $age=time()-(strtotime((string)($c['fetched']??''))?:0);
    if($purchase&&($age<0||$age>=SUPPLIER_PURCHASE_MAX_AGE||!empty($c['stale'])||$c['expires']<=time()))fail('Үнэ, үлдэгдлийг шинэчилж чадсангүй. Түр хүлээгээд дахин оролдоно уу.',409);
    product_policy_assert(($c['data']['Item']??[])+['RootPath'=>$c['data']['RootPath']??[]]);
    $p=supplier_normalize($c['data']['Item']??[],true,$identity['provider']);if($p['id']!==$id)fail('Барааны дугаар таарахгүй байна.',503);
    $p['price_expires']=(int)$c['expires'];
    if($brandId!==''){$p['brand_id']=$brandId;$p['brand_name']=$brand['name'];$p['offers']=supplier_offers($c['data']['Item'],$c);$p['offers_available']=empty($c['data']['PromotionsError'])&&!$c['stale'];}
    $p['category_path']=[];foreach(array_reverse($c['data']['RootPath']['Content']??[]) as $category){$name=supplier_text($category['Name']??'',150);if($name!=='')$p['category_path'][]=$name;}
    $p['related']=[];$seen=[$p['id']=>true];foreach(array_merge($c['data']['VendorItems']['Content']??[],$c['data']['RecommendedItems']['Content']??[]) as $item){try{$related=supplier_card_price(supplier_normalize($item,false,$identity['provider']),(int)$c['expires']);if(!isset($seen[$related['id']])){$seen[$related['id']]=true;$p['related'][]=$related;}if(count($p['related'])>=12)break;}catch(ApiError){}}
    return ['product'=>$p,'fetched'=>$c['fetched'],'stale'=>$c['stale'],'cache_expires'=>(int)$c['expires'],'cache_ttl'=>$c['stale']?0:max(0,(int)$c['expires']-time()),'shipping'=>shipping_public()];
}
function supplier_order(array $b): array {
    $d=supplier_detail(str_field($b,'product_id',50),false,'',true);$p=$d['product'];
    if($d['stale']||!$p['sellable'])fail('Барааны худалдаалах нөхцөлийг шинэчилж чадсангүй. Дараа дахин оролдоно уу.',409);
    $sku=str_field($b,'sku',150);$variant=null;foreach($p['variants'] as $v)if($v['id']===$sku)$variant=$v;
    if(!$variant||$variant['cny']===null)fail('Барааны хувилбар эсвэл үнэ тодорхойгүй байна.',409);
    $qty=int_field($b,'qty',1,9999);if($qty<$p['min_qty']||($qty-$p['min_qty'])%$p['step']!==0||($variant['stock']!==null&&$qty>$variant['stock']))fail('Багцын тоо эсвэл үлдэгдлийг шалгана уу.');
    // Supplier variants and quantity discounts require an operator's final quote.
    return ['id'=>$p['id'],'provider'=>$p['provider'],'catalog_provider'=>$p['catalog_provider']??'otcommerce','sku'=>$sku,'name'=>$p['name'],'variant'=>$variant['label'],'qty'=>$qty,'unit_cny'=>$variant['cny'],'goods_cny'=>round($variant['cny']*$qty,2),'url'=>$p['url'],'image'=>$p['image'],'vendor_id'=>$p['vendor_id']??'','fetched'=>$d['fetched'],'rate'=>shipping_settings()['cny_rate']];
}

require_once __DIR__.'/supplier-snapshot.php';

