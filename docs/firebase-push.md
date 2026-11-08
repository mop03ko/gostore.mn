# Firebase web Analytics and customer push

## iOS Firebase integration — 2026-11-07

The supplied `GoogleService-Info.plist` matches `mn.gostore.app` in `gostore-27172`. Its copy under `gostoremn/config` is Firebase's public client configuration, not an administrative service-account credential. RN Firebase App/Analytics 27 uses the native iOS SDK through SPM and dynamic frameworks. The iOS-only config plugin and Android autolinking exclusions keep Android buildable until its separate Firebase configuration is provided.

Production iOS records sessions and allowlisted screen names, never route IDs, search terms, account IDs, phone numbers or order details. IDFA/IDFV, ad storage, ad user data and personalized advertising are disabled. Automatic native screen reporting is off to avoid duplicate events. Account includes a persistent Analytics switch; disabling resets local Analytics data. Development/Expo Go and web do not initialize the native SDK. These native dependencies require a new binary/runtime, not an OTA update to build 16.

Push still uses Expo/APNs, not Firebase Messaging on iOS. The backend supports an explicit `GOSTORE_CUSTOMER_PUSH_PLATFORMS` comma-separated allowlist (or private `customer-push-platforms` file). Both registration and delivery enforce the list; the app hides unsupported activation. Android must remain disabled until FCM is configured. Real handset receipt and Firebase Realtime collection must be checked after installing the new TestFlight build.

Validation: `tests/expo-analytics.cjs`, `tests/expo-push.cjs`, `tests/customer-push.php`, Expo lint/typecheck. The mobile privacy policy and local store privacy declaration describe Analytics and notification processing. The store declaration file is not evidence that Apple has saved those changes.

Deployment: server source and privacy policy hashes verified; private activation is `ios` only. Added and verified the customer push worker's every-minute cron, preserving existing jobs. There were zero registered customer devices at activation, so handset delivery is unverified. EAS build `95672fdf-418e-4fd5-8677-6a2c43675dae`, version 1.0.1 (17), finished successfully with runtime `52bd47e7637e521598a2f3e4d25ae1bccdf63bbd`; submission `767475ed-fc34-489e-94cb-f9801cc9879b` uploaded to Apple successfully. Apple processing/TestFlight availability is separate from upload success.

## Web Analytics

`firebase-web.js` initializes the supplied public Firebase web app in project `gostore-27172`, using SDK 13.2.0 and measurement ID `G-44TMZT4X1E`. It loads 1.2 seconds after window load, catches unavailable/blocked SDK errors, checks Analytics support, and initializes once. A single explicit page view excludes query strings and fragments. Localhost telemetry is disabled; browser tests explicitly opt into mocked SDK modules.

The existing GA property `G-WLC1E39628` and GTM container remain. These are separate destinations; Firebase receives one page view, not a second manual `gtag('config')` for its measurement ID. Audit GTM separately before configuring the same new stream there. No Firebase Authentication or PIN/SMS flow changes are made.

## Native transactional notifications

Expo SDK 58 `expo-notifications` uses Expo Push Service (Android FCM v1 / Apple APNs). The web SDK configuration alone cannot authorize native pushes.

- Users opt in from the app's Notifications screen; automatic renewal never prompts for permission. Denial and disabling unregister the saved token. Permission and network failures leave shopping usable.
- Tokens are stored through authenticated, CSRF-protected `customer-push-register` / `customer-push-unregister` mobile actions. Registrations expire after 90 days, are scoped to a customer and auth version, and are revoked on logout, account deletion or PIN/password version changes. Up to 10 devices per customer.
- The worker observes existing customer-owned `order_notifications`, skips history before opt-in, coalesces pending changes, and uses generic text without order IDs, phone numbers, addresses or payment amounts. Tapping opens only the authenticated Notifications screen.
- Push tickets are checked after 15 minutes. Invalid-device errors remove tokens; transient errors back off. A file lock prevents concurrent workers. Unknown delivery after 24 hours may be retried; as with push providers generally, exactly-once delivery is not guaranteed.
- Delivery stays disabled until `GOSTORE_CUSTOMER_PUSH_ENABLED=1` or the private data directory contains `customer-push-enabled`. Optional Expo enhanced-security token: server environment `EXPO_ACCESS_TOKEN`, never an Expo public variable.
- Run `php /absolute/path/server/customer-push-worker.php` every minute after activation. A bounded shutdown drain opportunistically sends after order changes; cron is still required for delayed receipts/retries.

