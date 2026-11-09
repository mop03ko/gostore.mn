# TaoWorld open platform review

Reviewed 2026-11-09 from the public documentation at https://open.taobao.global/doc/api.htm (its `getApiCategoryMixed.json` and `getApi.json` data), the five platform announcements, and the linked user-behaviour guide. GOStore's app: «GOStore Mongolia», AppKey `504946`, category «TaoWorld跨境供货平台», status Online.

## Usage rules that affect GOStore

- **Product pool and daily quota depend on purchases** (announcement 137, 2025-11-13). `/traffic/item/get`, `/traffic/item/search` and `/traffic/item/imgsearch` are for registered TaoWorld customers. Access opens 1–2 working days after the first paid order.
  - Until the authorised purchasing account has bought **CNY 10,000 in total**, the APIs return only a designated product pool.
  - New customers get a **30-day trial of up to 10,000 calls/day**. After the trial, accounts below the purchase threshold are throttled.
  - Above CNY 10,000, the daily quota follows the average daily purchase amount of the last 30 days (example: CNY 10,000/day average → up to 70,000 calls/day). Related accounts share one quota.
  - This is the most likely reason the international flagship stores (adidas, UNIQLO and others, see [official-stores.md](official-stores.md)) return `data: []` while Nike and many Chinese brand flagship stores return products.
  - GOStore's own budget (admin «Taobao API: өдрийн дуудлагын дээд тоо», 2500 since 2026-11-09) must stay below TaoWorld's real quota. The trial end date was not recorded; ask the account manager.
- **`/product/get` is only for placing orders** (announcement 135). Using it for web display or product collection is forbidden. GOStore calls it only in procurement and domestic-shipping checks (`taoworld-purchase.php`, `taoworld-domestic.php`).
- **Taobao `item_id` inputs were switched off on 2026-06-30** (announcement 150). Use `mi_id`, `item_url` or `tao_password`; `mi_id` expires after 90 days. GOStore already sends `mi_id` everywhere.
- **Shop fields** (announcement 111, 2024-09): `supplier_nick` was removed; `shop_name` and `shop_id` replaced it, and `/traffic/item/search` accepts `shop_id`.
- **Behaviour data return.** The traffic APIs ask integrators to send shopper events to `https://distributor.taobao.global/usertrack?app=…&leadsId=…&user=…&platform=…&page=…&type=…&event=…&args=…`.
  - Events cover page enter/leave, search and photo-search clicks, and product-card impressions and clicks on the home, search, photo-search and detail pages.
  - TaoWorld must allow the site domain and supply the `leadsId`.
  - GOStore does not send these events yet. Doing so needs a pseudonymous user ID and a privacy-policy note.

## API catalogue (65 APIs)

✓ = used by GOStore.

