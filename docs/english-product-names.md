# English product names

Supplier product names now use English translations while `catalog_language` continues
to control descriptions, SKU labels, categories and promotions. No currency or pricing
setting is changed. Product identities, stock and prices always come from the original
catalog response; only matching product `Title` fields are overlaid.

English names are cached separately for seven days by provider and product ID. A page
or product viewed in the catalog without cached names can use one additional OT
request with `language=en`; background catalog warming can do the same.
The existing API limits and response caches apply. There is no per-card network call.
This can increase API consumption during the initial catalog refresh. Ensure the OT
key has English enabled; a request parameter alone cannot enable an unavailable language.

If OT fails, the quota is exhausted, the English result does not contain a matching ID,
or OT returns Cyrillic/Chinese text instead, the original name is retained. Names are
never replaced with invented translations or empty placeholders. Translation failure
does not block product availability checks or checkout. Checkout only reuses an
already cached English title; it never requests a translation while validating SKU
prices and stock. Descriptive data continues to use `catalog_language`.

Existing catalog snapshots remain usable while the background worker rebuilds them.
Cards immediately use English names already present in the title cache. Previously
saved browser favorites and historical orders keep their stored names until refreshed;
this change does not rewrite order records.

## Verification

Run `php tests/supplier-english-titles.php` with the mbstring extension enabled. The
test uses synthetic bilingual caches and forbids supplier network calls. It checks
product details, search result reordering, brand/related items, snapshot cards,
provider separation, unchanged commercial data, and translation failure fallback.

Run `node tests/run-logistics.cjs english-titles-ui` for the isolated browser check.
It verifies English catalog/product headings alongside unchanged Mongolian UI,
description, attributes, variant labels and category names, and unchanged CNY/MNT
values. The fixtures deliberately put a different currency and price in the English
response to catch accidental full-product replacement.

Review on 2026-10-19: the production key's read-only `language_list` response still
contained only `khk` (Mongolian). English names therefore require provider-side
enablement; do not change the site's `catalog_language` to work around it.

The owner explicitly approved merging and production deployment on 2026-10-19.
PR #1 was merged as `d1beb526cda3ab7eb14cc9990414c27fe201be93`, and its three PHP
files were deployed with verified backups. Live search and product detail matched
the pre-deployment baseline exactly. Nike products matched by ID with unchanged
prices, currency, SKU data and offers; normal cache refresh updated expiry times
and moved five already-unsellable products to the end of the list. Desktop/mobile
browser checks passed. The live key still lists only `khk`, so existing names remain
until English is enabled upstream. See `DEPLOYMENT.md` for the backup location.

After deploying the PHP files, check a search, a product page and a brand page with
an English-enabled OT key. Confirm the heading is English while the description,
variant labels, category labels and MNT price remain as configured.
