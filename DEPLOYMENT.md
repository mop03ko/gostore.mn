# cPanel суулгалт

## Шаардлага

- PHP 8.2+; `PDO`, `pdo_sqlite`, `mbstring`, зураг хөрвүүлэхэд `gd`, QPay-д `curl`.
- HTTPS гэрчилгээ, Apache `.htaccess` дэмжлэг.
- SQLite өгөгдлийг вебийн Document Root-оос гадна, зөвхөн hosting хэрэглэгч уншиж/бичих хавтаст хадгална.

Одоогийн өгөгдлийн сан нь SQLite. MySQL шаардахгүй. cPanel → Select PHP Version хэсгээс `pdo_sqlite`, `mbstring`, `curl`-ийг идэвхжүүлнэ. Эдгээрийг hosting хориглосон бол provider-оос идэвхжүүлэх эсвэл MySQL рүү шилжүүлэх шаардлагатай.

## Админ эрх

Админ анхдагч нууц үггүй. Windows PowerShell дээр төслийн хавтаснаас:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure-admin.ps1
```

Имэйл, 14+ тэмдэгт нууц үгийг зөвхөн өөрийн компьютерт оруулна. Скрипт password hash бүхий `server/config.local.php` үүсгэнэ. Нууц үгийг GitHub эсвэл чатад оруулахгүй. Энэ файл ZIP/Git-д орохгүй.

Linux CLI дээр `php scripts/password.php`-д нууц үгийг stdin-ээр дамжуулж hash гарган `config.local.php`-д тавьж болно. Жишээ бүтэц `server/config.example.php`-д бий. Browser setup endpoint зориуд байхгүй.

## Байршуулах

1. cPanel → Domains → `gostore.mn` Document Root-ийг тогтоож, өмнөх файлуудаа нөөцөл.
2. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package.ps1` ажиллуул.
3. `output/gostore-preview.zip`-ийг File Manager-ээр Document Root-д оруулж задал. `.htaccess` орсон эсэхийг шалга.
4. `server/config.local.php`-ийг тусад нь `server/` хавтаст оруул. File permissions 0600 байхаар тохируул.
5. Document Root `/home/gostorem/public_html` бол өгөгдлийн default хавтас `/home/gostorem/gostore-data`. Document Root өөр бол `data_dir`-ийг `/home/gostorem/gostore-data` зэрэг нийтийн бус absolute path-аар config.local.php-д тодорхойл.
6. `https://gostore.mn/admin/` нээж өөрийн админ эрхээр нэвтэр.
7. `https://gostore.mn/server/seed.json`, `/server/config.local.php` нь 403/404 буцаах ёстой. Өгөгдлийн хавтас URL-аар огт хандах боломжгүй байна.
8. Каталогт жишээ мэдээлэл байгаа. Өөрийн барааны үнэ, зураг, үлдэгдэл оруулж байж жишээ тэмдэглэгээг арилга.

Барааг нуух нь өгөгдлийг устгахгүй. Хүсэлт гаргах нь үлдэгдлийг автоматаар нөөцлөх/хасахгүй; админ баталгаажуулах үед бодит үлдэгдлийг хянаж шинэчилнэ. Нэвтрэх сесс 30 минут идэвхгүй байвал дуусна.

## QPay Merchant V2

