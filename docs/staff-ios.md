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

Before accepting a device build, check on an iPhone: correct app identity, login,
session restoration and logout; QR scanning; camera and library upload including
permission denial; a print preview; external links; offline recovery; and switching
apps while sensitive content is open. A JavaScript export or simulator build alone
does not establish that these real-device behaviors have passed.

## Build and TestFlight

The Apple Developer account must be authenticated for the initial provisioning
of each new bundle ID. Enter Apple credentials only into the local EAS terminal
prompt, never into source files or chat.

```powershell
# From the repository root, in an interactive terminal:
powershell -ExecutionPolicy Bypass -File .\staff-ios\build-ios.ps1 -Variant admin
powershell -ExecutionPolicy Bypass -File .\staff-ios\build-ios.ps1 -Variant warehouse
```

The script pins EAS CLI, sets APP_VARIANT, EAS_NO_VCS and an absolute
EAS_PROJECT_ROOT so the upload contains only `staff-ios/`. `.easignore` excludes dependencies, exports, credentials and
private environment files. Store builds require Apple signing; simulator builds
use `admin-simulator` / `warehouse-simulator` and cannot be installed with TestFlight.

Create a separate App Store Connect record for each exact bundle ID, then record
each ASC app ID in the corresponding `eas.json` submit profile (`ios.ascAppId`).
Do not use the customer application's ASC app ID or signing profile.

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
