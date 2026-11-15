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

The owner explicitly approved temporary encrypted GitHub Secrets for signing.
Both workflows completed successfully, including IPA identity verification, upload
and signing-material cleanup. Both temporary GitHub Secrets were deleted afterward.
EAS remote build numbers were advanced to 5 for both projects to avoid reuse.

- Admin 1.0.0 (5): VALID / IN_BETA_TESTING, assigned to GOStore Admin Team.
  Apple build ID: 7157c47f-68b9-478d-851d-e4d5b8378c7c.
  Run: https://github.com/mop03ko/gostore.mn/actions/runs/43712137606
- UB Warehouse 1.0.1 (5): VALID / internal IN_BETA_TESTING, assigned to
  Ulaanbaatar Warehouse Managers, automatic tester notification enabled.
  Apple build ID: e616cb1a-994a-4fcf-b748-006412e31ffe.
  Run: https://github.com/mop03ko/gostore.mn/actions/runs/43712140424

External beta submission for warehouse build 5 was rejected with
ENTITY_UNPROCESSABLE.ANOTHER_BUILD_IN_REVIEW because warehouse build 4 is already
WAITING_FOR_BETA_REVIEW in the same 1.0.1 train. Build 5 remains
READY_FOR_BETA_SUBMISSION for external testing. It must be submitted after the
earlier review completes or is withdrawn. The previous submission was not changed.
Computer Use could not confidently determine the browser URL and stopped, so
no App Store Connect UI mutation was performed. No physical-device update was
verified. No public App Store review/release was changed by this task.
