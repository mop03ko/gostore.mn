# cPanel суулгалт

## Direct TaoWorld authorization - 2026-10-30

- Added an admin-only connection page at `/api/taoworld/connect.php` and the registered callback path `/api/taoworld/callback.php`. Supports one-use, session-bound OAuth state, signed code exchange, private token storage and explicit serialized refresh. The transport cannot call purchase/payment endpoints. Existing OT catalog and purchasing behavior are unchanged.
- Imported the owner's credentials without displaying them into ignored `server/taoworld.local.php`. The original key file is ignored and explicitly denied over HTTP. Eight runtime/configuration files were deployed with FTPS staging and hash verification; the live `.htaccess` received only the filename-denial addition, preserving its cPanel handler. Backup: `/gostore-backups/taoworld-auth-20261030-49321d101c`.
- Passed official HMAC signing vector, isolated authorization tests and an isolated browser flow using fake credentials/transport: admin/CSRF gates, expiry/replay/cross-session rejection, key/account binding, rotating token persistence, locks, failed-refresh preservation, redacted UI and mobile layout. PHP syntax and Git whitespace checks passed.
- Live unauthenticated checks: connect page 401 with no-store, callback 303 to the clean connection page, private configuration and original key filename 403, storefront 200. The owner must still authorize the TaoWorld purchasing account. No real buyer token exchange, catalog permission test, purchase or payment was performed. Operator instructions: `docs/taoworld-authorization.md`.

## QPay bank grid and fit fixes — 2026-10-28

- Owner-authorized deployment of `29d57b7` (`app.css`, `app.js`, `index.html`). Live files matched `fc96768` before publishing. Verified FTPS backup: `/gostore-backups/fit-20261028-e1321ee4af`; staged, published and HTTPS bytes matched; `/`, `/v/…`, `/brands/nike`, `/cart`, `/help`, `/account` 200.
- Fixed: from 768px up, QPay bank buttons overflowed to the left of the invoice modal where most banks could not be reached; phones listed them in reverse. Live check rendered an 18-bank invoice client-side only (no order or payment): all 18 inside the modal, 2 columns at 320px, 4 at 768/1440px, `qPay хэтэвч` first. Also fixed the 761–1099px product buy bar, 320px account menu, cart remove target and the 320px progress label.
- `tests/layout-audit-ui.cjs` (part of run-all) found no issues locally; the same audit on live home, two products, brand, cart and help pages at six widths found none. Real QPay bank lists may differ in names/count; the grid wraps any number.

## Bundled assets, lazy hidden images, brand shift — 2026-10-27

- Owner-authorized deployments: `0215c09`/`896da2c` (one `app.js` + `app.css` instead of 16 scripts and 6 stylesheets, because the host serves HTTP/1.1; in-flight cart sync fix). Backup `/gostore-backups/bundle-20261027-bb41e4ab1a`. Then `fc96768` (lazy hero images/brand logos, homepage hero preload, brand page shift fix). Backup `/gostore-backups/lazy-20261027-1b0f08a6a4`. Each time live files matched the previous release before publishing; staged, published and HTTPS bytes matched. Source scripts remain on the server but are no longer referenced. No server, schema, configuration, order or payment changes.
- Live checks: `app.js` 59.5 KB and `app.css` 27 KB with Brotli and immutable caching; `/`, `/v/…`, `/brands/nike`, `/cart`, `/help`, `/account` 200. Chrome at 390px (4x CPU, ~2 MB/s) and 1440px: CLS 0 on home, product and brand pages, no JavaScript errors; product and brand pages no longer request homepage hero images. Mobile scripts finish at 0.64–0.69 s (previously 1.4–1.5 s); product options visible at 0.75 s on a cached product; home LCP 0.73 s mobile / 0.19 s desktop; brand LCP 0.77–0.86 s in repeat runs (one cold 2.8 s run).
- After editing storefront JS/CSS run `node scripts/bundle.cjs`; `tests/run-all.cjs` fails on a stale bundle. Full suite passed except the known stale `catalog-navigation-ui`.

## Early product request — 2026-10-27

- Owner-authorized deployment of `fa1d3f7`: `store-server.js`, `product-page.js`, then `index.html`. Live files matched `cfce7c8` before publishing. Verified FTPS backup: `/gostore-backups/product-early-20261027-98be65f6dd`; staged, published and HTTPS bytes matched. No server, schema, configuration, order or payment changes.
- Live Chrome at 390px with 4x CPU and ~2 MB/s throttling, two products, three runs: the single `supplier-product` request now starts at 0.26 s (previously 1.39–1.52 s), LCP 1.78–1.84 s (previously 2.77–2.79 s) and options are usable at 1.99–2.05 s (previously 2.26–2.84 s). Remaining LCP is bounded by deferred scripts executing.
- Tests: new `tests/product-early-ui.cjs` and 17 related suites passed.

## Store release: copy, speed, cart sync, payment confirmation — 2026-10-27

- Owner-authorized deployment of `aacc819` (store copy), `05fc926` (WOFF2 font and layout-shift fixes), `cfce7c8` (cross-device cart/saved sync, unpaid-order reminder, automatic payment confirmation) and the pending admin fixes `07806a2`/`97fb74f`. 25 runtime files: 22 changed, 3 new (`customer-sync.js`, `server/customer-state.php`, `assets/fonts/arimo-variable.woff2`). `coming-soon/index.html` is not on the live server and was not uploaded; `server/taobao-purchase.php` was already live.
- All 22 live files matched `1565e63` before publishing; new paths did not exist. Published server files first and `index.html` last. Verified FTPS backup: `/gostore-backups/store-release-20261027-5169c85606`; staged and published bytes matched. The `customer_state` table is created by the existing `CREATE TABLE IF NOT EXISTS` bootstrap; no other schema, configuration, order or payment data changed.
- Live HTTPS: 13 public files byte-identical to Git; private PHP 403; catalog API 200; `customer-state` 401 without a session; WOFF2 served as `font/woff2` with one-year immutable caching; `/v/…`, `/brands/nike`, `/cart`, `/help`, `/account` 200.
- Live Chrome (390px with 4x CPU and ~2 MB/s throttling, plus 1440px): CLS 0 on home and product pages (previously 0.39 and 0.78), font transfer 87 KB (previously 269 KB), no JavaScript errors; warm mobile home FCP/LCP 0.72 s. Mobile product LCP remains 2.6–3.2 s because the 800px Taobao image dominates. Screenshots reviewed. No live orders, payments or accounts were created.
- Tests: new `tests/customer-state.php` and `tests/customer-sync-ui.cjs`, plus 19 browser and 4 PHP regression suites, passed. Payment confirmation was exercised with a mocked paid response, not a real QPay transaction. `catalog-navigation-ui` still has its earlier stale 10-brand assumption.

## Taobao provider error details — 2026-10-27

