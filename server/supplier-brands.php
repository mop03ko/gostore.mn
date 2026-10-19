<?php
declare(strict_types=1);

// Case-sensitive OT VendorIds and numeric seller identities verified 2026-10-19.
function supplier_brands(): array {
    return [
        'nike'=>['name'=>'Nike','vendor'=>'NIKE官方旗舰店','seller'=>'890482188'],
        'adidas'=>['name'=>'adidas','vendor'=>'adidas官方旗舰店','seller'=>'446338500'],
        'puma'=>['name'=>'Puma','vendor'=>'PUMA官方旗舰店','seller'=>'734584252'],
        'newbalance'=>['name'=>'New Balance','vendor'=>'New Balance官方旗舰店','seller'=>'520557274'],
        'uniqlo'=>['name'=>'UNIQLO','vendor'=>'优衣库官方旗舰店','seller'=>'196993935'],
        'zara'=>['name'=>'ZARA','vendor'=>'ZARA官方旗舰店','seller'=>'2228361831'],
        'sony'=>['name'=>'Sony','vendor'=>'索尼官方旗舰店','seller'=>'782731205'],
        'xiaomi'=>['name'=>'Xiaomi','vendor'=>'小米官方旗舰店','seller'=>'1714128138'],
        'lego'=>['name'=>'LEGO','vendor'=>'乐高官方旗舰店','seller'=>'766568254'],
        'ikea'=>['name'=>'IKEA','vendor'=>'IKEA宜家家居官方旗舰店','seller'=>'2207239419714'],
    ];
}
function supplier_brand(string $id): array {return supplier_brands()[$id]??throw new ApiError('Брэнд олдсонгүй.',404);}
function supplier_brand_assert_vendor(array $vendor,array $brand): void {
    $features=[];foreach($vendor['FeaturedValues']??[] as $v)$features[$v['Name']??'']=$v['Value']??'';
    $seller=(string)($features['userId']??$features['TaobaoVendorId']??'');
    if(($vendor['Id']??'')!==$brand['vendor']||$seller!==$brand['seller']||($vendor['ProviderType']??'')!=='Taobao')fail('Брэндийн дэлгүүрийн мэдээллийг баталгаажуулж чадсангүй. Түр хүлээгээд дахин оролдоно уу.',503);
}
function supplier_brand_item_matches(array $item,array $brand): bool {
    if(($item['VendorId']??'')!==$brand['vendor'])return false;
    foreach($item['FeaturedValues']??[] as $feature)if(($feature['Name']??'')==='TaobaoVendorId'&&(string)($feature['Value']??'')!==$brand['seller'])return false;
    return true;
}
function supplier_brand_query(array $brand,int $page,string $sort,array $range=[]): array {
    $orders=['default'=>'Default','price'=>'Price:Asc','-price'=>'Price:Desc','-volume'=>'Volume:Desc','-updated_time'=>'UpdatedTime:Desc'];
    if(!isset($orders[$sort]))fail('Эрэмбэ буруу.');
    $xml='<SearchItemsParameters><Provider>Taobao</Provider><VendorId>'.htmlspecialchars($brand['vendor'],ENT_XML1|ENT_QUOTES,'UTF-8').'</VendorId><OrderBy>'.$orders[$sort].'</OrderBy>';
    $rate=shipping_settings()['cny_rate'];foreach(['price_min'=>'MinPrice','price_max'=>'MaxPrice'] as $key=>$tag)if(isset($range[$key]))$xml.='<'.$tag.'>'.number_format($range[$key]/$rate,2,'.','').'</'.$tag.'>';
    return ['language'=>supplier_language(),'xmlParameters'=>$xml.'</SearchItemsParameters>','framePosition'=>($page-1)*12,'frameSize'=>12,'blockList'=>'Vendor'];
}
function supplier_brand_search(array $b,bool $display=false): array {
    $id=str_field($b,'brand',30);$brand=supplier_brand($id);$page=int_field($b,'page',1,100);$sort=str_field($b,'sort',20,false)?:'default';
    $c=supplier_request('/service-json/BatchSearchItemsFrame',supplier_brand_query($brand,$page,$sort,supplier_price_range($b)),$display);
    supplier_brand_assert_vendor($c['data']['Vendor']??[],$brand);
    $raw=$c['data']['Items']['Items']['Content']??[];$safe=array_values(array_filter($raw,static fn($p)=>is_array($p)&&supplier_brand_item_matches($p,$brand)));
    $c['data']['Items']['Items']['Content']=$safe;$r=supplier_search_result($c,$page);
    $byId=[];foreach($safe as $p)$byId['tb-'.$p['Id']]=$p;
    foreach($r['products'] as &$p){$p['brand_id']=$id;$p['brand_name']=$brand['name'];$p['offers']=supplier_offers($byId[$p['id']],$c);}unset($p);
    if(count($safe)!==count($raw)){$r['total']=null;$r['more']=count($raw)===12&&$page<100;$r['pages']=$page+($r['more']?1:0);}
    $r['brand']=['id'=>$id,'name'=>$brand['name']];
    return supplier_price_order_result($r,$sort);
}
// Offers are display-only. Checkout always revalidates the chosen SKU independently.
function supplier_offers(array $item,array $cache): array {
    if(!empty($cache['stale'])||($cache['expires']??0)<=time())return ['discount'=>null,'promotions'=>[],'expires'=>0];
    $price=$item['Price']??[];$now=supplier_cny($price);$was=supplier_cny($price['PriceWithoutDiscountAndDelivery']??[]);$rate=shipping_settings()['cny_rate'];
    $discount=$now!==null&&$was!==null&&$was>$now?['current_mnt'=>(int)ceil($now*$rate),'was_mnt'=>(int)ceil($was*$rate),'percent'=>(int)floor(round(($was-$now)/$was*100,8))]:null;
    $promotions=[];
    if(($item['IsValidPromotions']??true)!==false)foreach(array_slice($item['Promotions']??[],0,20) as $offer){
        if(!is_array($offer)||!empty($offer['HasError'])||(!empty($offer['ErrorCode'])&&$offer['ErrorCode']!=='Ok'))continue;
        $start=empty($offer['StartTime'])?null:strtotime((string)$offer['StartTime']);$end=empty($offer['EndTime'])?null:strtotime((string)$offer['EndTime']);
        if($start===false||$end===false||($start!==null&&$start>time())||($end!==null&&$end<=time()))continue;
        $name=supplier_text($offer['Name']??'',200);$description=supplier_text($offer['Desciption']??'',1000); // OT schema spells this Desciption.
        if($name===''&&$description==='')continue;
        $promoPrice=($offer['IsCalculated']??false)===true?supplier_cny($offer['Price']??[]):null;
        $promotions[]=['name'=>$name?:'Нийлүүлэгчийн урамшуулал','description'=>$description,'price_mnt'=>$promoPrice!==null?(int)ceil($promoPrice*$rate):null,'ends'=>$end?gmdate('c',$end):null];
    }
    return ['discount'=>$discount,'promotions'=>$promotions,'expires'=>(int)$cache['expires']];
}
