# Warehouse freight method

Erenhot receipt and remeasurement require an explicit UI selection: `按重量 · kg` (weight) or `按体积 · m³` (volume). Both physical measurements remain required. The preview shows the selected formula before receipt/freight approval; a saved explicit method is preselected on remeasurement.

The existing tariff is unchanged. Weight uses started 0.5 kg steps of 1,000 MNT below 70 kg, and 1,300 CNY/tonne at or above 70 kg, irrespective of volume. Volume uses 390 CNY/m³ irrespective of weight. CNY uses the order's retained rate. Only the selected method is billed; it is not replaced by the higher of the two calculations.

The server recalculates and persists the method, tariff, measurements and amount. Ulaanbaatar settlement carries this approved amount forward. Each split consignment can have its own method. Existing invoices are not repriced. Legacy clients that omit a method preserve an existing selected method, or use the previous automatic calculation for new measurements.

Validation: `node tests/cargo-tariff.cjs` and `node tests/run-logistics.cjs warehouse-split warehouse-split-ui warehouse-flow warehouse-ub-flow`. Covers browser/PHP price parity, independent methods per split part, invalid methods, Erenhot approval through UB settlement and payment, Chinese selection and live preview, and existing warehouse flows. No real orders are changed in tests.

Deployed 2026-11-18: 10 files backed up and uploaded over verified TLS, remote hashes/public assets verified, anonymous warehouse access still denied. Backup: `/gostore-backups/freight-method-20261118-c5efa608`. Existing live stylesheet version retained. The warehouse WebView receives this through refresh; no native build is required.
