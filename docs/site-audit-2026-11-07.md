# Site audit — 2026-11-07

Live checks of 11 public routes at 390 and 1440 px, the November access log (~17,000 lines), the PHP
error log, the TaoWorld worker log and the full test suite. Fixed on branch `audit-fixes`:

| Finding | Fix | Commit |
|---|---|---|
| 80 homepage `supplier-search` 503s in November (rising to ~28/day), 13 `supplier-deals`, 6 `supplier-product`; one locked or failing department failed the whole homepage mix | Display reads fall back to a snapshot up to 24 h old (stale, uncacheable); departments without one are left out; one shared 2 s lock deadline | 714413d |
| Warehouse settlement tests refused after the 1 kg tariff change | Test totals updated; production forms are prefilled from the quote and approved transport keeps its rates | 9615f61 |
| Desktop CLS 0.17–0.38 on every page, up to 0.8 on phones locally | Store/account/official-store `#main` one viewport tall; pre-rendered `#eleven-sale` and `#discovery-home` with reserved sizes; head script sets `home-route` / `eleven-active` | 4388c7c |
| No security headers on HTML | HSTS, nosniff, `X-Frame-Options: SAMEORIGIN`, Referrer-Policy, Permissions-Policy (camera self) | 99aed54 |
| No robots.txt/sitemap, `favicon.ico` and apple-touch-icon 404s, raw Apache 404 page | Added files and a branded 404 page | 99aed54 |
| Product links previewed as the site logo | `/v/` served by `api/product-page.php` with product title/photo from the cached detail; no provider calls | b23106c |
| Empty GTM container (117 KB) and Meta Pixel (114 KB) loaded during page load; GTM start event missing | All tag scripts load 1.2 s after `load`; queued calls kept; `gtm.js` event pushed | 8e802a7 |
| Early product request read the old v10 browser cache key; 19 test suites red | Key aligned with `store-server.js`; tests updated to intentional changes | abc09b2 |

New suites: `taoworld-fallback`, `layout-shift-ui`, `analytics-ui`; link-preview checks in `taoworld-storefront-ui`.

## Not changed (need an owner decision)

- **Per-IP limits** (30/min, 120/h on uncached supplier reads): 46 November 429s, 41 from one IP. Mongolian mobile carriers share IPs (CGNAT), so busy periods may block real shoppers.
- **Warehouse push key**: `openssl_pkey_new()` failed four times on 2026-11-02 in `server/warehouse-notifications.php` ("Private key length … configured to 0"), so web push keys may not be generated on the host.
- **Database errors**: eight `GOStore API: PDOException` entries (2026-10-12 to 11-06) are logged without the exception message, so the cause cannot be identified.
- If GA4 is added inside the GTM container, remove the separate `gtag('config', 'G-WLC1E39628')` to avoid double counting.
