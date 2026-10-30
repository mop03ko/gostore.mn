# Direct TaoWorld catalog

GOStore can use `shipping_settings.catalog_provider = taoworld` for the public catalog. The admin shipping settings include this selector and the image-search switch. `otcommerce` remains an explicit rollback option; native requests never fall back to OT. A connected TaoWorld buyer and the application's traffic API permissions are required.

## API and data flow

1. Keyword/category search calls `/traffic/item/search`. Fixed storefront departments use Chinese search terms; results request English translations. TaoWorld does not list Mongolian as a supported output language.
2. Search results persist the provider-issued `mi_id` in private, app/account-scoped storage. Product details use `/traffic/item/get` with this identifier, never `/product/get` for storefront display.
3. Product SKU, quantity and price are revalidated before checkout. Native detail prices are fen; search prices are yuan. Conditional coupon prices are not promised as checkout prices. Unknown stock cannot be purchased. Domestic shipping to Erenhot is rendered for the complete cart before QPay; see [domestic shipping](taoworld-domestic-shipping.md) for endpoint limits, validation and the pending reference API permission.
4. The existing QPay flow stores paid orders. Native procurement uses the persisted `mi_id` with `/product/get`, renders the purchase to the order's Erenhot warehouse snapshot, checks the cost ceiling, then uses the existing durable create/query/payment worker. The source catalog is recorded on each order line.
5. Images are re-encoded to JPEG with metadata removed, uploaded as plain base64 through `/upload/image`, then searched through `/traffic/item/imgsearch` using `image_id`. Image results are cached and paginated locally; an empty eligible result set is valid. GOStore retains the local search image for up to seven days under the existing cleanup policy.

The public data shape, SKU IDs, cart and checkout routes remain compatible. Long numeric SKU IDs remain strings. Knife restrictions apply to raw Chinese titles, translated titles, categories, variants and blocked IDs.

## Seller facts and recommendations

Search rows include `shopDsr` (shop rating out of 5), `shippingOrigin` (Chinese region text) and sometimes `deliveryTimes: 48shipping`; `/traffic/item/get` has none of them. `tw_catalog_remember()` stores these next to the `mi_id` mapping (keeping them when a detail refresh rotates the identifier, rewriting only on change), and the detail response exposes `shop_rating`, `ship_from` (Mongolian province name) and `ships_48h`. Invalid ratings are ignored.

`supplier-recommend` returns up to 24 products under a product page: page one of every storefront department, interleaved so no category (including the product's own) dominates, starting at a department chosen by the product ID. Only display-fresh snapshots are read; when fewer than 12 products are cached one uncached department is fetched through the normal quota and locks. Provider failure returns an empty list. TaoWorld has no product review API; `/product/recommend` exists but is not enabled for this application.

## Cache and limits

Native caches are separate from OT caches and scoped to the connected account. Keyword search results are fresh for 30 minutes; display-only list reads may show snapshots up to 60 minutes old while the browser refreshes them with a separate request. Stale responses have `revalidate=true`, zero cache TTL and HTTP `no-store`; they cannot enter the fresh browser cache. Failed refreshes never extend their age. Image results last 10 minutes, details 5 minutes, and checkout accepts at most 120-second-old details. Search prices remain indicative; checkout revalidates the chosen SKU. A provider error cannot use stale data to create a payment quote. Fresh snapshots are read without taking the writer lock; cache misses lock and recheck before calling the provider. Identical identifier mappings are not rewritten on cache hits.

The first 50-item storefront batch can request `preview=1` to show the first 20 items before the rest arrive. A `partial=true` response is completed through the same query without that flag; page one is reused. `refresh=1` bypasses the stale allowance but still reuses freshly updated pages. Query/filter keys and 50-item pagination offsets do not change. See [performance details](performance-cache.md).

Native cache misses enforce the existing per-IP limits (30/minute, 120/hour), daily API budget and checkout reserve; fresh cache reads consume neither provider quota nor these IP counters. Disabling the catalog blocks search, details and image results, including cached results. Native admin health reports these cache TTLs instead of the legacy snapshot cron. A 50-item storefront page can require up to four native 20-item requests across page boundaries. The first page is checked separately so an empty/short search avoids unnecessary calls. Remaining uncached pages run concurrently, at most three per batch, with ordered cache locks and atomic quota reservation. Successful pages survive another page's failure, so a retry only requests the missing page. Only `/traffic/item/search` supports parallel transport; order creation and payment remain serial. See [PHP cURL multi documentation](https://www.php.net/manual/en/function.curl-multi-exec.php).

`mi_id` expires after 90 days according to TaoWorld's notice; GOStore requires a new search after 89 days. Cached reads do not extend this lifetime. An old OT-only bookmark or cart item without a native mapping must be searched again. Native normalization currently requires the `item_id` still returned by the live API as the existing GOStore URL identity; it never sends that deprecated identifier to TaoWorld. If TaoWorld removes it from responses, normalization fails closed and the URL identity scheme will need migration.

The old OT snapshot cron exits without provider work in native mode. The native catalog fills its own cache on demand. The homepage's default selection is storage products; categories and free-text search select other products. Brand pages use brand-name keyword searches and do not claim an official seller identity.

## Rollout and validation

Automated tests: `tests/taoworld-catalog.php` checks pagination, prices, native identifiers, cache/freshness, stock, policy and image search with a fake upstream. `tests/taoworld-purchase.php` includes the native catalog-to-procurement identifier path. Existing checkout, image-search and admin UI tests cover the unchanged customer controls.

Catalog activation does not itself enable automatic procurement or supplier payment. Those are separate settings. On 2026-10-30, after catalog development, the worker cron and automatic switches were activated following an owner-approved real purchase/payment pilot; see [procurement acceptance](taoworld-procurement.md#acceptance-status). Product availability and traffic quotas depend on the buyer's eligible pool and procurement history; API success does not imply access to every Taobao listing.

Official references:

- [Traffic keyword search](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/traffic/item/search&methodType=GET/POST)
- [Traffic detail](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/traffic/item/get&methodType=GET/POST)
- [Image search](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/traffic/item/imgsearch&methodType=GET/POST)
- [Upload image](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/upload/image&methodType=POST)
- [Display API restrictions, notice 135](https://open.taobao.global/announcement/index.htm#/announcement/detail?id=135)
- [Traffic access and quota policy, notice 137](https://open.taobao.global/announcement/index.htm#/announcement/detail?id=137)
- [mi_id migration, notice 150](https://open.taobao.global/announcement/index.htm#/announcement/detail?id=150)
