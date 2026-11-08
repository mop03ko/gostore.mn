# Incoming parcel barcode lookup

The Erenhot warehouse scanner reads GS order labels, GB batch QR codes, and carrier tracking barcodes. Code 128, Code 39, ITF, Codabar, EAN/UPC and QR are decoded locally with pinned ZXing JS 0.23.0. Camera frames and selected photos are not uploaded. GS/GB continue using the existing order/batch detail routes.

Carrier numbers use GET warehouse-tracking with an exact, case-insensitive match against stored inbound.numbers[].no. Leading zeroes are preserved. The authenticated Erenhot manager can only see orders assigned to their warehouse. Multiple orders on one parcel are displayed for selection; missing numbers never fall back to a partial search or automatically attach a parcel. URLs are rejected. Since 2026-11-08 a carrier number that matches exactly one order also records that parcel as arrived (see [erenhot-workflow.md](erenhot-workflow.md)); scanning never receives, dispatches or batches an order.

TaoWorld purchase polling and domestic logistics refresh populate these numbers. If the supplier has not returned a tracking number yet, the barcode cannot identify the order until it is synced or an operator verifies and adds the number using the existing manual inbound form.

Open the warehouse app again to load the web update, tap 扫描条码 / 二维码, allow camera access, and point at the carrier waybill barcode with both white margins visible. A photo or manual/scanner input is also supported. A product SKU barcode may not be the parcel tracking number.

Validation uses real synthetic Code 128/39 pixels, rotated labels, camera-frame streams, image upload, exact/multiple/missing matches, no receipt mutation, and anonymous/branch/role access checks. Existing QR/label/warehouse workflow tests also pass. A physical manager phone and actual waybill remain the final hardware acceptance check.