- Deployed only `server/taobao-purchase.php` from `b650b3e` after an admin saw `Missing parameter` from «Taobao тооцоо харах». Admin errors now include provider detail fields (`sub_msg`, `message`, `detail`…) next to `reason`, so the missing field can be identified. Request payloads were not changed.
- Live file matched the previous release before publishing. Verified FTPS backup: `/gostore-backups/taobao-reason-20261027-d37d6ad165`; staged and published bytes matched. Live HTTPS: `/`, `/admin/` and catalog API 200; private PHP 403. No orders, payments or Taobao purchases were created.
- `tests/taobao-purchase.php` passed. Unconfirmed hypothesis: single-variant (`standard`) lines omit `sku_id`; confirm with the next detailed provider error before changing the payload.
- The earlier admin purchase-panel layout fix (`07806a2`) is committed but not deployed.

## Restricted catalog products — 2026-10-26

- Removed the knife navigation entry and applied a shared restriction to supplier search (including brand/image results), detail, related products, cached snapshots, local inventory, checkout, invoice requests and supplier purchases. Browser favorites/cart/comparison displays are filtered; cache namespaces and asset versions changed. See `docs/product-policy.md` for scope and limitations.
- The initial live snapshot contained 300 department entries, including eight identified restricted Taobao IDs. These IDs are explicitly denied even if renamed. Existing normalized snapshots are rebuilt from screened raw data. No schema, configuration, historical orders or payment records were edited.
- Deployed 15 runtime files over verified FTPS with pre-change comparisons, remote backups, staged byte verification and per-file atomic rename. Backup: `/gostore-backups/product-policy-20261026-6bb44d3af3`. Prepared artifacts, audit snapshot and verification report remain in ignored `tmp/product-policy-deployment/`.
- Live HTTPS: all seven public assets matched local bytes; four restricted queries returned zero products; all eight confirmed IDs returned 404. The mixed feed returned 266 products without a policy match; kitchen/tools/camping feeds also passed. Private PHP source returned 403. Live mobile browser confirmed the removed category, blocked detail with no purchase controls, no overflow and no JavaScript errors. No live orders/payments were created.
- Passed isolated PHP suites: product policy, supplier errors/performance/snapshots/card prices/batches/English names, catalog filters, checkout/freshness, Taobao purchase, QPay/flow, freight payment and OT operator. Browser policy, supplier cache and checkout suites passed. PHP/JS syntax and diff checks passed.
- Two older UI suites have unrelated stale assumptions: catalog navigation expects 10 brands and a flex layout (current site has 12 and a grid); product-page UI reaches the legacy `/p/chair` test after supplier assertions, but that demo product is removed by the existing migration. They were not reported as fully passing. New policy and live browser checks cover this change's category removal and blocked detail behavior.

## Google Analytics and Facebook domain verification

- Deployed the tags from `2f0ac89` and `e825f0f` to `/public_html/index.html`: GA4 measurement ID `G-WLC1E39628` and Facebook domain verification value `ebt236r27oijorkmps2m2pz9vkr4t7`.
- Inserted only the two tag blocks into the existing live HTML. Verified FTPS backup: `/gostore-backups/site-tags-ac3eb8cbe8c2/index.html`; staged and published bytes matched the prepared artifact. Local backup and manifest remain in ignored `tmp/site-tags-deployment/`.
- Public HTTPS checks for `/` and `/help` returned HTTP 200 and exactly matched the deployed HTML, with one Google loader/config and one Facebook verification meta tag. GA4 event receipt and Meta's Verify domain action were not checked; these require their respective consoles. No application configuration or database changes.

## Supplier contention recovery — 2026-10-20

- Release `65dd251` deployed five files: supplier backend, API, public cache client, prefetch logic and versioned HTML. Verified backup: `/gostore-backups/supplier-queue-20261020-a84b4285fcc1`; FTPS and public HTTPS bytes matched. No configuration/schema/payment changes.
- Foreground cache-key/provider-slot contention now waits up to eight seconds; background work uses one slot without waiting. Typed busy responses receive bounded automatic retries only for public GETs. Speculative prefetch is serialized, capped at four, and disabled on slow/save-data connections. Existing checkout freshness checks remain enforced.
- Ten targeted suites passed, including multiprocess cache publication/slot contention, retry/backoff/prefetch, shared browser cache, budget, English fallback and mocked invoice freshness. Live Chrome verified 50→100 scroll, 320/390px layouts and no JS errors. A browser-only simulated initial busy response recovered automatically into 50 real cached products without an error/retry UI; production was not load-tested or deliberately saturated.

## Cache, supplier budget and checkout freshness — 2026-10-20

- Release `fa90e97` deployed 11 runtime files. Verified backup: `/gostore-backups/performance-20261020-9475eb8bd94d`. The live cPanel PHP 8.3 handler appended to `.htaccess` was preserved byte-for-byte; application directives match Git. No schema, business settings, orders or payment data were changed.
- Live checks passed for one-year immutable versioned assets, revalidating unversioned assets, HTML `no-cache`, customer/dashboard `no-store`, protected server files, and both Brotli/Gzip. `supplier.js`: 25,254 identity bytes, 8,497 Gzip, 8,004 Brotli. A fresh Chrome context's second navigation used browser cache for all 20 versioned JS/CSS resources (zero transfer bytes); 50→100 scroll and 390px layout passed without JS errors. These are controlled observations, not field p75 Web Vitals.
- Eleven targeted PHP suites and six API/browser suites passed, including fake-QPay invoice freshness/price/stock checks, issued-invoice idempotency, budget reserve/caps, snapshot resume, title fallback, public cache privacy, concurrent orders and admin health display. No real invoice/payment/supplier purchase was created by verification.
- Read-only live health confirmed the existing 800/day limit, a 160-call checkout reserve, 400-call background ceiling and adaptive three-hour snapshot cycle. Background worker activity is reported separately from cron. Cron has no verified heartbeat: PHP exec is disabled and the browser connector could not start, so no scheduling change was made. Hosting must confirm the ten-minute schedule in [the runbook](docs/performance-cache.md).

## Compact catalog and scroll batches — 2026-10-19

- Release `5d6aa82` replaces numbered pagination with 50-item automatic scroll batches and compact responsive cards. Published eight runtime files, backend first and versioned HTML last. No database or configuration changes.
- Verified backup: `/gostore-backups/catalog-scroll50-20261019-f8228cf7967b`. FTPS backup/stage/live bytes and HTTPS assets match the committed release; private PHP files remain protected.
- Targeted PHP, public API, catalog/cache, all-ten-brand, English-title, image-search and desktop/mobile browser checks passed. Tests exercise append retry, preserved DOM, duplicate/final stop, stale-query races, filter/saved resets, native offsets and 50-item image search. Both provider search transports returned 50 products in read-only checks.
- Live Chrome verified 50 initial products becoming 100 unique products by scrolling, retained first-card DOM, no numbered pages, six columns at 1440px and two at 390/320px, no horizontal overflow or JavaScript errors. Desktop/mobile screenshots reviewed. No live orders or payments created.


