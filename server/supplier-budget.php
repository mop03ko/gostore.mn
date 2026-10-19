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
        $db->exec('RELEASE SAVEPOINT supplier_budget');
    }catch(Throwable $e){$db->exec('ROLLBACK TO SAVEPOINT supplier_budget');$db->exec('RELEASE SAVEPOINT supplier_budget');throw $e;}
}
