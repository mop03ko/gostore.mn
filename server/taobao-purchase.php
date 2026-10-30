<?php
declare(strict_types=1);

// Paid customer orders are bought on Taobao through OT and shipped to the Erenhot warehouse.
// Tokens stay in the private data directory and are never returned to a browser.
function taobao_buyer_state(): array {
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['taobao_buyer']);
    return json_decode($s->fetchColumn()?:'{}',true)?:[];
}
function taobao_buyer_store(array $state): void {
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['taobao_buyer',json_encode($state,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
}
function taobao_buyer_public(): array {
    $s=taobao_buyer_state();
    return ['connected'=>!empty($s['access_token']),'account'=>$s['account']??'','connected_at'=>$s['connected_at']??null,
        'expires_at'=>isset($s['expires_at'])?gmdate('c',$s['expires_at']):null,'refresh_expires_at'=>isset($s['refresh_expires_at'])?gmdate('c',$s['refresh_expires_at']):null,
        'auto_purchase'=>($s['auto_purchase']??false)===true,'receiver'=>taobao_receiver('GS-000000')];
}
// Provider reasons are short English codes; keep them readable for the admin without markup.
// Taobao errors relayed by OT may name the missing field outside `reason`, so nearby detail fields are kept too.
function taobao_reason(?array $body,int $status): string {
    $parts=[];
    foreach([$body,$body['error']??null,$body['data']??null,$body['details']??null] as $level){
        if(!is_array($level))continue;
        foreach(['reason','message','msg','sub_code','sub_msg','detail','error_description','code'] as $key)if(is_string($level[$key]??null)&&trim($level[$key])!=='')$parts[]=trim($level[$key]);
    }
    $reason=$parts?implode(' · ',array_unique($parts)):'HTTP '.$status;
    return mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u','',$reason),0,400);
}
function taobao_oauth_tokens(array $body): array {
    foreach(['access_token','refresh_token'] as $key)if(!is_string($body[$key]??null)||$body[$key]===''||strlen($body[$key])>2000)fail('Taobao нэвтрэлтийн хариу танигдсангүй.',502);
    $now=time();
    return ['access_token'=>$body['access_token'],'refresh_token'=>$body['refresh_token'],
        'expires_at'=>$now+max(60,(int)($body['expires_in']??0)),'refresh_expires_at'=>$now+max(60,(int)($body['refresh_expires_in']??0)),
        'account'=>mb_substr((string)($body['account']??''),0,120)];
}
function taobao_buyer_authorize_url(): string {
    $r=taobao_http('GET','/v1/taobao/oauth/authorize-url',['back_url'=>rtrim(config()['site_url'],'/').'/admin/?taobao_oauth=1']);
    $url=$r['body']['url']??'';if($r['status']!==200||!is_string($url))fail('Taobao холбох холбоос авч чадсангүй: '.taobao_reason($r['body'],$r['status']),502);
    $p=parse_url($url);$host=strtolower($p['host']??'');$allowed=false;
    foreach(['taobao.global','otdev.net','otapi.net'] as $domain)if($host===$domain||str_ends_with($host,'.'.$domain))$allowed=true;
    if(!$allowed||($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['port']))fail('Taobao нэвтрэх холбоосыг баталгаажуулж чадсангүй.',502);
    return $url;
}
function taobao_buyer_connect(string $code): array {
    if($code===''||strlen($code)>2000||preg_match('/[\x00-\x20]/',$code))fail('Taobao баталгаажуулах код буруу.');
    $r=taobao_http('POST','/v1/taobao/oauth/token',[],null,['code'=>$code]);
    if($r['status']!==200||!$r['body'])fail('Taobao данс холбогдсонгүй: '.taobao_reason($r['body'],$r['status']),502);
    $old=taobao_buyer_state();
    taobao_buyer_store(taobao_oauth_tokens($r['body'])+['connected_at'=>gmdate('c'),'auto_purchase'=>($old['auto_purchase']??false)===true]);
    return taobao_buyer_public();
}
function taobao_access_token(): string {
    $s=taobao_buyer_state();
    if(empty($s['access_token']))fail('Taobao худалдан авагчийн данс холбогдоогүй байна. Админ → Тохиргоо хэсгээс холбоно уу.',409);
    if($s['expires_at']>time()+300)return $s['access_token'];
    if(($s['refresh_expires_at']??0)<=time()+60)fail('Taobao дансны холболтын хугацаа дууссан. Дахин холбоно уу.',409);
    $r=taobao_http('POST','/v1/taobao/oauth/refresh',[],null,['refresh_token'=>$s['refresh_token']]);
    if($r['status']!==200||!$r['body'])fail('Taobao токен шинэчилж чадсангүй: '.taobao_reason($r['body'],$r['status']),502);
    $s=array_replace($s,taobao_oauth_tokens($r['body']));if(($s['account']??'')==='')unset($s['account']);
    taobao_buyer_store($s);return $s['access_token'];
}
// Erenhot warehouse; the GS code in the receiver name lets the warehouse match each parcel.
function taobao_receiver(string $orderId): array {
    $s=shipping_settings();
    return ['name'=>$orderId.' GOStore','mobile_phone'=>$s['warehouse_phone'],'country'=>'China','state'=>'内蒙古自治区','city'=>'锡林郭勒盟','district'=>'二连浩特市','zip'=>'011100','address'=>$s['warehouse_address']];
}
function taobao_order_items(array $o): array {
    $lines=$o['items']??(isset($o['supplier'])?[$o['supplier']]:[]);$items=[];
    if(!$lines)fail('Захиалгад Taobao бараа алга.',409);
    foreach($lines as $l){
        if(!preg_match('/^tb-(\d{5,20})$/D',(string)($l['id']??''),$m))fail('Зөвхөн Taobao барааг API-аар захиална. 1688 барааг гараар худалдаж авна.',409);
        $item=['item_id'=>$m[1],'quantity'=>(int)$l['qty']];
        if(($l['sku']??'standard')!=='standard')$item['sku_id']=(string)$l['sku'];
        $items[]=$item;
    }
    return $items;
}
function taobao_order_body(array $o): array {
    return ['items'=>taobao_order_items($o),'receiver'=>taobao_receiver($o['id']),'access_token'=>taobao_access_token()];
}
// Provider payloads are free-form; keep a bounded copy and any order identifiers found in it.
function taobao_provider_ids(mixed $value,array &$ids=[],int $depth=0): array {
    if($depth>6||!is_array($value)||count($ids)>=10)return $ids;
    foreach($value as $key=>$child){
        if(is_string($key)&&preg_match('/^(?:order_?id|trade_?id|orderId|tradeId|purchase_order_id)s?$/i',$key)){
            foreach(is_array($child)?$child:[$child] as $v)if((is_string($v)||is_int($v))&&preg_match('/^[A-Za-z0-9_-]{4,64}$/',(string)$v))$ids[]=(string)$v;
        }elseif(is_array($child))taobao_provider_ids($child,$ids,$depth+1);
    }
    return array_values(array_unique(array_slice($ids,0,10)));
}
function taobao_trim_payload(?array $body): string {
    return mb_substr(json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)?:'',0,8000);
}
function taobao_purchase_preview(string $id): array {
    $o=order_row($id)['order'];$r=taobao_http('POST','/v1/taobao/order/render',[],taobao_order_body($o));
    if($r['status']!==200)fail('Taobao тооцоо гаргасангүй: '.taobao_reason($r['body'],$r['status']),502);
    return ['render'=>taobao_trim_payload($r['body'])];
}
function taobao_purchase_check(array $o): void {
    if(isset($o['purchase']['provider'])&&$o['purchase']['provider']!=='ot')fail('Энэ захиалга өөр худалдан авалтын холболтод хамаарна.',409);
    product_policy_order_assert($o);
    if(!$o['paid']||in_array($o['status'],['cancelled','completed'],true))fail('Зөвхөн төлбөр орсон идэвхтэй захиалгыг Taobao-д захиална.',409);
    if(in_array($o['purchase']['state']??'',['creating','created','review'],true))fail('Энэ захиалгыг Taobao-д захиалсан эсвэл шалгаж байна.',409);
}
function taobao_purchase_create(string $id,bool $auto=false): array {
    // Token refresh may call the network, so the request body is prepared before locking the database.
    $o=order_row($id)['order'];taobao_purchase_check($o);$body=taobao_order_body($o);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];taobao_purchase_check($o);$attempt=(int)($o['purchase']['attempt']??0)+1;
        // A retry after a confirmed provider rejection uses a new external order number.
        $body=['order_id'=>$attempt>1?$id.'-'.$attempt:$id]+$body;
        $o['purchase']=['state'=>'creating','attempt'=>$attempt,'auto'=>$auto,'order_id'=>$body['order_id'],'started_at'=>gmdate('c')];
        save_order($o);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    try{$r=taobao_http('POST','/v1/taobao/order/create',[],$body);$error=null;}catch(Throwable $e){$r=null;$error=$e;}
    $db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];$p=$o['purchase'];
        if($r===null||$r['status']>=500){$p['state']='review';$p['error']='Хариу тодорхойгүй. Taobao Global дээр '.$p['order_id'].' захиалга үүссэн эсэхийг шалгаад шийдвэрлэнэ үү.';}
        elseif($r['status']===200&&is_array($r['body'])){$p['state']='created';$p['created_at']=gmdate('c');$p['provider_order_ids']=taobao_provider_ids($r['body']);$p['response']=taobao_trim_payload($r['body']);unset($p['error']);}
        else{$p['state']='failed';$p['error']=taobao_reason($r['body'],$r['status']);$p['response']=taobao_trim_payload($r['body']);}
        $p['finished_at']=gmdate('c');$o['purchase']=$p;save_order($o);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    if($error&&!($error instanceof ApiError))error_log('GOStore Taobao purchase: '.get_class($error));
    return $o;
}
// Admin decision for an ambiguous attempt after checking the Taobao Global account.
function taobao_purchase_resolve(string $id,array $b): array {
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];if(isset($o['purchase']['provider'])&&$o['purchase']['provider']!=='ot')fail('Энэ захиалгыг TaoWorld-оор тулган шалгана.',409);if(($o['purchase']['state']??'')!=='review')fail('Шийдвэрлэх шаардлагагүй.',409);
        $outcome=str_field($b,'outcome',10);if(!in_array($outcome,['created','failed'],true))fail('Шийдвэр буруу.');
        $o['purchase']['state']=$outcome;$o['purchase']['resolved_at']=gmdate('c');
        if($outcome==='created'){$provider=str_field($b,'provider_order_id',64);if(!preg_match('/^[A-Za-z0-9_-]{4,64}$/',$provider))fail('Taobao захиалгын дугаар буруу.');$o['purchase']['provider_order_ids']=[$provider];$o['purchase']['created_at']=gmdate('c');unset($o['purchase']['error']);}
        else $o['purchase']['error']='Админ үүсээгүй гэж баталгаажуулсан.';
        save_order($o);$db->exec('COMMIT');return $o;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function taobao_purchase_track(string $id): array {
    if((order_row($id)['order']['purchase']['provider']??'')==='taoworld')return tw_run_order($id);
    $o=order_row($id)['order'];$provider=$o['purchase']['provider_order_ids'][0]??null;
    if(($o['purchase']['state']??'')!=='created'||!$provider)fail('Taobao захиалгын дугаар алга.',409);
    $r=taobao_http('GET','/v1/taobao/order/tracker/'.rawurlencode($provider),['access_token'=>taobao_access_token()]);
    if($r['status']!==200)fail('Taobao хүргэлтийн мэдээлэл авч чадсангүй: '.taobao_reason($r['body'],$r['status']),502);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];$o['purchase']['tracking']=taobao_trim_payload($r['body']);$o['purchase']['tracked_at']=gmdate('c');
        inbound_merge($o,inbound_tracking_extract($r['body']),'taobao');$o['inbound']['checked_at']=gmdate('c');
        $status=inbound_status_text($r['body']);if($status!=='')$o['inbound']['status']=$status;
        save_order($o);$db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return $o;
}
// Called after QPay confirms the first payment. Failures stay on the order for the admin.
function taobao_purchase_after_payment(string $id): void {
    try{
        if(function_exists('tw_settings')&&tw_settings()['enabled'])return;
        if((taobao_buyer_state()['auto_purchase']??false)!==true)return;
        $o=order_row($id)['order'];if(!$o['paid']||isset($o['purchase'])||($o['type']??'')!=='checkout')return;
        taobao_purchase_create($id,true);
    }catch(Throwable $e){error_log('GOStore automatic Taobao purchase deferred: '.$e->getMessage());}
}
function taobao_admin_post(string $action,array $b): never {
    admin_required();limit_attempts('taobao-admin:'.($_SERVER['REMOTE_ADDR']??'cli'),60,900);
    if($action==='taobao-buyer-authorize')json_out(['url'=>taobao_buyer_authorize_url()]);
    if($action==='taobao-buyer-connect')json_out(['taobao_buyer'=>taobao_buyer_connect(str_field($b,'code',2000))]);
    if($action==='taobao-buyer-disconnect'){$s=taobao_buyer_state();taobao_buyer_store(['auto_purchase'=>false]);json_out(['taobao_buyer'=>taobao_buyer_public()]);}
    if($action==='taobao-buyer-auto'){$s=taobao_buyer_state();if(!is_bool($b['enabled']??null))fail('Тохиргоо буруу.');if($b['enabled']&&function_exists('tw_settings')&&tw_settings()['enabled'])fail('Эхлээд TaoWorld автомат худалдан авалтыг унтраана уу.',409);if($b['enabled']&&empty($s['access_token']))fail('Эхлээд Taobao данс холбоно уу.',409);$s['auto_purchase']=$b['enabled'];taobao_buyer_store($s);json_out(['taobao_buyer'=>taobao_buyer_public()]);}
    $id=str_field($b,'id',50);
    if($action==='taobao-purchase-preview')json_out(taobao_purchase_preview($id));
    if($action==='taobao-purchase-create')json_out(['order'=>taobao_purchase_create($id)]);
    if($action==='taobao-purchase-resolve')json_out(['order'=>taobao_purchase_resolve($id,$b)]);
    if($action==='taobao-purchase-track')json_out(['order'=>taobao_purchase_track($id)]);
    if($action==='taobao-purchase-tracking-add')json_out(['order'=>inbound_add_manual($id,$b)]);
    fail('Үйлдэл олдсонгүй.',404);
}

