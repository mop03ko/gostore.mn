<?php
declare(strict_types=1);

// One shared daily budget; background work cannot consume checkout's reserve.
function supplier_budget_status(): array {
    $limit=(int)shipping_settings()['api_daily_limit'];
    $read=static function(string $name):int{$s=db()->prepare('SELECT hits FROM limits WHERE key=? AND expires>?');$s->execute([hash('sha256',$name.':'.gmdate('Y-m-d')),time()]);return max(0,(int)$s->fetchColumn());};
    $used=$read('supplier-budget');$background=$read('supplier-background');
    $reserve=max(1,(int)ceil($limit*.2));
    return ['date'=>gmdate('Y-m-d'),'limit'=>$limit,'used'=>$used,'remaining'=>max(0,$limit-$used),'checkout_reserve'=>$reserve,'browse_limit'=>max(0,$limit-$reserve),'background_limit'=>(int)floor($limit/2),'background_used'=>$background];
}
function supplier_budget_take(bool $warming,bool $purchase=false): void {
    $db=db();$db->exec('SAVEPOINT supplier_budget');
    try{
        // Acquire the SQLite writer lock before inspecting counts, including on old cPanel SQLite.
        $expires=strtotime('tomorrow UTC');
        foreach(['supplier-budget','supplier-background'] as $name)$db->prepare('INSERT OR IGNORE INTO limits VALUES (?,0,?)')->execute([hash('sha256',$name.':'.gmdate('Y-m-d')),$expires]);
        $b=supplier_budget_status();$ceiling=$purchase?$b['limit']:$b['browse_limit'];
        if($b['used']>=$ceiling||($warming&&$b['background_used']>=$b['background_limit']))fail('Шинэ мэдээлэл авах API төсөв түр хүрэлцэхгүй байна. Дараа дахин оролдоно уу.',429);
        foreach($warming?['supplier-budget','supplier-background']:['supplier-budget'] as $name)$db->prepare('UPDATE limits SET hits=hits+1 WHERE key=?')->execute([hash('sha256',$name.':'.gmdate('Y-m-d'))]);
        supplier_budget_record(($warming?'bg:':'').($purchase?'checkout':supplier_budget_kind()));
        $db->exec('RELEASE SAVEPOINT supplier_budget');
    }catch(Throwable $e){$db->exec('ROLLBACK TO SAVEPOINT supplier_budget');$db->exec('RELEASE SAVEPOINT supplier_budget');throw $e;}
}
// Daily usage history by kind (UTC days, like the budget) for the admin usage panel; kept 120 days.
function supplier_budget_schema(): void {
    static $done=false;if($done)return;
    db()->exec('CREATE TABLE IF NOT EXISTS supplier_budget_daily (day TEXT NOT NULL, kind TEXT NOT NULL, hits INTEGER NOT NULL, PRIMARY KEY(day,kind))');$done=true;
}
function supplier_budget_record(string $kind): void {
    supplier_budget_schema();$db=db();$day=gmdate('Y-m-d');
    $new=$db->prepare('INSERT OR IGNORE INTO supplier_budget_daily VALUES (?,?,0)');$new->execute([$day,$kind]);
    $db->prepare('UPDATE supplier_budget_daily SET hits=hits+1 WHERE day=? AND kind=?')->execute([$day,$kind]);
    if($new->rowCount()===1)$db->prepare('DELETE FROM supplier_budget_daily WHERE day<?')->execute([gmdate('Y-m-d',time()-120*86400)]);
}
// What a provider call is for, from the calling code path (store pages, brands, home feed, shipping,
// image search, recommendations, then the TaoWorld path itself).
function supplier_budget_kind(): string {
    $names=[];$path='';
    foreach(debug_backtrace(0,14) as $frame){$fn=(string)($frame['function']??'');$names[]=$fn;if($fn==='tw_catalog_call'&&$path==='')$path=(string)($frame['args'][0]??'');}
    foreach(['official_store'=>'official','tw_catalog_brand'=>'brand','supplier_brand'=>'brand','tw_catalog_home'=>'home','tw_domestic'=>'shipping','tw_product_logistics'=>'shipping','tw_catalog_image'=>'image','supplier_image'=>'image','tw_catalog_recommend'=>'recommend','catalog_store_test'=>'official'] as $prefix=>$kind)
        foreach($names as $fn)if(str_starts_with($fn,$prefix))return $kind;
    if(in_array('tw_catalog_search_pages',$names,true))return 'search';
    return match($path){'/traffic/item/search'=>'search','/traffic/item/get'=>'detail','/traffic/item/imgsearch','/upload/image'=>'image','/traffic/item/batchGetSourceItemLogisticPrice'=>'shipping',default=>in_array('supplier_raw_request',$names,true)?'ot':'other'};
}