## Brands first on homepage — 2026-10-19

- At the owner's request, `9819d14` moves the existing brand logo row immediately below the header, before the hero and catalog. Only `index.html` was deployed; verified backup: `/gostore-backups/brands-first-20261019-3ae08eaed91d`.
- Catalog navigation regression passed. Live Chrome verified ten loaded logos first on the homepage, 1440/390/320px layout without horizontal overflow, Nike's internal storefront link and no JavaScript errors. FTPS and HTTPS bytes match the committed file.

## Ecommerce purchase flow — production release 2026-10-19

- Owner explicitly authorized review, fixes, merge and live deployment of PR #2. Reviewed head `b6d86443a399cadfebb6a7127cd760c1bdbf63ba`, merged into `main` as `fa2ccb709df716039c6581d6de676a41a6e2a7c8`.
- Published 13 runtime files, including new `commerce-ui.js/css`, guest cart/login continuation, cost estimates, product/SKU layout and catalog sort changes. Verified FTPS backup/stage/live bytes and HTTPS public asset bytes. Backup: `/gostore-backups/commerce-ux-20261019-92502b87507b`. No configuration or database changes.
- All 48 registered suites passed across the full local run and targeted reruns, plus brand API and all-storefront UI (50 total). Review fixed narrow-header touch targets and updated obsolete UI expectations. Local payment tests use mocked transport; no live payment or supplier purchase was made.
- Live public baseline confirmed unchanged product price, SKU, title, descriptions, attributes and shipping/payment settings, with QPay still enabled. Normal cache refresh changed expiry/offer availability metadata and marked already-unsellable related products unavailable; product amounts and offer content were unchanged.
- Live Chrome passed homepage/catalog, 320px layout and 44px controls, guest cart add, buy-now sign-in, Nike product detail, cart/help/returns anchors and cargo calculator. No JavaScript or same-origin HTTP errors, and no live orders created. Deployment state and verification artifacts are retained in ignored `tmp/`.

## English product names — production release 2026-10-19

- Owner explicitly authorized merging and production deployment. PR #1 merged into `main` as `d1beb526cda3ab7eb14cc9990414c27fe201be93`; reviewed implementation head `ef3ab183b716b5a6079f776123380ad96438c4bc`.
- Published only `server/supplier-titles.php`, `server/supplier-snapshot.php`, and `server/supplier.php` using verified FTPS staging and backups. Backup: `/gostore-backups/english-titles-20261019-acbb7e7512ad`. Live bytes match the committed release; direct PHP file requests return 403.
- Eleven targeted PHP/browser suites passed during review. Live search and product detail exactly matched the pre-deployment baseline. The initial positional Nike comparison detected a normal cache refresh: ID-based comparison confirmed the same 12 products with unchanged prices, currency, SKU data and offers; expiry timestamps changed and five already-unsellable products changed from unverified to unavailable and sorted last. Existing pricing logic is unchanged.
- Live Chrome checks passed for homepage entry, Nike catalog, product heading fallback, brand return, mobile layout and no JavaScript errors. No orders or payments created.
- Provider limitation: the read-only OT language list still contains only `khk` (Mongolian). English titles remain unavailable until English is enabled for the key. The deployed fallback preserves existing names; `catalog_language`, descriptions, attributes, SKU language and pricing settings remain unchanged.

## Бүх брэндийн тусдаа хуудас — 2026-10-19

- `626452c`: Nike-ийн хуудасны загварыг adidas, Puma, New Balance, UNIQLO, ZARA, Sony, Xiaomi, LEGO, IKEA-д өргөтгөсөн. `/brands/<id>` route, тухайн брэндийн эх SVG лого, нүүрийн текст, title/meta/canonical болон API каталогтой. Нүүрийн карт, барааны дэлгэрэнгүйн буцах холбоос бүгд энэ route-ийг ашиглана.
- Нийтлэг `brand-page.js`/CSS нь баталгаажсан брэндийн жагсаалтаас нэр ба лого сонгоно. Apple/Samsung/үл мэдэгдэх route 404. Үнийн шүүлт, шинэ/борлуулалтын эрэмбэ, хуудаслалт, кэш, урамшууллын одоогийн логик ашиглагдана. Гар утсанд урт гарчиг багтах font хэмжээг тохируулсан.
- `brand-storefronts-ui`, `nike-storefront-ui`, `brand-browse-ui`, `catalog-navigation-ui` тэнцсэн. 10 брэндийн seller scope, metadata/logo, detail return, 320/390/1440px layout, IKEA sort/page/price/reset/reload, Sony error/retry шалгасан. JS/PHP syntax болон diff шалгалт тэнцсэн.
- 5 live файл шинэчилсэн; `.htaccess`-ийн cPanel handler хадгалсан. FTPS backup/stage/live ба HTTPS файлын байт, 10 route HTTP 200, unknown route 404 баталсан. Нөөц: `/gostore-backups/all-storefronts-20261019-64e418a195b5`.
- Live browser: бүх 10 брэнд зөв seller-ийн каталог буцаасан (adidas 11, бусад 12 бараа). Desktop/mobile лого, title/canonical, IKEA борлуулалтын эрэмбэ/reload, adidas detail return, нүүрээс LEGO руу орох, JS/HTTP алдаагүйг шалгасан. Захиалга, төлбөр үүсгээгүй.

## Nike брэндийн тусдаа хуудас — 2026-10-19

- `17a0b04`: `/brands/nike` хуудас GOStore-ийн өнгө, фонт, header/footer-тэй; Nike лого, нүүр хэсэг, API каталог, шинэ бараа/борлуулалтын цэс, үнийн шүүлт, хуудаслалт, захиалгын тайлбартай. Нүүрийн Nike карт, барааны дэлгэрэнгүйн буцах холбоос энэ хуудсыг нээнэ.
- Nike seller scope URL дахь өөр brand/category/image/filter утгаар солигдохгүй. Reset Nike-д үлдэнэ; сайтын ерөнхий хайлт, хадгалсан бараа, зураг хайлт үндсэн каталог руу шилжинэ. Нэмэлт API хүсэлтгүй, одоогийн кэш/зураг/хямдралын шалгалтыг ашигласан. Tmall жишээ холбоос автомат уншилтаар нээгдээгүй; дэлгүүрийн HTML хуулбарлаагүй, GOStore-ийн загвараар бүтээсэн.
- `nike-storefront-ui`, `brand-browse-ui`, `catalog-navigation-ui`, `product-page-ui`, `supplier-cache-ui` тэнцсэн. 320/390/1440px харагдац, exact seller, ганц анхны хүсэлт, sort/page/reload/price/reset, дотоод detail/return, ерөнхий хайлт, keyboard болон үндсэн каталогийн регрессийг шалгасан.
- 7 live файл байршуулсан (2 шинэ: `brand-page.js`, `brand-page.css`). `.htaccess`-ийн cPanel PHP handler блокийг хадгалсан. Нөөц: `/gostore-backups/nike-storefront-20261019-abeafef83be0`. FTPS backup/stage/live байт, HTTPS assets, route HTTP 200, private server файл 403 шалгасан.
- Live: гурван эрэмбэ тус бүр зөв Nike seller-ийн 12 бараа буцаасан; бүтээгдэхүүний зургууд ачаалсан. Шинэ эрэмбэ, page 2/reload, reset, дэлгэрэнгүйгээс буцах, нүүрийн Nike карт, mobile overflow болон JavaScript/HTTP алдаагүйг browser-оор баталсан. Захиалга, төлбөр үүсгээгүй.

