# Partial shipment from Erenhot

The Erenhot order detail has **拆分已到货部分**. Choose courier parcels or item quantities, check the selected and remaining quantities, and enter a reason. Only arrived waybills may be selected in parcel mode. Item mode supports opening one courier box and dividing its contents; the manager confirms the physical quantities.

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
