# Partial shipment from Erenhot

The Erenhot order detail has **拆分已到货部分**. Choose courier parcels or item quantities, check the selected and remaining quantities, and enter a reason. Only arrived waybills may be selected in parcel mode. Item mode supports opening one courier box and dividing its contents; the manager confirms the physical quantities.

Arrived courier rows also have **单独拆分** (split this waybill separately). This opens a confirmation with exactly that code selected and locked. Repeat from the original remainder to create one GS portion per arrived waybill, then photograph, measure, approve freight and pack each portion into its own GB batch. The linked-parts list displays the waybills alongside their GS codes. Missing parcels have no split action. When one parcel remains, receive and pack it under the original GS code instead of creating an empty remainder.

The three-arrived/one-missing case is covered by API tests through three separate GB dispatches, and by the Chinese mobile UI test through all three single-code splits. The missing waybill remains on the original order and cannot be packed. These controls use the existing split transaction and authorization checks; no real order was split during deployment.

Single-waybill controls were deployed on 2026-11-18 with verified file hashes and versioned asset URLs. Backup: `/gostore-backups/waybill-split-20261118-0eab8eae`. Existing warehouse apps receive the controls on refresh; no native build is needed. The split API/UI and complete Erenhot receipt/scan-out UI suites pass.

The original GS record retains the purchase, original items, goods payment and remaining shipment. Each extracted portion gets a new GS transport-only record with the same owner and warehouse assignments. Original commercial items are not reduced; `shipping_items` is the remaining operational inventory. Parcel mode measures boxes rather than pretending one box equals one product. The UB overview retains original purchase totals and reports split boxes separately.

Print the new GS QR/barcode label, photograph and measure each portion, then approve its freight. Both the extracted part and remainder require fresh receipt photos and measurements. Earlier measurements/photos remain in the original audit. The normal scan-out, GB dispatch, UB receipt/sorting and pickup flows operate independently per GS portion. Item portions use GS labels; parcel portions also resolve through their assigned waybills. The provider's full tracking remains on the original purchase, with extracted waybills excluded from the remainder's operational lookup.

Customers and administrators can open linked parts from the original order. The customer app also has a parts list. The original customer's overall status cannot become completed until all portions complete. Each portion has its own photos, freight invoice and pickup code. Goods, domestic shipping and purchase-service charges remain exclusively on the original order; manual settlement cannot add these charges to an extracted part. Notifications identify the affected part.

## Restrictions and safeguards

- Only the assigned Erenhot manager can split an order before packing/final settlement. Existing damage or other non-receipt issues must be resolved first.
- Both portions must be nonempty. A purchase retains its first splitting mode. Continue splitting from the original remainder, up to 40 extracted parts; extracted parts cannot be split again.
- Version/status checks and a transactional request token prevent stale or repeated extraction. Financial and provider purchase fields are never copied.
- Root-token guest access and customer ownership cover the complete family. Claiming a guest root also claims its existing parts. A different customer or warehouse cannot access/mutate them.
- Splitting does not dispatch anything. The manager must still photograph, weigh, approve freight, pack and explicitly confirm dispatch.
- Already packed, invoiced or handed-over portions cannot be repartitioned. Automatic cancellation is not supported for split families.

## Validation

`node tests/run-logistics.cjs warehouse-split warehouse-split-ui`

Tests cover both modes, quantity conservation, duplicate retries, stale writes, roles/ownership, courier lookup, QR printing, phone layouts, independent Erenhot dispatch and UB receipt, freight-only billing, original payment conservation, pickup and family completion. Existing warehouse-flow, warehouse-ub-flow, warehouse-batches and logistics suites also pass. Native lint and TypeScript checks pass.

## Release: 2026-11-18

Source commit `7805a3f9` was pushed to main. Production deployment updated 23 files, verified remote hashes and public assets, and confirmed anonymous warehouse access returns 401. Backup: `/gostore-backups/shipment-split-20261118-5df5a39b`. Existing live differences in API checkout expiry, standalone cargo and stylesheet/index content were retained while applying this feature.

Customer OTA updates were published and their served launch-asset SHA-256 hashes matched the validated local export:

| Platform/channel | Update ID | Runtime |
| --- | --- | --- |
| iOS production | `01a1ee08-96a0-73c9-be88-f4cc6ecc7ca0` | `646e611a39796fd0c8cb87ef08a4ea35cc51abba` |
| Android production | `01a1ee08-bf0b-7f98-81d0-f15a9a2f48bd` | `12e475e0cbbc9ab91d7ecfa01d472e04d133f2a1` |
| Android preview APK | `01a1ee08-beb3-71bc-8e34-d0de7a67722d` | `12e475e0cbbc9ab91d7ecfa01d472e04d133f2a1` |

iOS uses the verified native configuration of public 1.0.2 (20). No new native binary is required. Validation used isolated fixtures; real customer orders were not mutated and physical-device acceptance remains to be checked by warehouse staff.