## Брэндийн дотоод API каталог, урамшуулал — 2026-10-19

- `cdb8c88`: 10 лого `/?brand=<id>#catalog` дотоод каталог нээнэ. Барааны дэлгэрэнгүй `?brand=<id>` хадгална; гадаад дэлгүүр рүү автоматаар шилжихгүй. Үнэ, эрэмбэ, хуудаслалт, reload болон брэндээс гарах төлөв тестлэгдсэн.
- OTAPI `BatchSearchItemsFrame` + VendorId ашиглаж, дэлгүүрийн canonical ID / numeric seller ID болон бараа бүрийн эзэмшигчийг тулгана. REST vendor_name бодит туршилтаар ерөнхий каталог буцаасан тул ашиглаагүй. Native хүсэлтүүд одоогийн төсөв/lock/backoff хамгаалалтыг ашиглаж 10 минут кэшлэгдэнэ.
- `BatchGetItemFullInfo`-ийн Promotions блок, хямдралгүй үнэ, нэр/нөхцөл/тооцоолсон лавлах үнэ/дуусах хугацааг дэмжсэн. Баталгаагүй, дууссан, ирээдүйн, stale урамшуулал харуулахгүй. Купоны үнийг checkout дүн рүү автоматаар хэрэглэхгүй; SKU, үлдэгдэл, үнийг захиалгын үед шалгана.
- 9 файл (1 шинэ backend, 8 шинэчилсэн) байршуулж FTPS байт, frontend HTTPS, private server файл 403, үл мэдэгдэх брэнд 404-ийг шалгасан. Нөөц: `/gostore-backups/brand-api-20261019-37fea1c417f8`.
- Live бүх 10 брэнд HTTP 200; тус бүр 12 бараа, adidas дээр өөр seller-ийн нэг барааг хасаж 11 бараа. Nike дотоод navigation, page 2/reload, detail/offers, 390px mobile, JS алдаагүй. API-ийн туршсан бодит detail идэвхтэй урамшуулалгүй байсан; хямдрал, нөхцөл, expiry харагдацыг тусгаарласан fixture-ээр баталсан. OT өөрийн Storage өгөгдөл буцааж болох тул эх үүсвэрийн шинэчлэлээс хамаарна.
- `brand-api` (PHP contracts багтсан), `brand-browse-ui`, `catalog-navigation-ui`, `product-page-ui`, `collection-ui`, `supplier-cache-ui`, `supplier-images-ui` тэнцсэн. Live захиалга, төлбөр үүсгээгүй.

## Логотой брэндүүд, зураг ачаалал — 2026-10-19

- `a4c06bc`: Apple/Samsung-ийг хасаж 10 локал SVG логотой карт нэмсэн. Desktop 5, mobile 2 багана; карт бүр албан ёсны Tmall дэлгүүрийг шинэ цонхонд нээнэ. Эх сурвалж, гуравдагч сайтын хандалтын хязгаар: `docs/brand-storefronts.md`.
- 6 frontend файл, 10 шинэ лого live-д байршуулсан. Өмнөх файлуудын нөөц: `/gostore-backups/brand-logos-20261019-a0d94f4a1ab1`. Stage, backup, live, HTTPS файлуудыг байтаар тулгасан; алдаанд буцаах хамгаалалттай.
- AliCDN эх зургаас карт/галерей/thumbnail/хувилбарын жижиг зургууд татна; resize алдаанд эх зураг руу нэг удаа буцна. Томруулалт, хадгалсан бараа, сагсны эх зураг хадгалагдсан. Ижил 10 бодит барааны картын зураг 1,469,198 → 243,720 bytes (83% бага). Энэ нь татах хэмжээний харьцуулалт; бүх шинэ хайлтын хугацааны баталгаа биш.
- Локал `catalog-navigation-ui`, `supplier-images-ui`, `supplier-cache-ui`, `product-page-ui`, `collection-ui` тэнцсэн. Live 1440/390 өргөнд 10 лого, Apple/Samsung байхгүй, гадаад дэлгүүрийн холбоос, жижиг зураг, эх зургийн zoom, хэвтээ хальсан хэсэггүй, JS алдаагүйг шалгасан. Нэг хэмжилтэд жагсаалт 447ms, кэштэй дэлгэрэнгүй 229ms. Live захиалга, төлбөр үүсгээгүй.

## Үйлдвэрээс шууд захиалах текст — 2026-10-19

- `ce1a031` хүртэлх хувилбар: хэрэглэгчийн нүүр, каталог, хадгалсан бараа, сагс, тусламж, барааны хуудсан дахь Taobao шошгыг шууд захиалгын текстээр сольсон. Нийлүүлэгчийн ангиллын үндсэн Taobao мөрийг харагдацаас хассан. API, нийлүүлэгчийн холболт, админы техникийн нэршил хэвээр.
- 7 frontend файлыг нөөцлөөд байршуулсан. Үндсэн нөөц: `/gostore-backups/direct-copy-20261019-d4515dc27f6a`; ангиллын шошгоны 2 файлын засварын нөөц: `/gostore-backups/direct-copy-20261019-bceded58ddfe`.
- Live шалгалт: нүүр 1440/390, ангиллын цэс, хадгалсан бараа, `/cart`, `/help`, `/v/tb-773839428782` 1440/390 дээр харагдах текст болон aria/meta шошгонд Taobao үлдээгүй; хэвтээ хальсан хэсэг, JavaScript алдаагүй. Локал collection-ui, product-page-ui, store-pages-ui шалгалтууд амжилттай.


## Дэлхийн брэндүүд — 2026-10-19

- `b852777` хувилбарын 4 frontend файлыг байршуулсан: `catalog-navigation.css`, `catalog-navigation.js`, `supplier.js`, `index.html`. Брэндийн 12 карт нэрээр нь Taobao каталогт хайлт нээдэг.
- Live файлуудыг Git хувилбартай тулгаж, нөөц ба stage хуулбарыг шалгасны дараа шинэчилсэн. Нөөц: `/gostore-backups/brands-20261019-2f7a8b3bc99f`; локал тайлан: `tmp/brands-deployment.json`.
- Live шалгалт: 12 брэнд, Nike хайлт HTTP 200 / 12 бараа, сонгосон брэндийн төлөв ба URL, 1440/390 өргөний харагдац, хэвтээ хальсан хэсэггүй, JavaScript алдаагүй. HTTP-ээр авсан 4 файл commit-тэй ижил.


