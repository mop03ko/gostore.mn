<?php
declare(strict_types=1);

// TaoWorld /logistics/detail/get. Keep receiver and carrier detail inside purchase,
// which public_order removes; only the assigned Erenhot manager receives this view.
function inbound_detail_text(mixed $v,int $limit=300): string {
    return is_scalar($v)?mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]/u','',strip_tags((string)$v))??''),0,$limit):'';
}
function inbound_detail_fields(array $row,array $keys): array {
    $out=[];foreach($keys as $key)$out[$key]=inbound_detail_text($row[$key]??'');return $out;
}
function inbound_detail_parcels(array $data): array {
    if(!isset($data['pnm_logistics_details'])||!is_array($data['pnm_logistics_details']))fail('TaoWorld хүргэлтийн хариу дутуу.',502);
    $out=[];
    foreach(array_slice($data['pnm_logistics_details'],0,20) as $p){
        if(!is_array($p))continue;
        $row=inbound_detail_fields($p,['mail_no','logistics_status','logistics_desc']);
        if(!preg_match('/^[A-Za-z0-9-]{6,40}$/D',$row['mail_no']))continue;
        $row['mail_no']=strtoupper($row['mail_no']);
        $row['receiver']=inbound_detail_fields(is_array($p['receiver']??null)?$p['receiver']:[],['name','phone','province','city','district','address','zip_code']);
        $row['partners']=[];foreach(array_slice(is_array($p['logistics_partner']??null)?$p['logistics_partner']:[],0,5) as $partner)if(is_array($partner))$row['partners'][]=inbound_detail_fields($partner,['company','company_contact']);
        $row['goods']=[];foreach(array_slice(is_array($p['logistics_goods']??null)?$p['logistics_goods']:[],0,30) as $good){if(!is_array($good))continue;$g=inbound_detail_fields($good,['title','property']);$g['quantity']=isset($good['quantity'])&&is_numeric($good['quantity'])?max(0,min(1000000,(int)$good['quantity'])):null;$row['goods'][]=$g;}
        $row['traces']=[];foreach(array_slice(is_array($p['logistics_traces']??null)?$p['logistics_traces']:[],0,100) as $trace)if(is_array($trace))$row['traces'][]=inbound_detail_fields($trace,['time','status','status_desc','standerd_desc','action','province','city','district','facility_name','next_city','next_node_name']);
        // The provider's timestamps are China local time; retain them verbatim.
        usort($row['traces'],static fn($a,$b)=>strcmp($b['time'],$a['time']));
        $out[]=$row;
    }
    return $out;
}
function inbound_details_public(array $o): ?array {
    $p=$o['purchase']??[];if(($p['provider']??'')!=='taoworld')return null;
    $cache=$p['domestic_tracking']??[];$children=[];
    foreach(array_slice($p['children']??[],0,60) as $child){
        $id=(string)($child['sub_purchase_order_id']??'');$detail=$cache['children'][$id]??[];
        $children[]=['id'=>$id,'purchase_id'=>$child['purchase_id']??'','taobao_order_id'=>$child['taobao_order_id']??null,'status'=>$child['status']??'UNKNOWN','quantity'=>$child['quantity']??null,
            'numbers'=>$child['parcels']??[],'parcels'=>$detail['parcels']??[],'checked_at'=>$detail['checked_at']??null,'attempted_at'=>$detail['attempted_at']??null,'error'=>!empty($detail['error'])];
    }
    return ['children'=>$children,'query_error'=>!empty($cache['query_error']),'query_attempted_at'=>$cache['query_attempted_at']??null,'cache_seconds'=>600];
}
function inbound_details_refresh(string $id,string $location): array {
    return tw_order_lock($id,static function()use($id,$location){
        $o=order_row($id)['order'];
        if(warehouse_role($location)!=='erenhot'||!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);
        tw_assert_pinned($o);
        if(empty($o['purchase']['submitted_at']))fail('Taobao захиалгын дугаар алга.',409);
        $cache=$o['purchase']['domestic_tracking']??[];$now=time();$started=microtime(true);
        // Read-only purchase queries only. Never invoke tw_run_order/create/pay here.
        if((strtotime($o['purchase']['tracked_at']??'')?:0)<$now-600&&(strtotime($cache['query_attempted_at']??'')?:0)<$now-120){
            $cache['query_attempted_at']=gmdate('c');
            try{$o=tw_query_locked($id);$cache['query_error']=false;}catch(Throwable $e){$cache['query_error']=true;}
        }
        $pending=[];
        foreach(array_slice($o['purchase']['children']??[],0,60) as $child){
            $cid=tw_id($child['sub_purchase_order_id']??null);$old=$cache['children'][$cid]??[];
            if((strtotime($old['checked_at']??'')?:0)>$now-600||(strtotime($old['attempted_at']??'')?:0)>$now-120)continue;
            $pending[]=['id'=>$cid,'old'=>$old];
        }
        usort($pending,static fn($a,$b)=>strcmp($a['old']['attempted_at']??'',$b['old']['attempted_at']??''));
        $count=0;
        foreach($pending as $job){
            if($count>=3||microtime(true)-$started>20)break;$count++;
            $cid=$job['id'];$detail=$job['old'];$detail['attempted_at']=gmdate('c');
            try{
                $data=tw_data(tw_call('/logistics/detail/get',['purchase_order_line_id'=>$cid]));
                $detail['parcels']=inbound_detail_parcels($data);$detail['checked_at']=gmdate('c');unset($detail['error']);
            }catch(Throwable $e){$detail['error']=true;}
            $cache['children'][$cid]=$detail;
        }
        return tw_update($id,static function(&$fresh)use($cache,$location){
            if(!warehouse_order_visible($fresh,$location))fail('Захиалга олдсонгүй.',404);
            tw_assert_pinned($fresh);$fresh['purchase']['domestic_tracking']=$cache;
            $numbers=[];foreach($cache['children']??[] as $detail)foreach($detail['parcels']??[] as $parcel)$numbers[]=['no'=>$parcel['mail_no'],'company'=>$parcel['partners'][0]['company']??''];
            inbound_merge($fresh,$numbers,'taoworld');
        });
    });
}
