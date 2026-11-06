# Customer app shopping layout

The customer Expo project is `gostoremn/` (bundle/package `mn.gostore.app`). Staff apps are separate.

- Five bottom tabs: Home, Categories, Search, Cart, Account.
- Home has horizontal collections, bundled category photography, current supplier offers and a shared two-column product card.
- Categories use a vertical department rail and a three-column image grid, with search results and recommendations using the existing catalog cache.
- Search offers explicit camera permission, a live photo preview, gallery selection and keyword search. Photos are resized before uploading to the existing image-search endpoint. Unavailable image search falls back to text. The camera unmounts on blur/background or text mode; upload failure permits retry.
- Cart keeps existing quantity limits, persisted customer cart, server quote and checkout rules. Its total and checkout remain above the tab bar.
- Account exposes addresses, notifications and filtered orders. `/orders` is a stack route: SDK 58 treats `href: null` tabs as hidden redirects, so orders must not be a hidden tab.
- Brand accents follow the supplied logo: orange `#f16522`, navy `#262261`. Dark surfaces and readable text variants remain supported.

No placeholder vouchers, sales counts, free international shipping or refund guarantees were added. The seasonal home shelf disappears if no valid supplier offers are available; the Deals channel retains its empty/error states.

## Validation

From `gostoremn`: `npm run lint`, `npm run typecheck`.

Start the local web preview on port 8086 and run `node tests/expo-shopping-redesign.cjs` from the repository root. It mocks every commerce request and uses Chromium's synthetic camera. Covers responsive widths, category selection, order filters, cart updates, permission/capture/upload retry, image-result navigation, camera teardown, text search and guest/disabled states. Screenshots are saved under ignored `output/shopping-redesign/`.

Native bundles can be checked with `npx expo export --platform ios --platform android --output-dir ../output/customer-redesign-native --max-workers 2`.

## Native distribution

`expo-camera` is a new native dependency. Existing installed binaries need a new signed build; an OTA-only update is insufficient. The config enables camera access and disables microphone/audio recording. Verify camera permission denial, gallery cancellation, background/resume and real-device capture on iOS/Android before public release. A web mock test cannot validate physical cameras or native permission dialogs.