## Хямдаас үнэтэй эрэмбэ, логикийн засвар — 2026-10-18

- `7092a90` (6 файл): анхдагч эрэмбэ хямдаас үнэтэй (холимог каталог бүхэлдээ, ангилал/хайлт хуудас дотроо), «Үнэ өсөх» (Taobao-гийн 0.01¥ хог зар) цэснээс хасагдсан. `7fe0452`: 14 хоногийн цонхоор автомат цуцлалтын скан, хаягийн шилжүүлэлтийн race, «Хадгалах» үнэ.
- SQLite backup, нөөц `/gostore-backups/checkout-20261017-dcc29143dbc9`. Live API: `__all__`, `lamp`, `jewelry accessories` өсөх дараалалтай, үнэгүй нь төгсгөлд.

## Сагсны хуудас, тусламж, ангиллын засвар — 2026-10-17

- `0049328` хувилбарын 9 файлыг (шинэ: `store-pages.js`) байршуулсан. `.htaccess`-д `^(?:cart|help)/?$` дүрэм нэмэгдэж, cPanel handler блок хадгалагдсан. «Хүүхдийн гутал» (0 үр дүн) ангилал хасагдсан (`ac3e0cd`).
- SQLite backup (integrity ok, 2 захиалга), файлын нөөц `/gostore-backups/checkout-20261017-b29062cde318`.
- Live хөтчийн шалгалт (1366/390): сагсанд нэмэхэд хөвөгч цонх, `/cart` мөр ба хураангуй, `/help` 8 FAQ, каргоны тариф, утасны карт, хөвөгч «?» товч, header-т «Хүүхдийн гутал» байхгүй; JS алдаа, 4xx/5xx, хэвтээ гүйлгээгүй. Шалгалтад нэмсэн бараа зөвхөн тест хөтчийн localStorage-д байсан бөгөөд хасагдсан.

## Миний бүртгэл (/account) — 2026-10-17

- `f00d967` хувилбарын 9 файлыг (шинэ: `account-page.js`) байршуулсан. `.htaccess`-д `^account` дүрэм нэмэгдэж, cPanel-ийн ea-php83 handler блок хадгалагдсан (скрипт блокийг хассан агуулгыг Git-тэй тулгаж, шинэ файлд блокийг буцааж залгадаг).
- SQLite backup (integrity ok, 2 захиалга), файлын нөөц `/gostore-backups/checkout-20261016-174f1ef73ec5`. `customer_addresses` хүснэгт эхний хүсэлтээр автоматаар үүссэн.
- Шалгалт: `/`, `/account`, `/account/addresses`, API 200; нэвтрээгүй үед нэвтрэх санал, нэвтрэх модал, каталог нуугдсан; нүүр хуудас 12 бараатай; desktop/mobile JS алдаа, 4xx/5xx, хэвтээ гүйлгээгүй.

## Каталогийн шүүлтүүр, харьцуулах, хайлтын санал, Хятад доторх хүргэлт — 2026-10-17

- `72de09e` хувилбарын 14 файлыг (шинэ: `shop-tools.js`) `tmp/deploy-checkout-release.cjs`-ээр байршуулсан: SQLite backup (integrity ok, 2 захиалга), солигдсон файлын нөөц `/gostore-backups/checkout-20261016-40f34a82c1a5`. Файлуудыг HEAD-ээс уншдаг тул commit хийгдээгүй локал ажил орохгүй.
- Хятад доторх хүргэлтийн анхдагч утга 0 болсон (`cb8915d`): захиалахад бараа + үйлчилгээ төлж, Хятад доторх хүргэлт болон каргог эцсийн тооцоонд бодит дүнгээр авна.
- Live хөтчийн шалгалт (1366/390): үнийн шүүлтүүр, «нийт N үр дүн», дугаартай хуудаслалт, харьцуулах тоолуур, хайлтын санал, барааны хуудасны харьцуулах төлөв; JS алдаа, 4xx/5xx, хэвтээ гүйлгээгүй.

## Сагс, шууд төлбөр, Taobao → Эрээн худалдан авалт — 2026-10-16

- `82c5242` хувилбарын 26 файлыг (шинэ: `checkout.js`, `server/checkout.php`, `server/taobao-http.php`, `server/taobao-purchase.php`) FTPS-ээр байршуулсан. Зөвхөн `0ac83ab`-аас хойш Git-д өөрчлөгдсөн, live хувилбар нь commit эсвэл өмнөх `tmp/*-release` build-тэй таарсан файлуудыг сольсон; сервер дээр оптимижуулсан зураг болон cPanel-ийн PHP handler бүхий `.htaccess`-д хүрээгүй. `server/config.local.php` өөрчлөгдөөгүй, QPay/OT идэвхтэй хэвээр.
- SQLite online backup: `/home/gostorem/gostore-data/backups/checkout-20261016-*.sqlite` (integrity ok, 2 захиалга). Солигдсон файлын нөөц `/gostore-backups/checkout-20261016-*`, локал `tmp/deploy-backups/`. Нарийвчилсан төлөв: `tmp/checkout-release-deployment.json`.
- Эхний скрипт 14 файл нийтэлсний дараа FTP холболт тасарч зогссон (API 503 горимд). Сервер дээрх stage хавтаснаас үлдсэн 12 файлыг `tmp/deploy-checkout-resume.cjs`-ээр ижил дарааллаар нийтэлж, засвар үйлчилгээний `api/.htaccess`-ийг устгасан. Нийт тасалдал хэдэн минут.
- Шалгалт (`tmp/deploy-checkout-verify.cjs`): 26 live файл HEAD-тэй ижил; хувийн замууд 403/404; шинэ POST үйлдлүүд CSRF шаарддаг; каталог, барааны хуудас, DB integrity; desktop/mobile хөтчид JS алдаа, 4xx/5xx, хэвтээ гүйлгээгүй.
- Live тохиргоо: ханш 550, Хятад доторх хүргэлт 10¥/дэлгүүр, тогтмол хураамж 0₮, үйлчилгээ 0%, төлбөрийн хугацаа 24 цаг, зургаар хайх унтраалттай, Taobao худалдан авагчийн данс холбогдоогүй, автомат худалдан авалт унтраалттай. `fastcgi_finish_request` бий тул tracking/кэшийн арын шинэчлэлт ажиллана.
- УБ агуулахын хаягийг админ «Улаанбаатар хот, Сүхбаатар дүүрэг, 3-р хороо, 5-р хороолол, 14б байр, 4 тоот. Шуудангийн код: 14252-0024» болгож зассан; live API-д харагдаж байна (утас 86079077, ажиллах цаг хоосон).

## Агуулахын багц ба захиалгын tracking — 2026-10-13

