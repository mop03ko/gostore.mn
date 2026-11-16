# Homepage discounted products

The web homepage's main catalogue and Expo home feed use `supplier-deals` instead of the mixed `__all__` search. The heading is **Хямдралтай бараа**. Existing price and percentage cards remain; results follow the server's largest-discount-first order. Price sorting is shown on search/catalogue pages, not on this curated homepage feed.

The existing index includes in-stock products with a real original/current price reduction from details verified within 24 hours. Coupon-only or conditional promotions are excluded. Clients also reject missing, expired or mismatched discounts. The web removes expired deal cards; the app schedules a refresh of visible cards when their discounts expire. Empty/error responses do not fall back to unrelated products. Pagination and deduplication remain, with retry on errors.

Category pages, all-products browsing, saved items, keyword/image searches and product-detail recommendations keep their existing behavior. Homepage-only requests do not consume additional TaoWorld search calls: the deals endpoint reads the existing index.

Validation: `tests/home-deals-ui.cjs` exercises real/expired/non-discount rows, percentage labels, paging/deduplication, search/back and empty/error states; native discount helpers, Expo typecheck and lint. No orders or payments are created by these checks.
