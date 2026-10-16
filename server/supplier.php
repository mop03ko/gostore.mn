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
function supplier_public_json(array $data): never {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    $ttl=min(60,(int)($data['cache_ttl']??0));
    header('Cache-Control: '.($ttl>0?'public, max-age='.$ttl.', must-revalidate':'no-store'));
    echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
}
function supplier_request(string $path,array $query,bool $display=false,bool $force=false): array {
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
    $lock=fopen($dir.'/request.lock','c');if(!$lock)fail('Нийлүүлэгчийн холболт завгүй байна.',503);
    if(!flock($lock,LOCK_EX|(($display||$force)?LOCK_NB:0))){fclose($lock);if($cached&&$force)return $cached;fail('Нийлүүлэгчийн холболт завгүй байна. Түр хүлээгээд дахин оролдоно уу.',503);}
    try {
        $cached=$read();if($cached&&$cached['expires']>time()&&(!$force||$cached['expires']-time()>=1800))return $cached;
        if(is_file($retry)&&(int)file_get_contents($retry)>time()){if($cached){$cached['stale']=$cached['expires']<=time();return $cached;}fail('Нийлүүлэгчийн холболтыг түр хүлээнэ үү.',503);}
        // A single lock and daily budget prevent concurrent public searches exhausting the trial.
        try {
            if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')fail('Туршилтын орчинд нийлүүлэгчийн дуудлагыг хаасан.',503);
            limit_attempts('supplier-ip:'.($_SERVER['REMOTE_ADDR']??'cli'),10,3600);
            limit_attempts('supplier-budget:'.gmdate('Y-m-d'),shipping_settings()['api_daily_limit'],86400);
            $ch=curl_init('https://rest.otapi.net'.$path.'?'.http_build_query($query));$raw='';
            curl_setopt_array($ch,[CURLOPT_HTTPHEADER=>['X-Api-Key: '.config()['otcommerce']['api_key'],'Accept: application/json'],CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>35,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_WRITEFUNCTION=>static function($ch,$chunk)use(&$raw){if(strlen($raw)+strlen($chunk)>12000000)return 0;$raw.=$chunk;return strlen($chunk);}]);
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
        }
    } finally {flock($lock,LOCK_UN);fclose($lock);}
}
function supplier_cny(array $p): ?float {
    if(($p['OriginalCurrencyCode']??'')!=='CNY'||!is_numeric($p['OriginalPrice']??null))return null;
    $v=(float)$p['OriginalPrice'];return is_finite($v)&&$v>0&&$v<=1000000?$v:null;
}
function supplier_image(string $url): string {
    $url=preg_replace('#^http://#','https://',$url);$p=parse_url($url);$host=strtolower($p['host']??'');
    if(($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['port']))return '';
    foreach(['alicdn.com','otcommerce.com','otapi.net'] as $domain)if($host===$domain||str_ends_with($host,'.'.$domain))return $url;
    return '';
}
function supplier_normalize(array $p,bool $detail=false,string $provider='alibaba1688'): array {
    $rawId=(string)($p['Id']??'');$taobao=$provider==='taobao';
    if(!preg_match($taobao?'/^\d{5,20}$/D':'/^abb-\d{5,20}$/D',$rawId)||!empty($p['HasError'])||(!empty($p['ProviderType'])&&$p['ProviderType']!==($taobao?'Taobao':'Alibaba1688')))fail('Нийлүүлэгчийн барааны мэдээлэл буруу.',503);
    $id=$taobao?'tb-'.$rawId:$rawId;$identity=supplier_identity($id);
    $price=supplier_cny($p['Price']??[]);$rate=shipping_settings()['cny_rate'];
    $r=['id'=>$id,'provider'=>$identity['provider'],'provider_label'=>$identity['label'],'name'=>mb_substr(trim((string)($p['Title']??''))?:((string)($p['OriginalTitle']??$id)),0,300),'image'=>supplier_image((string)($p['MainPictureUrl']??'')),'cny'=>$price,'mnt'=>$price===null?null:(int)ceil($price*$rate),'url'=>$taobao?'https://item.taobao.com/item.htm?id='.$identity['number']:'https://detail.1688.com/offer/'.$identity['number'].'.html','min_qty'=>max(1,(int)($p['FirstLotQuantity']??1)),'step'=>max(1,(int)($p['NextLotQuantity']??1)),'sellable'=>($p['IsSellAllowed']??false)===true&&!($p['IsFiltered']??false),'variants'=>[]];
    if($detail){
        $pictures=[$r['image']];foreach($p['Pictures']??[] as $picture){if(is_array($picture))$pictures[]=supplier_image((string)($picture['Url']??''));}
        $r['images']=array_slice(array_values(array_unique(array_filter($pictures))),0,20);
        $r['vendor_name']=mb_substr((string)($p['VendorName']??''),0,200);
        $r['attributes']=[];foreach(array_slice($p['Attributes']??[],0,60) as $attribute){$name=mb_substr((string)($attribute['PropertyName']??''),0,120);$value=mb_substr((string)($attribute['Value']??''),0,300);if($name!==''&&$value!=='')$r['attributes'][]=['name'=>$name,'value'=>$value];}
        $attrs=[];foreach($p['Attributes']??[] as $a)$attrs[($a['Pid']??'').'|'.($a['Vid']??'')]=($a['PropertyName']??$a['Pid']??'').': '.($a['Value']??$a['Vid']??'');
        foreach($p['ConfiguredItems']??[] as $v){$labels=[];foreach($v['Configurators']??[] as $a)$labels[]=$attrs[($a['Pid']??'').'|'.($a['Vid']??'')]??($a['Vid']??'');$vp=supplier_cny($v['Price']??[]);$r['variants'][]=['id'=>(string)$v['Id'],'label'=>mb_substr(implode(' / ',$labels)?:'Стандарт',0,300),'cny'=>$vp,'stock'=>isset($v['Quantity'])?(int)$v['Quantity']:null];}
        if(!$r['variants'])$r['variants'][]=['id'=>'standard','label'=>'Стандарт · админ баталгаажуулна','cny'=>$price,'stock'=>isset($p['MasterQuantity'])?(int)$p['MasterQuantity']:null];
        $r['description']=mb_substr(trim(html_entity_decode(strip_tags((string)($p['Description']??'')),ENT_QUOTES|ENT_HTML5,'UTF-8')),0,2000);
        $r['tiers']=[];foreach($p['QuantityRanges']??[] as $tier){$v=supplier_cny($tier['Price']??[]);if($v!==null)$r['tiers'][]=['qty'=>(int)$tier['MinQuantity'],'cny'=>$v];}
    }
    return $r;
}
function supplier_search(array $b,bool $display=false): array {
    $q=str_field($b,'q',100,false)?:'bag';$page=int_field($b,'page',1,100);$sort=str_field($b,'sort',20,false)?:'default';
    if(!in_array($sort,['default','price','-price','-volume'],true))fail('Эрэмбэ буруу.');
    $c=supplier_request('/v1/taobao/search',['language'=>'mn','item_title'=>$q,'page'=>$page,'limit'=>12,'sort'=>$sort],$display);
    $block=$c['data']['Items']??[];$items=[];foreach($block['Items']['Content']??[] as $p){try{$items[]=supplier_normalize($p,false,'taobao');}catch(ApiError){}}
    return ['products'=>$items,'page'=>$page,'more'=>count($items)===12&&$page<min(100,(int)($block['MaximumPageCount']??100))&&$page*12<(int)($block['Items']['TotalCount']??PHP_INT_MAX),'fetched'=>$c['fetched'],'stale'=>$c['stale'],'cache_expires'=>(int)$c['expires'],'cache_ttl'=>$c['stale']?0:max(0,(int)$c['expires']-time()),'shipping'=>shipping_public()];
}
function supplier_detail(string $id,bool $display=false): array {
    $identity=supplier_identity($id);
    $c=supplier_request('/v1/'.$identity['provider'].'/product/'.$identity['number'],['language'=>'mn'],$display);
    $p=supplier_normalize($c['data']['Item']??[],true,$identity['provider']);if($p['id']!==$id)fail('Барааны дугаар таарахгүй байна.',503);
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
