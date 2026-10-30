# Shared app and web discovery

The Expo category screen and web category menu use the same 25 departments, labels, search queries and image mapping. Category tiles use three columns, initially show six choices, and expand for the remaining subcategories. The selected department loads its own product recommendations independently. The category search includes an entry to the app's existing image-search flow.

Home discovery includes Explore, domestic 0 CNY shipping, Clothing, Home and Technology channels, photographic collection links and a horizontal category strip. Navigation opens real searches or product pages. There are no invented vouchers, discounts, review counts or sales claims.

## Photos

`assets/category-photos.json` records illustrative catalog photos and their source product IDs/URLs. All 25 main categories have photos. There are 195 query mappings, using 165 distinct 200-pixel WebP thumbnails totaling approximately 1.3 MB. A few subcategories without a suitable verified photo retain a neutral fallback instead of displaying an unrelated product. Initial incidental title matches (for example, laptop “notebook” and bra “cup”) were removed during curation. A photo is category artwork, not a promise of that product's availability or price.

Run `node scripts/sync-discovery.cjs` after changing the taxonomy in `script.js` or the photo mapping. This regenerates `catalog-discovery-data.js`, the app's `src/lib/discovery.json`, and a static bundled-image map. The same WebP thumbnails are copied into the app's assets so category pictures need no network request and work offline. Then run `node scripts/bundle.cjs` to update the storefront bundles. Generated files are committed so app-only EAS archives include their data.

## Domestic free-shipping channel

Public GET `supplier-free-shipping` is available through both API entry points. It samples up to 20 current recommendation products and calls the existing per-item logistics reference endpoint for the configured Erenhot destination. Only an explicitly validated integer zero fee qualifies. Missing, null, non-CNY, unsuccessful, unmatched or unavailable references do not advertise free shipping. Normal catalog quota is used; this discovery lookup does not consume the checkout reserve. Results are cached for ten minutes under the connected account and destination, with a lock and the existing reference endpoint cooldown.

The UI labels this **China to Erenhot domestic reference shipping**. International freight is separate. The exact SKU, quantity and combined basket still go through the existing `/purchase/order/render` check at checkout and before procurement. Discovery does not create orders, invoices or payments and does not expose private warehouse/contact/account data.

On 2026-10-31, a read-only live reference request remained unavailable. Both public routes returned HTTP 200 with `status: unavailable`, `scope: china_to_erenhot`, no products and no session cookie. The UI therefore shows an unavailable message. TaoWorld logistics access must work before real zero-fee products can populate this channel; the frontend requires no speculative shipping claims or manual product flags.

## Validation and deployment

- TypeScript and Expo lint passed.
- `tests/discovery.php` checks explicit-zero selection and rejection of missing/error/null/string-zero reference data.
- `tests/discovery-ui.cjs` and `tests/expo-discovery-ui.cjs` check layout, category expansion/navigation, image-search entry and both populated/unavailable shipping states with isolated fixtures.
- Existing home hub, mobile session and TaoWorld domestic checkout tests passed.
- The 176-file web/API/thumbnail release was verified with per-file hashes and backups under `gostore-backups/discovery-5f9e3382f5ddb131`. The live HTML predates an unrelated local performance change, so deployment preserved its content and replaced only the two JS/CSS bundle URLs.
- App Store build 7 is already in review. This update must use a new TestFlight build and must not silently replace that review submission.

The native iPhone 18 Pro Max Maestro flow passed all ten screens in simulator build `9885bac0-f133-429f-b5a5-09475ef2cb92`. Visual inspection found that some category pictures were still waiting behind network image requests at capture time. Category thumbnails were subsequently bundled into the app. The Expo UI test now blocks the remote thumbnail URL and waits for all six initial category photos to decode successfully, verifying that these pictures require no network. TypeScript/lint passed again, and the final Android export includes all 165 category images (193 total assets).

Production build 9 was cancelled before upload so it would not distribute the earlier network-dependent category pictures. The final version is 1.0.0 (10), EAS build `51a9da87-a1cd-4f90-b6eb-78939b3b2bb9`, with automatic submission `6d406e9b-9e7a-4228-8794-21f65adc5cc2`.

Submission completed successfully. At 05:59 Ulaanbaatar time on 2026-10-31, App Store Connect build `b81d202f-e7a6-49ae-8661-e0a08fea7254` reached `VALID` / `IN_BETA_TESTING` and was present in the internal **Team (Expo)** group. TestFlight notes were saved. Build 9's submission is `CANCELED`; the existing App Review submission remains `WAITING_FOR_REVIEW` on build 7.

The follow-up web route-isolation and aligned-placeholder fixes were also deployed with verified backups: `discovery-bb38ee64a5c20393` and `discovery-6e23d45c202aa432`. Home discovery is only mounted on the home route; category browsing remains available elsewhere.
