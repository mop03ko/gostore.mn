<?php
declare(strict_types=1);

// Signed-in shoppers keep their cart and saved products across devices.
// The browser copy stays the working list; the server stores a bounded, re-validated snapshot.
// Prices in it are display hints only: checkout always re-prices every line.
const CUSTOMER_CART_MAX = 30;
const CUSTOMER_FAVORITES_MAX = 100;

function customer_state_text(mixed $v,int $max): string {
    return is_string($v)?mb_substr(preg_replace('/[\x00-\x1F\x7F]/u','',$v)??'',0,$max):'';
}
function customer_state_int(mixed $v,int $min,int $max): ?int {
    return is_int($v)&&$v>=$min&&$v<=$max?$v:null;
}
function customer_state_money(mixed $v): int|float|null {
    return (is_int($v)||is_float($v))&&is_finite((float)$v)&&$v>=0&&$v<=100000000?$v:null;
}
function customer_state_url(mixed $v): string {
    $v=customer_state_text($v,1000);
    return preg_match('#^https://[^\s"\'<>\\\\]+$#',$v)?$v:'';
}
function customer_state_blocked(array $item): bool {
    return function_exists('product_policy_blocked')&&product_policy_blocked($item);
}
function customer_state_cart(mixed $items): array {
    if(!is_array($items)||!array_is_list($items))fail('Сагсны мэдээлэл буруу байна.');
    $out=[];$seen=[];
    foreach(array_slice($items,0,CUSTOMER_CART_MAX) as $i){
        if(!is_array($i)||!is_string($i['id']??null)||!preg_match('/^(?:tb|abb)-[0-9]{5,20}$/D',$i['id']))continue;
        $sku=customer_state_text($i['sku']??null,150);$qty=customer_state_int($i['qty']??null,1,9999);
        $min=customer_state_int($i['min_qty']??null,1,9999);$step=customer_state_int($i['step']??null,1,9999);
        $key=$i['id'].'|'.$sku;
        if($sku===''||$qty===null||$min===null||$step===null||isset($seen[$key]))continue;
        $line=['id'=>$i['id'],'sku'=>$sku,'qty'=>$qty,'name'=>customer_state_text($i['name']??null,500),'image'=>customer_state_url($i['image']??null),
            'variant'=>customer_state_text($i['variant']??null,300),'cny'=>customer_state_money($i['cny']??null),'min_qty'=>$min,'step'=>$step,
            'stock'=>customer_state_int($i['stock']??null,0,100000000),'vendor_id'=>customer_state_text($i['vendor_id']??null,100),'vendor_name'=>customer_state_text($i['vendor_name']??null,200)];
        if(customer_state_blocked($line))continue;
        $seen[$key]=true;$out[]=$line;
    }
    return $out;
}
function customer_state_favorites(mixed $items): array {
    if(!is_array($items)||!array_is_list($items))fail('Хадгалсан барааны мэдээлэл буруу байна.');
    $out=[];$seen=[];
    foreach(array_slice($items,0,CUSTOMER_FAVORITES_MAX) as $p){
        if(!is_array($p)||!is_string($p['id']??null)||!preg_match('/^tb-[0-9]{5,20}$/D',$p['id'])||isset($seen[$p['id']]))continue;
        $card=['id'=>$p['id'],'provider'=>customer_state_text($p['provider']??null,30),'provider_label'=>customer_state_text($p['provider_label']??null,60),
            'name'=>customer_state_text($p['name']??null,500),'image'=>customer_state_url($p['image']??null),'url'=>customer_state_url($p['url']??null),
            'cny'=>customer_state_money($p['cny']??null),'mnt'=>customer_state_money($p['mnt']??null),'approx_cny'=>customer_state_money($p['approx_cny']??null),
            'approx_mnt'=>customer_state_money($p['approx_mnt']??null),'min_qty'=>customer_state_int($p['min_qty']??null,1,9999)??1,
            'step'=>customer_state_int($p['step']??null,1,9999)??1,'sellable'=>($p['sellable']??true)===true,
            'sold_count'=>customer_state_int($p['sold_count']??null,0,PHP_INT_MAX),'sales_30_days'=>customer_state_int($p['sales_30_days']??null,0,PHP_INT_MAX),
            'price_status'=>customer_state_text($p['price_status']??null,30),'variants'=>[]];
        if(customer_state_blocked($card))continue;
        $seen[$p['id']]=true;$out[]=$card;
    }
    return $out;
}
// Unpaid instant checkouts that can still be paid; shown as a reminder on every page.
function customer_state_pending(array $c): array {
    $s=db()->prepare('SELECT o.data FROM orders o JOIN customer_orders co ON co.order_id=o.id WHERE co.customer_id=? ORDER BY o.created DESC LIMIT 20');
    $s->execute([$c['id']]);$pending=[];
    foreach($s->fetchAll() as $row){
        $o=json_decode($row['data'],true);
        if(!is_array($o)||($o['type']??'')!=='checkout'||($o['status']??'')!=='quoted'||!empty($o['paid']))continue;
        $due=strtotime((string)($o['payment_due']??''));if(!$due||$due<=time())continue;
        $pending[]=['id'=>$o['id'],'amount'=>(int)($o['amount']??0),'payment_due'=>gmdate('c',$due)];
    }
    return $pending;
}
function customer_state_row(array $c): array {
    $s=db()->prepare('SELECT cart,favorites,version FROM customer_state WHERE customer_id=?');$s->execute([$c['id']]);$r=$s->fetch();
    return ['cart'=>$r?json_decode($r['cart'],true):[],'favorites'=>$r?json_decode($r['favorites'],true):[],'version'=>$r?(int)$r['version']:0];
}
function customer_state_get(array $c): array {
    return customer_state_row($c)+['pending'=>customer_state_pending($c)];
}
function customer_state_save(array $c,array $b): array {
    limit_attempts('customer-state:'.$c['id'],240,3600);
    $db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $current=customer_state_row($c);
        $cart=array_key_exists('cart',$b)?customer_state_cart($b['cart']):$current['cart'];
        $favorites=array_key_exists('favorites',$b)?customer_state_favorites($b['favorites']):$current['favorites'];
        $version=$current['version']+1;
        $db->prepare('INSERT INTO customer_state (customer_id,cart,favorites,version,updated) VALUES (?,?,?,?,?) ON CONFLICT(customer_id) DO UPDATE SET cart=excluded.cart,favorites=excluded.favorites,version=excluded.version,updated=excluded.updated')
            ->execute([$c['id'],json_encode($cart,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),json_encode($favorites,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$version,gmdate('c')]);
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    return ['cart'=>$cart,'favorites'=>$favorites,'version'=>$version];
}
