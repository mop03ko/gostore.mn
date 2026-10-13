<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
require __DIR__.'/../server/qpay-http.php';
require __DIR__.'/../server/qpay.php';
require __DIR__.'/../server/customers.php';
require __DIR__.'/../server/shipping.php';
require __DIR__.'/../server/supplier.php';
require __DIR__.'/../server/ot-operator-http.php';
require __DIR__.'/../server/ot-operator.php';
require __DIR__.'/../server/warehouse.php';
require __DIR__.'/../server/warehouse-batches.php';
require __DIR__.'/../server/logistics.php';
require __DIR__.'/../server/freight-payment.php';
try {
    $local=in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true);
    if (!$local && (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off')) fail('HTTPS холболт шаардлагатай.',403);
    $action=$_GET['action']??'catalog'; $method=$_SERVER['REQUEST_METHOD'];
    if ($action==='qpay-callback' && in_array($method,['GET','POST'],true)) json_out(qpay_callback((string)($_GET['id']??''),(string)($_GET['key']??'')));
    if ($action==='freight-callback' && in_array($method,['GET','POST'],true)) json_out(freight_callback((string)($_GET['id']??''),(string)($_GET['key']??'')));
    $adminAction=str_starts_with($action,'ot-operator-')||in_array($action,['session','dashboard','login','logout','image-upload','product-save','order-update','shipping-save','shipping-calculate','warehouse-account-save'],true);
    $warehouseAction=!$adminAction&&str_starts_with($action,'warehouse-');
    session_boot($adminAction?'admin':($warehouseAction?'warehouse':'customer'));
    if ($method==='GET') {
        if($warehouseAction)warehouse_get($action);
        if ($action==='catalog') json_out(['products'=>products(),'local_products_enabled'=>config()['local_products_enabled'],'qpay'=>qpay_ready(),'supplier'=>supplier_ready(),'shipping'=>shipping_public(),'customer'=>customer_public(current_customer()),'csrf'=>$_SESSION['csrf']]);
        if (str_starts_with($action,'customer-')) customer_get($action);
        if ($action==='session') json_out(['authenticated'=>!empty($_SESSION['admin']),'csrf'=>$_SESSION['csrf'],'configured'=>config()['admin_password_hash']!=='']);
        admin_required();
        if ($action==='dashboard') {
            $orders=array_map(fn($r)=>json_decode($r['data'],true),db()->query('SELECT data FROM orders ORDER BY created DESC LIMIT 1000')->fetchAll());
            json_out(['products'=>products(true),'orders'=>$orders,'email'=>config()['admin_email'],'warehouse_account'=>warehouse_account_public(),'warehouse_accounts'=>['erenhot'=>warehouse_account_public('erenhot'),'ulaanbaatar'=>warehouse_account_public('ulaanbaatar')],'local_products_enabled'=>config()['local_products_enabled'],'shipping'=>shipping_settings(),'supplier'=>supplier_ready(),'ot_operator'=>ot_operator_public(),'qpay'=>['enabled'=>qpay_ready(),'environment'=>config()['qpay']['environment']],'csrf'=>$_SESSION['csrf']]);
        }
        fail('Үйлдэл олдсонгүй.',404);
    }
    if ($method!=='POST') fail('Зөвшөөрөөгүй хүсэлт.',405);
    csrf_required();
    if($action==='warehouse-photo-upload')logistics_photo_upload();
    if($action==='warehouse-exception-photo-upload')logistics_photo_upload(true);
    if ($action==='image-upload') {
        admin_required(); $file=$_FILES['image']??null;
        if (!$file || $file['error']!==UPLOAD_ERR_OK || $file['size']>5*1024*1024) fail('5 MB хүртэл зураг сонгоно уу.');
        $info=@getimagesize($file['tmp_name']);
        if (!$info || !in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true) || $info[0]*$info[1]>12000000) fail('JPEG, PNG, WebP зураг (12 MP хүртэл) оруулна уу.');
        if (!function_exists('imagecreatefromstring')) fail('Серверт GD өргөтгөл шаардлагатай.',503);
        $image=@imagecreatefromstring(file_get_contents($file['tmp_name'])); if (!$image) fail('Зураг уншигдсангүй.');
        $width=min(1600,imagesx($image));$height=(int)round(imagesy($image)*$width/imagesx($image));
        $canvas=imagecreatetruecolor($width,$height);imagefill($canvas,0,0,imagecolorallocate($canvas,255,255,255));
        imagecopyresampled($canvas,$image,0,0,0,0,$width,$height,imagesx($image),imagesy($image));
        $name='uploads/'.bin2hex(random_bytes(16));$path=__DIR__.'/../assets/'.$name.'.jpg';
        if (!imagejpeg($canvas,$path,87)) fail('Зураг хадгалагдсангүй.',503);
        imagedestroy($canvas);imagedestroy($image);json_out(['image'=>$name]);
    }
    $b=body();
    if(str_starts_with($action,'ot-operator-'))ot_operator_post($action,$b);
    if(in_array($action,['order-photo','freight-invoice','payment-check'],true)){
        $r=order_row(str_field($b,'id',50));customer_order_access($r,$b);
        if($action==='order-photo')logistics_photo_read($r['order'],str_field($b,'photo',32));
        if($action==='freight-invoice')json_out(['order'=>public_order(freight_invoice($r['id']))]);
        if(isset($r['order']['callback_token'])&&!$r['order']['paid'])qpay_callback($r['id'],$r['order']['callback_token']);
        if(isset($r['order']['freight']['callback_token']))freight_callback($r['id'],$r['order']['freight']['callback_token']);
        json_out(['order'=>public_order(order_row($r['id'])['order'])]);
    }
    if($warehouseAction)warehouse_post($action,$b);
    if($action==='warehouse-account-save')json_out(['account'=>warehouse_account_save($b)]);
    if($action==='supplier-search')json_out(supplier_search($b));
    if($action==='supplier-product')json_out(supplier_detail(str_field($b,'id',50)));
    if($action==='shipping-calculate'){admin_required();json_out(['quote'=>shipping_calculate($b)]);}
    if($action==='shipping-save'){admin_required();json_out(['shipping'=>shipping_save($b)]);}
    if (str_starts_with($action,'customer-')) customer_post($action,$b);
    if ($action==='login') {
        limit_attempts('login:'.($_SERVER['REMOTE_ADDR']??''),8,900);
        $email=str_field($b,'email',200); $password=str_field($b,'password',500);
        $hash=config()['admin_password_hash'];
        if (!$hash || !hash_equals(strtolower(config()['admin_email']),strtolower($email)) || !password_verify($password,$hash)) fail('Имэйл эсвэл нууц үг буруу байна.',401);
        session_regenerate_id(true); $_SESSION['admin']=true; $_SESSION['csrf']=bin2hex(random_bytes(32)); json_out(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
    }
    if ($action==='logout') { $_SESSION=[]; session_destroy(); json_out(['ok'=>true]); }
    if ($action==='order-create') {
        if(($b['type']??'')==='link')fail('Линкээр захиалах үйлчилгээ зогссон. Каталогоос бараагаа сонгоно уу.',410);
        if(($b['require_account']??false)===true)customer_required();
        limit_attempts('order:'.($_SERVER['REMOTE_ADDR']??''),15,3600);
        $token=str_field($b,'token',100); if (!preg_match('/^[a-f0-9]{64}$/',$token)) fail('Хүсэлтийн түлхүүр буруу.');
        $key=hash('sha256',$token); $s=db()->prepare('SELECT id FROM orders WHERE request_key=?');$s->execute([$key]);
        if ($existing=$s->fetchColumn()) { $r=order_row($existing);customer_order_access($r,$b);json_out(['order'=>public_order($r['order'])]); }
        $type=str_field($b,'type',10); if (!in_array($type,['cart','supplier'],true)) fail('Захиалгын төрөл буруу.');
        $o=['type'=>$type,'title'=>str_field($b,'title',120),'customer'=>str_field($b,'customer',100),'phone'=>str_field($b,'phone',30),'notes'=>str_field($b,'notes',1000,false),'status'=>'new','amount'=>0,'paid'=>false,'demo'=>false,'internal_note'=>'','created'=>gmdate('c')];
        if (!preg_match('/^[+\d ()-]{8,25}$/',$o['phone'])) fail('Холбогдох утасны дугаараа шалгана уу.');
        $address=str_field($b,'address',500,false);
        $o['delivery_address']=$address;
        if($address!=='')$o['notes']=trim($o['notes']."\nХүргэлтийн хаяг: ".$address);
        if ($type==='supplier') {
            $o['supplier']=supplier_order($b);$o['title']=mb_substr($o['supplier']['name'],0,120);$o['url']=$o['supplier']['url'];$o['variant']=$o['supplier']['variant'];$o['qty']=$o['supplier']['qty'];$o['route']=['Эрээн','Замын-Үүд','Улаанбаатар'];
        } else {
            $items=$b['items']??[];if (!is_array($items)||count($items)<1||count($items)>100) fail('Сагс буруу байна.');
            $catalog=array_column(products(),null,'id');$o['items']=[];$o['subtotal']=0;
            foreach($items as $item) {
                $p=$catalog[$item['id']??'']??null; if (!$p) fail('Бараа худалдаанд байхгүй байна.');
                $qty=int_field($item,'qty',1,99);$variant=str_field($item,'variant',100);
                if (!$p['demo'] && $p['type']==='local' && $qty>$p['stock']) fail('Барааны үлдэгдэл хүрэлцэхгүй байна.');
                if (!in_array($variant,$p['variants'],true)) fail('Барааны хувилбар өөрчлөгдсөн байна.');
                if($p['type']==='china')$o['route']=['Эрээн','Замын-Үүд','Улаанбаатар'];
                $o['items'][]=['id'=>$p['id'],'name'=>$p['name'],'qty'=>$qty,'variant'=>$variant,'price'=>$p['price']];
                $o['subtotal']+=$p['price']*$qty;$o['demo']=$o['demo']||$p['demo'];
            }
        }
        $customer=current_customer();$db=db();$db->exec('BEGIN IMMEDIATE');
        try {
            // Hold the write lock so another request cannot claim the same short code.
            $exists=$db->prepare('SELECT 1 FROM orders WHERE id=?');
            for($attempt=0;$attempt<20;$attempt++){
                $o['id']='GS-'.strtoupper(bin2hex(random_bytes(3)));
                $exists->execute([$o['id']]);$taken=(bool)$exists->fetchColumn();$exists->closeCursor();
                if(!$taken)break;
            }
            if($taken)fail('Захиалгын код үүсгэж чадсангүй. Дахин оролдоно уу.',503);
            if(isset($o['route'])){$o['warehouse']=warehouse_destination($o,$b);$o['customer']=$o['warehouse']['family_name'].' '.$o['warehouse']['given_name'];}
            if(!isset($o['route'])&&($b['family_name']??'')!=='')$o['customer']=str_field($b,'family_name',100).' '.$o['customer'];
            $db->prepare('INSERT INTO orders VALUES (?,?,?,?,?,?)')->execute([$o['id'],hash('sha256',$token),$key,json_encode($o,JSON_UNESCAPED_UNICODE),$o['created'],$o['created']]);
            if($customer)$db->prepare('INSERT INTO customer_orders VALUES (?,?,?)')->execute([$o['id'],$customer['id'],$o['created']]);
            $db->exec('COMMIT');
        } catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        json_out(['order'=>public_order($o)],201);
    }
    if (in_array($action,['order-get','invoice'],true)) {
        $r=order_row(str_field($b,'id',50));customer_order_access($r,$b);
        json_out(['order'=>public_order($action==='invoice'?qpay_invoice($r['id']):$r['order'])]);
    }
    admin_required();
    if ($action==='product-save') {
        $id=str_field($b,'id',60,false)?:'p-'.bin2hex(random_bytes(8)); if (!preg_match('/^[a-z0-9-]+$/',$id)) fail('Барааны код буруу.');
        $p=['id'=>$id,'name'=>str_field($b,'name',150),'description'=>str_field($b,'description',3000),'category'=>str_field($b,'category',30),'type'=>str_field($b,'type',10),'image'=>str_field($b,'image',100),'price'=>int_field($b,'price',0,100000000),'stock'=>int_field($b,'stock',0,1000000),'active'=>($b['active']??false)===true,'demo'=>($b['demo']??true)===true];
        if (!in_array($p['category'],['home','tech','bags','shoes','accessories','beauty','lighting'],true)||!in_array($p['type'],['local','china'],true)) fail('Ангилал/төрөл буруу.');
        if (!in_array($p['image'],['chair','headphones','backpack','sneakers','watch','lamp','skincare','living'],true) && !(preg_match('#^uploads/[a-f0-9]{32}$#',$p['image']) && is_file(__DIR__.'/../assets/'.$p['image'].'.jpg'))) fail('Зураг буруу.');
        $variants=$b['variants']??null; if (!is_array($variants)||count($variants)<1||count($variants)>30) fail('Хувилбар оруулна уу.');
        $p['variants']=array_values(array_unique(array_map(fn($v)=>str_field(['v'=>$v],'v',100),$variants)));$p['source']=$p['type']==='local'?'GOStore сонголт':'Хятад захиалга';
        $db=db();$db->beginTransaction();
        try {
            $data=json_encode($p,JSON_UNESCAPED_UNICODE);$updated=gmdate('c');
            $db->prepare('INSERT OR IGNORE INTO products VALUES (?,?,?)')->execute([$id,$data,$updated]);
            $db->prepare('UPDATE products SET data=?,updated=? WHERE id=?')->execute([$data,$updated,$id]);
            $db->commit();
        } catch(Throwable $e){$db->rollBack();throw $e;}
        json_out(['product'=>$p]);
    }
    if ($action==='order-update') {
        $db=db();$db->exec('BEGIN IMMEDIATE');
        try {
            $o=order_row(str_field($b,'id',50))['order'];$status=str_field($b,'status',30);
            if((isset($o['batch_id'])||isset($o['fulfillment'])||in_array($status,['ulaanbaatar_unsorted','ready_pickup','ready_delivery','out_for_delivery'],true))&&$status!==$o['status'])fail('Багцтай болон ангилсан захиалгын явцыг агуулахын панелаас шинэчилнэ.',409);
            if (!in_array($status,['new','reviewing','quoted','confirmed','shipping','erenhot','erenhot_dispatched','zamyn_uud','ulaanbaatar','ulaanbaatar_unsorted','ready_pickup','ready_delivery','out_for_delivery','completed','cancelled'],true)) fail('Төлөв буруу.');
            $amount=int_field($b,'amount',0,100000000);
            if(isset($o['settlement'])&&($amount!==$o['amount']||isset($b['quote_inputs'])))fail('Эцсийн тооцоотой захиалгын эхний дүнг өөрчлөхгүй.',409);
            if (isset($o['invoice']) && ($amount!==$o['amount']||$status==='cancelled')) fail('Нэхэмжлэлтэй захиалгын дүн/цуцлалтыг QPay-тай тулган шийднэ.',409);

            if(isset($b['quote_inputs'])){if(isset($o['invoice']))fail('Нэхэмжлэлтэй захиалгын тооцоог өөрчлөхгүй.',409);if(!is_array($b['quote_inputs']))fail('Тооцоо буруу.');$o['quote']=shipping_calculate($b['quote_inputs']);$amount=$o['quote']['total'];}
            if ($status==='quoted'&&$amount<1) fail('Хүргэлт орсон нийт үнийн санал оруулна уу.');
            if(isset($o['quote'])&&$amount!==$o['quote']['total'])unset($o['quote']);
            if($o['status']!==$status){$o['history'][]=['status'=>$status,'at'=>gmdate('c')];}
            $o['status']=$status;$o['amount']=$amount;$o['internal_note']=str_field($b,'internal_note',2000,false);save_order($o);$db->exec('COMMIT');
        } catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}json_out(['order'=>$o]);
    }
    fail('Үйлдэл олдсонгүй.',404);
} catch(ApiError $e) { json_out(['error'=>(($warehouseAction??false)&&($_GET['lang']??'')==='zh')?warehouse_error_zh($e->getMessage()):$e->getMessage()],$e->getCode()?:400); }
catch(Throwable $e) { error_log('GOStore API: '.get_class($e));json_out(['error'=>(($warehouseAction??false)&&($_GET['lang']??'')==='zh')?'服务器暂时不可用，请联系管理员。':'Серверийн тохиргоо эсвэл өгөгдлийн алдаа. Админтай холбогдоно уу.'],503); }
