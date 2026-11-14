# Independently purchased cargo

Customers buy from their chosen Chinese seller and use GOStore for forwarding to Ulaanbaatar. This does not create a TaoWorld/OT purchase or collect the seller's goods payment.

## Customer flow

- Web: `/self-cargo.html`, linked from the home page, account page and footer.
- Expo app: Account → Өөрөө захиалах · Эрээн карго (`/self-cargo`). The native screen requires an app/OTA release; deploying PHP does not update installed apps.
- Authenticated customers receive a permanent `GO` + eight-digit cargo ID before registering shipments. Their address card uses the configured Erenhot warehouse address/phone, with their ID in the receiver name and address. Copy the ID, recipient, phone, address separately, or copy the full Chinese label.
- Customers enter the goods description, total item count, phone and optional variant/note. Each shipment still gets its own short GS order code. New forwarding orders snapshot the permanent cargo ID and shipping label; historical GS labels are preserved.
- Customers pay the seller and Chinese domestic shipping themselves, then add the courier waybill(s). One registration represents one whole order; up to 20 waybills can belong to it.
- The existing order detail shows warehouse photos, measurements, status history and freight payment. Goods amount starts at zero, `paid=false`, `type=forwarding`. It is excluded from supplier auto-purchase.

## Warehouse flow

Registration creates notifications for Erenhot and Ulaanbaatar. Both can see the order; Ulaanbaatar is read-only before arrival. A waybill scan finds the order. Erenhot checks in parcels, photographs and measures the goods, approves freight and packs/dispatches a QR batch using the existing workflow. Ulaanbaatar scans/receives the batch, photographs and sorts individual orders. Sorting a forwarding order creates a bill with zero goods, domestic shipping and purchasing-service costs, plus approved cargo and optional Ulaanbaatar delivery. Payment and handover use the existing freight invoice/collection-code controls.

## API and safeguards

- GET `customer-self-cargo`: own forwarding orders (most recent 100), public warehouse contact fields, `cargo_id` and `delivery` address card. `customer-me` also exposes the signed-in customer's cargo ID.
- IDs are allocated lazily in `customer_cargo_ids`, uniquely constrained by customer and cargo code. Concurrent first visits retry safely. IDs survive session/profile changes and are reserved after account deletion; clients cannot choose or overwrite them. Warehouse list/search suggestions include each new order's cargo ID. Users still register each parcel and courier waybill before receipt.
- POST `customer-self-cargo-create`: `request_key`, `title`, integer `qty`, `phone`, optional `note`, `number`, `company`.
- POST `customer-self-cargo-tracking`: `id`, `number`, optional `company`.
- Available through both web and token-only mobile API. Authentication and CSRF are required for writes. Idempotency is scoped to the customer, transactions serialize registration, waybills cannot be claimed across orders, and customer additions stop after warehouse receipt.
- No API key, supplier purchase operation, account sharing or public access token is exposed. Address is snapshotted when the order is registered.
- The owner authorized public display of Orgil's WeChat contact QR on 2026-11-12. The original, unmodified JPEG is available on the self-cargo page and bundled in the native app, with a full-size link for saving. It is visible before login too. It is a contact code, not a shipment/batch tracking code.

## Validation

`node tests/run-logistics.cjs self-cargo self-cargo-ui warehouse-ub-flow`

The isolated tests cover web/mobile auth, ownership, CSRF, invalid input, idempotency, duplicate waybills, both warehouse notifications, scan lookup, receipt photos/measurement, batch dispatch/receipt, transport-only final billing, customer notifications and responsive browser registration. They do not send real supplier orders or QPay payments. Run Expo `npm run typecheck` and `npm run lint` after refreshing generated Router types for the new screen.

## Deployment

For the initial feature, deploy `server/self-cargo.php` before `server/customers.php`, then `server/warehouse-ub.php` and `api/mobile.php`, the three root `self-cargo.*` files and the standalone script entry in `index.html`. For permanent IDs, deploy `server/bootstrap.php` first (additive `CREATE TABLE IF NOT EXISTS`), then self-cargo/customers/warehouse PHP and the warehouse/customer web assets. Back up and compare live files first; preserve unrelated storefront changes. The existing warehouse address/phone settings remain authoritative.

## Released 2026-11-12

