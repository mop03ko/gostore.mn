# GOStore UB Warehouse public App Store release

The owner requested public App Store distribution on 2026-11-15 (Ulaanbaatar time). This applies to the Ulaanbaatar staff app, not the customer or administrator app.

- App Store ID: `6831710242`; bundle: `mn.gostore.ubwarehouse`.
- Version: **1.0.0 (2)**. App Store version ID: `b67654dc-ac12-4783-b1c3-807a48cc6ba1`.
- Existing valid build: `625af063-586c-4f82-85a9-058ce4587282`; TestFlight beta review is approved.
- Distribution territory: Mongolia; price: free. Production data remains restricted to authorized warehouse managers. Public users can try the isolated demo without credentials.
- Release policy: `AFTER_APPROVAL`. The previous unlisted-distribution request in review notes was replaced with a public-distribution request. Existing contact information and demo instructions were preserved.

## Review preparation

The existing Mongolian/English description, business category, age rating, privacy information and iPhone screenshots were checked. The support and staff privacy URLs both return HTTP 200. Apple submission validation identified the missing 13-inch iPad screenshot as the remaining requirement.

The native screenshot workflow uses the existing EAS simulator build `9383c3e2-d3c8-4f27-8b43-269613009c1b`, archive SHA-256 `004e06d70fd5629d83af3e16ecd745ba027675581b8224e54f9e5f94d08b5621`. It runs an actual iPad simulator and opens the public demo through the app. No signing credentials, staff login, production order or payment is used.

Visual inspection found that the demo banner inherited the shared admin sidebar's sticky full-viewport height because it used an `aside` element. Commit `08c0014` changes this status section to a `section`, leaving the real warehouse interface and authentication unchanged. The isolated regression passed photo upload, batch scan/receipt, sorting, handover, reset, network isolation, and compact banner checks at 390 and 1032 CSS pixels.

Only `warehouse/review-demo.js` was deployed after baseline comparison, remote backup and published hash verification. Backup: `/gostore-backups/warehouse-demo-layout-20261115-0ca509394e`. Live checks verified six synthetic orders and no production API calls; the iPad-sized viewport shows a 178px banner and the warehouse overview within the first screen.

## Submission status

Submitted to Apple App Review at **2026-11-15 01:44:03 Ulaanbaatar time** (`2026-11-14T17:44:03.131Z`). Both the version and review submission were independently read back as **`WAITING_FOR_REVIEW`**. The app is not yet publicly released; approval is still pending.

- Review submission: `f5479858-7c07-4ad3-8782-0995f981f7fa`.
- Native iPad screenshot capture: [GitHub Actions run 43621675318](https://github.com/mop03ko/gostore.mn/actions/runs/43621675318). The final 2064 × 2752 image was visually inspected before upload and shows the compact demo notice, warehouse counts and scan controls.
- iPad screenshot ID: `b6800019-733a-8022-8032-53b26db3b252`; delivery state: `COMPLETE`.
- Both existing iPhone screenshots were also visually inspected and remain `COMPLETE`. All screenshots use synthetic demo data.
- Post-submission verification confirmed version **1.0.0**, build **2** (`VALID`), release policy `AFTER_APPROVAL`, and only `MNG` enabled for availability.

The submission and screenshots used the existing App Store Connect authorization. No new signing credentials or GitHub secrets were created for this public-release task.