| Group | APIs | Notes for GOStore |
|---|---|---|
| Account token | ✓ `/auth/token/create`, ✓ `/auth/token/refresh` | OAuth for the purchasing account |
| User traffic (catalog) | ✓ `/traffic/item/search`, ✓ `/traffic/item/get`, ✓ `/traffic/item/imgsearch`, ✓ `/upload/image`, ✓ `/traffic/item/batchGetSourceItemLogisticPrice`, `/traffic/item/logisticPrice/get`, `/traffic/theme/getThemeDimList`, `/traffic/theme/getThemeDetail` | See the search notes and theme lists below |
| Product sourcing | ✓ `/product/get`, `/batch/src/products/check`, `/product/recommend` | `recommend` finds similar items (with `video_url`); `check` can suggest replacements for unavailable items (needs activation) |
| Product distribution | `/product/relation/build`, `/product/relation/cancel`, `/product/spus/get`, `/product/details/query`, `/product/translate/get`, `/product/batchGetProductLogisticPrice`, `/product/logisticsProperties/get`, `/product/sensitiveword/identification`, `/promotion/query`, `/product/similar/get` (deprecated) | Listing ("铺货", `mp_id`) mode; details add brand, 30-day sales, rating, SKU weight/size and battery/magnet/liquid flags |
| Purchasing | ✓ `/purchase/order/render`, ✓ `/purchase/order/create`, ✓ `/purchase/order/batch/pay`, ✓ `/purchase/orders/query`, ✓ `/logistics/detail/get`, ✓ `/purchase/order/asyn/cancel`, `/purchase/order/confirm/receipt`, `/logistics/express/freight/estimate`, `/logistics/weight/write` | Cancel is in the admin order view ([admin-tools.md](admin-tools.md)); confirm-receipt is not automated |
| Refund | ✓ `/order/refund/render`, ✓ `/submit`, `/modify`, ✓ `/cancel`, ✓ `/query`, ✓ `/queryList`, ✓ `/render/logistics`, ✓ `/submit/logistics`, ✓ `/query/message`, ✓ `/submit/message` | Refund-only or return-and-refund against a sub-order, from the admin order view (photos not yet) |
| Bill | ✓ `/purchase/bills/query`, ✓ `/refund/bills/query` | Supplier bill reconciliation under «TaoWorld лимит» |
| Supply chain service | `/delivery/address/get`, `/supplychain/price/get`, `/purchase/supplychain/orders/query` | TaoWorld's own cross-border shipping (USA/Brazil examples); order creation says it is "not offered yet" |
| Tool integration | `/page/link/get` | Opens a chat with the Taobao seller; requires the platform login and password |
| Taobao Global Affiliate (淘宝客) | `/tbk/material/item/optional`, `/tbk/material/item/info/get`, `/tbk/material/item/recommend`, `/tbk/material/item/link/convert`, `/tbk/shop/get`, `/tbk/favitem/get`, `/tbk/general/link/parse`, `/tbk/order/details/batch/get`, settlement and offline-shop APIs | Separate affiliate (commission) programme with an `adzone_id`; supports site `MN` with Mongolia restriction filtering |
| Incentive | `/product/rebate/general/query` | Commission rate per item/SKU |
| Account information | `/account/subaccount/query`, `/account/customer/function/switch` | Sub-accounts and account switches |
| CSA service | `/supply/csa/wisers/v1/event/notify` | Country-specific selection project |

## Notes on the catalog APIs

- `item_resource` is always `taobao` and means Taobao **or** Tmall. The traffic APIs have no Tmall or flagship flag. Search rows carry `shop_name` but not `shop_id`; details carry both.
- `/traffic/item/search` also supports:
  - `sort` by `SALE_QTY_DESC`/`SALE_QTY_ASC` (sales), besides price.
  - `filters`: `min_price:<fen>`, `max_price:<fen>`, `24shipping`, `48shipping`.
  - `excludeFilters`: `used_item`, `customized_item`, `offline_seller_item`.
  - `include_tags`: campaign tags such as `activity_…_tm_manjian` (Tmall campaigns).
- Search rows include `inventory` (stock), which GOStore does not show yet. Details include `property_image_list` (images per option), which is also unused.
- `coupon_price` appears in search, detail and SKU data but is "for reference only". GOStore deliberately does not show it.
- Theme lists: `getThemeDimList` (`theme_channel_type=1`, `theme_content_type` such as `2` commission or `22` Kazakhstan picks; filter by category) gives `theme_dim_id`. `getThemeDetail` returns up to 20 items per scroll with `sold_quantity30d_fuzzy` (30-day sales). If a list is empty, the account manager must enable it.

## Tmall store information

TaoWorld's traffic APIs can only list a known shop's products (`shop_id`). Store directories and store profiles exist only in the affiliate programme:
- `/tbk/shop/get` searches shops with `is_tmall`, returning `shop_type` (B = Tmall, C = Taobao), logo and URL.
- `/tbk/material/item/*` return `user_type` (1 = Tmall), `brand_name`, annual sales and a white-background image.

The affiliate programme is a commission model that sends shoppers to Taobao, not GOStore's buy-and-ship model. It requires separate enrolment and an `adzone_id`.
