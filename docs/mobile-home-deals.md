# Customer home: swipe categories and verified deals

2026-11-17. The customer app home now uses GoStore branding with a compact logo/help
row, camera/search bar, warehouse/cargo shortcuts, persistent horizontal category
tabs, product collages, an orange deals shelf, category photos and a two-column
product grid (four columns on wide screens). Dark mode retains the white GoStore
logo. No Taobao coupon, countdown, free-shipping or sales-volume claims are copied
from the design reference.

Swipe left on the list for the next category, right for the previous one; tabs
and photo shortcuts also select a category. Vertical scrolling and horizontal
collage/category-photo scrolling keep their normal behavior. The active tab stays
in view. Category changes clear old results and cancel obsolete requests.

The default feed calls `supplier-deals`. Category feeds use the existing cached
`supplier-search` query and display only rows accepted by `productSavings`: a
sellable item, positive matching current price, higher previous price, and an
unexpired verified discount. Highlights reuse these same rows without extra API
calls. A category page may have no verified deals even when regular products are
available; it shows an honest empty state and a manual next-page action instead
of automatically scanning every page. Explicit text/image search still shows
all matching products. No backend or native dependency change is required.

Validation: Expo lint, TypeScript, iOS/Android/web export; product discount and
campaign unit checks; `tests/expo-home-deals-ui.cjs` using isolated API fixtures
checks real discounts, request counts/cache reuse, response races, left/right
touch swipes, vertical gestures, pagination, empty/error states, search, and
light/dark 390px/320px layouts. Screenshots: `output/home-deals/`. Physical-device
receipt and touch performance require observation after OTA installation.

## iOS build compatibility

The public Mac build 1.0.2 (20) was built from `4fff9935556edb14c68fccfd17458ccf85910edf`
with the signing plugin and config additions in `scripts/ios-mac-build.sh`. Its
runtime is `646e611a39796fd0c8cb87ef08a4ea35cc51abba`. An ordinary Windows update
uses runtime `a8dd376b5cdfd560a1feff8949377a4204ebaa5f`, so those earlier updates
cannot reach this Mac-built binary.

After committing the reviewed app, run `node scripts/customer-ios-ota.cjs` to
stage tracked files under `tmp/`, reproduce the original config/plugin, and
verify the exact build-20 fingerprint. `--publish` additionally sends that
verified staging project to the production channel. No native code is generated,
no signing secrets are used, and the fingerprint policy is never overridden.
The script refuses publication if the app version or native fingerprint changes.

Android runtime remains `12e475e0cbbc9ab91d7ecfa01d472e04d133f2a1`. Publish from
`gostoremn` using `eas update --platform android --environment production` with
`--channel production` and `--channel preview` (the directly installed APK).
