<?php
declare(strict_types=1);
require_once __DIR__.'/taoworld-deals.php';

const TW_NEW_YEAR_SEARCH_TTL=43200;
const TW_NEW_YEAR_DETAILS_PER_RUN=12;
const TW_NEW_YEAR_DETAILS_PER_DAY=72;

// Only the catalog worker calls this. Candidate search never supplies discount claims.
function tw_deals_warm_new_year(): array {
    $now=time();
    if(!tw_catalog_warming()||!tw_deals_new_year_active($now)||getenv('GOSTORE_DISABLE_SUPPLIER_NETWORK')==='1')return ['status'=>'inactive'];
    $path=tw_catalog_dir().'/new-year-warming.json';
    $lock=fopen($path.'.lock','c');
    if(!$lock)return ['status'=>'deferred'];
    try{
        if(!flock($lock,LOCK_EX|LOCK_NB))return ['status'=>'busy'];
        $state=supplier_snapshot_read($path)??[];
        $cache=$state['data']['queries']??[];
        $day=gmdate('Y-m-d',$now+8*3600);
        $attempted=($state['data']['day']??'')===$day?($state['data']['attempted']??[]):[];
        $budget=supplier_budget_status();
        $daily=min(TW_NEW_YEAR_DETAILS_PER_DAY,max(4,intdiv($budget['background_limit'],8)));
        $groups=[];$searched=0;$checked=0;$errors=0;$limited=false;
        $queries=[
            '圣诞树挂件','圣诞花环','圣诞桌布','圣诞帽','圣诞礼品包装','元旦装饰','圣诞雪花装饰',
            '圣诞树','圣诞装饰','圣诞彩灯','圣诞礼品袋','跨年派对装饰',
        ];
        foreach($queries as $query){
            $entry=$cache[$query]??[];
            if(!$limited&&($entry['next']??0)<=$now){
                try{
                    $response=tw_catalog_search(['q'=>$query,'page'=>1,'limit'=>12]);
                    $matching=array_filter($response['products'],static fn($p)=>tw_deals_new_year_item($p)&&!empty($p['image']));
                    $entry=['ids'=>array_column($matching,'id'),'next'=>$now+TW_NEW_YEAR_SEARCH_TTL];
                    $searched++;
                }catch(ApiError $e){
                    $entry['next']=$now+1800;
                    $errors++;
                    $limited=$e->getCode()===429;
                }
                $cache[$query]=$entry;
            }
            $groups[]=$entry['ids']??[];
        }
        $candidates=[];
        for($i=0;$i<12;$i++)foreach($groups as $ids){
            $id=$ids[$i]??'';
            if(preg_match('/^tb-\d{5,20}$/D',$id))$candidates[$id]=true;
        }
        foreach(array_keys($candidates) as $id){
            if($limited||$checked>=TW_NEW_YEAR_DETAILS_PER_RUN||count($attempted)>=$daily)break;
            if(isset($attempted[$id])||tw_catalog_fresh(supplier_snapshot_read(tw_deals_detail_path($id)),20*3600))continue;
            try{
                tw_catalog_detail($id);
                $attempted[$id]=true;
                $checked++;
            }catch(ApiError $e){
                $errors++;
                if($e->getCode()===429){$limited=true;break;}
                $attempted[$id]=true;
                $checked++;
            }
        }
        supplier_snapshot_write($path,['time'=>$now,'data'=>['queries'=>$cache,'day'=>$day,'attempted'=>$attempted]]);
        return ['status'=>$limited?'budget':'ready','candidates'=>count($candidates),'searches'=>$searched,'checked'=>$checked,'errors'=>$errors,'checked_today'=>count($attempted),'daily_limit'=>$daily];
    }finally{fclose($lock);}
}
