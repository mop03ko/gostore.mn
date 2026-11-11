# Independently purchased cargo

Customers buy from their chosen Chinese seller and use GOStore for forwarding to Ulaanbaatar. This does not create a TaoWorld/OT purchase or collect the seller's goods payment.

## Customer flow

- Web: `/self-cargo.html`, linked from the home page, account page and footer.
- Expo app: Account → Өөрөө захиалах · Эрээн карго (`/self-cargo`). The native screen requires an app/OTA release; deploying PHP does not update installed apps.
- Authenticated customers enter the goods description, total item count, phone and optional variant/note. Registration returns a short GS code and a Chinese shipping label using the configured Erenhot warehouse address/phone. The GS code is included in the receiver name.
- Customers pay the seller and Chinese domestic shipping themselves, then add the courier waybill(s). One registration represents one whole order; up to 20 waybills can belong to it.
- The existing order detail shows warehouse photos, measurements, status history and freight payment. Goods amount starts at zero, `paid=false`, `type=forwarding`. It is excluded from supplier auto-purchase.

## Warehouse flow

Registration creates notifications for Erenhot and Ulaanbaatar. Both can see the order; Ulaanbaatar is read-only before arrival. A waybill scan finds the order. Erenhot checks in parcels, photographs and measures the goods, approves freight and packs/dispatches a QR batch using the existing workflow. Ulaanbaatar scans/receives the batch, photographs and sorts individual orders. Sorting a forwarding order creates a bill with zero goods, domestic shipping and purchasing-service costs, plus approved cargo and optional Ulaanbaatar delivery. Payment and handover use the existing freight invoice/collection-code controls.

## API and safeguards

- GET `customer-self-cargo`: own forwarding orders (most recent 100), public warehouse contact fields.
- POST `customer-self-cargo-create`: `request_key`, `title`, integer `qty`, `phone`, optional `note`, `number`, `company`.
- POST `customer-self-cargo-tracking`: `id`, `number`, optional `company`.
- Available through both web and token-only mobile API. Authentication and CSRF are required for writes. Idempotency is scoped to the customer, transactions serialize registration, waybills cannot be claimed across orders, and customer additions stop after warehouse receipt.
- No API key, supplier purchase operation, account sharing or public access token is exposed. Address is snapshotted when the order is registered.
- The supplied WeChat contact QR is not included pending the user's decision on its audience.

## Validation

`node tests/run-logistics.cjs self-cargo self-cargo-ui warehouse-ub-flow`

The isolated tests cover web/mobile auth, ownership, CSRF, invalid input, idempotency, duplicate waybills, both warehouse notifications, scan lookup, receipt photos/measurement, batch dispatch/receipt, transport-only final billing, customer notifications and responsive browser registration. They do not send real supplier orders or QPay payments. Run Expo `npm run typecheck` and `npm run lint` after refreshing generated Router types for the new screen.

## Deployment

Deploy `server/self-cargo.php` before `server/customers.php`, then `server/warehouse-ub.php` and `api/mobile.php`. Deploy the three root `self-cargo.*` files and append the standalone script to `index.html`. Back up and compare live files first; preserve unrelated working-tree changes to the storefront bundle/index. No database migration is required. The existing warehouse address/phone settings remain authoritative.
