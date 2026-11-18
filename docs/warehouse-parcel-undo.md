# Erenhot parcel arrival correction

2026-11-18. In the Erenhot order details, each arrived courier parcel has a
`撤销到件` (undo arrival) button. A separate confirmation form names the order and
waybill and requires a reason; cancelling makes no change. After success, the
parcel becomes not arrived, counts and receipt controls refresh, and the same
parcel can be scanned in again. Both the browser and warehouse Android WebView
use this panel; no native build is required.

`warehouse-parcel-undo` is authenticated, CSRF-protected and limited to the
assigned Erenhot warehouse. It requires a current logistics version, explicit
confirmation, a known waybill and an existing arrival. A transaction checks these
conditions before writing. Draft/packed/dispatched batches, finalized settlement
and freight invoices prevent undo. Other warehouses and UB cannot use it.

This corrects a parcel scan, not the entire order receipt. Order status, photos,
measurements and other parcels are retained. For an already received order,
undo opens a missing-parcel issue and clears freight approval. Re-scanning all
missing parcels resolves the automatic shortfall; the manager must recheck the
measurement and approve freight before packing. An audit event retains the prior
arrival, reason, actor email, warehouse and time. Old/repeated undo requests cannot
remove a subsequent new scan.

Validation: PHP syntax, JavaScript syntax, `warehouse-parcel-undo.php`,
`node tests/run-logistics.cjs warehouse-flow warehouse-flow-ui`. Covers role and
warehouse isolation, stale versions, repeated undo, unknown/unarrived waybills,
audit retention, receipt/freight correction, packing/billing guards and the actual
Chinese confirmation/cancel/re-scan flow with isolated test orders. No real
customer parcel was changed during validation.
