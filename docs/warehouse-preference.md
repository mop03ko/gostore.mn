# App pickup warehouse preference

Implemented 2026-11-15 for the customer Expo app.

## Customer flow

- On the first home visit of each cold app launch, show a warehouse reminder. The previous choice is preselected; returning from another app does not repeatedly show it. Auth/payment/product deep links are not interrupted.
- Show the active pickup warehouses from `catalog.shipping.pickup_locations`: Ulaanbaatar, Zamyn-Uud and Sainshand. Show current addresses and telephone numbers, not a duplicate static address list.
- Save only `{version:1, location}` in device AsyncStorage (`gostore-pickup-warehouse-v1`). This is a device preference, not an account address. It persists across app restarts and account changes. The customer can skip and choose before ordering.
- The home card, checkout and self-cargo form open the same picker. New pickup orders and new forwarding orders use the selected destination. Changing the preference never reroutes an existing order or changes an idempotent retry. Ulaanbaatar home delivery remains separate.
- Removed/inactive destinations cannot be selected or used in new orders. The server validates the destination under the order write transaction. Old clients omitting the forwarding destination retain the Ulaanbaatar default.
- The warehouse reminder takes precedence over the existing promotional popup.

## Location design and limitations

The **Байршлаар ойр агуулах санал болгох** button requests foreground permission and a single balanced-accuracy position through Expo Location. No location request runs at startup or in the background. Denial, disabled services, unsupported native module and a 20-second acquisition timeout leave manual selection available. A late result cannot overwrite a manual selection. A recommendation never automatically changes the saved or draft destination; the customer chooses and confirms it.

Coordinates stay in memory on the device; they are not stored, logged, sent to GOStore, sent to analytics or reverse-geocoded. Only the selected warehouse identifier is persisted and sent with an order. There is no background location entitlement or foreground location service. iOS Always permission descriptions are disabled.