- Implementation commit: `f35e1e4` (rebased onto the current main; pre-existing storefront work remains uncommitted).
- Web/PHP deployed with baseline checks, backups and published hash verification. Live `index.html` was patched with only the standalone entry script, preserving its other content. Backup: `/gostore-backups/self-cargo-1794414437550`.
- Live `/self-cargo.html`, JS and CSS return 200. Both web and mobile self-cargo APIs reject unauthenticated access with 401. No real customer/supplier order or bank payment was created for testing.
- Isolated API, browser (360/390/1280 px) and existing Ulaanbaatar warehouse regression tests passed, as did Expo typecheck/lint and the storefront bundle consistency check after rebase.
- Production iOS OTA: `dc73f567-2a30-4116-985d-f9d12223fa3a`, runtime `52bd47e7637e521598a2f3e4d25ae1bccdf63bbd`.
- Production Android OTA: `88ab90d0-5e2b-4f3e-90e2-fc7b308464cd`, runtime `7bb34ca75e224d3e958e2ee55510338e0effe0ad`.
- Android preview OTA (same bundle): `40d5a7d5-c14b-4246-b2e2-55def041e256`.
- Native runtimes match the previously published apps. No new native build was created. Publishing was verified in EAS; receipt on a physical customer's device has not been observed.

## Public WeChat contact — 2026-11-12

- User explicitly approved public display of Orgil's supplied contact QR. Implementation: `4b6b76c`.
- Web contact panel is available before login, with full-size and download links. App account navigation opens the self-cargo screen before authentication; only shipment registration still requires login.
- Original JPEG bytes are preserved in both web and bundled app assets. Web image stays on a white background and retains its full proportions; the native image uses `contain`, including in dark mode.
- Deployed `assets/erenhot-wechat-orgil.jpg`, `self-cargo.css` and `self-cargo.html`. Backup: `/gostore-backups/wechat-contact-1794415742446`. Live image returns 200 and matches the original file byte-for-byte.
- Existing self-cargo browser regression, public panel/image/download checks, mobile overflow check and Expo typecheck/lint passed. WeChat recognition on a physical phone has not been tested.
- Published OTA groups: production iOS `503c0960-f182-42e3-96ca-81c52969b2df`, production Android `bb182098-18b0-4ce0-a45c-255072ecc1b0`, preview Android `7eca29f6-8630-4f48-9981-fabcda7f9e2c`. Native runtime hashes remain unchanged; no new build.

## Permanent cargo IDs — 2026-11-12

- Implementation: `ef50f36`. Web layout now puts the permanent address card first, with GOStore orange/navy styling and individually labeled copy buttons. Existing forwarding registration, tracking and public WeChat contact remain available.
- Deployed bootstrap/self-cargo/customers/warehouse PHP, warehouse JS/HTML and the three self-cargo web assets. Backup: `/gostore-backups/cargo-id-1794416713802`. All published files passed hash verification; live web/mobile endpoints still reject anonymous cargo access. No production order was created during verification.
- Passed isolated self-cargo API/browser, customer authentication, warehouse and Ulaanbaatar workflow tests. Clipboard tests cover each field and the full label, normalizing Windows CRLF. Browser checks cover 360/390/1280px. Expo typecheck/lint passed.
- The native customer screen uses SDK-compatible `expo-clipboard` 58.0.4 for one-tap copying, including dark mode. This changes the native runtime and requires new iOS/Android builds. No native build, TestFlight submission or OTA update was created for this change; installed apps retain their previously published UI until a compatible build is released. Physical-device clipboard behavior has not been verified.

## Native release attempt — 2026-11-12

