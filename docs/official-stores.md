# Official store directory

Updated 2026-11-02. This replaces the customer-facing brand section on web and app.
Legacy `/brands` and `/brands/<id>` links redirect to `/official-stores`.

## Coverage and identity

TaoWorld's current `/traffic/item/search` integration supports `shop_id`, but no
official-store enumeration or official-status field has been established. The
merchant does not have a provider-issued registry. Therefore this is **not every
official Tmall store**. It includes the API-accessible subset of the twelve
previously checked identities in `server/official-stores.json`; historical source
and shop/seller-ID verification notes are in `brand-storefronts.md`.

Add stores only after verifying their official source URL, exact shop ID (not
seller ID), and shop name. Never discover official status from a keyword, logo,
rating, or a name containing 官方/旗舰店. The registry can grow without client edits.
Only stores with matching, policy-allowed API products appear. Empty results are
not replaced by reseller searches. Upstream errors are distinguished from empty
results, with partial-success messaging and retry.

## API and clients

- Public `supplier-official-stores` returns identities and up to four product
  previews, plus `coverage=verified_registry`, `all_platform_stores=false`,
  checked/registered counts and `incomplete`.
- `supplier-search` with `shop=<id>` requests the allowlisted shop directly.
  Native pages contain twenty candidates. Exact shop names and any supplied shop
  IDs must match. Filtering does not erase the next-page control.
- Cards carry `official_shop_id`; product links and detail requests carry `shop`.
  Details require both the exact shop ID and name. Checkout still independently
  refreshes current SKU, stock and price.
- Default sorting is highest price first; ascending price is available. No
  ratings, ranks, discounts or authenticity guarantees are invented.

Directory reads batch at most three shops concurrently and share thirty-minute
search snapshots with store pages. Locks and quota reservations use the existing
supplier budget. Successful results survive a partial upstream failure. Display
snapshots older than thirty minutes explicitly request revalidation.

Web uses `/official-stores?shop=<id>`. Expo uses `/official-stores` with the same
shop parameter. Both have loading, empty, error/retry states and dark-mode colors.
Old brand endpoints remain for compatibility with installed app builds, but the
new UI does not expose the brand grid or its broad keyword selection.

## Validation

`tests/taoworld-catalog.php` covers exact identity filtering, unknown shop rejection,
detail mismatch rejection, shared caches, stale revalidation, partial outages and
empty-store exclusion. Web interaction checks cover routing, store context, price
filters, retries and responsive layout. Mobile changes require Expo lint/typecheck
and a subsequent app update/build before installed customers receive them.

Live read-only validation on November 2 checked all twelve registered shops without
partial errors: Nike returned three products; the other eleven returned no matching
available products and were omitted. The mobile API returned the same shop context,
and a Nike product detail passed the exact shop ID/name check. The new web route
returned HTTP 200; `/brands/nike` redirected with HTTP 302. This is a point-in-time
availability check, not a guarantee of future supplier inventory.