- `09c5c90` хувилбарыг `https://gostore.mn/` дээр FTPS-ээр байршуулсан. Багцын 39 файлыг тулгаж, өөрчлөгдсөн 16 файлыг сольсон; live `server/config.local.php` өөрчлөгдөөгүй, QPay идэвхтэй хэвээр.
- SQLite online backup болон integrity check амжилттай: `/home/gostorem/gostore-data/backups/warehouse-20261013-f71cf47f6cd5.sqlite`. Солигдсон файлын нөөц: `/home/gostorem/gostore-backups/warehouse-20261013-f71cf47f6cd5`; локал хуулбар `tmp/deploy-backups/warehouse-20261013-f71cf47f6cd5/`.
- Бэлэн бараа түр хаалттай. Захиалгын богино GS код, хятад хэлтэй Эрээн панел, монгол хэлтэй Улаанбаатар панел, GB багц үүсгэх/илгээх/хүлээн авах, захиалга бүрээр ангилах, агуулахаас өгөх/хүргэлтээр гаргах урсгал байршуулсан. GB код зөвхөн дотоод хэрэглээнд; хэрэглэгч өөрийн GS кодоор төлөвөө харна.
- `shipment_batches`, `shipment_batch_orders` хүснэгтүүд live SQLite 3.7.17 дээр үүсэж, DB integrity check амжилттай. Өмнөх 1 захиалга хадгалагдсан; live тестийн захиалга, багц, төлбөр үүсгээгүй.
- HTTPS public файлууд локал эхтэй ижил; серверийн хувийн файлууд 403/404, эрхгүй агуулахын API 401. Chrome дээр Эрээн/Улаанбаатар нэвтрэх дэлгэц, mobile өргөн, админ нэвтрэх → агуулахын эрх → гарах, нүүр хуудасны бэлэн барааны хаалт болон JavaScript алдаагүйг шалгасан.
- Менежерийн хоёр эрх хараахан тохируулагдаагүй. Үндсэн админ `/admin/` → **Агуулахын эрх** хэсгээс имэйл, нууц үг, идэвхтэй эрхийг тохируулна. Панелууд: `/warehouse/?location=erenhot`, `/warehouse/?location=ulaanbaatar`.

## Одоогийн байршуулалт — 2026-10-12

- Үндсэн сайт: `https://gostore.mn/`; админ: `https://gostore.mn/admin/`.
- FTPS-ээр `/home/gostorem/public_html` руу байршуулж, public файлуудын агуулгыг локал эхтэй HTTPS-ээр тулгасан. Админ нэвтрэх, dashboard унших, гарах болон нууц файлууд 403/404 буцаах шалгалт амжилттай.
- PHP 8.3.35, SQLite 3.7.17; `pdo_sqlite`, `mbstring`, `curl`, `gd` идэвхтэй. Rate limit болон бараа хадгалах SQL-ийг SQLite 3.7.17-д нийцүүлсэн.
- Өгөгдөл `/home/gostorem/gostore-data` хавтаст (0700), админ тохиргоо `server/config.local.php` файлд (0600). Анхны админы нэвтрэх мэдээлэл зөвхөн локал `output/gostore-admin-login.txt` дотор; Git болон ZIP-д орохгүй.
- Өмнөх “Тун удахгүй” хуудасны солигдсон файлуудын нөөц: `/home/gostorem/gostore-backups/20261012-61f26f0609`; SQLite нийцлийн засварын өмнөх хувилбар: `/home/gostorem/gostore-backups/20261012-2a5c207bbf`. Локал хуулбар `tmp/deploy-backups/` дотор бий. Эдгээр нь солигдсон файлын нөөц бөгөөд өгөгдлийн сангийн snapshot биш.
- Нээх үеийн каталог 8 жишээ бараатай, захиалга 0. Бодит бараа, үнэ, үлдэгдлийг админаар оруулна.
- Хэрэглэгчийн тусгай зөвшөөрлөөр QPay/OT Commerce түлхүүрүүдийг серверийн хамгаалсан `server/config.local.php` файлд байрлуулсан; Git/ZIP-д оруулаагүй. QPay production идэвхтэй; OT Commerce 1688 хайлт, барааны сонголт, захиалгын хүсэлт идэвхтэй.

## Хэрэглэгчийн бүртгэл — 2026-10-12

- Сайтын дээд хэсэг болон гар утасны доод цэсний **Нэвтрэх → Бүртгүүлэх** товчоор нэр, имэйл, нууц үг оруулж бүртгүүлнэ. Профайлаас нэр, утас, хүргэлтийн хаяг болон нууц үгээ өөрчилнө. Имэйл энэ хувилбарт өөрчлөгдөхгүй.
- Нэвтэрсэн үед үүсгэсэн захиалгыг `customer_orders` хүснэгтээр эзэмшигчтэй холбоно. **Профайл → Захиалгууд** хэсэгт 20-оор хуудаслаж, өөр төхөөрөмжөөс нэвтэрч үзэж болно. Нэвтрээгүй зочны урсгал хэвээр ажиллана.
- Хуучин зочны хүсэлтийг тухайн хөтөчид хадгалагдсан нууц түлхүүрээр **Бүртгэлдээ холбох** товчоор холбоно. Имэйл/утас таарснаар автоматаар эзэмшүүлэхгүй. Холбосны дараа хуучин зочны түлхүүр дангаараа захиалга харах эрх өгөхгүй.
- `gostore_customer` нь админы `gostore_session` cookie-оос тусдаа. Session cookie нь HTTPS үед Secure, HttpOnly, SameSite=Lax; POST үйлдлүүд CSRF шалгалттай. Нууц үг bcrypt hash-аар хадгалагдана. Нууц үг солиход бусад төхөөрөмжийн сесс хүчингүй болно.
- Имэйл баталгаажуулах, нууц үг сэргээх мэйл, SMS нэвтрэлт энэ хувилбарт холбогдоогүй. Нэвтрэх тусламжийн холбоо: `shop@gostore.mn`. Имэйлийг баталгаажсан хаяг гэж үзэхгүй.
- Байршуулахын өмнөх SQLite online backup: `/home/gostorem/gostore-data/backups/accounts-20261012-1a2e09d779d1.sqlite` (0600). Шинэ `customers`, `customer_orders` хүснэгт болон индекс автоматаар үүснэ; хуучин orders хүснэгтийг өөрчлөхгүй.
- `tests/customers.mjs`: CSRF, давхардсан имэйл, админ/хэрэглэгчийн тусгаарлалт, өөр эзэмшигчийн захиалга хориглох, профайл, нууц үг/сесс, зочны хүсэлт холбох шалгалтууд. Desktop/mobile хөтчөөр бүртгэл, профайл, захиалгын формын автоматаар бөглөлт, захиалга харах шалгасан. Live серверт нэг техникийн хэрэглэгчээр бүртгэл/нэвтрэлт/профайл/нууц үг шалгаад зөвхөн тэр хэрэглэгчийг устгасан; бодит захиалга, төлбөр үүсгээгүй.

## Серверийн шаардлага