We do not have verified warehouse GPS pins. Haversine distance therefore ranks **city reference points**, not buildings or driving routes. The UI explicitly explains this. Reference coordinates: [Ulaanbaatar](https://www.wikidata.org/wiki/Q23430), [Zamyn-Uud](https://www.wikidata.org/wiki/Q2084833), [Sainshand](https://www.wikidata.org/wiki/Q943290). No live geocoding dependency or fee is needed.

Recommendations require a valid, non-mocked position no older than two minutes, reported accuracy at most 10 km, and a city within 150 km. A gap of at most `10 km + 2 × accuracy` between the closest two destinations is ambiguous and produces no recommendation. Multiple branches in one city also require manual selection until actual pins exist. These are conservative product thresholds, not transport coverage boundaries.

API references: [Expo SDK 58 Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/) and [React Native Modal](https://reactnative.dev/docs/modal).

## Verification and release

- `node tests/warehouse-preference.cjs`: preference validation, active options, all three cities, inaccurate/stale/mocked/far locations, ambiguity, permission denial, disabled services and timeout.
- `node tests/run-logistics.cjs self-cargo checkout-branches`: isolated backend, no real payment; destination validation, checkout/forwarding routing and idempotent retry.
- Start Expo web on localhost:8093, then `node tests/expo-warehouse-preference-ui.cjs` (or set `MOBILE_WEB_BASE`): mocked catalogue, persisted reminder, explicit GPS, recommendation without switching, small/dark layouts, deep-link handling and actual checkout request payload.
- Run Expo lint and TypeScript checks.

`expo-location` is a new native dependency. Existing installed binaries cannot receive this feature through an OTA-only release; build matching new iOS and Android binaries. Do not override the fingerprint runtime to target old binaries. Before distribution, test foreground permission denial/approximate location and cold-start/resume on physical iOS and Android devices, and review store permission/privacy text against this on-device-only design. Do not declare location uploaded or collected when it is not.

The backend forwarding change is backward compatible and should precede app distribution. No live customer order is required to validate this release.

### Verified state, 2026-11-15

Unit tests, isolated self-cargo and checkout/forwarding integration tests, Expo browser interaction tests, TypeScript and lint passed. Checked the generated native configuration: iOS includes only the When-In-Use location description; Android includes coarse/fine location, with no background location, activity recognition or foreground location service permission. Small-screen confirmation buttons stay visible while the options scroll; light/dark previews were inspected.

Deployed only `server/self-cargo.php` through FTPS with verified backup and content hashes. Backup: `/gostore-backups/warehouse-picker-1794679626846`. Public mobile and web catalogue endpoints returned HTTP 200 with all three active pickup warehouses after deployment. No live order or payment was created. Native app build/distribution and physical-device QA remain pending; no OTA was sent to existing runtimes.

## Web extension, 2026-11-15

`warehouse-preference.js` and its stylesheet add a native HTML dialog on the first home visit of a browser tab session. It remembers the selected active warehouse in the same versioned localStorage shape as the app; browser and native storage are separate. Navigating or reloading in that tab does not repeatedly interrupt the customer. The home summary reopens the picker. Existing promotional popups wait until the initial warehouse reminder closes. Deep-linked checkout, login and product pages are not interrupted.

The home section is now named **Хүлээн авах боломжтой агуулах** (also updated in Expo source). Web checkout and the standalone self-cargo form use the remembered choice, allow changing it, and persist that change. Missing/invalid choices require explicit selection instead of silently using Ulaanbaatar. Orders already created retain their recorded destination. Another tab's preference change updates the home summary without silently changing an open checkout.

Location is read only after a click using [Geolocation.getCurrentPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), with a 20-second timeout and the same city/accuracy/ambiguity limits as Expo. No IP geolocation, reverse geocoding, coordinate storage or coordinate transmission is used. The [HTML dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) supports keyboard dismissal/focus management and keeps its confirm controls visible while options scroll. Dark mode uses existing theme variables.

Signed-in customers see **Эрээн агуулахын хаяг харах** on the home summary. Clicking revalidates their session and uses the existing authenticated `customer-self-cargo` endpoint to show their cargo ID, recipient, phone and full Erenhot address, with copy and self-cargo links. Private address data stays in the dialog's memory/DOM, is never put into localStorage/sessionStorage, and the dialog closes on account changes or cross-tab logout. The backend continues to reject anonymous access. The standalone self-cargo address has the `#sc-address` anchor.

Validation: `node tests/run-logistics.cjs warehouse-preference-ui checkout-branches self-cargo-ui promo-popup-ui`; Expo lint/typecheck for the heading change. The new web suite covers optional GPS/denial, explicit selection, persisted choices, responsive/dark rendering, authenticated address/copy/logout isolation, real isolated checkout and forwarding flows, and the final deployment snapshot. No live customer purchase/payment is used.

Web release deployed and verified on 2026-11-15, backup `/gostore-backups/web-warehouse-picker-1794680527344`. The production bundle was patched only for account-change notification, checkout preference and promo ordering, preserving unrelated live code. Read-only live browser checks passed for the three branches, updated heading, selected warehouse persistence, mobile layout and anonymous rejection of the private Erenhot address endpoint. Native heading changes remain source-only until the next app distribution.

## Native tester release, 2026-11-15

Built the customer app from source commit `4fff9935556edb14c68fccfd17458ccf85910edf`, including the native warehouse picker, optional foreground location, remembered destination, destination-aware checkout/forwarding, and the heading **Хүлээн авах боломжтой агуулах**.

- **iOS 1.0.2 (20):** [Mac workflow 43675266455](https://github.com/mop03ko/gostore.mn/actions/runs/43675266455) completed successfully. App Store Connect build/upload `ba280e3c-2424-449f-ad46-51a78e90831c` is `VALID`; both internal and external states are `IN_BETA_TESTING`. Verified membership in **Team (Expo)** and **GOStore Testers**. Updated What to Test, enabled automatic tester notifications, and completed beta review. The separate public App Store submission was not replaced.
- **Android Google Play 1.0.2 (11):** [EAS build 5c922058-03a0-411c-ac37-7dec2b2ba09b](https://expo.dev/accounts/morozkonkts-team/projects/gostoremn/builds/5c922058-03a0-411c-ac37-7dec2b2ba09b) completed. EAS submission `75404d9b-cb99-43eb-85d7-0bdedaab9b87` uploaded the AAB. Promoted the uploaded version to `completed` on the existing `internal` and `alpha` testing tracks, validated/committed the edit, and read back both tracks to confirm versionCode 11 and Mongolian release notes. Production remains empty; this is a tester release.
- **Android direct APK 1.0.2 (12):** [EAS build 327e8ce6-fa34-49d3-bf74-8f65c4474b93](https://expo.dev/accounts/morozkonkts-team/projects/gostoremn/builds/327e8ce6-fa34-49d3-bf74-8f65c4474b93) completed. [Signed APK](https://expo.dev/artifacts/eas/Af5Q67cxqYlG_oDTiSKFQnUQLyg9vpjdcjkQPIl9i0c.apk). Verified package `mn.gostore.app`, versionCode 12, versionName 1.0.2 and the same signing certificate as direct APK 1.0.1 (10). Existing APK testers can install it over their APK installation.

Runtime fingerprints: iOS `646e611a39796fd0c8cb87ef08a4ea35cc51abba` (production channel); Android `12e475e0cbbc9ab91d7ecfa01d472e04d133f2a1` (production for AAB, preview for APK). No incompatible OTA was sent to old runtimes. Synchronized the EAS iOS remote build counter from 19 to 20 after the Mac build.

Validation passed: TypeScript, lint, warehouse preference unit tests and the mocked Expo browser interaction suite (startup reminder, persistence, optional location without automatic switching, small/dark layouts, deep links and checkout destination payload). Inspected the IPA's actual Info.plist: correct identity/version, only When-In-Use location permission and no background location mode. APK manifest includes coarse/fine location and no background location permission. APK signature verification passed; AAB JAR signature verified and Google Play accepted it. The temporary GitHub signing secret was deleted after the successful run, with runner cleanup successful and the secret list verified empty.

Artifacts (SHA-256):

- IPA, 29,075,732 bytes: `922292f2e543c62ef54e30a681f6a2358b12ca2e44be43358ef69e93299ae7c0`.
- AAB, 90,585,800 bytes: `402dec45f13c7e3fd1169894324a0797054af490bf4893d4b8e8672043a19c2c`.
- APK, 131,513,195 bytes: `b27dc7d630d6c442d1253eca181938263a547d7f70116186f1b35a62de53e256`.

Testers install through TestFlight / their existing Play testing enrollment, or the APK link for direct APK installs. Store distribution does not prove installation on each phone. No physical device was attached for this release; testers should verify native permission denial/approximate location, cold start/resume and warehouse selection on their phones. No real order or payment was created during verification.
