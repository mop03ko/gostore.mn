# Brand storefronts

Updated 2026-10-19. The ten logo cards open GOStore's internal `/?brand=<id>#catalog` view.
Product links keep `?brand=<id>` and open on GOStore. Apple and Samsung are excluded.
The external URLs below are source references, not navigation destinations.
GOStore does not imply that it is itself an authorized retailer.

| Brand | Destination | Reference |
| --- | --- | --- |
| Nike | https://nike.tmall.com/ | [Tmall sports directory](https://www.tmall.com/wow/fushi/act/goufangxin) links to this shop; [Nike's China marketplace article](https://about.nike.com/en/magazine/how-nike-is-reimagining-the-marketplace-in-greater-china-to-better-serve-athletes) describes its flagship. |
| adidas | https://adidas.tmall.com/ | [adidas membership terms](https://static1.adidas.com.cn/ecp-cms/cdn-file/tac/content/WMS/0/TAC_MEMBER_OR.html). |
| Puma | https://puma.tmall.com/ | [Flagship directory](https://guanwangdaquan.com/puma-tmall/) and [retailer channel listing](https://m.xyyzi.com/item/index/is_new/1/sex/0/p/2/brand_id/11). |
| New Balance | https://newbalance.tmall.com/ | [Tmall sports directory](https://www.tmall.com/wow/fushi/act/goufangxin) and [July 2026 brand press release](https://www.businessnews.cn/2026/07/16/21805.html). |
| UNIQLO | https://uniqlo.tmall.com/ | [UNIQLO official FAQ](https://www.uniqlo.cn/htmlcode_FAQinn.html?category=6&sub=1). |
| ZARA | https://zara.tmall.com/ | [Flagship launch announcement](https://fashion.sina.com.cn/s/sh/2014-10-13/2140/doc-iavxeafr4081165.shtml) and [current indexed storefront title](https://site.365jz.com/29567.html). |
| Sony | https://sony.tmall.com/ | [Sony product announcement with purchase channels](https://www.sony.com.cn/content/sonyportal/zh-cn/cms/newscenter/product/2022/20220913-1.html). |
| Xiaomi | https://xiaomi.tmall.com/ | [Xiaomi official shop](https://www.mi.com/shop), footer link. |
| LEGO | https://lego.tmall.com/ | [Flagship listing](https://www.ppqjd.com.cn/94-531/) and [store campaign coverage](https://post.smzdm.com/p/akx7r9w4/). |
| IKEA | https://ikea.tmall.com/ | [IKEA China privacy policy](https://www.ikea.cn/cn/zh/customer-service/privacy-policy/), effective 2026-10-06. |

Some storefronts redirect international visitors to `*.world.tmall.com` and may
require sign-in or a regional security check. Automated page retrieval is blocked
for some destinations; source verification is not a promise of anonymous access.
Puma, ZARA and LEGO URL evidence includes secondary sources as noted above.
Customers no longer need to enter these third-party storefronts to browse on GOStore.

## API identity and offers

OT's REST `vendor_name` was observed returning unrelated catalog items despite a
matching Vendor block. Brand browsing therefore uses the documented
[BatchSearchItemsFrame](https://docs.otapi.net/en/Documentations/Method/BatchSearchItemsFrame)
with a case-sensitive VendorId. The server allowlist in `server/supplier-brands.php`
records both the exact VendorId and numeric seller ID verified through OT's
Vendor block for all ten shops. Responses must match both; individual products
must match VendorId and any returned numeric seller ID. Mismatches are omitted,
never replaced by keyword matches. Real smoke checks returned 12 items per shop,
except adidas where one mismatched seller was correctly excluded (11 remained).

Brand product details use
[BatchGetItemFullInfo](https://docs.otapi.net/en/Documentations/Method/BatchGetItemFullInfo)
with Promotions and Vendor blocks. Native calls share the existing request budget,
concurrency locks, retry backoff and private server cache; keys never reach browsers.
Brand data is cached for 10 minutes, with background refresh in its last minute.
OT may itself return its Storage search method; freshness is limited by upstream data.

Discounts use only `Price.PriceWithoutDiscountAndDelivery` compared with the same
item's current CNY price. Cards display a discount only when it matches the price
actually shown. Promotion names, `Desciption` (OT's spelling), calculated reference
prices and end times are escaped plain text. Invalid, future, expired or stale offers
are hidden. Unavailable offers are distinguished from a response with no offers;
no coupon or percentage is invented. Promotions remain informational: checkout
independently validates its current SKU price, stock and quantity, and does not
apply unverified coupon prices.

Validation: all ten shops and one Nike detail were read using the implementation
against the real API. That sample returned no active offers, so actual promotion
rendering was verified with isolated fixtures. Tests cover seller mismatches,
pagination/price/sort isolation, URL reloads, no external tabs, expired/stale offers,
SKU price preservation and mobile layout.

## Logos

Nine SVGs are from [Simple Icons v11.15.0](https://github.com/simple-icons/simple-icons/tree/11.15.0/icons):
`nike`, `adidas`, `puma`, `newbalance`, `uniqlo`, `zara`, `sony`, `xiaomi`, `ikea`.
The CC0 license is retained in `assets/brands/LICENSE.md`. Selected fills use
brand colors; paths are unchanged. LEGO's unmodified SVG is from
https://assets.lego.com/logos/v4.5.0/brand-lego.svg.
Logos and brand names remain trademarks of their respective owners, used here
to identify outbound storefront links.

## Product image loading

Unsigned original AliCDN JPG/PNG photos under `imgextra`, `bao` or `tfs` use
400px card images, 800px gallery/preview images, 120px thumbnails and 80px variant
images. Animated, signed, already resized and other-host URLs are unchanged.
The first four catalog photos load eagerly; later photos load lazily. A failed
resized image falls back once to its original URL. Cart/favorites/compare data
and full-screen zoom retain original URLs. Supplier API freshness and purchase
validation are unchanged; a cold upstream lookup can still take longer.
