# GOStore · Сонголт нэг дор.

Монгол хэлтэй дэлгүүр + Хятадаас линкээр захиалах хүсэлт + админ панел. cPanel-д зориулсан PHP 8.2+, SQLite backend; frontend нь HTML/CSS/JavaScript, build шаардахгүй.

Албан ёсны холбоо барих мэйл: [shop@gostore.mn](mailto:shop@gostore.mn).

## Боломжууд

- Дэлгүүр: ангилал, хайлт, үнийн шүүлтүүр, сагс, хадгалсан бараа.
- Админ: нэвтрэх, хянах самбар, бараа нэмэх/засах/нуух, үнэ ба үлдэгдэл, зураг оруулах (JPEG/PNG/WebP → JPEG).
- Серверт хадгалагдах барааны болон Хятад линк хүсэлт; хэрэглэгч нэр, холбоо барих утас, тайлбар оруулна.
- Админ хүсэлт шалгах, нийт үнийн санал өгөх, хүргэлтийн төлөв өөрчлөх, дотоод тэмдэглэл хадгалах.
- QPay Merchant V2 адаптер: token cache, invoice, callback-оор төлбөр шалгах. **Production token нэвтрэлт шалгагдсан; төлбөр авах горим идэвхгүй, invoice/callback шалгалт хийгдээгүй.**
- Бусад нийлүүлэгч/карго API: үйлчилгээ, эрх, баримтжуулалт хүлээгдэж байгаа; автоматаар бараа татахгүй.

## Ажиллуулах

