<?php
declare(strict_types=1);
require_once __DIR__.'/official-stores.php';

// Site controls without a code change: hidden items and shops, the home keyword mix, the reviewed
// official store list and the 11.11 campaign period. Stored in meta.catalog_controls and applied by
// product-policy.php (every catalog, product, cart and order path), taoworld-catalog.php (home mix),
// official-stores.php (directory) and eleven-sale.js (campaign).
function catalog_controls_defaults(): array {
    return ['blocked_items'=>[],'blocked_shops'=>[],'home_keywords'=>[],'campaign'=>['mode'=>'auto','until'=>''],'official_stores'=>[]];
}
function catalog_controls(): array {return array_replace(catalog_controls_defaults(),catalog_controls_meta(true));}
function catalog_controls_write(callable $change): array {
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $c=catalog_controls();$change($c);$c['updated']=gmdate('c');
        $db->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['catalog_controls',json_encode($c,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    catalog_controls_meta(true);return catalog_controls_admin();
}
function catalog_list(mixed $value,string $label,int $max): array {
    if(is_string($value))$value=preg_split('/[\r\n,]+/u',$value)?:[];
    if(!is_array($value)||!array_is_list($value))fail($label.' буруу.');
    $out=[];foreach($value as $v){if(!is_string($v))fail($label.' буруу.');$v=trim(preg_replace('/\s+/u',' ',$v)??'');if($v!=='')$out[$v]=true;}
    if(count($out)>$max)fail($label.': хамгийн ихдээ '.$max.'.');
    return array_keys($out);
}
function catalog_campaign_state(?array $c=null,?int $now=null): array {
    $c??=catalog_controls();$mode=$c['campaign']['mode']??'auto';$until=(string)($c['campaign']['until']??'');
    $today=gmdate('Y-m-d',($now??time())+8*3600);
    $active=match($mode){'off'=>false,'on'=>$until!==''&&$today<=$until,default=>substr($today,5,2)==='11'&&(int)substr($today,8,2)<=11};
    return ['mode'=>in_array($mode,['auto','on','off'],true)?$mode:'auto','until'=>$until?:null,'active'=>$active,'today'=>$today];
}
// Public view: in auto mode the browser keeps its own date rule (active=null).
function catalog_campaign_public(): array {
    $s=catalog_campaign_state();return ['mode'=>$s['mode'],'until'=>$s['until'],'active'=>$s['mode']==='auto'?null:$s['active']];
}
function catalog_controls_admin(): array {
    $c=catalog_controls();$logos=[];
    foreach(glob(__DIR__.'/../assets/brands/*.svg')?:[] as $f)$logos[]='/assets/brands/'.basename($f);
    $stores=[];foreach(official_stores_registry() as $s)$stores[]=$s;
    return ['controls'=>['blocked_items'=>$c['blocked_items'],'blocked_shops'=>$c['blocked_shops'],'home_keywords'=>$c['home_keywords'],'campaign'=>$c['campaign']],
        'campaign'=>catalog_campaign_state($c),'stores'=>$stores,'stores_custom'=>!empty($c['official_stores']),'logos'=>$logos,
        'default_home_keywords'=>count($c['home_keywords'])>=6?null:(function_exists('tw_catalog_home_keywords')?array_slice(tw_catalog_home_keywords(),0,200):null),'updated'=>$c['updated']??null];
}
function catalog_controls_save(array $b): array {
    $items=array_map(static function(string $v){$v=preg_replace('/^tb-/','',$v);if(!preg_match('/^\d{5,20}$/D',$v))fail('Барааны дугаар буруу: '.$v);return $v;},catalog_list($b['blocked_items']??[],'Нуух бараа',1000));
    $shops=catalog_list($b['blocked_shops']??[],'Нуух дэлгүүр',300);foreach($shops as $s)if(mb_strlen($s)>80)fail('Дэлгүүрийн нэр хэт урт.');
    $keywords=catalog_list($b['home_keywords']??[],'Нүүр хуудасны түлхүүр үг',200);
    if($keywords&&count($keywords)<6)fail('Нүүр хуудсанд 6-аас доошгүй түлхүүр үг оруулна уу, эсвэл хоосон орхиж үндсэн жагсаалтыг ашиглана уу.');
    foreach($keywords as $k){if(mb_strlen($k)>30)fail('Түлхүүр үг хэт урт: '.$k);if(product_policy_text_blocked($k))fail('Худалдаалахгүй барааны үг: '.$k);}
    $campaign=is_array($b['campaign']??null)?$b['campaign']:[];$mode=$campaign['mode']??'auto';if(!in_array($mode,['auto','on','off'],true))fail('Хямдралын горим буруу.');
    $until=is_string($campaign['until']??null)?trim($campaign['until']):'';
    if($mode==='on'){
        if(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$until)||!checkdate((int)substr($until,5,2),(int)substr($until,8,2),(int)substr($until,0,4)))fail('Хямдрал дуусах огноог оруулна уу.');
        $today=gmdate('Y-m-d',time()+8*3600);if($until<$today||$until>gmdate('Y-m-d',time()+8*3600+60*86400))fail('Дуусах огноо өнөөдрөөс 60 хоногийн дотор байна.');
    }else $until='';
    return catalog_controls_write(static function(array &$c)use($items,$shops,$keywords,$mode,$until){$c['blocked_items']=$items;$c['blocked_shops']=$shops;$c['home_keywords']=$keywords;$c['campaign']=['mode'=>$mode,'until'=>$until];});
}
// Store identities must be reviewed: exact shop id and Chinese shop name plus where they were checked.
function catalog_stores_save(array $b): array {
    if(($b['reset']??false)===true)return catalog_controls_write(static function(array &$c){$c['official_stores']=[];});
    $rows=$b['stores']??null;if(!is_array($rows)||!array_is_list($rows)||count($rows)<1||count($rows)>60)fail('1–60 дэлгүүр оруулна уу.');
    $logos=array_map(fn($f)=>'/assets/brands/'.basename($f),glob(__DIR__.'/../assets/brands/*.svg')?:[]);$seen=[];$stores=[];
    foreach($rows as $r){
        if(!is_array($r))fail('Дэлгүүрийн мэдээлэл буруу.');
        $id=str_field($r,'id',20);if(!preg_match('/^\d{5,20}$/D',$id))fail('Дэлгүүрийн дугаар (shop ID) буруу: '.$id);if(isset($seen[$id]))fail('Давхардсан дэлгүүр: '.$id);$seen[$id]=true;
        $name=str_field($r,'name',60);$display=str_field($r,'display_name',60);$logo=str_field($r,'logo',120,false);
        if($logo!==''&&!in_array($logo,$logos,true))fail('Лого олдсонгүй: '.$logo);
        $source=str_field($r,'source_url',300);$host=strtolower((string)parse_url($source,PHP_URL_HOST));
        if(parse_url($source,PHP_URL_SCHEME)!=='https'||!preg_match('/(^|\.)(tmall\.com|tmall\.hk|taobao\.com)$/D',$host))fail('Эх сурвалж Tmall/Taobao-ийн https холбоос байна: '.$display);
        $stores[]=['id'=>$id,'name'=>$name,'display_name'=>$display,'logo'=>$logo,'source_url'=>$source,'verification'=>str_field($r,'verification',200)];
    }
    return catalog_controls_write(static function(array &$c)use($stores){$c['official_stores']=$stores;});
}
// One search for the shop id: how many rows TaoWorld returns and the exact shop names among them.
function catalog_store_test(array $b): array {
    tw_catalog_require_ready();$id=str_field($b,'id',20);if(!preg_match('/^\d{5,20}$/D',$id))fail('Дэлгүүрийн дугаар буруу.');$name=str_field($b,'name',60,false);
    $c=tw_catalog_cached('/traffic/item/search',official_store_query(['id'=>$id]),false,null,true);$rows=array_values(array_filter($c['data']['data']??[],'is_array'));
    $names=array_values(array_unique(array_filter(array_map(fn($p)=>is_string($p['shop_name']??null)?$p['shop_name']:'',$rows))));
    $matching=array_values(array_filter($rows,fn($p)=>$name!==''&&($p['shop_name']??'')===$name));
    return ['rows'=>count($rows),'matching'=>count($matching),'shop_names'=>array_slice($names,0,5),
        'samples'=>array_map(fn($p)=>mb_substr((string)($p['multi_language_info']['title']??$p['title']??''),0,80),array_slice($matching?:$rows,0,3)),'checked_at'=>gmdate('c',$c['time']??time())];
}
