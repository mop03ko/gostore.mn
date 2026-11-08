<?php
declare(strict_types=1);
// Promotional popup: shown on the website's home page and when the app opens, at most once a day per
// device for each popup. Admins edit it on «Мэдэгдэл илгээх»; one popup at a time, kept in meta.
const PROMO_POPUP_KEY='promo_popup';

function promo_popup_settings(): array {
    $s=db()->prepare('SELECT value FROM meta WHERE key=?');$s->execute([PROMO_POPUP_KEY]);
    $v=json_decode((string)$s->fetchColumn(),true);
    return (is_array($v)?$v:[])+['enabled'=>false,'id'=>'','title'=>'','text'=>'','image'=>'','button'=>'','link'=>'','starts'=>'','ends'=>'','updated'=>''];
}

function promo_popup_live(array $p,int $now): bool {
    return $p['enabled']&&($p['image']!==''||$p['title']!=='')
        &&($p['starts']===''||strtotime($p['starts'])<=$now)&&($p['ends']===''||strtotime($p['ends'])>$now);
}

// What shoppers receive: null when switched off, empty or outside its dates.
function promo_popup_public(?int $now=null): ?array {
    $p=promo_popup_settings();
    if(!promo_popup_live($p,$now??time()))return null;
    return ['id'=>$p['id'],'title'=>$p['title'],'text'=>$p['text'],'image'=>$p['image']!==''?'/assets/'.$p['image'].'.jpg':'','button'=>$p['button'],'link'=>$p['link']];
}

function promo_popup_admin(): array {
    $p=promo_popup_settings();
    return ['popup'=>$p,'live'=>promo_popup_live($p,time()),'preview'=>$p['image']!==''?'/assets/'.$p['image'].'.jpg':''];
}

function promo_popup_save(array $b): array {
    $enabled=$b['enabled']??false;if(!is_bool($enabled))fail('Талбар буруу: enabled');
    $title=str_field($b,'title',80,false);$text=str_field($b,'text',300,false);$button=str_field($b,'button',30,false);
    // Images come from the admin image upload (assets/uploads/<32 hex>.jpg).
    $image=str_field($b,'image',60,false);
    if($image!==''&&(!preg_match('#^uploads/[a-f0-9]{32}$#D',$image)||!is_file(__DIR__.'/../assets/'.$image.'.jpg')))fail('Зураг олдсонгүй. Дахин оруулна уу.');
    // A page on this site (/v/…, /official-stores, /?q=…) or an https address.
    $link=str_field($b,'link',500,false);
    if($link!==''&&!preg_match('#^(?:/(?!/)|https://)[^\s<>"\'\\\\]*$#D',$link))fail('Холбоос «/»-ээр (сайтын хуудас) эсвэл https://-ээр эхэлнэ.');
    $dates=[];
    foreach(['starts','ends'] as $k){
        $v=str_field($b,$k,40,false);
        if($v!==''&&(!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/D',$v)||strtotime($v)===false))fail('Огноо буруу.');
        $dates[$k]=$v;
    }
    if($dates['starts']!==''&&$dates['ends']!==''&&strtotime($dates['ends'])<=strtotime($dates['starts']))fail('Дуусах хугацаа эхлэхээс хойш байх ёстой.');
    if($enabled&&$image===''&&$title==='')fail('Зураг эсвэл гарчиг оруулна уу.');
    $p=['enabled'=>$enabled,'title'=>$title,'text'=>$text,'image'=>$image,'button'=>$button,'link'=>$link,'starts'=>$dates['starts'],'ends'=>$dates['ends']];
    // Same content keeps its id (visitors who closed it today are not asked again); new content shows again.
    $p['id']=substr(hash('sha256',json_encode([$title,$text,$image,$button,$link],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)),0,12);
    $p['updated']=gmdate('Y-m-d\TH:i:s\Z');
    db()->prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')->execute([PROMO_POPUP_KEY,json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    return promo_popup_admin();
}
