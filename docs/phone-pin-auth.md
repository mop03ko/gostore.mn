# Phone + 4-digit PIN authentication

New mobile accounts use: phone and name → send an MO SMS to 144773 → server independently confirms VERIFIED → create and repeat a 4-digit PIN. Later logins use phone + PIN. Leading zeroes are preserved. Neither opening the SMS composer nor a carrier reply confirms ownership.

Existing email users keep their login and orders. They sign in through “Өмнөх имэйлээр нэвтрэх”, then choose “Утас, PIN холбох” in their profile. Matching an old, unverified profile phone never grants access to that account. Native account deletion accepts the PIN for linked accounts; old email/password deletion remains supported.

## Server

- `customer-pin-setup` requires a single-use, session-bound verify.mn challenge for the exact phone and purpose (`register`, `reset`, `link`), with an unexpired 5-minute deadline. Generic phone verification cannot authorize account takeover or PIN reset.
- `customer-pin-login` accepts only a normalized Mongolia phone and a string of exactly 4 digits.
- `customer-pin-change` requires the current PIN. Reset requires a fresh SMS proof. Both increment `auth_version`, revoking older sessions.
- A unique `customer_phone_auth` mapping binds one verified phone to one customer. The additive table is created by the existing SQLite schema initialization. Existing accounts/orders are not migrated or reassigned.
- Stored PINs are bcrypt hashes of HMAC-SHA256 digests keyed by a separate server secret. Set `GOSTORE_PIN_PEPPER` to 64 random hex characters in the process environment, or `server/pin-auth.env` as `GOSTORE_PIN_PEPPER=<value>`. Keep it backed up and out of Git. Changing/loss of this secret requires PIN resets. It is separate from VERIFY_MN_API_KEY and never sent to Expo.
- Guessing limits: 5 attempts per phone / 15 minutes, 20 per phone / day, 30 per IP / 15 minutes. A correct PIN clears the short phone counter; an SMS-authorized reset clears the phone counters. PINs never enter local storage, URLs, analytics or API response bodies.
- The mobile allowlist enables verification and PIN endpoints. Existing customer-session CSRF and mobile-token rotation are preserved.
- A linked login phone cannot be changed through ordinary profile editing; it requires a fresh link verification. Account deletion removes its PIN mapping and revokes sessions.

## Expo

SDK 58 `expo-sms` opens the native SMS composer; its result is not accepted as proof. Polling every ~3 seconds resumes when returning to the foreground. Expiry and cancellation stop polling. The UI supports new registration, reset, legacy linking, PIN change and account deletion, while preserving cart merge and checkout/order return routes.

Expo Update is configured with preview/production channels and the fingerprint runtime policy. Existing installed binaries do not contain expo-updates; **a new native build must be installed once** before they can receive compatible updates. Native SMS and update modules are included in that new build. See [Expo Update setup](https://docs.expo.dev/eas-update/getting-started/) and [SDK 58 SMS](https://docs.expo.dev/versions/v58.0.0/sdk/sms/).

## Validation and release

- `tests/phone-auth.php`: ownership/purpose/expiry/replay checks, peppered hashing, legacy isolation/linking, reset, revocation and guessing limits.
- `node tests/run-logistics.cjs phone-auth-api customers mobile account-ui`: isolated PHP/mobile integration, CSRF, forged proof rejection, protected phone changes, deletion and legacy regressions.
- `node tests/expo-phone-auth.cjs` with a local Metro web preview: mocked registration, pending/expiry, PIN creation/reset/change, email linking, deletion, return routing and 320/390/430 widths. No provider SMS or real customer account is used.
- `npm run typecheck` and `npm run lint` in `gostoremn`.

Physical Android/iPhone SMS testing is still required; browser fixtures do not establish carrier delivery or provider authorization. Production backend deployment and PIN secret provisioning were explicitly approved by the user on 2026-11-07 after automatic review requested confirmation. Backend activation precedes distribution of the new login UI.

## Production rollout — 2026-11-07

Backend deployment completed after explicit approval. Live checks confirmed verification enabled, invalid PIN login rejected, unverified setup rejected, and private configuration files denied over HTTP. No real SMS or customer account was created during these checks. Backup: `/gostore-backups/phone-pin-1793982908593`.

- iOS 1.0.0 (14): [native build completed](https://expo.dev/accounts/morozkonkts-team/projects/gostoremn/builds/5a921ef3-5159-49db-98ff-41e2d1d82fa6). [Submission 826499c2](https://expo.dev/accounts/morozkonkts-team/projects/gostoremn/submissions/826499c2-b9d2-410a-92cd-26d0a2fb5e44) successfully uploaded the binary to App Store Connect. Apple subsequently rejected processing with 90062/90186 because the approved 1.0.0 train is closed. Build 14 is not available in TestFlight; replacement builds must use 1.0.1 or higher.
- iOS production update published: [group 10faceb1](https://expo.dev/accounts/morozkonkts-team/projects/gostoremn/updates/10faceb1-a6a0-477e-859e-2f3fe4a7f182), runtime `08e7b907d489920fedb909620bc1bc7fc1d222eb`, matching build 14.
- Android 1.0.0 (7): [preview APK build](https://expo.dev/accounts/morozkonkts-team/projects/gostoremn/builds/bea052fb-7f33-4f9b-a332-00911b2d7e5c), runtime `39f08fbc9f739fc3f6796dd5eff2ac03c1d9c6fb`, completed successfully. [Install APK](https://expo.dev/artifacts/eas/4Xq7AoAK_EYYKtDNiBGmsAXVJWbKMGsoUsyc58KTfC8.apk). Matching Android preview update published: [group 533c7707-0f90-480f-afd0-887e72b4c578](https://expo.dev/accounts/morozkonkts-team/projects/gostoremn/updates/533c7707-0f90-480f-afd0-887e72b4c578). This is internal testing, not a Google Play production release.

Install the new native binary once. Then test registration → sending the SMS → returning to the app → creating a PIN → logout/login, plus SMS reset and existing-email linking, on physical devices. Opening the SMS composer is not successful verification.
