# GOStore staff access and iOS apps

## Web entry points

| URL | Entry behavior |
| --- | --- |
| `https://gostore.mn/warehouse/` | Choose an active warehouse before signing in. |
| `https://gostore.mn/warehouse/erenhot/` | Fixed Erenhot warehouse; Chinese interface. |
| `https://gostore.mn/warehouse/ulaanbaatar/` | Fixed Ulaanbaatar warehouse; Mongolian interface. |
| `https://gostore.mn/warehouse/wh-<12 lowercase hex characters>/` | Fixed additional warehouse created by the administrator. |
| `https://gostore.mn/admin/` | Existing administrator login. |

Admin → Агуулахууд links directly to each warehouse. Existing query links
(`/warehouse/?location=...`) still preselect the warehouse in the general selector.
Inactive or unknown fixed entries cannot submit a login. A browser session signed
into a different warehouse must explicitly sign out before using a fixed entry.
Passwords and access enforcement remain in the existing server authentication.

## Two independent iOS apps

The standalone Expo project is `staff-ios/`. It does not modify the customer app
in `gostoremn/`. Both iOS apps use the existing authenticated website in WKWebView;
server updates appear without rebuilding the native wrapper.

| Profile / APP_VARIANT | App name | Bundle ID |
| --- | --- | --- |
| `admin` | GOStore Admin | `mn.gostore.admin` |
| `warehouse` | GOStore UB Warehouse | `mn.gostore.ubwarehouse` |

Each has its own Expo project ID in `projects.json`, separate iOS cookies and
independent build numbering. The variant must be set explicitly; there is no
default that could accidentally build the wrong app.

Features:

- Admin shortcuts to overview, orders, products and warehouse management.
- Fixed Ulaanbaatar warehouse login, with server-enforced manager permissions.
- Native QR/barcode scanner for GOStore order and batch codes. Scanning only
  looks up a record; receiving, dispatching and payment actions require the
  existing web confirmation steps.
- Camera/photo upload through the web forms and native iOS print sheet for labels.
- Persistent sessions, refresh confirmation, connectivity errors and an app
  switcher privacy cover.
- Navigation is restricted to the intended GOStore panel. External links open
  outside the WebView. The message bridge never exports passwords or cookies.

The in-panel notification list works while the app is open. **Native iOS/APNs
background push is not implemented in this release.** The existing Android and
browser push integrations remain independent.

## Validation

From the repository root:

```powershell
node tests/run-logistics.cjs warehouse-entry-ui warehouse-session warehouse-barcode-ui warehouse-notifications-ui
node tests/staff-ios-bridge.cjs
cd staff-ios
npm ci
npm run typecheck
npm test
$env:APP_VARIANT='admin'
npx expo export --platform ios --output-dir dist/admin
$env:APP_VARIANT='warehouse'
npx expo export --platform ios --output-dir dist/warehouse
```

The broader pre-existing `logistics-ui` suite currently reaches label printing
and warehouse receiving but fails at its final settlement fixture with
“Өмнө төлсөн дүнгээс бага байна” (settlement below amount already paid). This change
does not alter settlement or tariff logic. Do not bypass that server validation.

On 2026-11-07, both native iOS simulator builds completed successfully:

