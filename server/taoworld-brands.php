<?php
declare(strict_types=1);

// Supplier-declared brand attributes are selection evidence, not authentication.
function tw_catalog_brand_aliases(string $id): array {
    $brand=supplier_brand($id);
    return [$brand['name'],...(['nike'=>['耐克'],'adidas'=>['阿迪达斯'],'puma'=>['彪马'],'newbalance'=>['NewBalance','新百伦'],'uniqlo'=>['优衣库'],'zara'=>[],'hm'=>['H＆M'],'thenorthface'=>['TheNorthFace','北面'],'sony'=>['索尼'],'xiaomi'=>['小米'],'lego'=>['乐高'],'ikea'=>['宜家']] [$id]??[])];
}
function tw_catalog_brand_normalize(string $value): string {
    return mb_strtolower(preg_replace('/[\s\x{3000}]+/u','',str_replace('＆','&',trim($value))));
}
function tw_catalog_brand_keyword(string $id): string {
    return ['uniqlo'=>'优衣库','zara'=>'ZARA 女装','hm'=>'H&M 服装','thenorthface'=>'北面','newbalance'=>'New Balance','sony'=>'索尼','xiaomi'=>'小米','lego'=>'乐高','ikea'=>'宜家'][$id]??supplier_brand($id)['name'];
}
function tw_catalog_product_brand_matches(array $item,string $id): bool {
    $aliases=array_map('tw_catalog_brand_normalize',tw_catalog_brand_aliases($id));$found=false;
    foreach($item['properties']??[] as $prop){
        if((string)($prop['prop_id']??'')!=='20000'&&!in_array(mb_strtolower(trim($prop['prop_name']??'')),['品牌','brand'],true))continue;
        $parts=preg_split('~[/／]~u',(string)($prop['value_name']??''));
        // Reject mixed or lookalike labels, including "Nike style" and "ZARA HOME".
        if(!$parts)return false;
        foreach($parts as $part)if(!in_array(tw_catalog_brand_normalize($part),$aliases,true))return false;
        $found=true;
    }
    if(tw_catalog_brand_matches($item,supplier_brand($id),true))return true;
    // Resellers must also name the brand in the title; an isolated attribute on a
    // generic search recommendation is insufficient. Latin aliases need boundaries.
    if(!$found)return false;
    $title=mb_strtolower(($item['title']??'').' '.($item['multi_language_info']['title']??''));
    if(preg_match('/平替|高仿|仿款|replica|inspired by/iu',$title))return false;
    foreach(tw_catalog_brand_aliases($id) as $alias){
        $pattern=preg_quote(mb_strtolower($alias),'~');
        if(preg_match('/[a-z]/i',$alias))$pattern='(?<![a-z0-9])'.$pattern.'(?![a-z0-9])';
        if(preg_match('~'.$pattern.'~u',$title))return true;
    }
    return false;
}
function tw_catalog_brand_details(array $rows): array {
    $results=[];$pending=[];$locks=[];$deadline=microtime(true)+2;
    try{
        // Same cache keys/locks as normal product pages, so browsing reuses verification.
        foreach($rows as $row){
            $id=tw_catalog_remember($row);$key=['id'=>$id,'language'=>'en'];
            $file=tw_catalog_dir().'/'.supplier_cache_key('/traffic/item/get',$key).'.json';$c=supplier_snapshot_read($file);
            if(!tw_catalog_fresh($c,300)){
                $h=supplier_acquire_lock([$file.'.lock'],$deadline);if(!$h)throw new SupplierBusy();$locks[]=$h;$c=supplier_snapshot_read($file);
                if(!tw_catalog_fresh($c,300)){$pending[$id]=['file'=>$file,'params'=>['mi_id'=>$row['mi_id'],'item_resource'=>'taobao','language'=>'en']];continue;}
            }
            $results[$id]=$c;
        }
        if($pending){
            $token=taoworld_access_token();$db=db();$db->exec('SAVEPOINT tw_brand_budget');
            try{foreach($pending as $_)supplier_limits(false);$db->exec('RELEASE SAVEPOINT tw_brand_budget');}
            catch(Throwable $e){$db->exec('ROLLBACK TO SAVEPOINT tw_brand_budget');$db->exec('RELEASE SAVEPOINT tw_brand_budget');throw $e;}
            $queries=array_map(fn($p)=>$p['params']+['access_token'=>$token],array_values($pending));$responses=taoworld_http_detail_batch($queries);$failure=null;
            foreach(array_keys($pending) as $i=>$id){
                try{
                    $r=$responses[$i]??null;if($r instanceof ApiError)throw $r;if(!is_array($r))fail('Брэндийн бараа шалгах хариу дутуу.',502);
                    if(($r['biz_error_code']??'')==='ITEM_NOT_SUPPORTED')continue;
                    $data=tw_catalog_data($r);if('tb-'.($data['item_id']??'')!==$id)fail('Барааны дугаар зөрлөө.',502);
                    $results[$id]=['time'=>time(),'data'=>$data];supplier_snapshot_write($pending[$id]['file'],$results[$id]);
                }catch(ApiError $e){$failure??=$e;}
            }
            if($failure)throw $failure; // Transient errors must not masquerade as an empty catalog.
        }
        return $results;
    }finally{foreach($locks as $h){flock($h,LOCK_UN);fclose($h);}}
}
function tw_catalog_brand_selection(string $id,int $page,string $sort,array $filters,bool $display): array {
    $brand=supplier_brand($id);$sorts=['default'=>'PRICE_DESC','-updated_time'=>'','price'=>'PRICE_ASC','-price'=>'PRICE_DESC','-volume'=>'SALE_QTY_DESC'];
    // Six candidates per page bounds cold verification cost; pagination follows source rows.
    $params=['keyword'=>tw_catalog_brand_keyword($id),'language'=>'en','page_no'=>(string)$page,'page_size'=>'6'];
    if($sorts[$sort]!=='')$params['sort']=$sorts[$sort];if($filters)$params['filters']=json_encode($filters,JSON_THROW_ON_ERROR);
    $search=tw_catalog_cached('/traffic/item/search',$params,false,null,$display);$rows=$search['data']['data']??null;
    if(!is_array($rows))fail('TaoWorld хайлтын хариу дутуу.',502);
    $rows=array_slice($rows,0,6);$more=count($rows)===6&&$page<100;$eligible=[];
    foreach($rows as $row){
        if(!is_array($row))continue;
        if(!preg_match('/^\d{5,20}$/D',(string)($row['item_id']??''))||empty($row['mi_id']))continue;
        $eligible[(string)$row['item_id']]=$row;
    }
    $details=tw_catalog_brand_details(array_values($eligible));$products=[];$fetched=$search['time'];
    foreach($eligible as $number=>$row){
        $c=$details['tb-'.$number]??null;if(!$c||!tw_catalog_product_brand_matches($c['data'],$id))continue;
        try{$p=tw_catalog_product($c['data'],true,$c['time']);}catch(ApiError){continue;}
        $p['brand_id']=$id;$p['brand_name']=$brand['name'];$p['price_expires']=$c['time']+300;$p['shop_rating']=tw_catalog_seller_info($row)['shop_rating']??null;
        $products[]=$p;$fetched=min($fetched,$c['time']);
    }
    if(in_array($sort,['default','-price','price'],true))usort($products,static function($a,$b)use($sort){
        $pa=$a['mnt']??$a['approx_mnt']??null;$pb=$b['mnt']??$b['approx_mnt']??null;
        if(($pa===null)!==($pb===null))return $pa===null?1:-1;
        return $sort==='price'?($pa<=>$pb):($pb<=>$pa);
    });
    $stale=$search['time']<=time()-TW_CATALOG_SEARCH_TTL;
    return tw_catalog_response(['products'=>$products,'page'=>$page,'page_size'=>6,'total'=>null,'pages'=>$page+($more?1:0),'more'=>$more,'partial'=>false,'stale'=>$stale,'revalidate'=>$stale,
        'brand'=>['id'=>$id,'name'=>$brand['name'],'scope'=>'brand_selection','store_name'=>'Брэндэд хамаарах бараанууд','source_url'=>supplier_brand_source_url($id)]],$fetched,300);
}
