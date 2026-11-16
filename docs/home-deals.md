# Homepage discounted products

The web homepage's main catalogue and Expo home feed use `supplier-deals` instead of the mixed `__all__` search. The heading is **Хямдралтай бараа**. Existing price and percentage cards remain; results follow the server's largest-discount-first order. Price sorting is shown on search/catalogue pages, not on this curated homepage feed.

The existing index includes in-stock products with a real original/current price reduction from details verified within 24 hours. Coupon-only or conditional promotions are excluded. Clients also reject missing, expired or mismatched discounts. The web removes expired deal cards; the app schedules a refresh of visible cards when their discounts expire. Empty/error responses do not fall back to unrelated products. Pagination and deduplication remain, with retry on errors.

Category pages, all-products browsing, saved items, keyword/image searches and product-detail recommendations keep their existing behavior. Homepage-only requests do not consume additional TaoWorld search calls: the deals endpoint reads the existing index.

Validation: `tests/home-deals-ui.cjs` exercises real/expired/non-discount rows, percentage labels, paging/deduplication, search/back and empty/error states; native discount helpers, Expo typecheck and lint. No orders or payments are created by these checks.

Deployed on 2026-11-16, backup/release `home-deals-1794840623539`. Live served source matched the committed source; the endpoint returned 208 deals, with all 50 first-page records carrying valid same-price discounts. This count changes as offers expire. Catalogue routing regression checks passed for categories/subcategories, search, all products, saved items, Back/Forward, direct links and mobile widths.

Expo release from `a06bfde` (published to compatible runtimes; individual-device installation is not confirmed):

| Channel | iOS update group | Android update group |
| --- | --- | --- |
| production | e58390cb-5d30-4d87-981b-68ed6a2665d5 | 1b719168-aacc-4962-af77-3955e2ee67cb |
| preview | 12c3ca48-52b4-4fe8-986f-5feafb24339b | 05133cc4-2a6d-4f37-a290-6fa9f48c5523 |

Runtimes: iOS `a8dd376b5cdfd560a1feff8949377a4204ebaa5f`, Android `12e475e0cbbc9ab91d7ecfa01d472e04d133f2a1`.
