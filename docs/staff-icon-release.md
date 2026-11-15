# Staff icon release — 2026-11-15

The consumer GOStore icon is unchanged. Admin uses the purple shield icon;
UB and Erlian warehouses share the teal warehouse icon.

## Android

Erlian Warehouse 1.3.1 (versionCode 5), package mn.gostore.warehouse, is built
and published at https://gostore.mn/downloads/warehouse-1.3.1/GOStore-Erenhot-1.3.1.apk.
The corresponding .sha256 and INSTALL.txt are in the same directory.

SHA256: d8a1733d6e945b7ba0f38e5bee2925e46717c1f25fd9fa3c4802575f0b2bd3da

Navigation checks, 14 unit tests, release lint, APK signature verification and
zip alignment passed. The previous 1.3.0 and new 1.3.1 signing certificate hashes
match. All three public downloads were fetched and verified byte-for-byte.
No Android phone was connected; installation and camera testing on testers'
physical devices remain unverified. Install the APK over the existing app.

## iOS

Staff typecheck and all five tests passed. EAS rejected the Admin build after
reserving build number 4 because the monthly free iOS build quota is exhausted.
No new EAS build was created. Use a fresh number when starting another attempt.

The Staff iOS TestFlight workflow uses the standard xcode-27 runner in the existing
public repository. It accepts an explicit admin/warehouse variant and verifies
the matching bundle ID, App Store signing profile, version and build number.
It has a 30-minute timeout and removes temporary keychain/profile material.
It uploads to TestFlight only, not App Review or public distribution.

The transfer of signing credentials to temporary GitHub encrypted secrets is
awaiting explicit owner approval after automatic approval review required it.
New icon builds have not yet been uploaded to TestFlight.
