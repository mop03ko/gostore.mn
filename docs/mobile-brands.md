# Mobile brand discovery

The app renders the same 12 SVG logos as the website's `assets/brands/` directory, with `react-native-svg`. The exact SVG content is bundled in `gostoremn/src/lib/brand-logos.json`; no remote logo download is required. The artwork's existing license is recorded in `assets/brands/LICENSE.md`.

After changing website logo files, run from `gostoremn/`:

```powershell
node scripts/sync-brand-logos.cjs
node scripts/sync-brand-logos.cjs --check
```

The Chinese Taobao-style browsing structure consists of a compact two-row logo shelf on Home, a three-column brand directory with group filters and name search, and a dedicated `/brand/[id]` store page. Every logo opens the store by brand ID. Entering an exact brand name in Home search also opens that store. The store page displays the allowlisted Tmall store name, price sorting, product pagination, retry and an explicit empty state. Product links preserve the brand ID so the backend checks the detail's shop identity. Unrelated global keyword results are never substituted.

Brand labels and group membership are defined in `gostoremn/src/lib/brands.ts`; authoritative store identities are in `server/supplier-brands.php`. The site and app retain their GOStore branding, Mongolian navigation and English product titles.

## Dark appearance (2026-11-01)

`src/lib/palette.ts` subscribes to the system color scheme. Screens and shared components use semantic surface, text, border, accent, success and error colors. Navigation headers, tabs, status bar, SKU sheets, forms and quantity controls follow changes while the app is open. Logos retain white backing to preserve their original artwork. `userInterfaceStyle` is `automatic`; the existing `expo-system-ui` dependency supports Android configuration. See [Expo color themes](https://docs.expo.dev/develop/user-interface/color-themes/).

These native appearance settings require a new installed binary. The changes do not replace the already submitted App Store build 10 or publish an OTA update. The server compatibility fix also scopes exact brand-name requests made by older installed builds.

Validation: Expo lint and TypeScript; iOS and Android JavaScript exports; browser navigation at 320/390/430px; live light/dark switching on the store page and dark reloads of Home, Profile and Cart; PHP catalog regressions for all 12 store identities, conflicting/missing sellers, detail rejection and legacy queries. Native device testing of these new visual changes is still required before the next store submission. Live Nike detail matched shop `71955116`; UNIQLO returned an empty upstream catalog.

`tests/expo-navigation-ui.cjs` verifies all twelve logos, brand filtering, empty search recovery, navigation to the correct supplier query and layout at three phone widths. Its screenshots use intercepted API fixtures and are not store listing images. The EAS native screenshot flow also opens the brand directory and saves `07-brands.png`.

Validation on 2026-10-31: TypeScript, Expo lint, the exact SVG source check, the Playwright navigation regression suite (320/390/430-pixel widths), and an Android production JavaScript export all passed. The browser test also exercises login return paths, order filters/pagination/retry and profile saving. The first native pass revealed that SDK 58's default translucent iOS header covered the fixed brand controls. The Brands route now explicitly uses an opaque header; Maestro additionally taps the Technology and All filters before capture. See the [Expo SDK 58 header migration guide](https://docs.expo.dev/router/migrate/sdk-57-to-58/#review-the-ios-header-appearance). Native verification passed on iPhone 18 Pro Max: all seven screens were captured, the Technology/All filters produced 2/12 brands, and visual inspection confirmed that the search field and filters sit below the header. The verified EAS simulator build is `2860934a-a1fe-4b1b-9533-7d5c8e21ebb6`.

iOS release verification: production `1.0.0 (7)`, EAS build `1e6082ed-d451-45e3-8f19-834b77ac5293`, is `VALID` and `IN_BETA_TESTING` in the internal Team (Expo) group. App Store Connect selects build 7 and four fully processed native screenshots. Following the owner's authorization, App Review submission succeeded on 2026-10-31 at 04:27:59 Asia/Ulaanbaatar; the version and submission are `WAITING_FOR_REVIEW`. Public release remains manual after approval. Android was checked by bundle export; this task did not publish an Android binary.