- [GOStore Admin build](https://expo.dev/accounts/morozkonkts-team/projects/gostore-admin/builds/7411457b-d831-466e-a8d4-1a4cbd8e799d)
- [GOStore UB Warehouse build](https://expo.dev/accounts/morozkonkts-team/projects/gostore-ub-warehouse/builds/9383c3e2-d3c8-4f27-8b43-269613009c1b)

The simulator builds are not installable through TestFlight. Separate signed
App Store builds completed on 2026-11-07:

| App | Version (build) | App Store Connect | EAS store build |
| --- | --- | --- | --- |
| Admin | 1.0.0 (3) | `6831708168` | `18fc5dcc-fff8-47cd-9d28-1b1a0c88be0e` |
| UB Warehouse | 1.0.0 (2) | `6831710242` | `9333d34c-2c70-4f4a-91f7-0d43dc33addc` |

Both uploads and Apple processing completed successfully. Submission IDs are
`c5e27fdb-642d-4752-b3d6-e831b29db9fa` (Admin) and
`afb0dd1f-813f-4114-84a0-b28265c53db9` (Warehouse), both `FINISHED`. Apple returned
`VALID` for both builds, with no upload errors or warnings. Minimum iOS is 16.4.

- [Admin TestFlight](https://appstoreconnect.apple.com/apps/6831708168/testflight/ios):
  build `1dcc54e0-fcaf-43f9-89aa-c1048938fa47` is `IN_BETA_TESTING`, assigned to
  the private **GOStore Admin Team** group. The owner-specified Admin tester is
  `INVITED`. Installation on a physical device has not yet been verified.
- [Warehouse TestFlight](https://appstoreconnect.apple.com/apps/6831710242/testflight/ios):
  build `625af063-586c-4f82-85a9-058ce4587282` is assigned to the private
  **Ulaanbaatar Warehouse Managers** external group. Beta review submission
  succeeded and is `WAITING_FOR_REVIEW` / `WAITING_FOR_BETA_REVIEW`. Its specified
  tester remains `NOT_INVITED` pending review. Automatic tester notification is
  enabled; the build is not yet installable by the external tester.

The owner approved the Arvis Trans business contact and demo instructions saved
in Apple's review fields. No App Store publication was requested or performed.

## Isolated warehouse demo

The Ulaanbaatar login offers **Демо үзэх / Try demo**, opening
`https://gostore.mn/warehouse/ulaanbaatar/?demo=1`. The native wrapper already
allows this same-path URL; no binary change is needed. The demo renders the
same warehouse UI with clearly labelled synthetic orders. It never loads the
server bootstrap, database or authentication session. A separate PHP response
sets `connect-src 'none'`, `worker-src 'none'` and `form-action 'none'`. The demo
fetch implementation handles sample operations in page memory and never calls
the original fetch. Push registration is omitted entirely.

Use batch `GB-DEMO01` and its order `GS-DEMO03`: add a receipt photo, scan/reconcile
the order, receive the batch, then sort for pickup or delivery. The demo pickup
code is `12345678`. Photos use in-memory blob URLs; all changes disappear on
reload. No real payment is initiated. Unsupported actions return a clear demo
error. Exiting the demo returns to the real login without changing its session.

`node tests/run-logistics.cjs warehouse-demo-ui warehouse-entry-ui` verifies the
receipt/sort/completion flow, reset behavior, no production API traffic, CSP
blocking of independent XHR, and normal warehouse entry behavior. A separate
read-only live check verified six sample orders, batch lookup and zero API
requests in a fresh mobile-sized browser.
The warehouse photo authorization and barcode UI regression suites also passed.
Live deployment backup: `/gostore-backups/staff-demo-20261107-8e3bc88dce`.

Before accepting a device build, check on an iPhone: correct app identity, login,
session restoration and logout; QR scanning; camera and library upload including
permission denial; a print preview; external links; offline recovery; and switching
apps while sensitive content is open. A JavaScript export or simulator build alone
does not establish that these real-device behaviors have passed.

## Build and TestFlight

Both bundle IDs and App Store provisioning profiles are registered. EAS holds
the existing distribution certificate and App Store Connect API key used for
these projects. No secret belongs in this repository. Interactive Apple login
may be required if those remote credentials expire or need replacement.

```powershell
# From the repository root, in an interactive terminal:
powershell -ExecutionPolicy Bypass -File .\staff-ios\build-ios.ps1 -Variant admin
powershell -ExecutionPolicy Bypass -File .\staff-ios\build-ios.ps1 -Variant warehouse
```

The script pins EAS CLI, sets APP_VARIANT, EAS_NO_VCS and an absolute
EAS_PROJECT_ROOT so the upload contains only `staff-ios/`. `.easignore` excludes dependencies, exports, credentials and
private environment files. Store builds require Apple signing; simulator builds
use `admin-simulator` / `warehouse-simulator` and cannot be installed with TestFlight.

The separate App Store Connect IDs are pinned in the `eas.json` submit profiles
(`ios.ascAppId`). Do not use the customer application's ASC app ID or signing profile.

Submit a specific successful store build ID to prevent selecting a simulator or
another variant by accident:

```powershell
cd staff-ios
$env:APP_VARIANT='admin' # use warehouse for the other app
$env:EAS_NO_VCS='1'
$env:EAS_PROJECT_ROOT=(Get-Location).Path
npx eas-cli@27.5.0 submit --platform ios --profile admin --id <ADMIN_STORE_BUILD_ID>
```

Use profile `warehouse` and its build ID for the warehouse app. Wait for Apple
processing, resolve any export-compliance prompts, and add the build to the
intended TestFlight tester group. External testing may require Apple's beta
review. Submission does not publish an app in the App Store, and does not by
itself prove that a tester can install it.