Үндсэн кодыг `D:\Gostore.mn` хавтаст засаж хадгална. GitHub нь энэ локал төслийн хувилбарын нөөц юм: [mop03ko/gostore.mn](https://github.com/mop03ko/gostore.mn).

Өөрчлөлтөө шалгасны дараа VS Code → Source Control → Commit → Sync Changes ашиглах эсвэл терминалд:

```powershell
git status
git add <өөрчилсөн-файлууд>
git commit -m "Өөрчлөлтийн тайлбар"
git push origin main
```

Save нь локал файлыг хадгална; Commit/Sync Changes нь GitHub руу хувилбарыг илгээнэ.

Эхлээд өөрийн админ эрхийг локал дээр тохируул:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure-admin.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1
```

Дэлгүүр: `http://127.0.0.1:3000/` · Админ: `http://127.0.0.1:3000/admin/`.

PHP суулгасан байх ёстой. Энэ workspace-д `tmp/tooling/php` зөөврийн PHP байгаа бол скрипт түүнийг ашиглана. GitHub-д PHP binary оруулаагүй. Өөр төхөөрөмжид PHP 8.2+ болон `pdo_sqlite`, `mbstring`, `curl`, `gd` суулгана. Локал өгөгдөл `tmp/local-data` дотор хадгалагдана.

Зөвхөн харагдац үзэх бол `index.html` шууд нээж болно; PHP backend-гүй үед хуучин хөтөч доторх нооргийн горим ажиллана. Админ болон серверийн захиалга ажиллахгүй.

## cPanel

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package.ps1
```

Багц: `output/gostore-preview.zip`. Админы `config.local.php`, нууц түлхүүр, хэрэглэгчийн DB, лог орохгүй. **[Байршуулалт, админ эрх, QPay тохиргооны заавар](DEPLOYMENT.md)**-ыг дагана. Энэ өөрчлөлтийг gostore.mn серверт хараахан байршуулаагүй.

## Бүтэц

```text
index.html / styles.css / script.js   Дэлгүүр, статик fallback
store-server.js                     Дэлгүүр ↔ PHP API
admin/                              Удирдлагын дэлгэц
api/index.php                       JSON API, эрхийн шалгалт
server/bootstrap.php                SQLite, session, validation
server/qpay.php                     QPay Merchant V2
server/config.example.php           Тохиргооны загвар
server/seed.json                     Жишээ бараа
assets/                             Лого, жишээ зураг
assets/uploads/                     Админы оруулсан зураг (Git-д орохгүй)
scripts/                            Ажиллуулах, багцлах хэрэгсэл
tests/                              API ба төлбөрийн логикийн шалгалт
```

## Туршилт

Loopback дээр тусгаарласан тестийн сервер ажиллуулж `tests/api.mjs` (Node 22+) болон `php tests/qpay.php` шалгалтыг гүйцэтгэсэн. API тест нь түр админ тохиргооны `tmp/admin-preview.json` файлыг ашигладаг; өөрийн production сервер рүү тест явуулахгүй.

Шалгасан: нэвтрэх/гарах, зөвшөөрөлгүй API, CSRF, private файлын хамгаалалт, бараа хадгалалт ба нуух, зураг шалгах/хөрвүүлэх, серверээс үнэ тооцох, давхар хүсэлтээс сэргийлэх, захиалгын эзэмшлийн түлхүүр, үнийн санал, QPay идэвхгүй горим, төлбөрийн currency/status/amount болон duplicate ID, хуурамч нийлүүлэгчийн холбоос.

## Хязгаар

- Эхний каталогийн зураг, үнэ нь жишээ. Жишээ бараагаар QPay төлбөр авахгүй.
- Үлдэгдэл нь нийт барааны лавлах тоо; хувилбар тус бүрийн reservation болон автоматаар хасах урсгал одоогоор байхгүй.
- Хэрэглэгчийн account, ажилтны олон role, audit log, refund, eBarimt, бараа импорт, карго API хэрэгжээгүй.
- Админ сүүлийн 1000 хүсэлтийг харуулна. Захиалга харах түлхүүр хэрэглэгчийн хөтөчид хадгалагдана.
- QPay production нээхээс өмнө merchant sandbox эрхээр бүтэн invoice/callback acceptance test хийнэ.

## Монгол үсгийн дүрслэл

Үндсэн фонт нь төхөөрөмжид суусан Gilroy Regular/Bold; CSS нь `local()`-аар хувилбар бүрийн нэрийг тодорхой заана. Gilroy суулгаагүй төхөөрөмж болон дутуу тэмдэгтэд Arial-тэй хэмжээс таарах [Arimo](https://github.com/googlefonts/arimo) фонтыг `GOStore Sans` нэрээр `assets/fonts/` хавтаснаас ачаална. Google Fonts-ийн бүрэн кирилл хувилбарын Өө, Үү, Ёё, ₮ тэмдэгтийг шалгасан. Гаднын font CDN шаардахгүй. SIL OFL лиценз багцад орсон. `.htaccess` нь HTML/CSS/JS-д UTF-8 заана. Хуулахдаа зөвхөн HTML биш `assets/fonts/`-ийг хамт хуулж, хөтөч болон CDN-ийн хуучин кэшийг цэвэрлэнэ.

## Брэнд ба жишээ зураг

`GOStore-Brand-Guidelines-Detailed.pdf` V2.3-ийн 07–17-р хуудсын өнгө ба хэмжээний стандарт: үндсэн хөх `#132344`, шар `#FFC400`, Cloud `#F3F6FC`; Gilroy / Arimo, үндсэн текст 16/24 px, тайлбар 14/20 px, H1 40/48 px. Карт 16 px, үндсэн товч 12 px радиустай; гар утасны үндсэн товч 44 px-ээс багагүй. Дэлгүүр, админ, түр нүүр хуудсанд нэг ижил палитр хэрэглэнэ. `assets/logo.png` нь уг PDF-ийн шинэчилсэн бүтэн логоны растер хувилбар; үсгийн хэлбэрийг дахин зураагүй. Жишээ зургууд Unsplash (`images.unsplash.com`) эх үүсвэртэй:

| Файл | Photo ID |
|---|---|
| chair | photo-1567538096630-e0c55bd6374c |
| headphones | photo-1505740420928-5e560c06d30e |
| backpack | photo-1553062407-98eeb64c6a62 |
| sneakers | photo-1542291026-7eec264c27ff |
| watch | photo-1523275335684-37898b6baf30 |
| lamp | photo-1507473885765-e6ed057f782c |
| skincare | photo-1608571423902-eed4a5ad8108 |
| living | photo-1600210492486-724fe5c67fb0 |
