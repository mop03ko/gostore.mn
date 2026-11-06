<?php
declare(strict_types=1);
// /v/<id> (see .htaccess): link-preview crawlers (Facebook, Messenger, Telegram) do not run
// JavaScript, so the product's name and photo are written into index.html's title and Open Graph
// tags. Only an existing detail snapshot is read and TaoWorld is never called, so the 800+ crawler
// visits a month spend no API quota. Anything unexpected serves index.html unchanged.
$html=(string)file_get_contents(__DIR__.'/../index.html');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
try{
    $raw=(string)($_GET['id']??'');
    if(!preg_match('/^(?:tb-)?([0-9]{5,20})$/D',$raw,$m)||!str_starts_with($raw,'tb-'))throw new RuntimeException('Not a native product');
    require __DIR__.'/../server/bootstrap.php';
    require_once __DIR__.'/../server/shipping.php';
    require_once __DIR__.'/../server/supplier.php';
    if(!tw_catalog_enabled())throw new RuntimeException('Native catalog disabled');
    $id='tb-'.$m[1];
    if(product_policy_blocked(['id'=>$id]))throw new RuntimeException('Blocked product');
    $c=supplier_snapshot_read(tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',['id'=>$id,'language'=>'en']).'.json');
    $p=$c['data']??null;
    // Previews may lag the live page by up to a week; prices are left out because they change.
    if(!is_array($p)||'tb-'.($p['item_id']??'')!==$id||($c['time']??0)<time()-7*86400)throw new RuntimeException('No recent snapshot');
    $name=trim(preg_replace('/\s+/u',' ',strip_tags((string)($p['multi_language_info']['title']??$p['title']??''))));
    $image=supplier_image((string)($p['multi_language_info']['main_image_url']??$p['main_image_url']??$p['pic_urls'][0]??''));
    if($name===''||product_policy_text_blocked($name))throw new RuntimeException('No usable title');
    $name=mb_substr($name,0,150);
    $e=static fn(string $v):string=>htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $url='https://gostore.mn/v/'.$id;$title=$name.' · GOStore';
    $description='Хятадаас захиалж, QPay-ээр төлөөд Улаанбаатарт хүлээн авна. Сонголт, үнэ, хүргэлтийн мэдээллийг GOStore-оос үзнэ үү.';
    $set=static function(string $pattern,string $replacement)use(&$html):void{$next=preg_replace($pattern,$replacement,$html,1,$count);if(is_string($next)&&$count===1)$html=$next;};
    $set('#<title>[^<]*</title>#u','<title>'.$e($title).'</title>');
    $set('#<meta name="description" content="[^"]*">#u','<meta name="description" content="'.$e($description).'">');
    $set('#<meta property="og:type" content="[^"]*">#u','<meta property="og:type" content="product">'."\n  ".'<meta property="og:url" content="'.$e($url).'">'."\n  ".'<link rel="canonical" href="'.$e($url).'">');
    $set('#<meta property="og:title" content="[^"]*">#u','<meta property="og:title" content="'.$e($name).'">');
    $set('#<meta property="og:description" content="[^"]*">#u','<meta property="og:description" content="'.$e($description).'">');
    $set('#<meta name="twitter:title" content="[^"]*">#u','<meta name="twitter:title" content="'.$e($name).'">');
    $set('#<meta name="twitter:description" content="[^"]*">#u','<meta name="twitter:description" content="'.$e($description).'">');
    if(preg_match('#^https://(?:[a-z0-9-]+\.)*alicdn\.com/#i',$image)){
        // A fixed 800 px JPEG rendition; the product photo replaces the logo card and its size tags.
        $photo=preg_match('/_[0-9]+x[0-9]+/',$image)||str_contains($image,'?')?$image:$image.'_800x800q80.jpg';
        foreach(['og:image','og:image:secure_url'] as $tag)$set('#<meta property="'.preg_quote($tag,'#').'" content="[^"]*">#u','<meta property="'.$tag.'" content="'.$e($photo).'">');
        $set('#<meta name="twitter:image" content="[^"]*">#u','<meta name="twitter:image" content="'.$e($photo).'">');
        foreach(['og:image:type','og:image:width','og:image:height'] as $tag)$set('#\s*<meta property="'.preg_quote($tag,'#').'" content="[^"]*">#u','');
        $set('#<meta property="og:image:alt" content="[^"]*">#u','<meta property="og:image:alt" content="'.$e($name).'">');
        $set('#<meta name="twitter:image:alt" content="[^"]*">#u','<meta name="twitter:image:alt" content="'.$e($name).'">');
    }
}catch(Throwable){/* Plain index.html: the browser app renders the product as before. */}
echo $html;
