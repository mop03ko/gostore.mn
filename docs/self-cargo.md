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
- The owner authorized public display of Orgil's WeChat contact QR on 2026-11-12. The original, unmodified JPEG is available on the self-cargo page and bundled in the native app, with a full-size link for saving. It is visible before login too. It is a contact code, not a shipment/batch tracking code.

## Validation

`node tests/run-logistics.cjs self-cargo self-cargo-ui warehouse-ub-flow`

The isolated tests cover web/mobile auth, ownership, CSRF, invalid input, idempotency, duplicate waybills, both warehouse notifications, scan lookup, receipt photos/measurement, batch dispatch/receipt, transport-only final billing, customer notifications and responsive browser registration. They do not send real supplier orders or QPay payments. Run Expo `npm run typecheck` and `npm run lint` after refreshing generated Router types for the new screen.

## Deployment

Deploy `server/self-cargo.php` before `server/customers.php`, then `server/warehouse-ub.php` and `api/mobile.php`. Deploy the three root `self-cargo.*` files and append the standalone script to `index.html`. Back up and compare live files first; preserve unrelated working-tree changes to the storefront bundle/index. No database migration is required. The existing warehouse address/phone settings remain authoritative.

## Released 2026-11-12

- Implementation commit: `f35e1e4` (rebased onto the current main; pre-existing storefront work remains uncommitted).
- Web/PHP deployed with baseline checks, backups and published hash verification. Live `index.html` was patched with only the standalone entry script, preserving its other content. Backup: `/gostore-backups/self-cargo-1794414437550`.
- Live `/self-cargo.html`, JS and CSS return 200. Both web and mobile self-cargo APIs reject unauthenticated access with 401. No real customer/supplier order or bank payment was created for testing.
- Isolated API, browser (360/390/1280 px) and existing Ulaanbaatar warehouse regression tests passed, as did Expo typecheck/lint and the storefront bundle consistency check after rebase.
- Production iOS OTA: `dc73f567-2a30-4116-985d-f9d12223fa3a`, runtime `52bd47e7637e521598a2f3e4d25ae1bccdf63bbd`.
- Production Android OTA: `88ab90d0-5e2b-4f3e-90e2-fc7b308464cd`, runtime `7bb34ca75e224d3e958e2ee55510338e0effe0ad`.
- Android preview OTA (same bundle): `40d5a7d5-c14b-4246-b2e2-55def041e256`.
- Native runtimes match the previously published apps. No new native build was created. Publishing was verified in EAS; receipt on a physical customer's device has not been observed.

## Public WeChat contact — 2026-11-12

- User explicitly approved public display of Orgil's supplied contact QR. Implementation: `4b6b76c`.
- Web contact panel is available before login, with full-size and download links. App account navigation opens the self-cargo screen before authentication; only shipment registration still requires login.
- Original JPEG bytes are preserved in both web and bundled app assets. Web image stays on a white background and retains its full proportions; the native image uses `contain`, including in dark mode.
- Deployed `assets/erenhot-wechat-orgil.jpg`, `self-cargo.css` and `self-cargo.html`. Backup: `/gostore-backups/wechat-contact-1794415742446`. Live image returns 200 and matches the original file byte-for-byte.
- Existing self-cargo browser regression, public panel/image/download checks, mobile overflow check and Expo typecheck/lint passed. WeChat recognition on a physical phone has not been tested.
- Published OTA groups: production iOS `503c0960-f182-42e3-96ca-81c52969b2df`, production Android `bb182098-18b0-4ce0-a45c-255072ecc1b0`, preview Android `7eca29f6-8630-4f48-9981-fabcda7f9e2c`. Native runtime hashes remain unchanged; no new build.