// Inbound China-domestic parcels heading to Erenhot. Numbers come from the OT tracker or are typed in
// by staff, so a courier barcode scan finds the matching GS order.
function inbound_tracking_extract(mixed $value,array &$found=[],int $depth=0): array {
    if($depth>8||!is_array($value)||count($found)>=10)return $found;
    $number=null;$company='';
    foreach($value as $key=>$child){
        if(!is_string($key))continue;$k=strtolower(str_replace(['_','-'],'',$key));
        if(in_array($k,['trackingno','trackingnumber','mailno','waybillno','waybillnumber','expressno','logisticsno','outsid','shipmentno','trackno'],true)&&(is_string($child)||is_int($child)))$number=(string)$child;
        if(in_array($k,['company','companyname','logisticscompany','logisticscompanyname','expresscompany','cpname','carrier','carriername'],true)&&is_string($child))$company=$child;
    }
    if($number!==null&&preg_match('/^[A-Za-z0-9-]{6,40}$/',$number))$found[]=['no'=>strtoupper($number),'company'=>mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u','',$company),0,60)];
    foreach($value as $child)if(is_array($child))inbound_tracking_extract($child,$found,$depth+1);
    return $found;
}
function inbound_status_text(mixed $value,int $depth=0): string {
    if($depth>8||!is_array($value))return '';
    foreach($value as $key=>$child)if(is_string($key)&&is_string($child)&&in_array(strtolower(str_replace('_','',$key)),['statusdesc','logisticsstatus','actiondesc','desc','context','status'],true)&&trim($child)!=='')return mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u','',$child),0,160);
    foreach($value as $child){$text=inbound_status_text($child,$depth+1);if($text!=='')return $text;}
    return '';
}
function inbound_merge(array &$o,array $numbers,string $source): void {
    $list=$o['inbound']['numbers']??[];$known=array_column($list,'no');
    foreach($numbers as $n){if(in_array($n['no'],$known,true)||count($list)>=20)continue;$list[]=$n+['source'=>$source,'added_at'=>gmdate('c')];$known[]=$n['no'];}
    $o['inbound']['numbers']=$list;
}
function inbound_add_manual(string $id,array $b,?string $location=null): array {
    $number=strtoupper(str_field($b,'number',40));$company=str_field($b,'company',60,false);
    if(!preg_match('/^[A-Z0-9-]{6,40}$/',$number))fail('Tracking дугаар буруу.');
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $o=order_row($id)['order'];
        if($location!==null&&(!warehouse_order_visible($o,$location)||!in_array($o['status'],['confirmed','shipping'],true)))fail('Захиалга олдсонгүй.',404);
        inbound_merge($o,[['no'=>$number,'company'=>$company]],$location===null?'admin':'warehouse');save_order($o);$db->exec('COMMIT');return $o;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function inbound_public(array $o): array {
    $p=$o['purchase']??[];
    return ['numbers'=>array_map(fn($n)=>array_intersect_key($n,array_flip(['no','company','source'])),$o['inbound']['numbers']??[]),'status'=>$o['inbound']['status']??'','checked_at'=>$o['inbound']['checked_at']??null,
        'provider_order_ids'=>$p['provider_order_ids']??[],'trackable'=>(($p['provider']??'')==='taoworld'&&!empty($p['submitted_at']))||(($p['state']??'')==='created'&&!empty($p['provider_order_ids']))];
}
// Erenhot list views refresh a few stale purchases after the response has been sent.
function inbound_schedule_refresh(): void {
    if(!function_exists('fastcgi_finish_request')||empty(taobao_buyer_state()['access_token']))return;
    $db=db();$s=$db->prepare('SELECT value FROM meta WHERE key=?');$s->execute(['inbound_refresh_run']);if((int)$s->fetchColumn()>time()-600)return;
    $db->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute(['inbound_refresh_run',(string)time()]);
    register_shutdown_function(static function(){
        ignore_user_abort(true);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();fastcgi_finish_request();
        foreach(inbound_refresh_candidates(5) as $id){try{taobao_purchase_track($id);}catch(Throwable $e){error_log('GOStore inbound tracking deferred');}}
    });
}
function inbound_refresh_candidates(int $limit,?int $now=null): array {
    $now??=time();$ids=[];
    $s=db()->prepare("SELECT id,data FROM orders WHERE data LIKE '%\"state\":\"created\"%' ORDER BY created");$s->execute();
    foreach($s->fetchAll() as $row){
        $o=json_decode($row['data'],true);
        if(!is_array($o)||!in_array($o['status']??'',['confirmed','shipping'],true)||($o['purchase']['state']??'')!=='created')continue;
        if((strtotime($o['inbound']['checked_at']??'')?:0)>$now-10800)continue;
        $ids[]=$row['id'];if(count($ids)>=$limit)break;
    }
    return $ids;
}
function inbound_warehouse_post(string $action,array $b,string $location): never {
    if(warehouse_role($location)!=='erenhot')fail('Эрээн агуулахад ирж буй ачааг бүртгэнэ.',403);
    limit_attempts('inbound:'.$location.':'.($_SERVER['REMOTE_ADDR']??''),60,900);
    $id=str_field($b,'id',50);
    if($action==='warehouse-inbound-add')$o=inbound_add_manual($id,$b,$location);
    elseif($action==='warehouse-inbound-refresh'){$o=order_row($id)['order'];if(!warehouse_order_visible($o,$location))fail('Захиалга олдсонгүй.',404);$o=taobao_purchase_track($id);}
    else fail('Үйлдэл олдсонгүй.',404);
    json_out(['order'=>warehouse_order_public($o,$location)]);
}
