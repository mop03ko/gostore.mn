# GOStore iOS / Android

Source: `gostoremn/`. Expo SDK 58, Expo Router, React Native. EAS project: `@morozkonkts-team/gostoremn`. Bundle/package ID: `mn.gostore.app`.

## Implemented

Catalog, brand/category/price search, camera/gallery image search (when server-enabled), gallery/SKUs, customer-scoped persistent cart, registration/login, profile/password, addresses, in-app order notifications and account deletion. Guest selections merge on login without replacing existing customer quantities.

Checkout displays server-validated goods, CNY rate, China delivery, service fee and payable total. Cargo and optional Ulaanbaatar delivery remain payable after measurement. A pending order request is persisted and reused after interruption to prevent duplicates. QPay invoice creation is an explicit separate action; QR/bank links, manual payment verification, verification on bank-app return, order history, final billing, weight/volume and pickup code are included.

## Backend and security

`api/mobile.php` allowlists catalog/customer actions and reuses the website checkout/payment/procurement logic. Mobile tokens use separate private session storage, no cookies, `X-GOStore-Mobile-Token` and CSRF. Login/password/logout rotate credentials. Password changes and deletion revoke other sessions. Tokens use SecureStore on native devices and sessionStorage for web preview.

Only `EXPO_PUBLIC_API_ORIGIN` is public configuration (default `https://gostore.mn`). TaoWorld/QPay secrets stay on PHP. Never put them in Expo config, public EAS variables or source control.

Deploy in order: `server/mobile-session.php`, `server/bootstrap.php`, `server/customers.php`, `mobile-privacy.html`, `api/mobile.php`. Back up and compare existing live files before replacement. The new endpoint is enabled last; existing browser session behavior is preserved.

Deletion removes login/profile/address-book/server-cart data and revokes sessions. Historical order/payment/fulfilment records and receiver information remain; active orders are not cancelled. The app explains this before password-confirmed deletion. Public privacy/deletion-request URL: `https://gostore.mn/mobile-privacy.html`.

## Development and validation

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

The Zod override removes the Expo CLI high-severity advisory; review it when upgrading Expo. Remaining low-severity findings come from Expo tooling → deepmerge; [upstream has no patched release](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Do not downgrade Expo/deepmerge simply to hide audit findings.

## Build and release

```powershell
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```

Preview produces an Android APK. iOS requires Apple signing/provisioning for `mn.gostore.app`. For a macOS simulator use `--profile simulator --platform ios`.

Before public release, test on real Android/iPhone devices: camera/gallery permissions, safe area/keyboard, bank-app return, interrupted checkout recovery and logout isolation. Bundle export does not verify signed native builds or physical devices. Isolated tests do not verify real bank payments.

Release through TestFlight and Google Play internal testing first. Configure the correct App Store Connect app ID and Google service account securely in EAS; never commit service-account JSON. Review privacy/data-safety declarations and backend retention before store submission. Notifications are currently in-app, not push; carts are device-local, not synchronized with the web cart.

Store description draft: **GOStore — бараа сонгох, захиалах, хүргэлтээ хянах.** Browse products, search by image, select variants, review delivery calculations, pay using QPay and follow orders from Erenhot to Ulaanbaatar. Support: `https://gostore.mn/help`.
