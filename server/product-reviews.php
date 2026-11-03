<?php
declare(strict_types=1);
function reviews_schema(): void {
    static $ready=false;if($ready)return;
    db()->exec("CREATE TABLE IF NOT EXISTS product_reviews (id TEXT PRIMARY KEY, product TEXT NOT NULL, title TEXT NOT NULL, customer TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'visible', created TEXT NOT NULL, updated TEXT NOT NULL, UNIQUE(product,customer));
    CREATE INDEX IF NOT EXISTS product_reviews_product ON product_reviews(product,status,created);
    CREATE TABLE IF NOT EXISTS product_review_photos (id TEXT PRIMARY KEY, review TEXT NOT NULL, image BLOB NOT NULL);
    CREATE INDEX IF NOT EXISTS product_review_photos_review ON product_review_photos(review);
    CREATE TABLE IF NOT EXISTS product_review_reports (review TEXT NOT NULL, customer TEXT NOT NULL, reason TEXT NOT NULL, created TEXT NOT NULL, PRIMARY KEY(review,customer));");$ready=true;
}
function review_number(array $b,string $key,int $min,int $max): int {
    $v=filter_var($b[$key]??null,FILTER_VALIDATE_INT);if($v===false||$v<$min||$v>$max)fail('Тоо буруу: '.$key);return $v;
}
function reviews_product(array $b): string {
    $id=str_field($b,'product',60);if(!preg_match('/^[a-z0-9-]{1,60}$/D',$id))fail('Барааны код буруу.');return $id;
}
function review_photos(string $id): array {
    $s=db()->prepare('SELECT id FROM product_review_photos WHERE review=? ORDER BY id');$s->execute([$id]);return array_map(fn($p)=>'/api/index.php?action=review-photo&id='.$p['id'],$s->fetchAll());
}
function review_public(array $r,?array $c): array {
    return ['id'=>$r['id'],'product'=>$r['product'],'rating'=>(int)$r['rating'],'comment'=>$r['comment'],'author'=>mb_substr(trim($r['name']),0,2).'***','created'=>$r['created'],'updated'=>$r['updated'],'mine'=>$c&&$c['id']===$r['customer'],'status'=>$r['status'],'photos'=>review_photos($r['id'])];
}
function reviews_get(): array {
    reviews_schema();$id=reviews_product($_GET);$page=review_number($_GET+['page'=>1],'page',1,10000);$c=current_customer();
    $s=db()->prepare("SELECT count(*) total,avg(rating) average FROM product_reviews WHERE product=? AND status='visible'");$s->execute([$id]);$summary=$s->fetch();
    $s=db()->prepare("SELECT r.*,c.name FROM product_reviews r JOIN customers c ON c.id=r.customer WHERE r.product=? AND r.status='visible' ORDER BY r.created DESC,r.id DESC LIMIT 20 OFFSET ".(($page-1)*20));$s->execute([$id]);$rows=$s->fetchAll();
    $mine=null;if($c){$s=db()->prepare('SELECT r.*,c.name FROM product_reviews r JOIN customers c ON c.id=r.customer WHERE r.product=? AND r.customer=?');$s->execute([$id,$c['id']]);if($r=$s->fetch())$mine=review_public($r,$c);}
    return ['reviews'=>array_map(fn($r)=>review_public($r,$c),$rows),'total'=>(int)$summary['total'],'average'=>$summary['average']===null?null:round((float)$summary['average'],1),'more'=>$page*20<(int)$summary['total'],'mine'=>$mine,'authenticated'=>(bool)$c,'csrf'=>$_SESSION['csrf']];
}
function review_photo(): never {
    reviews_schema();$id=str_field($_GET,'id',32);$s=db()->prepare("SELECT p.image FROM product_review_photos p JOIN product_reviews r ON r.id=p.review WHERE p.id=? AND r.status='visible'");$s->execute([$id]);$bytes=$s->fetchColumn();if($bytes===false)fail('Зураг олдсонгүй.',404);
    header('Content-Type: image/jpeg');header('X-Content-Type-Options: nosniff');header('Cache-Control: no-store');echo $bytes;exit;
}
function review_images(): array {
    $f=$_FILES['photos']??null;if(!$f)return [];
    if(!is_array($f['error']??null)||count($f['error'])>3)fail('3 хүртэл зураг оруулна уу.');$out=[];
    foreach($f['error'] as $i=>$error){
        if($error===UPLOAD_ERR_NO_FILE)continue;
        if($error!==UPLOAD_ERR_OK||($f['size'][$i]??0)>5*1024*1024)fail('Зураг бүр 5 MB-аас бага байна.');
        $path=$f['tmp_name'][$i];$info=@getimagesize($path);
        if(!$info||!in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true)||$info[0]*$info[1]>20000000)fail('JPEG, PNG эсвэл WebP зураг сонгоно уу (20 MP хүртэл).');
        if(!function_exists('imagecreatefromstring'))fail('Зураг боловсруулах үйлчилгээ түр боломжгүй.',503);
        $src=@imagecreatefromstring(file_get_contents($path));if(!$src)fail('Зураг уншигдсангүй.');
        $scale=min(1,1200/max(imagesx($src),imagesy($src)));$dst=imagecreatetruecolor(max(1,(int)round(imagesx($src)*$scale)),max(1,(int)round(imagesy($src)*$scale)));
        imagefill($dst,0,0,imagecolorallocate($dst,255,255,255));imagecopyresampled($dst,$src,0,0,0,0,imagesx($dst),imagesy($dst),imagesx($src),imagesy($src));
        ob_start();imagejpeg($dst,null,82);$bytes=ob_get_clean();imagedestroy($src);imagedestroy($dst);
        if(strlen($bytes)>1500000)fail('Зургийн хэмжээг багасгаж дахин оруулна уу.');$out[]=$bytes;
    }return $out;
}
function review_save(): array {
    $c=customer_required();reviews_schema();limit_attempts('review-save:'.$c['id'],20,3600);
    $product=reviews_product($_POST);$rating=review_number($_POST,'rating',1,5);$comment=str_field($_POST,'comment',2000,false);
    if(preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u',$comment))fail('Сэтгэгдэлд зөвхөн текст бичнэ үү.');
    // Resolve the real product server-side; never trust a client supplied title.
    if(preg_match('/^(?:tb|abb)-\d{5,20}$/D',$product)){$detail=supplier_detail($product);$p=$detail['product']??null;}
    else{$s=db()->prepare('SELECT data FROM products WHERE id=?');$s->execute([$product]);$p=json_decode($s->fetchColumn()?:'null',true);if($p&&empty($p['active']))$p=null;}
    if(!$p)fail('Бараа олдсонгүй.',404);
    $images=review_images();$remove=($_POST['remove_photos']??'')==='1';$now=gmdate('c');$db=db();$db->exec('BEGIN IMMEDIATE');
    try{
        $s=$db->prepare('SELECT id FROM product_reviews WHERE product=? AND customer=?');$s->execute([$product,$c['id']]);$id=$s->fetchColumn();
        if($id){$db->prepare('UPDATE product_reviews SET rating=?,comment=?,updated=? WHERE id=?')->execute([$rating,$comment,$now,$id]);}
        else{$id=bin2hex(random_bytes(16));$db->prepare('INSERT INTO product_reviews (id,product,title,customer,rating,comment,created,updated) VALUES (?,?,?,?,?,?,?,?)')->execute([$id,$product,mb_substr((string)$p['name'],0,300),$c['id'],$rating,$comment,$now,$now]);}
        if($images||$remove)$db->prepare('DELETE FROM product_review_photos WHERE review=?')->execute([$id]);
        foreach($images as $bytes){$s=$db->prepare('INSERT INTO product_review_photos VALUES (?,?,?)');$s->bindValue(1,bin2hex(random_bytes(16)));$s->bindValue(2,$id);$s->bindValue(3,$bytes,PDO::PARAM_LOB);$s->execute();}
        $db->exec('COMMIT');return ['ok'=>true,'id'=>$id];
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function review_remove(string $id): void {
    db()->prepare('DELETE FROM product_review_photos WHERE review=?')->execute([$id]);db()->prepare('DELETE FROM product_review_reports WHERE review=?')->execute([$id]);db()->prepare('DELETE FROM product_reviews WHERE id=?')->execute([$id]);
}
function reviews_delete_customer(string $customer): void {
    reviews_schema();$s=db()->prepare('SELECT id FROM product_reviews WHERE customer=?');$s->execute([$customer]);foreach($s->fetchAll() as $r)review_remove($r['id']);db()->prepare('DELETE FROM product_review_reports WHERE customer=?')->execute([$customer]);
}
function reviews_post(string $action,array $b): array {
    reviews_schema();$c=customer_required();$id=str_field($b,'id',32);$s=db()->prepare('SELECT * FROM product_reviews WHERE id=?');$s->execute([$id]);$r=$s->fetch();if(!$r)fail('Сэтгэгдэл олдсонгүй.',404);
    if($action==='review-delete'){
        if($r['customer']!==$c['id'])fail('Зөвхөн өөрийн сэтгэгдлийг устгана.',403);
        $db=db();$db->exec('BEGIN IMMEDIATE');try{review_remove($id);$db->exec('COMMIT');}catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    }elseif($action==='review-report'){
        $reason=str_field($b,'reason',500);limit_attempts('review-report:'.$c['id'],20,3600);db()->prepare('INSERT OR IGNORE INTO product_review_reports VALUES (?,?,?,?)')->execute([$id,$c['id'],$reason,gmdate('c')]);
    }else fail('Үйлдэл олдсонгүй.',404);return ['ok'=>true];
}
function reviews_admin(): array {
    admin_required();reviews_schema();$page=review_number($_GET+['page'=>1],'page',1,10000);
    $s=db()->query('SELECT r.*,c.name,(SELECT count(*) FROM product_review_reports t WHERE t.review=r.id) reports FROM product_reviews r JOIN customers c ON c.id=r.customer ORDER BY reports DESC,r.created DESC,r.id DESC LIMIT 21 OFFSET '.(($page-1)*20));$rows=$s->fetchAll();$more=count($rows)>20;
    return ['reviews'=>array_map(function($r){$s=db()->prepare('SELECT reason FROM product_review_reports WHERE review=? ORDER BY created DESC LIMIT 10');$s->execute([$r['id']]);return review_public($r,null)+['title'=>$r['title'],'reports'=>(int)$r['reports'],'reasons'=>$s->fetchAll(PDO::FETCH_COLUMN)];},array_slice($rows,0,20)),'more'=>$more];
}
function reviews_moderate(array $b): array {
    admin_required();reviews_schema();$id=str_field($b,'id',32);$status=str_field($b,'status',10);if(!in_array($status,['visible','hidden'],true))fail('Төлөв буруу.');
    $s=db()->prepare('UPDATE product_reviews SET status=? WHERE id=?');$s->execute([$status,$id]);if(!$s->rowCount())fail('Сэтгэгдэл олдсонгүй.',404);return ['ok'=>true];
}