- Requested: new customer iOS/TestFlight build and directly installable Android APK. App-only archives were inspected before upload (`EAS_NO_VCS=1`, absolute `EAS_PROJECT_ROOT=D:\Gostore.mn\gostoremn`). The app `.easignore` excludes private configuration, credentials, generated exports and dependencies. Preview builds now use Node 24.12.0. Release configuration commit: `d1be379`.
- Android **1.0.1 (10)** completed: EAS build `0eb47b67-639e-412a-8b6a-1b92d57edb9e`, runtime `802faf140dab3ded9e59279d7c1d313a000ddd87`. [Download APK](https://expo.dev/artifacts/eas/bsp57lolXMTDXcJFf1Fa2UjVqK6gKM00CDf0J8zipC0.apk). Local copy: `output/releases/gostore-1.0.1-10.apk`, 131,344,168 bytes, SHA-256 `f78eb058e2761d2f38276fc7450914b3567e4a83a57707913e04247f3d283632`. Verified APK signature v2, manifest package `mn.gostore.app`, version/code and ZIP alignment. Physical-device installation remains untested.
- iOS **1.0.1 (18)** compiled successfully: EAS build `f2554d2b-ca33-4ad8-8b8e-ffd268951c4f`, runtime `b1561d4cf26b7593bcbea61e54b04a8f2bb6e5d5`. The downloaded IPA's Info.plist independently confirms bundle `mn.gostore.app`, version 1.0.1, build 18.
- EAS submission `b66519c1-dd6d-4a8b-85c2-5f69a50f97f8` reports FINISHED, but Apple upload `0bb8cbc9-4659-47b2-bda4-f322304e40ab` FAILED with 90186/90062: approved version 1.0.1 is closed to new builds. **Build 18 is not available in TestFlight.** Check `/v1/apps/6828991827/buildUploads`, not only EAS submission status or `/v1/builds`, when diagnosing this failure.
- Corrected app/package/lock versions to **1.0.2** in commit `48b5265`. The replacement iOS attempt advanced the remote counter to 19 but EAS rejected build creation because the monthly Free-plan iOS allowance is exhausted, resetting December 1. No build 19 job or TestFlight submission was created. A further EAS attempt may increment again.
- The user selected a Mac build environment instead of increasing the Expo allowance. No billing plan was changed. Expo repack was checked as an alternative; its iOS signing supports ad-hoc/development only, so it was not used for TestFlight. Do not publish the old-runtime OTA as a substitute for the new clipboard native module.

## Mac release workflow — prepared 2026-11-12

- Commit `21052ad` adds the manually dispatched `.github/workflows/ios-testflight-mac.yml` and `scripts/ios-mac-*` helpers. It runs only from `main`, uses the GitHub `xcode-27` Mac runner, checks the app, generates the native project through Expo prebuild/config plugins, archives/signs it, verifies bundle/version/build and uploads it to App Store Connect. It does not submit a public App Store release.
- Planned release: **1.0.2 (19)**. Apple upload history confirmed no existing build 19 at preparation time. Recheck before dispatching; the EAS remote counter is already 19.
- The existing signing identity is available from EAS for `mn.gostore.app`, Apple team `8P6PVVWKUB`. The workflow expects an encrypted `GOSTORE_IOS_SIGNING` Actions secret containing the existing P12/password, provisioning profile and App Store Connect key. Credential values must never be committed, printed or included in artifacts. Runner keychain/profile/key files are removed in an `always()` cleanup step; remove the temporary GitHub secret after release too.
- **Not dispatched yet.** Automatic approval review rejected copying the Apple signing credentials into GitHub Actions without explicit permission for that storage. A permission question is pending. The repository contains only non-secret scripts; no signing secret was created and no Mac build/upload has started.
- Local Expo typecheck/lint, JavaScript/Python syntax and workflow YAML checks passed. Actual macOS archive/export/upload remains unverified until the first authorized run. A successful upload must still be checked through Apple `buildUploads` and `/v1/builds` before adding the build to existing TestFlight groups.


## Homepage entry and simpler registration — 2026-11-15

- Web and Expo home show a compact forwarding card before product discovery. The card opens the existing self-cargo route; no new backend endpoint is required. Web uses a scoped standalone stylesheet and updates its cached script reference without replacing unrelated homepage changes.
- Three steps are available before sign-in: obtain the personal warehouse address, buy/pay the seller, register the cargo and waybill. Chinese address-field labels and the distinction between seller order number and courier waybill are explained. Seller costs and GOStore forwarding costs are separate.
- Customers can enter an optional waybill/company with the initial cargo registration, or add it later. Existing permanent IDs, ownership checks, idempotency and warehouse processing remain unchanged.
- Validated isolated self-cargo API and browser flow, clipboard, initial and later waybills, public guide, homepage/account navigation, compact layout and 360/390/1280px widths. Expo typecheck and lint passed.
- Deployed only self-cargo-entry.css, self-cargo.css/js/html and the homepage script version. Published hashes verified; backup `/gostore-backups/self-cargo-home-1794672549979`. A read-only mobile-sized browser verified the live homepage card and public guide; no production order/payment was created.
- Native app source is ready, but this change has NOT been published as an OTA or a new store build. Existing iOS release lacks the previously added expo-clipboard native module. The last EAS builds remain Android 1.0.1 (10) and iOS 1.0.1 (18); the latter upload was rejected as documented above. The prepared 1.0.2 release needs a compatible native build before installed iOS apps can receive this flow. No paid build or signing-secret upload was performed.
