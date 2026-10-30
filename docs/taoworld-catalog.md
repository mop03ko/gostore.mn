# Direct TaoWorld catalog

GOStore can use `shipping_settings.catalog_provider = taoworld` for the public catalog. The admin shipping settings include this selector and the image-search switch. `otcommerce` remains an explicit rollback option; native requests never fall back to OT. A connected TaoWorld buyer and the application's traffic API permissions are required.

## API and data flow

1. Keyword/category search calls `/traffic/item/search`. Fixed storefront departments use Chinese search terms; results request English translations. TaoWorld does not list Mongolian as a supported output language.
2. Search results persist the provider-issued `mi_id` in private, app/account-scoped storage. Product details use `/traffic/item/get` with this identifier, never `/product/get` for storefront display.
3. Product SKU, quantity and price are revalidated before checkout. Native detail prices are fen; search prices are yuan. Conditional coupon prices are not promised as checkout prices. Unknown stock cannot be purchased.
4. The existing QPay flow stores paid orders. Native procurement uses the persisted `mi_id` with `/product/get`, renders the purchase to the order's Erenhot warehouse snapshot, checks the cost ceiling, then uses the existing durable create/query/payment worker. The source catalog is recorded on each order line.
5. Images are re-encoded to JPEG with metadata removed, uploaded as plain base64 through `/upload/image`, then searched through `/traffic/item/imgsearch` using `image_id`. Image results are cached and paginated locally; an empty eligible result set is valid. GOStore retains the local search image for up to seven days under the existing cleanup policy.

The public data shape, SKU IDs, cart and checkout routes remain compatible. Long numeric SKU IDs remain strings. Knife restrictions apply to raw Chinese titles, translated titles, categories, variants and blocked IDs.

## Cache and limits

Native caches are separate from OT caches and scoped to the connected account. Keyword search results last 30 minutes, image results 10 minutes, details 5 minutes, and checkout accepts at most 120-second-old details. Search prices remain indicative; checkout revalidates the chosen SKU. A provider error cannot use stale data to create a payment quote. Fresh snapshots are read without taking the writer lock; cache misses lock and recheck before calling the provider. Identical identifier mappings are not rewritten on cache hits.

Native calls use the existing daily API budget and checkout reserve; a 50-item storefront page can require up to four native 20-item requests across page boundaries. The first page is checked separately so an empty/short search avoids unnecessary calls. Remaining uncached pages run concurrently, at most three per batch, with ordered cache locks and atomic quota reservation. Successful pages survive another page's failure, so a retry only requests the missing page. Only `/traffic/item/search` supports parallel transport; order creation and payment remain serial. See [PHP cURL multi documentation](https://www.php.net/manual/en/function.curl-multi-exec.php).

`mi_id` expires after 90 days according to TaoWorld's notice; GOStore requires a new search after 89 days. Cached reads do not extend this lifetime. An old OT-only bookmark or cart item without a native mapping must be searched again. Native normalization currently requires the `item_id` still returned by the live API as the existing GOStore URL identity; it never sends that deprecated identifier to TaoWorld. If TaoWorld removes it from responses, normalization fails closed and the URL identity scheme will need migration.

The old OT snapshot cron exits without provider work in native mode. The native catalog fills its own cache on demand. The homepage's default selection is storage products; categories and free-text search select other products. Brand pages use brand-name keyword searches and do not claim an official seller identity.

## Rollout and validation

Automated tests: `tests/taoworld-catalog.php` checks pagination, prices, native identifiers, cache/freshness, stock, policy and image search with a fake upstream. `tests/taoworld-purchase.php` includes the native catalog-to-procurement identifier path. Existing checkout, image-search and admin UI tests cover the unchanged customer controls.

Catalog activation does not enable automatic procurement or automatic supplier payment. Those remain separate settings and require a configured worker cron. A real supplier purchase/payment was not performed as part of catalog development. Product availability and traffic quotas depend on the buyer's eligible pool and procurement history; API success does not imply access to every Taobao listing.

Official references:

- [Traffic keyword search](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/traffic/item/search&methodType=GET/POST)
- [Traffic detail](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/traffic/item/get&methodType=GET/POST)
- [Image search](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/traffic/item/imgsearch&methodType=GET/POST)
- [Upload image](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/upload/image&methodType=POST)
- [Display API restrictions, notice 135](https://open.taobao.global/announcement/index.htm#/announcement/detail?id=135)
- [Traffic access and quota policy, notice 137](https://open.taobao.global/announcement/index.htm#/announcement/detail?id=137)
- [mi_id migration, notice 150](https://open.taobao.global/announcement/index.htm#/announcement/detail?id=150)
