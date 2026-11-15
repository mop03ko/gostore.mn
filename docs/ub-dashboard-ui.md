# UB warehouse workspace refresh — 2026-11-15

The Ulaanbaatar-role warehouse panel now groups receipt, sorting, counter handover and courier dispatch in a single workbench. Receipt focuses the existing barcode field; sorting opens the existing pending-sort filter. Handover and dispatch retain their original buttons and handlers.

The scanner sits directly below the workbench. Overview cards, waiting counters, search filters, order rows and dialogs use a compact responsive layout in GOStore orange and navy. Phone controls retain at least 44px touch targets. The sticky dialog heading keeps the close action available on long forms.

`warehouse/ub-dashboard.js` observes the existing role visibility and authenticated app visibility. It restores moved controls when leaving the UB role, and does not call an API, change permissions or change order states. Styles are scoped to `body.ub-dashboard` and screen media, preserving Erenhot and label printing.

## Verification

- `node --check warehouse/ub-dashboard.js`
- `node tests/run-logistics.cjs warehouse-demo-ui warehouse-ub-ui`
- Demo coverage checks role switching, 320/390/768/1032/1440px overflow, touch targets, scan focus, pending-sort shortcut, photo/batch/sort/handover flow and network isolation.
- UB integration coverage passes partial receipt, continuous QR scan, locked billing, sorting, pickup codes, courier dispatch and print, plus 320–1440px dialog fit.
- Desktop and phone screenshots inspected in `output/warehouse-dashboard/` (ignored artifacts).

## Deployment

Published only `warehouse/ub-dashboard.css`, `warehouse/ub-dashboard.js` and `warehouse/index.html` via FTPS after matching the live HTML baseline. Assets were published before the HTML. Backup: `/gostore-backups/ub-dashboard-20261115-a664945b78`. Remote hashes matched all three local files.

Live demo checks passed at 390/1032/1440px, including the sorting shortcut and handover dialog, with no JavaScript errors or production API calls. Staff apps loading this web panel receive the change on reload; a new native build was not produced for this UI update.
