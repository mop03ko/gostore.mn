# Incoming parcel barcode lookup

The Erenhot warehouse scanner reads GS order labels, GB batch QR codes, and carrier tracking barcodes. Code 128, Code 39, ITF, Codabar, EAN/UPC and QR are decoded locally with pinned ZXing JS 0.23.0. Camera frames and selected photos are not uploaded. GS/GB continue using the existing order/batch detail routes.

Carrier numbers use GET warehouse-tracking with an exact, case-insensitive match against stored inbound.numbers[].no. Leading zeroes are preserved. The authenticated Erenhot manager can only see orders assigned to their warehouse. Multiple orders on one parcel are displayed for selection; missing numbers never fall back to a partial search or automatically attach a parcel. URLs are rejected. Since 2026-11-08 a carrier number that matches exactly one order also records that parcel as arrived (see [erenhot-workflow.md](erenhot-workflow.md)); scanning never receives or dispatches an order. Since 2026-11-09 the "扫码出库" window (scanner gun or phone camera, which then stays open for the next parcel) adds each scanned carrier number or GS label to a list kept on the device; only "确认打包" creates the GB batch (warehouse-outbound-pack), after the server checks every order is received, freight-approved, issue-free and has all its known carrier numbers scanned. A draft batch also accepts a carrier number in place of the GS label when checking its orders.

TaoWorld purchase polling and domestic logistics refresh populate these numbers. If the supplier has not returned a tracking number yet, the barcode cannot identify the order until it is synced or an operator verifies and adds the number using the existing manual inbound form.

Open the warehouse app again to load the web update, tap 扫描条码 / 二维码, allow camera access, and point at the carrier waybill barcode with both white margins visible. A photo or manual/scanner input is also supported. A product SKU barcode may not be the parcel tracking number.

Validation uses real synthetic Code 128/39 pixels, rotated labels, camera-frame streams, image upload, exact/multiple/missing matches, no receipt mutation, and anonymous/branch/role access checks. Existing QR/label/warehouse workflow tests also pass. A physical manager phone and actual waybill remain the final hardware acceptance check.

## Native scanner update — 2026-11-15

Android warehouse 1.3.0 (4) uses CameraX 1.4.2 with bundled ML Kit barcode scanning
17.3.0. The model is included in the APK rather than fetched on first scan.
Preview uses the rear camera, 1280×720 analysis with KEEP_ONLY_LATEST, tap focus,
torch, device-limited zoom up to 4x and auto-zoom suggestions. Managers can switch
QR-only/carrier formats. A recognized label is outlined and produces a short
notification-stream tone and haptic. The closest decoded code to the image centre
is processed first. Arbitrary URLs, executable and oversized payloads are rejected.

iOS warehouse 1.0.1 uses the existing native Expo camera with autofocus, torch,
manual zoom, QR-only/QR+barcode choice, a bundled 140ms tone and vibration. System
silent mode remains respected. Web scan buttons now invoke the native camera;
the separate app toolbar scan retains its order/batch lookup behavior.

Both native integrations feed the existing `acceptBatchQr` business flow. Batch
windows keep scanning without dismissing the camera. Repeated frames are suppressed
for 3 seconds; one operation is awaited at a time. Session IDs prevent delayed
results from controlling a newly opened scanner. Camera/torch are released on close
or background. Web camera/photo fallback remains available, including in older apps.
No receipt/dispatch permissions or confirmation rules were changed.

Checks: warehouse barcode UI with native bridge simulation, consecutive/duplicate
codes, invalid QR payloads, late callback after close, existing photo/camera cleanup
and branch isolation; Android navigation/unit/lint/signing; iOS TypeScript,
navigation tests and production JS bundle export. No physical phone camera was
connected: poor-light, glare, crumpled/small-label recognition speed and real autofocus
must still be compared on the managers' devices. We do not claim WeChat-equivalent
recognition based on automated tests.
