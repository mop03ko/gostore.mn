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

## Published OTA — 2026-11-17

App source commit: `d6c50571b6ba54f2458c9bd488438fe4db37ae16`.

| Platform/channel | Update group |
| --- | --- |
| iOS production, build 1.0.2 (20) runtime | `5cd6f440-f3dc-4d03-b68d-047ad11b27d3` |
| Android production, build 1.0.2 (11) runtime | `5a2faf3e-9381-4a0b-8a17-183c545614dc` |
| Android preview, APK 1.0.2 (12) runtime | `42265387-34b1-4f9d-948c-6387c8558df2` |

The Expo update endpoint was checked with each platform, runtime and channel;
it serves the new update IDs. Publication/routing is verified, not receipt on a
physical user device. Existing compatible apps download on launch and apply on
a subsequent restart; no new store binary was created. The live mobile deals
endpoint returned 50 unexpired discounted rows on its first page at verification.

## Continuous category pager — 2026-11-17

The original release switched category on a PanResponder release; the content did
not move during the drag. It now uses the existing React Native horizontal
ScrollView pager, so pages follow the finger, expose the neighboring page and
snap using platform scrolling physics. The orange tab indicator interpolates
with the scroll position using native Animated on iOS/Android. Adjacent tab taps
animate; distant tab taps jump directly without fetching intermediate categories.

Research: the user's Taobao reference establishes the tab/content structure.
[Alibaba mPaaS Tabs](https://www.alibabacloud.com/help/en/mobile-platform-as-a-service/latest/biaoqian)
documents swipeable panels, transition events, gesture angle and swipe thresholds;
[Ant Design Mini Tabs](https://0x-mini.ant.design/components/tabs/) documents the
same interaction family. These are primary references for the pattern, **not**
proof of the current Taobao app's private gesture implementation or exact timing.
No physical Taobao session was available to measure it frame by frame.
[React Native ScrollView](https://reactnative.dev/docs/scrollview) and
[Animated](https://reactnative.dev/docs/animated) provide the installed SDK's
paging, direction locking, nested scrolling and animated scroll APIs.

Each visited category owns its FlatList, fetched pages and scroll position. Keep
at most five feeds mounted; evicted feeds restore from an in-memory snapshot.
Unvisited neighboring pages show a lightweight placeholder and fetch only when
selected. Offscreen requests are cancelled, expiry still filters prices, and a
debounced scroll snapshot cannot overwrite a newer data response. Inner photo
carousels retain their own horizontal scrolling; vertical drags scroll the list.
Inactive pages are hidden from accessibility. Resizing re-aligns the active page.

`tests/expo-home-deals-ui.cjs` additionally verifies intermediate page/indicator
movement before release, snap-back after a short drag, independent nested
carousel scrolling, five-feed eviction/restoration, lazy requests, and resize
alignment. `output/home-deals/pager-mid-drag.png` captures two partially visible
pages during a real browser touch sequence. These browser gesture tests do not
replace a physical iPhone/Android performance check. Native dependencies and
runtime fingerprints remain unchanged; this change can use OTA.

Published from `3c43d1a5b8366b18bb697b9bd27fa16074812706` after lint, typecheck,
the expanded touch regression suite, discount checks and all-platform export:

| Platform/channel | Continuous-pager update group |
| --- | --- |
| iOS production, runtime `646e611…` | `86d45be0-68e7-4d39-a2d9-118187059808` |
| Android production, runtime `12e475e…` | `730b5d0a-aee5-4208-b0b6-7d85e2ea8fbf` |
| Android APK preview, runtime `12e475e…` | `4cb1a499-4aa3-45d3-8402-22ac11d0f526` |

All three update endpoint requests returned HTTP 200 and the expected new update
IDs for their platform/runtime/channel. Physical-device receipt remains unobserved.
