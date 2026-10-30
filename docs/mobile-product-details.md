# Mobile product details

The mobile product screen follows the supplied Taobao reference with fixed Overview, Ratings, Specifications and Recommendations tabs. Each tab scrolls to its section. The native header is explicitly opaque so the controls sit below the iOS navigation bar on Expo SDK 58. Product titles initially occupy two lines and can be expanded.

Specifications initially show up to four decision-relevant facts (brand, material, variant count and dispatch origin), falling back to the first four supplied attributes. The full supplied attribute table is available through an expand/collapse control. SKU selection, stock checks, minimum quantities and cart persistence retain their existing flow.

## Ratings data

`shop_rating`, when supplied and between 0 and 5, is labeled as a **shop** rating. It is not a product-review score. The current normalized supplier API does not provide buyer review text, photos or review counts. The buyer-comments section explicitly states that comments cannot currently be displayed; no testimonials, counts or scores are invented. Actual buyer reviews require an authorized upstream source and a backend response contract before they can be shown.

## Recommendations

The existing public `supplier-recommend` GET action is available through `api/mobile.php`. It returns the same cross-category recommendations as the website. The app requests them separately after product details load, excludes the current product, removes duplicate IDs and displays at most 12 cards. Failed requests have an independent retry; empty results link back to browsing. Selecting a card opens its own product route and resets the detail view.

## Verification

`tests/expo-product-ui.cjs` uses intercepted local-preview fixtures to check section jumps, compact and expanded specifications, missing ratings, recommendation retries/deduplication/navigation, SKU selection and cart saving at three phone widths. It makes no purchases or payments. `tests/mobile.cjs` checks the public GET recommendation route and rejection of POST requests in the isolated API fixture environment.

The native Maestro screenshot flow also captures product overview, ratings, specifications, recommendations and SKU selection. Browser fixture images are not store listing screenshots. Build 7 has already been submitted to App Review; this change must be verified as a new build without silently replacing or cancelling that review.

### Verified on 2026-10-31

- TypeScript, Expo lint, the mobile API tests and the product UI tests passed. The Android production JavaScript export also completed.
- The recommendation endpoint was deployed and verified against the live read-only API (24 items returned; the current item excluded). The app displays at most 12.
- EAS simulator build `b91401c9-ce8b-4c6a-9ea4-05268a5de85c` completed the full ten-screen Maestro flow. Product overview, ratings, compact specifications, recommendations and SKU selection screenshots were visually checked on iPhone 18 Pro Max. The screenshot-capture profile now references this verified simulator archive.
- Recommendation prices that are not supplied by the upstream response display the existing price-check label; opening a product retrieves its detailed price.
- These checks did not create orders or payments.

Production version **1.0.0 (8)** was built by EAS (`c6015cd7-39d3-4a97-9b6a-4c05bff24a1e`) and uploaded successfully (submission `22ef3d81-e774-4918-b407-91b8c9005f36`). App Store Connect build `6150be7a-10e4-4294-a6a6-74f2454e2ecd` reached `VALID` / `IN_BETA_TESTING` at 05:06 Ulaanbaatar time and is available to the internal **Team (Expo)** group. TestFlight notes describe the product changes. Version 1.0.0's existing App Review submission remains on build 7; this work did not replace that build or its store screenshots.
