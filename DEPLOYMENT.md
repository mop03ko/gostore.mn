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

Имэйл, 14+ тэмдэгт нууц үгийг зөвхөн өөрийн компьютерт оруулна. Скрипт password hash бүхий `server/config.local.php` үүсгэнэ. Нууц үгийг GitHub эсвэл чатад оруулахгүй. Энэ файл ZIP/Git-д орохгүй. QPay тохиргоо аль хэдийн байвал скрипт түүнийг хадгалж, зөвхөн анхны админ эрхийг нэмнэ; үүссэн админы нууц үгийг дарж бичихгүй.

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

Production merchant эрх ирсэн; 2026-10-12-нд token авах нэвтрэлт амжилттай шалгагдсан. Локал `server/config.local.php`-д production утгууд хадгалагдсан, `enabled=false`. Нэхэмжлэл, төлбөр, callback урсгалыг бодитоор хараахан шалгаагүй. [QPay-ийн албан ёсны баримт](https://developer.qpay.mn/mn/docs/merchant?version=2.0.0)-ын дагуу token, invoice, callback → payment/check урсгал бэлтгэсэн.

2026-10-10-нд [API жагсаалт](https://developer.qpay.mn/mn/docs/apis) болон Merchant V2-ийн token, invoice, payment/check лавлахтай тулгасан. Token авахад Basic, invoice/payment шалгахад Bearer ашиглана. `expires_in` нь Unix timestamp; хугацаа дууссан эсвэл буруу утгатай token-ийг хадгалахгүй. Хүчинтэй token-ийг серверийн private cache-д дахин ашиглана. Refresh endpoint одоогоор холбогдоогүй; хугацаа дуусахад Basic auth-аар шинэ token авна.

QPay-ээс GOStore-ийн sandbox болон production орчны `client_id`, `client_secret`, `invoice_code` авна. Бүртгэлийн холбоо барих мэйл: `shop@gostore.mn`; сайт: `https://gostore.mn`. Эдгээр мэйл/домэйн нь API эрхийг орлохгүй.

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

**Production token авах шалгалт нь төлбөрийн урсгалын баталгаа биш.** QPay-ээс sandbox эрх авч, төлөөгүй, дутуу төлсөн, төлсөн, давхар callback, timeout урсгалуудаар acceptance test хийж байж production нээнэ.

## Бусад API

### OT Commerce / 1688

2026-10-12-нд хэрэглэгчийн OT Commerce түлхүүрийг `server/config.local.php`-ийн `otcommerce.api_key` хэсэгт хадгалсан. Энэ файл GitHub болон ZIP-д орохгүй. QPay болон админы тохиргоог хэвээр хадгална.

[Албан ёсны REST API заавар](https://apidoc.otapi.net/) болон [OpenAPI тодорхойлолт](https://rest.otapi.net/openapi.yaml)-ын дагуу `GET https://rest.otapi.net/v1/catalog?language=en` хүсэлтийг `X-Api-Key` header-тай нэг удаа шалгасан: HTTP 200, `ErrorCode: Ok`, `Alibaba1688` ангиллууд ирсэн. Шалгалтыг PowerShell-оор хийсэн; PHP адаптер, бараа хайлт/импорт, захиалга үүсгэх урсгал хараахан хэрэгжээгүй. `enabled=false` нь ирээдүйн холболтын тохиргоо бөгөөд одоогоор сайт OT Commerce руу хүсэлт явуулахгүй.

2026-10-12-нд хэрэглэгчийн ирүүлсэн эрхийн мэдээлэл: provider `Alibaba1688`, сайт `https://gostore.mn/`, төлөв `Active`, тариф `Free Trial`, үлдсэн хугацаа 5 хоног, үлдсэн дуудлага 300, валют `CNY`, хэл `Mongolian (Монгол хэл)`. Эдгээр нь тухайн үеийн үлдэгдэл; шинэчлэгдэх квот болон хугацааг аккаунтаас дахин нягтална. Бүтээгдэхүүний хүсэлтийн эрхийг тусад нь шалгаагүй.

Адаптер хэрэгжүүлэхдээ хариуг серверт түр хадгалж, нэг мэдээллийг давтан татах дуудлагыг багасгана; өргөн хүрээний автомат импорт асаахаас өмнө туршилтын квотыг тооцно. `CNY` үнийг `MNT` гэж шууд үзүүлэхгүй: төгрөгийн ханш, үйлчилгээний шимтгэл, хүргэлтийн үнийг тусад нь тохируулна. Түлхүүрийг frontend JavaScript, URL query эсвэл логт бүү оруул. Серверээс зөвхөн албан ёсны HTTPS endpoint руу дамжуулна.

1688-д OT Commerce сонгосон; карго үйлчилгээ хараахан сонгоогүй. Одоогоор линк хүсэлтийг серверт хадгалж админ гараар үнийн санал өгнө. OT Commerce каталогийн холболт шалгагдсан ч бараа хайлт/импортын адаптер нэмэх шаардлагатай. “Холболтууд” дэлгэц дээр эдгээрийг бүрэн холбогдсон мэт үзүүлэхгүй.

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