## Required cloud configuration before activation

1. Firebase project `gostore-27172`: register Android package `mn.gostore.app`; download `google-services.json`, configure `expo.android.googleServicesFile` to that actual file (or an EAS secret-file variable). Do not fabricate an Android app ID from the web app ID.
2. Configure the matching Firebase FCM v1 service-account credential in EAS for `mn.gostore.app`. Keep the private JSON out of Git and public web paths; do not use the separate warehouse Firebase project.
3. Ensure EAS has an APNs push key and a provisioning profile with the push capability for the iOS app. No Firebase iOS plist is needed for Expo/APNs delivery.
4. Build/install new native binaries, then enable the server worker and test permission, foreground/background/terminated delivery, tapping, logout, and PIN reset on real devices. Never publish this native-module addition to old fingerprints.

## Validation

`tests/customer-push.php`, `tests/expo-push.cjs`, `tests/firebase-analytics-ui.cjs`, existing analytics/mobile/PIN API regressions, mobile typecheck and lint. Test transports never send real pushes or analytics events.

## Apple version correction

Apple rejected 1.0.0 (14) after upload with 90062/90186 because the approved 1.0.0 train is closed. App/package version is now 1.0.1; EAS remote build auto-increment remains enabled. An upload success message alone does not establish App Store processing success or TestFlight availability.

## iOS signing repair — 2026-11-07

- Build 1.0.1 (15) failed because the old provisioning profile lacked Push Notifications / `aps-environment`.
- After the account owner renewed Apple authentication and configured credentials, EAS validated the refreshed profile for `mn.gostore.app`. The existing distribution certificate was retained.
- An APNs push key was created and assigned to this app in EAS. No private key material was added to the repository.
- Replacement 1.0.1 (16), EAS build `95686861-ff8b-4675-b76d-a6975323911e`, completed Xcode archive/signing and was uploaded with submission `a8ad807c-26ab-4a9b-9594-c6dbcff9e3f1`.
- App Store Connect initially showed Processing. Physical-device notification delivery remains unverified; the server push switch remains disabled. Android FCM configuration is still outstanding.

## Android Firebase configuration — 2026-11-07

The owner supplied `google-services.json` for Android app `1:428447938231:android:54b7dde869a162f7bfff32`
(package `mn.gostore.app`, project `gostore-27172`). It is Firebase's public client configuration (like the
iOS plist), stored at `gostoremn/config/google-services.json` and referenced by
`expo.android.googleServicesFile` for Expo push (FCM v1). RN Firebase Analytics stays excluded from Android
autolinking; enabling it would also need the Play Data safety declaration. The iOS fingerprint is unchanged
(`52bd47e7637e521598a2f3e4d25ae1bccdf63bbd`), so build 17 keeps receiving OTA updates; Android needs a new
binary (fingerprint `7bb34ca75e224d3e958e2ee55510338e0effe0ad`).

The FCM V1 service-account key (`firebase-adminsdk-fbsvc`, private key ID starting `a8bb23dd`) was uploaded to EAS
and assigned to Android credentials `a47c1ace-a530-44ca-be21-360ff3f49f3c` on 2026-11-07. Key files are
git-ignored (`*-firebase-adminsdk-*.json`); keep the downloaded file outside the repository.

Still required before Android push: a new Android build tested on a device, then adding `android` to the
server's `customer-push-platforms`.

Android builds with the FCM configuration: production AAB versionCode 8 (`ed71b300-2ea4-4f8c-aaab-aff4467871b2`)
and preview APK versionCode 9 (`5cd94932-9a8c-4d03-a2ee-f28c2ba2e15b`), both finished 2026-11-07. The server's
private `customer-push-platforms` was changed from `ios` to `ios,android` the same day (previous value backed
up under `/gostore-backups/android-push-*`). Android handset delivery has not yet been verified.

Handset delivery: on 2026-11-08 the owner confirmed that customer notifications were received on a phone
after the Android FCM build and the iOS activation (the access log shows a successful
`customer-push-register` from the iOS app the same day).
