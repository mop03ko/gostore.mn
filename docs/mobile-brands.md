# Mobile brand discovery

The app renders the same 12 SVG logos as the website's `assets/brands/` directory, with `react-native-svg`. The exact SVG content is bundled in `gostoremn/src/lib/brand-logos.json`; no remote logo download is required. The artwork's existing license is recorded in `assets/brands/LICENSE.md`.

After changing website logo files, run from `gostoremn/`:

```powershell
node scripts/sync-brand-logos.cjs
node scripts/sync-brand-logos.cjs --check
```

The Chinese Taobao-style browsing structure consists of a compact, horizontally scrolling two-row logo shelf on Home, a three-column brand directory with group filters and name search, and a direct product-results view. Home discovery banners disappear during text, brand or image searches so the product grid and sort controls are reached immediately. Clearing the search restores Home discovery. Brand selection searches by name; the app does not label these results as verified official stores.

Categories uses the same logo tiles. Brand names, supplier search queries and group membership are defined in `gostoremn/src/lib/brands.ts`. The site and app retain their GOStore branding, Mongolian navigation and English product titles.

`tests/expo-navigation-ui.cjs` verifies all twelve logos, brand filtering, empty search recovery, navigation to the correct supplier query and layout at three phone widths. Its screenshots use intercepted API fixtures and are not store listing images. The EAS native screenshot flow also opens the brand directory and saves `07-brands.png`.

Validation on 2026-10-31: TypeScript, Expo lint, the exact SVG source check, the Playwright navigation regression suite (320/390/430-pixel widths), and an Android production JavaScript export all passed. The browser test also exercises login return paths, order filters/pagination/retry and profile saving. The first native pass revealed that SDK 58's default translucent iOS header covered the fixed brand controls. The Brands route now explicitly uses an opaque header; Maestro additionally taps the Technology and All filters before capture. See the [Expo SDK 58 header migration guide](https://docs.expo.dev/router/migrate/sdk-57-to-58/#review-the-ios-header-appearance). Native verification of this correction is recorded after the new screenshot build finishes.
