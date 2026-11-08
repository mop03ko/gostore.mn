# GOStore iOS / Android

Source: `gostoremn/`. Expo SDK 58, Expo Router, React Native. EAS project: `@morozkonkts-team/gostoremn`. Bundle/package ID: `mn.gostore.app`.

## Implemented

New mobile accounts use phone → verify.mn SMS confirmation → a four-digit PIN. Existing email accounts can still sign in and link a verified phone from their profile. PIN reset requires fresh SMS verification. See [Phone/PIN authentication and release notes](phone-pin-auth.md).

Catalog, brand/category/price search, camera/gallery image search (when server-enabled), gallery/SKUs, customer-scoped persistent cart, registration/login, profile/password, addresses, in-app order notifications and account deletion. Guest selections merge on login without replacing existing customer quantities.

The shopping layout follows the Taobao browsing pattern: persistent rounded search bar, two-row category shortcuts, two-column product feed, price sorting, dedicated category navigation, five bottom tabs, full-width gallery, SKU bottom sheet and persistent cart/order actions. GOStore naming, Mongolian UI, English catalog titles and the existing shipping/payment flow are retained. Campaign tiles open actual category searches; they do not advertise invented discounts, sales counts or shipping guarantees. Account profile/password fields expand from the customer dashboard.

Checkout displays server-validated goods, CNY rate, China delivery, service fee and payable total. Cargo and optional Ulaanbaatar delivery remain payable after measurement. A pending order request is persisted and reused after interruption to prevent duplicates. QPay invoice creation is an explicit separate action; QR/bank links, manual payment verification, verification on bank-app return, order history, final billing, weight/volume and pickup code are included.

## Backend and security

`api/mobile.php` allowlists catalog/customer actions and reuses the website checkout/payment/procurement logic. Mobile tokens use separate private session storage, no cookies, `X-GOStore-Mobile-Token` and CSRF. Login/password/logout rotate credentials. Password changes and deletion revoke other sessions. Tokens use SecureStore on native devices and sessionStorage for web preview.

Only `EXPO_PUBLIC_API_ORIGIN` is public configuration (default `https://gostore.mn`). TaoWorld/QPay secrets stay on PHP. Never put them in Expo config, public EAS variables or source control.

Deploy in order: `server/mobile-session.php`, `server/bootstrap.php`, `server/customers.php`, `mobile-privacy.html`, `api/mobile.php`. Back up and compare existing live files before replacement. The new endpoint is enabled last; existing browser session behavior is preserved.

Deletion removes login/profile/address-book/server-cart data and revokes sessions. Historical order/payment/fulfilment records and receiver information remain; active orders are not cancelled. The app explains this before PIN-confirmed deletion (or password confirmation for legacy accounts). Public privacy/deletion-request URL: `https://gostore.mn/mobile-privacy.html`.

## Development and validation

The home screen includes a seasonal 11.11 shelf from November 1 through November 11
(Ulaanbaatar time). It uses the existing `supplier-deals` endpoint and catalog cache,
shows at most eight products with a real price cut (confirmed within 24 hours, see
[performance-cache.md](performance-cache.md)) and removes expired offers on clock checks
or app resume. Coupon prices are not shown; the shelf hides itself on an error or when
nothing qualifies. It does not claim official campaign membership.
No API polling is added. The shelf supports loading, empty and retry states.

Run `node tests/expo-eleven-sale.cjs` for date/offer rules. With Expo web running,
set `EXPO_TEST_URL` to its loopback URL and run `node tests/expo-eleven-sale-ui.cjs`
for layout, navigation, expiry, cache, empty and failure coverage. Native installed
apps require a new build; changing the website does not update their bundled UI.

```powershell
cd D:\Gostore.mn\gostoremn
npm ci
npx expo start
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform all --output-dir ../output/mobile-export
```

From repository root, `node tests/run-logistics.cjs mobile customers api` uses disposable SQLite data with QPay and supplier network disabled. With Expo web on 8081, `node tests/run-logistics.cjs expo-ui` proxies only to the isolated backend and checks catalog → SKU → guest cart → registration → quote → order → addresses → logout at a 390px viewport. No live purchases/payments are made. Screenshots are in ignored `output/mobile/`.

`node tests/run-logistics.cjs expo-design` additionally checks category navigation, price sort parameters, persistent search, SKU selection and quantity controls, with screenshots at 390px and 320px in ignored `output/mobile-design/`. Those screenshots use isolated sample data, not live customer orders.

The Zod override removes the Expo CLI high-severity advisory; review it when upgrading Expo. Remaining low-severity findings come from Expo tooling → deepmerge; [upstream has no patched release](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Do not downgrade Expo/deepmerge simply to hide audit findings.

## Build and release

The installed app name and App Store Connect name are `gostore.mn`. App Store Connect app ID: `6828991827`; `eas.json` pins submissions to this record. The EAS-hosted App Store Connect key is assigned for submission; no private key is stored in this repository. Internal TestFlight group: `Team (Expo)`.

Submit an existing production iOS build with `npx eas-cli@latest submit --platform ios --profile production --id <build-id> --non-interactive`. Apple processing must finish before the build is available for testing. TestFlight: https://appstoreconnect.apple.com/apps/6828991827/testflight/ios.

```powershell
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```

Preview produces an Android APK. iOS requires Apple signing/provisioning for `mn.gostore.app`. For a macOS simulator use `--profile simulator --platform ios`.

Before public release, test on real Android/iPhone devices: camera/gallery permissions, safe area/keyboard, bank-app return, interrupted checkout recovery and logout isolation. Bundle export does not verify signed native builds or physical devices. Isolated tests do not verify real bank payments.

Release through TestFlight and Google Play internal testing first. Configure the correct App Store Connect app ID and Google service account securely in EAS; never commit service-account JSON. Review privacy/data-safety declarations and backend retention before store submission. Notifications are currently in-app, not push; carts are device-local, not synchronized with the web cart.

Store description draft: **GOStore — бараа сонгох, захиалах, хүргэлтээ хянах.** Browse products, search by image, select variants, review delivery calculations, pay using QPay and follow orders from Erenhot to Ulaanbaatar. Support: `https://gostore.mn/help`.

## Google Play submission — 2026-11-08

The Play Console app `mn.gostore.app` already had versionCode 4 completed on the internal and closed
(alpha) tracks; production was empty. The owner enabled the Google Play Android Developer API in
`gostore-27172` and invited `firebase-adminsdk-fbsvc@gostore-27172.iam.gserviceaccount.com`; the
EAS-stored key (also the FCM V1 key) is now the Android submissions key. `eas submit` sent production
build `ed71b300-2ea4-4f8c-aaab-aff4467871b2` (1.0.1, versionCode 8, FCM push) to the internal track as a
draft (submission `040b9551-7865-4212-a7c6-c4d563dc0409`); the Play API shows the internal track with draft
8 and completed 4. Releasing the draft, closed testing and production promotion are done in Play Console.
A dedicated least-privilege Play service account would be safer than the Firebase admin account.