Эрх аваагүй тул анхдагчаар унтраалттай. [QPay-ийн албан ёсны баримт](https://developer.qpay.mn/mn/docs/merchant?version=2.0.0)-ын дагуу token, invoice, callback → payment/check урсгал бэлтгэсэн.

`server/config.local.php` дотор дараах тохиргоог өөрийн утгаар нэм:

```php
'site_url' => 'https://gostore.mn',
'qpay' => [
    'enabled' => false,
    'environment' => 'sandbox',
    'client_id' => '',
    'client_secret' => '',
    'invoice_code' => '',
],
```

- Sandbox: `https://merchant-sandbox.qpay.mn`; production: `https://merchant.qpay.mn`.
- Түлхүүр авсны дараа sandbox тохиргоогоор `enabled`-ийг true болгоно. Эхлээд live төлбөр бүү ав.
- Админ бодит барааны хүсэлтэд **хүргэлт орсон нийт санал** оруулж “Үнийн саналтай” төлөв сонгоно. Хэрэглэгч хүсэлтээ нээгээд QPay invoice үүсгэнэ.
- Нэхэмжлэлийн дүн серверийн сангаас авна; frontend илгээсэн үнийг ашиглахгүй. Жишээ бараатай хүсэлтэд төлбөр авахгүй.
- Callback доторх өгөгдлийг төлбөрийн баталгаа гэж үзэхгүй. Сервер QPay `payment/check` дуудаж `PAID`, `MNT`, давхцаагүй payment ID болон нийт дүнг шалгана.
- “Төлөв шинэчлэх” нь зөвхөн GOStore серверийн бүртгэлийг уншина. QPay руу тогтмол polling / cron хийхгүй.
- Invoice үүсгэх оролдлогын хариу тодорхойгүй бол `review` төлөвт түгжинэ. QPay merchant portal/support-оор sender_invoice_no-г тулгаж, давхар invoice үүсгээгүйг шийдсэний дараа хөгжүүлэгч өгөгдлийг засна. Автомат дахин invoice үүсгэхгүй.
- Нэхэмжлэлтэй хүсэлтийн дүнг өөрчлөх, шууд цуцлахыг хаасан. Refund, eBarimt, reconciliation dashboard одоогоор хэрэгжээгүй.

**Sandbox эрхгүй тул бодит QPay invoice/callback урсгал баталгаажаагүй.** Merchant эрх авсны дараа төлөөгүй, дутуу төлсөн, төлсөн, давхар callback, timeout урсгалуудаар acceptance test хийж байж production нээнэ.

## Бусад API

Taobao/1688 бараа автоматаар татах, карго явц холбох үйлчилгээ сонгогдоогүй. Одоогоор линк хүсэлтийг серверт хадгалж админ гараар үнийн санал өгнө. Нийлүүлэгчийн API баримт, эрх, callback schema авсны дараа бодит адаптер нэмнэ. “Холболтууд” дэлгэц дээр эдгээрийг холбогдсон мэт үзүүлэхгүй.

## Нөөц ба хязгаар

- `gostore-data` хавтсыг hosting-ийн private backup-д хамруул. SQLite WAL ашигладаг тул ажиллаж байгаа DB-г дан файлаар хуулж болохгүй; SQLite backup хэрэгсэл эсвэл hosting snapshot хэрэглэ.
- Админ самбар сүүлийн 1000 хүсэлтийг харуулна. Томруулбал pagination, audit log, roles, хэрэглэгчийн бүртгэл, inventory reservation нэмнэ.
- Захиалга харах түлхүүр тухайн хөтөчид хадгалагдана. Хөтчийн мэдээллийг устгавал хэрэглэгч админтай холбогдож захиалгаа лавлана.
- Хөгжүүлэлтийн `tmp/`, тестийн өгөгдөл, лог, `.vscode`, brand source болон ZIP файлууд repository/production-д орохгүй.

## Үндсэн сайтад “Тун удахгүй” хуудас тавих

`coming-soon/index.html` нь хөгжүүлж буй дэлгүүрээс тусдаа түр нүүр хуудас. ZIP бэлтгэх:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-coming-soon.ps1
```

`output/gostore-coming-soon.zip` нь `index.html`, `.htaccess`, `assets/logo.png`, мөн `assets/fonts/` доторх фонт, CSS, лицензийг агуулна. Фонтыг зөв ачаалахын тулд ZIP-ийг бүтнээр нь задлана.

1. cPanel → Domains дотроос `gostore.mn`-ийн Document Root-ийг харна (ихэвчлэн `public_html`).
2. File Manager дотор тухайн хавтасны одоогийн `index.html` болон `.htaccess` файлуудыг компьютертоо нөөцөлнө. `.htaccess` харагдахгүй бол Settings → Show Hidden Files идэвхжүүлнэ.
3. ZIP-ийг Document Root-д Upload → Extract хийнэ. `index.html` нь уг хавтасны шууд дотор байрлах ёстой.
4. `https://gostore.mn`-ийг Ctrl+F5 дарж шалгана. Шаардлагатай бол хостинг/CDN кэшийг цэвэрлэнэ.

Энэ ZIP нь зөвхөн нүүр хуудсыг солино; серверт өмнө нь байрласан бусад URL-ийг хаахгүй. Дэлгүүр нээх үед бүрэн аппын ZIP-ээр сольж, серверийн тохиргоог тусад нь хийнэ.
