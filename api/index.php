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
require __DIR__.'/../server/checkout.php';
require __DIR__.'/../server/taobao-http.php';
require __DIR__.'/../server/taobao-purchase.php';
try {
    $local=in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true);
    if (!$local && (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off')) fail('HTTPS холболт шаардлагатай.',403);
    $action=$_GET['action']??'catalog'; $method=$_SERVER['REQUEST_METHOD'];
    if ($action==='qpay-callback' && in_array($method,['GET','POST'],true)) json_out(qpay_callback((string)($_GET['id']??''),(string)($_GET['key']??'')));
    if ($action==='freight-callback' && in_array($method,['GET','POST'],true)) json_out(freight_callback((string)($_GET['id']??''),(string)($_GET['key']??'')));
    // Public product reads never open or expose a customer/admin session.
    if($method==='GET'&&in_array($action,['supplier-search','supplier-product'],true)){
        if($action==='supplier-product')supplier_public_json(supplier_detail(str_field($_GET,'id',50),true,str_field($_GET,'brand',30,false)));
        $page=filter_var($_GET['page']??1,FILTER_VALIDATE_INT);
        if($page===false)fail('Хуудасны дугаар буруу.');
        if(isset($_GET['image']))supplier_public_json(supplier_image_search(str_field($_GET,'image',32),$page,true,supplier_page_size($_GET)));
        supplier_public_json(supplier_search(['q'=>$_GET['q']??'bag','brand'=>$_GET['brand']??'','page'=>$page,'limit'=>$_GET['limit']??12,'sort'=>$_GET['sort']??'default','price_min'=>$_GET['price_min']??'','price_max'=>$_GET['price_max']??''],true));
    }
    $adminAction=str_starts_with($action,'ot-operator-')||str_starts_with($action,'taobao-buyer-')||str_starts_with($action,'taobao-purchase-')||in_array($action,['session','dashboard','login','logout','image-upload','product-save','product-delete','admin-password-change','warehouse-profile-save','warehouse-create','warehouse-assign-order','order-update','shipping-save','shipping-calculate','warehouse-account-save'],true);
    $warehouseAction=!$adminAction&&str_starts_with($action,'warehouse-');
    session_boot($adminAction?'admin':($warehouseAction?'warehouse':'customer'));
    // Unpaid instant checkouts are released lazily (at most every five minutes).
    if(in_array($action,['catalog','customer-orders','dashboard'],true))checkout_expire_due();
    if ($method==='GET') {
        if($warehouseAction)warehouse_get($action);
        if ($action==='catalog') json_out(['products'=>products(),'local_products_enabled'=>config()['local_products_enabled'],'qpay'=>qpay_ready(),'supplier'=>supplier_ready(),'shipping'=>shipping_public(),'customer'=>customer_public(current_customer()),'csrf'=>$_SESSION['csrf']]);
        if (str_starts_with($action,'customer-')) customer_get($action);
        if ($action==='session') json_out(['authenticated'=>admin_authenticated(),'csrf'=>$_SESSION['csrf'],'configured'=>admin_password_hash()!=='']);
        admin_required();
        if ($action==='dashboard') {
            $orders=array_map(fn($r)=>json_decode($r['data'],true),db()->query('SELECT data FROM orders ORDER BY created DESC LIMIT 1000')->fetchAll());
            json_out(['products'=>products(true),'orders'=>$orders,'email'=>config()['admin_email'],'warehouse_profiles'=>warehouse_catalog(),'warehouse_account'=>warehouse_account_public(),'warehouse_accounts'=>warehouse_accounts(),'local_products_enabled'=>config()['local_products_enabled'],'shipping'=>shipping_settings(),'supplier'=>supplier_ready(),'ot_operator'=>ot_operator_public(),'taobao_buyer'=>taobao_buyer_public(),'qpay'=>['enabled'=>qpay_ready(),'environment'=>config()['qpay']['environment']],'csrf'=>$_SESSION['csrf']]);
        }
        fail('Үйлдэл олдсонгүй.',404);
    }
    if ($method!=='POST') fail('Зөвшөөрөөгүй хүсэлт.',405);
    csrf_required();
    if($action==='supplier-image-upload')json_out(supplier_image_search_upload());
    if($action==='warehouse-photo-upload')logistics_photo_upload();
    if($action==='warehouse-exception-photo-upload')logistics_photo_upload(true);
    if ($action==='image-upload') {
        admin_required(); $file=$_FILES['image']??null;
        if (!$file || $file['error']!==UPLOAD_ERR_OK || $file['size']>5*1024*1024) fail('5 MB хүртэл зураг сонгоно уу.');
        $info=@getimagesize($file['tmp_name']);
        if (!$info || !in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true) || $info[0]*$info[1]>12000000) fail('JPEG, PNG, WebP зураг (12 MP хүртэл) оруулна уу.');
        if (!function_exists('imagecreatefromstring')) fail('Серверт GD өргөтгөл шаардлагатай.',503);
        $image=@imagecreatefromstring(file_get_contents($file['tmp_name'])); if (!$image) fail('Зураг уншигдсангүй.');
        $width=min(1600,imagesx($image));$height=max(1,(int)round(imagesy($image)*$width/imagesx($image)));
        $canvas=imagecreatetruecolor($width,$height);imagefill($canvas,0,0,imagecolorallocate($canvas,255,255,255));
        imagecopyresampled($canvas,$image,0,0,0,0,$width,$height,imagesx($image),imagesy($image));
        $name='uploads/'.bin2hex(random_bytes(16));$path=__DIR__.'/../assets/'.$name.'.jpg';
        if (!imagejpeg($canvas,$path,87)) fail('Зураг хадгалагдсангүй.',503);
        imagedestroy($canvas);imagedestroy($image);json_out(['image'=>$name]);
    }
    $b=body();
    if(str_starts_with($action,'ot-operator-'))ot_operator_post($action,$b);
    if(str_starts_with($action,'taobao-buyer-')||str_starts_with($action,'taobao-purchase-'))taobao_admin_post($action,$b);
    if($action==='checkout-quote')json_out(checkout_preview($b));
    if(in_array($action,['order-photo','freight-invoice','payment-check'],true)){
        $r=order_row(str_field($b,'id',50));customer_order_access($r,$b);
        if($action==='payment-check'){checkout_expire_order($r['id']);$r=order_row($r['id']);}
        if($action==='order-photo')logistics_photo_read($r['order'],str_field($b,'photo',32));
        if($action==='freight-invoice')json_out(['order'=>public_order(freight_invoice($r['id']))]);
        if(isset($r['order']['callback_token'])&&!$r['order']['paid'])qpay_callback($r['id'],$r['order']['callback_token']);
        if(isset($r['order']['freight']['callback_token']))freight_callback($r['id'],$r['order']['freight']['callback_token']);
        json_out(['order'=>public_order(order_row($r['id'])['order'])]);
    }
    if($warehouseAction)warehouse_post($action,$b);
    if($action==='admin-password-change')json_out(admin_password_change($b));
    if($action==='warehouse-create')json_out(['warehouse'=>warehouse_create($b)],201);
    if($action==='warehouse-assign-order')json_out(['order'=>warehouse_assign_order($b)]);
    if($action==='warehouse-profile-save')json_out(['profile'=>warehouse_profile_save($b)]);
    if($action==='warehouse-account-save')json_out(['account'=>warehouse_account_save($b)]);
    if($action==='supplier-search')json_out(supplier_search($b));
    if($action==='supplier-product')json_out(supplier_detail(str_field($b,'id',50)));
    if($action==='shipping-calculate'){admin_required();json_out(['quote'=>shipping_calculate($b)]);}
    if($action==='shipping-save'){admin_required();json_out(['shipping'=>shipping_save($b)]);}
    if (str_starts_with($action,'customer-')) customer_post($action,$b);
    if ($action==='login') {
        limit_attempts('login:'.($_SERVER['REMOTE_ADDR']??''),8,900);
        $email=str_field($b,'email',200); $password=$b['password']??'';
        if(!is_string($password)||$password===''||strlen($password)>1000)fail('Имэйл эсвэл нууц үг буруу байна.',401);
        $hash=admin_password_hash();
        if (!$hash || !hash_equals(strtolower(config()['admin_email']),strtolower($email)) || !password_verify($password,$hash)) fail('Имэйл эсвэл нууц үг буруу байна.',401);
        session_regenerate_id(true); $_SESSION['admin']=true; $_SESSION['admin_version']=hash('sha256',$hash); $_SESSION['csrf']=bin2hex(random_bytes(32)); json_out(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
    }
    if ($action==='logout') { $_SESSION=[]; session_destroy(); json_out(['ok'=>true]); }
    if ($action==='order-create') {
        if(($b['type']??'')==='link')fail('Линкээр захиалах үйлчилгээ зогссон. Каталогоос бараагаа сонгоно уу.',410);
        if(($b['require_account']??false)===true||($b['type']??'')==='checkout')customer_required();
        limit_attempts('order:'.($_SERVER['REMOTE_ADDR']??''),15,3600);
        $token=str_field($b,'token',100); if (!preg_match('/^[a-f0-9]{64}$/',$token)) fail('Хүсэлтийн түлхүүр буруу.');
        $key=hash('sha256',$token); $s=db()->prepare('SELECT id FROM orders WHERE request_key=?');$s->execute([$key]);
        if ($existing=$s->fetchColumn()) { $r=order_row($existing);customer_order_access($r,$b);json_out(['order'=>public_order($r['order'])]); }
        $type=str_field($b,'type',10); if (!in_array($type,['cart','supplier','checkout'],true)) fail('Захиалгын төрөл буруу.');
        $o=['type'=>$type,'title'=>str_field($b,'title',120),'customer'=>str_field($b,'customer',100),'phone'=>str_field($b,'phone',30),'notes'=>str_field($b,'notes',1000,false),'status'=>'new','amount'=>0,'paid'=>false,'demo'=>false,'internal_note'=>'','created'=>gmdate('c')];
        if (!preg_match('/^[+\d ()-]{8,25}$/',$o['phone'])) fail('Холбогдох утасны дугаараа шалгана уу.');
        $address=str_field($b,'address',500,false);
        $o['delivery_address']=$address;
        if($address!=='')$o['notes']=trim($o['notes']."\nХүргэлтийн хаяг: ".$address);
        if($type==='checkout')$o=checkout_order($b,$o);
        elseif ($type==='supplier') {
            $o['supplier']=supplier_order($b);$o['title']=mb_substr($o['supplier']['name'],0,120);$o['url']=$o['supplier']['url'];$o['variant']=$o['supplier']['variant'];$o['qty']=$o['supplier']['qty'];$o['route']=['Эрээн','Замын-Үүд','Улаанбаатар'];
        } else {
            $items=$b['items']??[];if (!is_array($items)||!array_is_list($items)||count($items)<1||count($items)>100) fail('Сагс буруу байна.');
            $catalog=array_column(products(),null,'id');$o['items']=[];$o['subtotal']=0;$quantities=[];
            foreach($items as $item) {
                if(!is_array($item))fail('Сагсны барааны мэдээлэл буруу байна.');
                $p=$catalog[str_field($item,'id',60)]??null; if (!$p) fail('Бараа худалдаанд байхгүй байна.');
                $qty=int_field($item,'qty',1,99);$variant=str_field($item,'variant',100);
                $quantities[$p['id']]=($quantities[$p['id']]??0)+$qty;
                if (!$p['demo'] && $p['type']==='local' && $quantities[$p['id']]>$p['stock']) fail('Барааны үлдэгдэл хүрэлцэхгүй байна.');
                if (!in_array($variant,$p['variants'],true)) fail('Барааны хувилбар өөрчлөгдсөн байна.');
                if($p['type']==='china')$o['route']=['Эрээн','Замын-Үүд','Улаанбаатар'];
                $o['items'][]=['id'=>$p['id'],'name'=>$p['name'],'qty'=>$qty,'variant'=>$variant,'price'=>$p['price']];
                $o['subtotal']+=$p['price']*$qty;$o['demo']=$o['demo']||$p['demo'];
            }
        }
        $customer=current_customer();$db=db();$db->exec('BEGIN IMMEDIATE');
        try {
            // Another session may have saved this request while supplier validation was running.
            $s=$db->prepare('SELECT id FROM orders WHERE request_key=?');$s->execute([$key]);$existing=$s->fetchColumn();$s->closeCursor();
            if($existing){$r=order_row($existing);customer_order_access($r,$b);$db->exec('COMMIT');json_out(['order'=>public_order($r['order'])]);}
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
        $r=order_row(str_field($b,'id',50));customer_order_access($r,$b);checkout_expire_order($r['id']);
        if($action==='invoice'&&checkout_expired_or_cancelled($r['id']))fail('Төлбөрийн хугацаа дууссан тул захиалга цуцлагдсан. Сагсаа дахин захиална уу.',409);
        json_out(['order'=>public_order($action==='invoice'?qpay_invoice($r['id']):$r['order'])]);
    }
    admin_required();
    if ($action==='product-delete') {
        $id=str_field($b,'id',60);
        if(($b['confirm_id']??'')!==$id)fail('Устгах барааг баталгаажуулна уу.');
        $db=db();$db->exec('BEGIN IMMEDIATE');
        try {
            $s=$db->prepare('SELECT data FROM products WHERE id=?');$s->execute([$id]);$raw=$s->fetchColumn();
            if(!$raw)fail('Бараа олдсонгүй.',404);
            $p=json_decode($raw,true);$p['active']=false;$p['deleted_at']=$p['deleted_at']??gmdate('c');
            $db->prepare('UPDATE products SET data=?,updated=? WHERE id=?')->execute([json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),gmdate('c'),$id]);
            $db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        json_out(['ok'=>true]);
    }
    if ($action==='product-save') {
        $id=str_field($b,'id',60,false)?:'p-'.bin2hex(random_bytes(8)); if (!preg_match('/^[a-z0-9-]+$/',$id)) fail('Барааны код буруу.');
        $p=['id'=>$id,'name'=>str_field($b,'name',150),'description'=>str_field($b,'description',3000),'category'=>str_field($b,'category',30),'type'=>str_field($b,'type',10),'image'=>str_field($b,'image',100),'price'=>int_field($b,'price',0,100000000),'stock'=>int_field($b,'stock',0,1000000),'active'=>($b['active']??false)===true,'demo'=>($b['demo']??true)===true];
        if (!in_array($p['category'],['home','tech','bags','shoes','accessories','beauty','lighting'],true)||!in_array($p['type'],['local','china'],true)) fail('Ангилал/төрөл буруу.');
        if (!in_array($p['image'],['chair','headphones','backpack','sneakers','watch','lamp','skincare','living'],true) && !(preg_match('#^uploads/[a-f0-9]{32}$#',$p['image']) && is_file(__DIR__.'/../assets/'.$p['image'].'.jpg'))) fail('Зураг буруу.');
        $variants=$b['variants']??null; if (!is_array($variants)||count($variants)<1||count($variants)>30) fail('Хувилбар оруулна уу.');
        $p['variants']=array_values(array_unique(array_map(fn($v)=>str_field(['v'=>$v],'v',100),$variants)));$p['source']=$p['type']==='local'?'GOStore сонголт':'Хятад захиалга';
        $db=db();$db->exec('BEGIN IMMEDIATE');
        try {
            $s=$db->prepare('SELECT data FROM products WHERE id=?');$s->execute([$id]);$existing=json_decode($s->fetchColumn()?:'{}',true);
            if(!empty($existing['deleted_at']))fail('Энэ бараа устгагдсан. Жагсаалтаа шинэчилнэ үү.',409);
            $data=json_encode($p,JSON_UNESCAPED_UNICODE);$updated=gmdate('c');
            $db->prepare('INSERT OR IGNORE INTO products VALUES (?,?,?)')->execute([$id,$data,$updated]);
            $db->prepare('UPDATE products SET data=?,updated=? WHERE id=?')->execute([$data,$updated,$id]);
            $db->exec('COMMIT');
        } catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
        json_out(['product'=>$p]);
    }
    if ($action==='order-update') {
        $db=db();$db->exec('BEGIN IMMEDIATE');
        try {
            $o=order_row(str_field($b,'id',50))['order'];$status=str_field($b,'status',30);
            if((isset($o['batch_id'])||isset($o['fulfillment'])||in_array($status,['erenhot_ready','ulaanbaatar_unsorted','ready_pickup','ready_delivery','out_for_delivery'],true))&&$status!==$o['status'])fail('Багцтай болон ангилсан захиалгын явцыг агуулахын панелаас шинэчилнэ.',409);
            if (!in_array($status,['new','reviewing','quoted','confirmed','shipping','erenhot','erenhot_ready','erenhot_dispatched','zamyn_uud','ulaanbaatar','ulaanbaatar_unsorted','ready_pickup','ready_delivery','out_for_delivery','completed','cancelled'],true)) fail('Төлөв буруу.');
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
