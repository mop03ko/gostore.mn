<?php
declare(strict_types=1);

// English is a display preference for product names only. Keep the catalog language
// for descriptions, SKU labels, categories, offers and all transactional data.
const SUPPLIER_TITLE_TTL = 604800;
function supplier_title_text(mixed $value): ?string {
    $title=supplier_text($value,500);
    // A key without English enabled can silently return Mongolian or Chinese.
    // Do not cache that response as an English translation.
    if($title===''||!preg_match('/[a-z]/i',$title)||preg_match('/[\p{Cyrillic}\p{Han}]/u',$title))return null;
    return mb_substr(supplier_clean_title($title),0,300);
}
function supplier_title_file(string $id): ?string {
    if(!preg_match('/^(tb|abb)-\d{5,20}$/D',$id))return null;
    return config()['data_dir'].'/supplier-titles/'.$id.'.json';
}
function supplier_title_read(string $id): ?string {
    $file=supplier_title_file($id);
    if($file===null||!is_file($file)||filesize($file)>4096)return null;
    $entry=json_decode((string)file_get_contents($file),true);
    if(!is_array($entry)||($entry['expires']??0)<=time())return null;
    return supplier_title_text($entry['title']??null);
}
function supplier_title_write(string $id,string $title): void {
    $file=supplier_title_file($id);if($file===null)return;
    $dir=dirname($file);
    if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('Title cache unavailable');
    $tmp=tempnam($dir,'title-');if($tmp===false)throw new RuntimeException('Title cache unavailable');
    try {
        $data=json_encode(['title'=>$title,'expires'=>time()+SUPPLIER_TITLE_TTL],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        if(file_put_contents($tmp,$data,LOCK_EX)===false||!chmod($tmp,0600)||!rename($tmp,$file))throw new RuntimeException('Title cache write failed');
    } finally {if(is_file($tmp))unlink($tmp);}
}
// Visit only product objects, never similarly named vendor/category/offer fields.
function supplier_title_map(array $data,callable $visit): array {
    if(is_array($data['Item']??null))$data['Item']=$visit($data['Item']);
    foreach(['VendorItems','RecommendedItems'] as $key)if(is_array($data[$key]['Content']??null)){
        foreach($data[$key]['Content'] as &$item)if(is_array($item))$item=$visit($item);unset($item);
    }
    if(is_array($data['Items']['Items']['Content']??null)){
        foreach($data['Items']['Items']['Content'] as &$item)if(is_array($item))$item=$visit($item);unset($item);
    }
    return $data;
}
function supplier_title_id(array $item,string $provider): ?string {
    $id=(string)($item['Id']??'');
    if(!empty($item['HasError'])||(!empty($item['ProviderType'])&&$item['ProviderType']!==$provider))return null;
    if($provider==='Taobao')return preg_match('/^\d{5,20}$/D',$id)?'tb-'.$id:null;
    return preg_match('/^abb-\d{5,20}$/D',$id)?$id:null;
}
function supplier_english_titles(array $cache,string $path,array $query,bool $display,bool $warming): array {
    $provider=str_starts_with($path,'/v1/alibaba1688/')?'Alibaba1688':'Taobao';
    $wanted=[];$titles=[];
    supplier_title_map($cache['data'],static function($item)use(&$wanted,&$titles,$provider,$query){
        $id=supplier_title_id($item,$provider);if($id===null)return $item;
        $wanted[$id]=true;
        $title=($query['language']??'')==='en'?supplier_title_text($item['Title']??null):supplier_title_read($id);
        if($title!==null)$titles[$id]=$title;
        return $item;
    });
    if(!$wanted)return $cache;
    try {
        if(($display||$warming)&&($query['language']??'')!=='en'&&array_diff_key($wanted,$titles)){
            // One translated page/detail request, never one API call per product.
            // Existing request limits, retries and language-specific caches apply.
            // Checkout uses cached titles only: translation must never add network
            // latency, lock contention or quota consumption to SKU/price validation.
            $english=supplier_raw_request($path,array_replace($query,['language'=>'en']),$display,false,$warming);
            supplier_title_map($english['data'],static function($item)use(&$titles,$wanted,$provider){
                $id=supplier_title_id($item,$provider);
                if($id!==null&&isset($wanted[$id])&&($title=supplier_title_text($item['Title']??null))!==null){
                    $titles[$id]=$title;supplier_title_write($id,$title);
                }
                return $item;
            });
        }elseif(($query['language']??'')==='en'){
            foreach($titles as $id=>$title)supplier_title_write($id,$title);
        }
    } catch(Throwable $e) {
        // Translation outages or exhausted quota must not block browsing/checkout.
        // Preserve the supplier name until an English translation is available.
        error_log('GOStore English product names temporarily unavailable');
    }
    $cache['data']=supplier_title_map($cache['data'],static function($item)use($titles,$provider){
        $id=supplier_title_id($item,$provider);
        if($id!==null&&isset($titles[$id]))$item['Title']=$titles[$id];
        return $item;
    });
    return $cache;
}
