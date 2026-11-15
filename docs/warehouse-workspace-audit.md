# Warehouse workflow and usability audit — 2026-11-15

Both staff apps load the warehouse web panel. This release updates that panel without changing native app versions, pricing, permissions, order transitions or print-label dimensions.

## Changes

- Erenhot has a Chinese workbench for receipt, packing, dispatch confirmation and arrival alerts. It moves the existing packing button and invokes the existing filters/scanner. Dispatch still requires explicit confirmation after the batch physically leaves the warehouse.
- Both roles have a phone dock for the workbench, orders, QR/barcode scanner and batches. The scanner uses the existing native bridge when available. The dock is hidden while a dialog is open.
- Compact GoStore orange/navy layouts, readable forms, at least 44px primary touch targets, sticky dialog headings, clearer shelf labels and responsive controls at 320–1440px.
- The list shows loading/error/filter feedback, a retry button and a single reset for query, status and month. An offline banner asks managers to refresh and check state after reconnecting; no mutation is queued or replayed automatically.
- Fixed failed list refreshes retaining unrelated rows under a new filter heading. Loading rows are inert; a failed request clears rows and pagination rather than presenting stale results.
- Logout clears transient toast messages so the next manager does not see the previous manager's feedback.
- Retained and verified the existing workspace initialization fix: deferred UI modules register before the first session response renders cards.

## Verification

Isolated local databases, supplier network and QPay disabled:

```powershell
node tests/run-logistics.cjs warehouse-flow-ui warehouse-ub-ui warehouse-ub-flow warehouse-cargo warehouse-session warehouse-managers
node tests/run-logistics.cjs warehouse-demo-ui warehouse-flow-ui warehouse-ub-ui warehouse-barcode-ui warehouse-workspace-ui
node --test staff-ios/tests/navigation.test.cjs
```

Coverage includes Erenhot arrival alerts, domestic parcel matching, partial receipt, photos, weight/volume pricing, packing and manual dispatch; UB partial batch receipt, missing-item issues, sorting, billing locks, payment guards, one-time pickup codes, multi-order handover, courier dispatch and print, refund/role guards; session persistence/revocation and multiple managers; native scanner bridge, real barcode image decoding, camera cleanup; mobile layout, failed-load recovery, filter clearing, offline feedback and role switching.

Android `testReleaseUnitTest` and `lintRelease` passed: 14 unit tests, 0 lint errors, 20 existing warnings. iOS navigation/scanner policy tests passed (5 tests). Layout screenshots were inspected in `output/warehouse-workspace/` (ignored).

Limits: no physical Android/iPhone camera, printer or background push-delivery test was performed. These checks do not establish performance under Erenhot's real network conditions. Native signing/build/publication and separate in-progress push changes are outside this web UI release.

## Deployment

Published `workspace.css`, `workspace.js`, `warehouse.js`, then `index.html` via FTPS with verified backups and byte-for-byte checks. The existing live initialization fix matched the reviewed local change and was preserved. Backup: `/gostore-backups/warehouse-workspace-20261115-b59b9f20f0`.

Public asset hashes match local files. The live isolated demo passed both role layouts, sorting/reset shortcuts and 320–1440px overflow checks with no JavaScript errors and no production API requests. Existing staff apps receive this update when their web panel reloads; no new APK or TestFlight build is needed for these changes.
