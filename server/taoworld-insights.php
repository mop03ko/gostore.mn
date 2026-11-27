<?php
declare(strict_types=1);
require_once __DIR__.'/taoworld-domestic.php';

// Cached read-only requests, keyed by the approved buyer, path and exact inputs.
function tw_insight_read(string $path,array $params): array {
    $file=tw_catalog_dir().'/insight-'.supplier_cache_key($path,$params).'.json';
    $cached=supplier_snapshot_read($file);
    if(tw_catalog_fresh($cached,600))return $cached['data'];
    $lock=supplier_acquire_lock([$file.'.lock'],microtime(true)+2);
    if(!$lock)throw new SupplierBusy();
    try{
        $cached=supplier_snapshot_read($file);
        if(tw_catalog_fresh($cached,600))return $cached['data'];
        supplier_limits(false);
        $response=tw_call($path,$params);
        $result=match($path){
            '/traffic/item/logisticPrice/get'=>tw_catalog_data($response),
            '/logistics/express/freight/estimate'=>tw_insight_estimate_data($response),
            '/product/logisticsProperties/get'=>tw_insight_properties_data($response),
            default=>tw_data($response),
        };
        supplier_snapshot_write($file,['time'=>time(),'data'=>$result]);
        return $result;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}

function tw_insight_distribution(array $b): array {
    $page=int_field($b,'page',1,100);
    $end=intdiv(time(),600)*600;
    $result=tw_insight_read('/product/spus/get',[
        'page_no'=>(string)$page,'page_size'=>'10','status'=>'NORMAL','spus_get_type'=>'PAGINATION',
        'start_modified_time'=>(string)(($end-30*86400)*1000),'end_modified_time'=>(string)($end*1000),
    ]);
    $products=[];
    foreach(array_slice($result['product_list']??[],0,10) as $item){
        if(!is_array($item)||!preg_match('/^[1-9]\d{0,29}$/D',(string)($item['item_id']??'')))continue;
        $products[]=['mp_id'=>(string)$item['item_id'],'title'=>supplier_text($item['title']??'',180),'status'=>supplier_text($item['status']??'',32)];
    }
    return ['products'=>$products,'page'=>$page,'total'=>is_numeric($result['results_total']??null)?(int)$result['results_total']:null,
        'more'=>is_numeric($result['results_total']??null)?$page*10<(int)$result['results_total']:count($products)===10];
}

function tw_insight_line(array $b): array {
    $order=order_row(str_field($b,'id',50))['order'];
    $line=$order['items'][int_field($b,'line',0,199)]??null;
    if(!is_array($line)||!preg_match('/^tb-(\d{5,20})$/D',$line['id']??'',$id))fail('Захиалгын Taobao барааг сонгоно уу.',422);
    $purchase=$order['purchase']??[];
    $mapped=null;
    if(($purchase['provider']??'')==='taoworld'){
        if(!hash_equals((string)($purchase['account_binding']??''),tw_account()))fail('Захиалгын TaoWorld данс зөрж байна.',409);
        foreach($purchase['quote']['lines']??[] as $item){
            if(($item['source_id']??'')===$line['id']&&(string)($item['source_sku']??'')===(string)($line['sku']??'')){
                $mapped=['mp_id'=>tw_id($item['mp_id']??null),'mp_sku_id'=>tw_id($item['mp_sku_id']??null)];break;
            }
        }
    }
    return [$order,$id[1],$mapped,$line];
}

function tw_insight_alternatives(string $sourceId): array {
    $url='https://item.taobao.com/item.htm?id='.$sourceId;
    $raw=tw_insight_read('/product/recommend',['item_url'=>$url]);
    if(!array_is_list($raw))fail('Орлуулах барааны хариу буруу.',502);
    $out=[];
    foreach(array_slice($raw,0,20) as $p){
        if(!is_array($p))continue;
        $id=(string)($p['item_id']??'');
        if($id===$sourceId||isset($out[$id])||!preg_match('/^\d{5,20}$/D',$id))continue;
        $title=supplier_text($p['title']??'',180);
        if($title===''||product_policy_blocked(['id'=>'tb-'.$id,'name'=>$title,'description'=>$p['description']??'','category_path'=>$p['category_path']??'','variants'=>$p['sku_list']??[]]))continue;
        $out[$id]=['id'=>$id,'title'=>$title,'shop'=>supplier_text($p['shop_name']??'',120),'status'=>supplier_text($p['status']??'',32)];
    }
    return ['alternatives'=>array_values($out)];
}

function tw_insight_detail(string $mp): array {
    $p=tw_insight_read('/product/details/query',['items'=>'['.tw_insight_number($mp).']','language'=>'en']);
    foreach($p['goods_info_list']??[] as $item){
        if(!is_array($item)||(string)($item['mp_id']??'')!==$mp||($item['success']??false)!==true)continue;
        return ['product'=>['mp_id'=>$mp,'title'=>supplier_text($item['title']??'',180),
            'status'=>supplier_text($item['status']??'',32),'shop'=>supplier_text($item['shop_name']??'',120),
            'stock'=>is_numeric($item['inventory']??null)?max(0,(int)$item['inventory']):null,
            'sku_count'=>is_array($item['skus']??null)?count($item['skus']):0]];
    }
    return ['product'=>null];
}

// Preserve exact numeric JSON IDs even when they exceed a native PHP integer.
function tw_insight_number(string $id): string {
    if(!preg_match('/^(?:0|[1-9]\d{0,29})$/D',$id))fail('TaoWorld дугаарын формат буруу.',502);
    return $id;
}

function tw_insight_estimate_data(array $response): array {
    $r=$response['result']??$response;
    $amount=$r['data']??null;
    $amount=(is_string($amount)||is_int($amount)||is_float($amount))?trim(trim((string)$amount),'"'):'';
    if(($r['success']??null)!==true||!empty($r['error_code'])||!preg_match('/^\d{1,12}(?:\.\d{1,3})?$/D',$amount))fail('Жинд суурилсан хүргэлтийн лавлагаа ирсэнгүй.',502);
    return ['amount_mnt'=>$amount];
}

function tw_insight_properties_data(array $response): array {
    $r=$response['result']??$response;
    if(($r['success']??null)===false&&($r['error_code']??'')==='ITEM_LOGISTICS_PROPERTY_NOT_FOUND')return ['properties'=>null];
    $data=tw_data($response);
    $list=$data['logistics_properties_list']??null;
    if(!is_array($list))fail('TaoWorld тээврийн шинжийн хариу дутуу.',502);
    $properties=[];
    foreach(array_slice($list,0,20) as $entry){
        if(!is_array($entry))continue;
        $key=supplier_text($entry['key']??'',40);
        if($key!=='')$properties[$key]=supplier_text($entry['name']??$key,70);
    }
    return ['properties'=>array_values($properties)];
}

function tw_insights(array $b): array {
    require_once __DIR__.'/supplier.php';
    $mode=str_field($b,'mode',24);
    if($mode==='distribution')return tw_insight_distribution($b);
    if($mode==='accounts'){
        $r=tw_insight_read('/account/subaccount/query',['page_no'=>'1','page_size'=>'10']);
        return ['total'=>is_numeric($r['results_total']??null)?(int)$r['results_total']:count($r['sub_account_infos']??[])];
    }
    if(!in_array($mode,['availability','alternatives','detail','delivery','properties','rebate','keywords','freight'],true))fail('Лавлагааны төрөл буруу.',422);
    [$order,$sourceId,$mapped,$line]=tw_insight_line($b);
    if($mode==='alternatives')return tw_insight_alternatives($sourceId);
    $url='https://item.taobao.com/item.htm?id='.$sourceId;
    if($mode==='availability'){
        $r=tw_insight_read('/batch/src/products/check',['param'=>tw_json([['itemUrl'=>$url]]),'recommendSimilar'=>'false']);
        $reasons=[];
        foreach($r['noMpReasonList']??[] as $row){
            if((string)($row['itemId']??'')!==$sourceId)continue;
            $text=supplier_text($row['reason']??'',160);if($text!=='')$reasons[]=$text;
        }
        $available=$reasons?false:null;
        foreach($r['noMpProductItemIds']??[] as $id)if((string)$id===$sourceId)$available=false;
        foreach($r['mpProducts']??[] as $row)if((string)($row['itemId']??$row['item_id']??'')===$sourceId)$available=true;
        return ['available'=>$available,'reasons'=>array_values(array_unique($reasons))];
    }
    if($mode==='delivery'){
        $receiver=$order['purchase']['receiver']??tw_domestic_receiver($order['warehouse']??null);
        $address=tw_json(array_intersect_key($receiver,array_flip(['country','state','city','district'])));
        $r=tw_insight_read('/traffic/item/logisticPrice/get',['item_resource'=>'taobao','item_url'=>$url,'address_info'=>$address]);
        if((string)($r['item_id']??'')!==$sourceId||($r['item_resource']??'')!=='taobao'||($r['currency']??'')!=='CNY')fail('TaoWorld хүргэлтийн лавлагаа зөрлөө.',502);
        $out=['source_fee_fen'=>tw_fen($r['post_fee']??null),'distribution_fee_fen'=>null];
        if($mapped){
            try{
                $raw=tw_insight_read('/product/batchGetProductLogisticPrice',['mp_ids'=>'['.tw_insight_number($mapped['mp_id']).']','address_info'=>$address]);
                foreach($raw as $row)if((string)($row['mp_id']??'')===$mapped['mp_id']&&($row['success']??false)===true&&($row['currency']??'')==='CNY'){
                    $out['distribution_fee_fen']=tw_fen($row['post_fee']??null);break;
                }
            }catch(ApiError){$out['distribution_unavailable']=true;}
        }
        return $out;
    }
    if(!$mapped)fail('Энэ бараанд хадгалсан TaoWorld SKU хараахан алга.',409);
    $mp=$mapped['mp_id'];
    if($mode==='detail')return tw_insight_detail($mp);
    if($mode==='properties')return tw_insight_read('/product/logisticsProperties/get',['mp_id'=>$mp]);
    if($mode==='freight'){
        $qty=int_field($line,'qty',1,100000);
        $rates=[['tiered_order'=>1,'weight_min'=>0,'weight_max'=>10000,'first_weight'=>1,'additional_weight_unit'=>1,
            'first_weight_price'=>int_field($b,'first_mnt',0,1000000),'additional_weight_price'=>int_field($b,'extra_mnt',0,1000000)]];
        return tw_insight_read('/logistics/express/freight/estimate',[
            'items'=>'[{"item_id":'.tw_insight_number($mp).',"item_quantity":'.$qty.'}]','weight_tiered_freight_list'=>tw_json($rates)]);
    }
    if($mode==='rebate'){
        $sku=$mapped['mp_sku_id'];
        $items='[{"item_id":'.tw_insight_number($mp).',"sku_id":'.tw_insight_number($sku).'}]';
        $r=tw_insight_read('/product/rebate/general/query',['items'=>$items]);
        foreach($r['item_commission_rates']??[] as $row){
            if((string)($row['item_id']??'')!==$mp||(string)($row['sku_id']??'')!==$sku)continue;
            return ['rebate'=>['rate'=>supplier_text($row['commission_rate']??'',30)]];
        }
        return ['rebate'=>null];
    }
    $words=array_values(array_unique(array_filter(array_map('trim',explode(',',str_field($b,'words',240))),fn($v)=>$v!=='')));
    if(!$words||count($words)>10||array_filter($words,fn($word)=>mb_strlen($word)>30))fail('Таслалаар тусгаарласан 1–10 үг оруулна уу.',422);
    $items='[{"mp_id":'.tw_insight_number($mp).',"sensitive_words":'.tw_json($words).'}]';
    $r=tw_insight_read('/product/sensitiveword/identification',['items'=>$items]);
    foreach($r['success_product_list']??[] as $row)if((string)($row['mp_id']??'')===$mp&&is_array($row['sensitiveword_detail_list']??null))return ['matches'=>count($row['sensitiveword_detail_list'])];
    fail('TaoWorld энэ барааны үгийн шалгалтын дүнг буцаасангүй.',502);
}
