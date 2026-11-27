<?php
declare(strict_types=1);

// Shopper search text → intent. Pasted Taobao/Tmall links, app share texts and bare item numbers open
// the product itself; brand misspellings and Mongolian transliterations become the brand name (Taobao
// already understands ordinary Mongolian words such as "малгай"); spacing and letter case are
// normalised so equivalent searches share one cache entry and one API call.
function search_brand_aliases(): array {
    return ['uniclo'=>'uniqlo','uniqulo'=>'uniqlo','unicqlo'=>'uniqlo','юникло'=>'uniqlo','юниклo'=>'uniqlo',
        'найк'=>'nike','найки'=>'nike','nayk'=>'nike','адидас'=>'adidas','addidas'=>'adidas','adiddas'=>'adidas','пума'=>'puma',
        'нью баланс'=>'new balance','норт фэйс'=>'the north face',
        'шаоми'=>'xiaomi','сяоми'=>'xiaomi','ксиаоми'=>'xiaomi','xiomi'=>'xiaomi','xaomi'=>'xiaomi',
        'айфон'=>'iphone','эпл'=>'apple','самсунг'=>'samsung','хуавэй'=>'huawei','хуавей'=>'huawei',
        'сони'=>'sony','лего'=>'lego','зара'=>'zara','икеа'=>'ikea','хайер'=>'haier'];
}
function search_query_intent(string $raw,?callable $resolve=null): array {
    $q=trim((string)preg_replace('/\s+/u',' ',$raw));
    // Item pages: item.taobao.com/item.htm?id=…, detail.tmall.com/item.htm?id=…, m.intl.taobao.com…?id=…,
    // world.taobao.com/item/….htm, a.m.taobao.com/i….htm
    // Text around a link (an app share text's 「title」, or whatever remains without links and 【…】 tags)
    // is kept as the product's title, so an item GOStore has not seen yet can be found by name.
    $title='';
    if(preg_match('~https?://\S+~i',$q)){
        $title=preg_match('/「([^」]{2,100})」/u',$q,$t)?$t[1]:(string)preg_replace(['~https?://\S+~i','/【[^】]*】/u','/[「」]/u'],' ',$q);
        $title=search_normalise(trim((string)preg_replace('/\s+/u',' ',$title)));
    }
    if(preg_match('~(?:taobao|tmall)\.com/\S*?[?&](?:id|itemId|item_id)=(\d{6,20})~i',$q,$m)
        ||preg_match('~(?:taobao|tmall)\.com/(?:item/|i)(\d{6,20})\.htm~i',$q,$m)
        ||preg_match('/^(?:tb-)?(\d{9,20})$/D',$q,$m))return ['type'=>'product','id'=>'tb-'.$m[1],'title'=>$title];
    if(preg_match('~https?://\S+~i',$q)){
        // App share text: a short link resolves to the item; otherwise search its title.
        if(preg_match('~https?://(?:m|e|s)\.tb\.cn/[\w./-]+~i',$q,$m)&&($id=($resolve??'search_resolve_short_link')($m[0])))return ['type'=>'product','id'=>'tb-'.$id,'title'=>$title];
        return $title===''?['type'=>'empty']:['type'=>'search','q'=>$title];
    }
    return ['type'=>'search','q'=>search_category_keyword(search_normalise($q))];
}
// Exact category labels share the same provider keyword and cached results.
function search_category_keyword(string $q): string {
    return match ($q) {
        'kitchen counter racks', 'гал тогооны тавиур' => '厨房台面置物架',
        'wardrobe storage boxes', 'шүүгээний хадгалах хайрцаг' => '衣柜收纳箱',
        'under bed storage', 'орны доорх хадгалах сав' => '床底扁平收纳袋',

        'women winter coats', 'эмэгтэй өвлийн гадуур хувцас' => '女士冬季外套',
        'women plus size clothing', 'том размерын эмэгтэй хувцас' => '大码女装',
        'knit dress', 'нэхмэл даашинз' => '针织连衣裙',

        'men winter sneakers', 'дотортой эрэгтэй пүүз' => '男士加绒运动鞋',
        'men hiking boots', 'эрэгтэй уулын гутал' => '男士户外登山鞋',
        'men slip on shoes', 'үдээсгүй эрэгтэй гутал' => '男士一脚蹬鞋',

        'phone cases', 'утасны гэр' => '手机保护壳',
        'phone screen protectors', 'утасны хамгаалалтын шил' => '手机钢化膜',
        'usb c cables', 'usb-c кабель' => 'USB-C数据线',

        'spinning reels', 'ил дамар' => '纺车轮',
        'baitcasting reels', 'байткаст дамар' => '路亚水滴轮',
        'fishing soft lures', 'зөөлөн өгөөш' => '路亚软饵',

        'expansion anchors', 'тэлэгч анкер' => '膨胀螺栓',
        'pvc pipe elbows', 'pvc хоолойн булан' => 'PVC水管90度弯头',
        'butyl waterproof tape', 'ус тусгаарлах тууз' => '自粘丁基防水胶带',
        default => $q,
    };
}
function search_normalise(string $q): string {
    $q=mb_strtolower($q);
    foreach(search_brand_aliases() as $alias=>$brand)$q=(string)preg_replace('/(?<![\p{L}\p{N}])'.preg_quote($alias,'/').'(?![\p{L}\p{N}])/u',$brand,$q);
    return mb_substr($q,0,100);
}
// m.tb.cn / e.tb.cn share links redirect to the item; the item number is read from the redirect or page
// (4-second limit, results cached for 30 days). Never called when supplier network access is disabled.
function search_resolve_short_link(string $url): ?string {
    if(getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1'||!preg_match('~^https?://(?:m|e|s)\.tb\.cn/[\w./-]{1,80}$~i',$url))return null;
    $dir=config()['data_dir'].'/search-links';$file=$dir.'/'.hash('sha256',strtolower($url)).'.json';
    $cached=json_decode((string)@file_get_contents($file),true);
    if(is_array($cached)&&($cached['time']??0)>time()-30*86400)return is_string($cached['id']??null)?$cached['id']:null;
    $location='';$curl=curl_init('https://'.preg_replace('~^https?://~i','',$url));
    curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>4,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_MAXFILESIZE=>300000,
        CURLOPT_USERAGENT=>'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        CURLOPT_HEADERFUNCTION=>function($c,$h)use(&$location){if(stripos($h,'location:')===0)$location=trim(substr($h,9));return strlen($h);}]);
    $body=(string)curl_exec($curl);curl_close($curl);
    $id=preg_match('~(?:[?&](?:id|itemId)=|/item/|/i)(\d{9,20})~',$location.' '.substr($body,0,300000),$m)?$m[1]:null;
    if(!is_dir($dir))@mkdir($dir,0700,true);@file_put_contents($file,json_encode(['time'=>time(),'id'=>$id]),LOCK_EX);
    return $id;
}
