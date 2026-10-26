<?php
declare(strict_types=1);

// Applies to every customer and payment method, including cached supplier data.
// Bump the version when rules change so snapshots are reclassified from raw data.
const PRODUCT_POLICY_VERSION = 1;
// Confirmed listings in the live catalog audit on 2026-10-26. Keep blocked if renamed.
const PRODUCT_POLICY_TAOBAO_IDS = ['820391759756','890435819512','969448181837','1076875933199','986957554392','964068539697','651837891440','589448620660'];
const PRODUCT_POLICY_PATTERN = '~(?<![\p{L}\p{N}])(?:knif\p{L}*|kniv\p{L}*|pocketknife\p{L}*|penknife\p{L}*|jackknife\p{L}*|switchblade\p{L}*|cleaver\p{L}*|dagger\p{L}*|machete\p{L}*|bayonet\p{L}*|sword\p{L}*|katana\p{L}*|scalpel\p{L}*|blade\p{L}*|box[\s-]*cutter\p{L}*|cutlery|whetstone\p{L}*|хутг\p{L}*|чинжаал\p{L}*|сэлэм\p{L}*|тонгорог\p{L}*|khutg\p{L}*|нож(?:и|ей|ом|ами|ах|а|у|ик\p{L}*|ны|евой|евые)?|клинок|кинжал\p{L}*)(?![\p{L}\p{N}])|刀|匕首~iu';

function product_policy_text_blocked(string $text): bool {
    $text=html_entity_decode(strip_tags($text),ENT_QUOTES|ENT_HTML5,'UTF-8');
    $text=preg_replace('/[\p{Cf}\x{00AD}]/u','',$text)??$text;
    return preg_match(PRODUCT_POLICY_PATTERN,$text)===1;
}
// Inspect product text, not URL filenames, customer addresses or unrelated recommendations.
function product_policy_blocked(array $product): bool {
    $id=(string)($product['id']??$product['Id']??'');
    if(in_array(preg_replace('/^tb-/','',$id),PRODUCT_POLICY_TAOBAO_IDS,true))return true;
    $fields=['Title','OriginalTitle','Description','CategoryName','RootPath','Attributes','ConfiguredItems','Promotions','name','original_name','description','category','category_path','attributes','variants','variant','label','offers'];
    $visit=static function(mixed $value)use(&$visit):bool {
        if(is_string($value))return product_policy_text_blocked($value);
        if(is_array($value))foreach($value as $key=>$child){
            if(is_string($key)&&preg_match('/(?:url|image|picture|id|code)$/i',$key))continue;
            if($visit($child))return true;
        }
        return false;
    };
    foreach($fields as $field)if(isset($product[$field])&&$visit($product[$field]))return true;
    return false;
}
function product_policy_assert(array $product,int $status=404): void {
    if(product_policy_blocked($product))fail('Энэ бараа худалдаанд байхгүй байна. Өөр бараа сонгоно уу.',$status);
}
function product_policy_order_assert(array $order): void {
    product_policy_assert(['name'=>$order['title']??''],409);
    if(is_array($order['supplier']??null))product_policy_assert($order['supplier'],409);
    foreach($order['items']??[] as $item)if(is_array($item))product_policy_assert($item,409);
}