- PHP 8.2+; `PDO`, `pdo_sqlite`, `mbstring`, зураг хөрвүүлэхэд `gd`, QPay-д `curl`.
- HTTPS гэрчилгээ, Apache `.htaccess` дэмжлэг.
- SQLite өгөгдлийг вебийн Document Root-оос гадна, зөвхөн hosting хэрэглэгч уншиж/бичих хавтаст хадгална.

Одоогийн өгөгдлийн сан нь SQLite. MySQL шаардахгүй. cPanel → Select PHP Version хэсгээс `pdo_sqlite`, `mbstring`, `curl`-ийг идэвхжүүлнэ. Эдгээрийг hosting хориглосон бол provider-оос идэвхжүүлэх эсвэл MySQL рүү шилжүүлэх шаардлагатай.

## Админ эрх

Тохируулсан үндсэн админ `/admin/` → **Нууц үг солих** хэсгээс өөрийн нууц үгийг солино. Одоогийн нууц үг шаардлагатай. Шинэ hash хувийн SQLite DB-ийн `meta.admin_password_hash` утгад хадгалагдаж, `config.local.php` дахь анхны hash-ийг орлоно; config файлыг дахин upload хийх нь шинэ нууц үгийг буцаахгүй. Бусад төхөөрөмжийн session цуцлагдана. Доорх скрипт зөвхөн анхны тохиргоонд хэрэглэгдэнэ.

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

