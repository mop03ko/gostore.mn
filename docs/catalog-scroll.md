# Compact catalog and scroll batches — 2026-10-19

The catalog starts with 50 products and appends the next 50 when the visitor scrolls near its end. Numbered pagination is removed. A keyboard-accessible load-more control remains available; failed appends preserve visible cards and expose an explicit retry. Filtering or sorting resets the list, invalidates older responses, and starts at the first batch. Appending does not change the reload URL. Duplicate IDs are discarded and the final batch stops loading.

Cards use six columns at 1440px, seven above 1600px, and two on phones, with smaller typography and spacing. Purchase/favorite controls retain 44px touch targets. Appended images load lazily and existing card elements remain in place.

The public search API accepts `limit=50`; its existing default remains 12 for compatibility. REST search, image search, native brand offsets, cache identities, and cached homepage slicing honor the requested size. The homepage continues using its mixed department snapshot. Brand seller verification, commercial data, title fallback, and checkout calculations are unchanged.

Targeted tests cover 50/50/final batches, native offsets, seller exclusion, image search, public API validation, no session cookies, automatic scroll, append failure/retry, DOM retention, duplicates, filter races, saved items, fallback controls, and responsive layouts. Existing catalog/cache/brand/title/image and pricing regressions are also run. Read-only provider checks confirmed 50 results from both general REST search and Nike's native seller search.

Deployment includes `server/supplier.php`, `server/supplier-brands.php`, `server/supplier-snapshot.php`, `api/index.php`, `store-server.js`, `supplier.js`, `commerce-ui.css`, and `index.html`. Deploy the compatible backend first and the cache-versioned HTML last. No database migration or configuration changes are needed.