2026-10-12-нд production QPay-г локал болон live `server/config.local.php` дотор `enabled=true` болгосон. Хүчинтэй token-ийг дахин ашиглаж, хостингийн PHP cURL-аас 1₮-ийн техникийн invoice үүсгэн QR болон 23 банк/аппын deeplink ирэхийг шалгасан. Давтан invoice хүсэлт ижил нэхэмжлэл буцаасан. Буруу callback түлхүүр 403 өгсөн; зөв callback-ийг нэг удаа дуурайлган дуудахад QPay payment/check нь төлөөгүйг баталсан. Туршилтын invoice-ийг QPay DELETE endpoint-оор амжилттай цуцалж, GOStore хүсэлтийг цуцалсан төлөвт хадгалсан. Бодит мөнгө шилжүүлээгүй. [QPay-ийн албан ёсны баримт](https://developer.qpay.mn/mn/docs/merchant?version=2.0.0)-ын дагуу token, invoice, callback → payment/check урсгал бэлтгэсэн.

2026-10-10-нд [API жагсаалт](https://developer.qpay.mn/mn/docs/apis) болон Merchant V2-ийн token, invoice, payment/check лавлахтай тулгасан. Token авахад Basic, invoice/payment шалгахад Bearer ашиглана. `expires_in` нь Unix timestamp; хугацаа дууссан эсвэл буруу утгатай token-ийг хадгалахгүй. Хүчинтэй token-ийг серверийн private cache-д дахин ашиглана. Refresh endpoint одоогоор холбогдоогүй; хугацаа дуусахад Basic auth-аар шинэ token авна.

QPay-ээс GOStore-ийн sandbox болон production орчны `client_id`, `client_secret`, `invoice_code` авна. Бүртгэлийн холбоо барих мэйл: `shop@gostore.mn`; сайт: `https://gostore.mn`. Эдгээр мэйл/домэйн нь API эрхийг орлохгүй.

Шинэ орчинд тохируулах идэвхгүй sandbox загвар (live production тохиргоог үүгээр бүү дарж бич):

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

**Бодит төлсөн гүйлгээний эцсийн шалгалт үлдсэн.** Төлсөн/дутуу төлсөн/давхар callback/timeout урсгалууд `tests/qpay-flow.php` дотор тусгаарласан SQLite болон хуурамч QPay хариугаар шалгагдсан. Банкны апп-аас бодит төлбөр орж, QPay өөрөө callback илгээн GOStore дээр “Баталгаажсан” болохыг хараахан туршаагүй. Эхний бодит захиалгын төлбөрийг merchant portal дахь гүйлгээтэй тулгаж хянана.

Локал API тестийн серверийг `GOSTORE_DISABLE_QPAY=1`-тэй ажиллуулна. `scripts/dev.ps1` үүнийг автоматаар тохируулдаг; production config-ийг өөрчлөхгүй.

## Бусад API

### OT Commerce / 1688

2026-10-12-нд хэрэглэгчийн OT Commerce түлхүүрийг `server/config.local.php`-ийн `otcommerce.api_key` хэсэгт хадгалсан. Энэ файл GitHub болон ZIP-д орохгүй. QPay болон админы тохиргоог хэвээр хадгална.

[Албан ёсны REST API заавар](https://apidoc.otapi.net/) болон [OpenAPI тодорхойлолт](https://rest.otapi.net/openapi.yaml)-ын дагуу `GET https://rest.otapi.net/v1/catalog?language=en` хүсэлтийг `X-Api-Key` header-тай нэг удаа шалгасан: HTTP 200, `ErrorCode: Ok`, `Alibaba1688` ангиллууд ирсэн. Шалгалтыг PowerShell-оор хийсэн; PHP адаптер, бараа хайлт/импорт, захиалга үүсгэх урсгал хараахан хэрэгжээгүй. `enabled=false` нь ирээдүйн холболтын тохиргоо бөгөөд одоогоор сайт OT Commerce руу хүсэлт явуулахгүй.

2026-10-12-нд хэрэглэгчийн ирүүлсэн эрхийн мэдээлэл: provider `Alibaba1688`, сайт `https://gostore.mn/`, төлөв `Active`, тариф `Free Trial`, үлдсэн хугацаа 5 хоног, үлдсэн дуудлага 300, валют `CNY`, хэл `Mongolian (Монгол хэл)`. Эдгээр нь тухайн үеийн үлдэгдэл; шинэчлэгдэх квот болон хугацааг аккаунтаас дахин нягтална. Бүтээгдэхүүний хүсэлтийн эрхийг тусад нь шалгаагүй.

Адаптер хэрэгжүүлэхдээ хариуг серверт түр хадгалж, нэг мэдээллийг давтан татах дуудлагыг багасгана; өргөн хүрээний автомат импорт асаахаас өмнө туршилтын квотыг тооцно. `CNY` үнийг `MNT` гэж шууд үзүүлэхгүй: төгрөгийн ханш, үйлчилгээний шимтгэл, хүргэлтийн үнийг тусад нь тохируулна. Түлхүүрийг frontend JavaScript, URL query эсвэл логт бүү оруул. Серверээс зөвхөн албан ёсны HTTPS endpoint руу дамжуулна.

1688 каталог, хайлт, SKU сонголтыг OT Commerce REST API-аар холбоно. Нийлүүлэгчид худалдан авах ажиллагааг оператор гүйцэтгэнэ. Линк оруулж шинэ захиалга үүсгэх урсгал хаагдсан (HTTP 410); өмнөх захиалгуудыг хадгална. Хятад захиалга бүрд Эрээн хаяг, овог нэр, захиалгын код бүхий хүргэлтийн шошго сервер дээр үүсгэнэ.

## Нөөц ба хязгаар

2026-10-13-ны ажиллагааны шалгалт: үндсэн домэйны HTTP хүсэлтийг HTTPS руу 308-аар шилжүүлнэ. `.htaccess` нь зөвхөн `gostore.mn` / `www.gostore.mn` хостод энэ дүрмийг хэрэглэнэ; path болон query хадгална. Байршуулсны дараа HTTP нүүр, админ, барааны deep URL болон HTTPS API-г шалгана. [Apache RewriteRule redirect заавар](https://httpd.apache.org/docs/2.4/rewrite/flags.html#flag_r).

OT операторын live төлөв `configured=false`, `purchasing_enabled=false` байсан. Энэ нь каталогоос бараа харах API-аас тусдаа: QPay төлөгдсөнөөс хойш 1688-д автоматаар худалдан авах урсгал одоогоор хэрэгжээгүй. Бодит QPay гүйлгээ, банкны аппын callback болон нийлүүлэгчийн бодит худалдан авалтыг автомат локал тест батлахгүй.

- `gostore-data` хавтсыг hosting-ийн private backup-д хамруул. SQLite WAL ашигладаг тул ажиллаж байгаа DB-г дан файлаар хуулж болохгүй; SQLite backup хэрэгсэл эсвэл hosting snapshot хэрэглэ.
- Админ самбар сүүлийн 1000 хүсэлтийг харуулна. Томруулбал pagination, audit log, roles, хэрэглэгчийн бүртгэл, inventory reservation нэмнэ.
- Зочны захиалга харах түлхүүр тухайн хөтөчид хадгалагдана. Бүртгэлтэй холбогдсон захиалга нэвтрэх эрхээр бүх төхөөрөмжөөс харагдана.
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

## 1688 ба карго — 2026-10-12

- Каталог, SKU сонголт, серверийн үнийн санал, ханш ба каргоны админ тохиргоо байршуулсан.
- Байршуулалтын өмнөх SQLite online backup: `/home/gostorem/gostore-data/backups/supplier-20261012-41bc65a9787e.sqlite`. Өмнөх файлуудын локал хуулбар: `D:\Gostore.mn\tmp\supplier-20261012-41bc65a9787e`.
- Серверийн хувийн `gostore-data/supplier-cache` хавтаст API response хадгална (0700 / файлууд 0600). `meta.shipping_settings` нь тариф, ханш, API лимитийг хадгална.
- Live шалгалт: HTTPS public файлууд локалтай ижил; серверийн файлууд 403; каталог 12 бараа, нэг бүтээгдэхүүний 93 хувилбар, серверээс шинэ хайлт 12 бараа; 550₮ ханш, карго 3,000₮, нийт 9,600₮ тооцоо зөв. QPay идэвхтэй хэвээр. Энэ шинэчлэлээр live захиалга эсвэл invoice үүсгээгүй.

## Линк захиалга хаах, Эрээн хаяг — 2026-10-12

- UI, статик ноорог болон API-аас шинэ линк захиалга хассан; шууд `type=link` хүсэлт HTTP 410. Хуучин өгөгдлийг устгаагүй.
- Хаяг: `内蒙古锡林郭勒盟二连浩特市环宇商贸城10-16号`; `warehouse_phone=18047981132`, `warehouse_contact_phone=99889815`. Live админ тохиргоонд хадгалсан, ханш/каргоны тариф өөрчлөгдөөгүй.
- Хятад захиалгад овог, нэр заавал; сервер GS кодоор хүлээн авагч болон хятад хэлбэрийн хүргэлтийн шошго үүсгэн захиалгад хадгална. Админ хуулж нийлүүлэгчид өгнө; хэрэглэгч өөрийн захиалгад харна. Нийлүүлэгчид худалдан авах API автоматаар дуудагдахгүй.
- Өмнөх DB backup: `/home/gostorem/gostore-data/backups/supplier-20261012-be9c6bed8421.sqlite`. Өмнөх тохиргооны локал нөөц: `tmp/warehouse-settings-before.json`.
- Локал API/хөтчийн шалгалт: бүртгэл ба захиалгын эрх, линк хориг, SKU захиалга, овоггүй хүсэлт буцаах, нэр/код шошго, хаягийн snapshot, админ ба mobile харагдац амжилттай. Live файл/хаяг/хоёр утас/410/QPay төлөв шалгагдсан. Live тестийн захиалга, төлбөр үүсгээгүй.


## Агуулахын тулгалт, Миний ачаа — 2026-10-13

- Аппын commit: e97e724. Нийт 44 файлын manifest-аас 17 өөрчлөгдсөн файлыг https://gostore.mn/ дээр байршуулсан. Нийтлэх үед API-г богино хугацаанд 503 болгож, бүх файл солигдсоны дараа хэвийн болгосон.
- Code 39 GS/GB шошго, скан тулгалт, жин/хэмжээ, хувийн зураг, зөрчлийн бүртгэл, УБ тавиур, эцсийн тооцоо, тусдаа үлдэгдлийн QPay нэхэмжлэл, нэг удаагийн авах код, «Миний ачаа», сайтын мэдэгдэл нэмсэн. SMS холболт хийгдээгүй.
- SQLite online backup: /home/gostorem/gostore-data/backups/logistics-20261013-1c24c69b52f5.sqlite. Өмнөх файлууд: /home/gostorem/gostore-backups/logistics-20261013-1c24c69b52f5; локал хуулбар tmp/deploy-backups/logistics-20261013-1c24c69b52f5.
- Өгөгдлийн санд order_notifications, warehouse_exceptions, warehouse_exception_photos хүснэгт нэмэгдсэн. Хуучин 1 захиалга хадгалагдсан; live config, QPay төлөв, бэлэн барааны түр хаалт өөрчлөгдөөгүй.
- API/customer/warehouse/batch/logistics интеграцийн тестүүд, хуурамч QPay-ийн анхны ба үлдэгдлийн нэхэмжлэлийн тестүүд тэнцсэн. Chrome дээр хоёр агуулах, зураг, шошго, тулгалт, эцсийн тооцоо, хэрэглэгчийн авах код, хүлээлгэн өгөх, мэдэгдлийн урсгалыг тусгаарласан өгөгдлөөр шалгасан.
- Live файл тус бүр, DB integrity/schema, зөвшөөрөлгүй API хандалтын хаалт, GS/GB нууцлал, хятад/монгол агуулахын нэвтрэлт, админ тохиргоо, гар утасны «Миний ачаа» ба мэдэгдлийн нэвтрэлтийг шалгасан. Live захиалга, нэхэмжлэл, бодит төлбөр үүсгээгүй; шинэ төлбөрийн урсгалын бодит гүйлгээний шалгалт үлдсэн.
- Эрээн болон УБ менежерийн аккаунтууд live дээр хараахан тохируулагдаагүй. Админ → «Агуулахын эрх» хэсгээс тус бүрийн имэйл, нууц үг, идэвхтэй төлөвийг тохируулна.
