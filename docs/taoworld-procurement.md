# TaoWorld procurement

Implemented 2026-10-30. Customer payment, supplier order creation, supplier payment and physical warehouse receipt are independent states. Both the storefront catalog and procurement use the directly authorized TaoWorld buyer; native order lines use the stored provider-issued `mi_id`.

## Operation

1. Connect the purchasing account at `/api/taoworld/connect.php`.
2. Configure the CLI worker every two minutes in cPanel Cron Jobs:

   ```cron
   */2 * * * * /opt/cpanel/ea-php83/root/usr/bin/php /home/gostorem/public_html/scripts/taoworld-worker.php >> /home/gostorem/gostore-data/taoworld/worker.log 2>&1
   ```

   The worker is CLI-only and protected from HTTP by `.htaccess`. It processes at most three jobs per run, has a global overlap lock and records its last actual invocation in `meta.taoworld_worker`. A recent invocation is required before enabling automatic procurement. A timestamp from a manual invocation alone is not evidence that the recurring schedule works; verify successive scheduled runs.
3. In admin → Integrations → TaoWorld, select the approved business channel: purchasing agent (`PANAMA_DG`) or distribution (`PANAMA`). Automatic creation and automatic supplier payment are separate switches, initially off. Enabling creation applies to newly confirmed payments; old paid orders need explicit per-order queueing. OT automatic purchasing and TaoWorld automatic purchasing cannot both be enabled.
4. For an existing paid checkout, open its admin order → TaoWorld → preview. Check SKU, quantity and supplier cost, including China domestic shipping. Queue the order, approve a higher per-order budget if necessary, then process it. Queueing or approving a budget allows the scheduled worker to submit it; these are not draft-only actions. An administrator can also process the queued job directly.
5. After native order IDs appear, supplier payment can be submitted once through the explicit payment button. If automatic supplier payment was enabled when an automatic job was queued, the worker can submit payment within its approved budget. Existing jobs are not silently opted into automatic payment by changing a setting later.
6. Query reconciliation updates every parent and child order and merges every domestic parcel's tracking number into the existing Erenhot inbound list. Shipment does not mark goods received in Erenhot or delivered in Mongolia.

## Validation and money

The original budget is the checkout's goods plus China shipping, converted from CNY to integer fen. New native checkouts use a cart-level TaoWorld render for domestic shipping; older orders may contain an estimate. See [domestic checkout shipping](taoworld-domestic-shipping.md). Service fees and later cargo charges are excluded. No existing QPay amount is changed. If the live TaoWorld render total exceeds this budget, the job holds in `preflight_review` until an operator approves a new budget. A fresh product/SKU/stock check and render are required before create, with a 120-second quote window.

The first read-only live check mapped the selected SKU of `GS-99EDB4`. Its customer quote allowed CNY 2.86 for procurement, while TaoWorld render returned CNY 12.21 including CNY 10 China shipping. On 2026-10-30 the owner explicitly approved a CNY 12.21 ceiling for this pilot. Its per-order budget was updated, the cron created the order, and one explicit supplier-payment API call was subsequently confirmed paid by an order query. The original MNT 1,573 QPay amount was unchanged. This approval applies to that pilot only; future over-budget purchases still require an operator's approval.

Only exact source SKU matches are accepted. A default source SKU is accepted only if TaoWorld returns a single explicitly default SKU. Missing or ambiguous mappings, inactive products, insufficient reported stock, incompatible currency, changed warehouse snapshots and policy-blocked products stop submission. The current address adapter supports the existing default Erenhot warehouse only; other branches require an explicit address adapter.

## Persistence and recovery

- Jobs are persisted under `orders.data.purchase`, with `provider=taoworld`, a random stable alphanumeric external ID, buyer/app binding, source snapshot fingerprint, receiver, budget, native mapping, quote and child orders. They survive PHP/worker restarts; no schema migration is needed.
- Per-order file locks serialize manual and scheduled actions. Short SQLite transactions merge procurement changes with the latest order; network requests run outside database transactions. Existing OT attempts cannot be switched to TaoWorld, and native attempts cannot be submitted or manually resolved through OT.
- The create submission boundary is saved before the network call. HTTP success is not proof of creation. Every outcome, including a timeout or business error, moves to query reconciliation using the same external ID. A missing query result never authorizes another create.
- The payment boundary is also persisted before submission. Unknown, rejected or partial payment responses are reconciled, never automatically retried. A recorded payment attempt prevents a second API payment. An operator must reconcile unresolved payments in TaoWorld before making any separate payment decision.
- `purchase.payment_result` retains the response's success flag and a validated business error code, or `TRANSPORT_UNCERTAIN`. Raw messages, tokens and signed requests are not stored. This is diagnostic evidence; supplier-paid status still requires query reconciliation.
- Observed paid/shipped child IDs are retained independently of the latest response. A later stale unpaid response cannot re-enable payment, including after a payment made on the TaoWorld website.
- Split orders, incomplete item totals, mixed states and unexpected currencies remain visible for review. Fully closed orders stop polling; other submitted orders continue polling even if new automatic procurement is disabled. Cancellation of a GOStore order does not cancel an already submitted TaoWorld order; handle supplier cancellation/refunds separately.
- A missed callback-to-queue write can be recovered by the worker for payments strictly after the latest activation timestamp. Payments from before activation are not backfilled. Same-second payment callbacks queue normally; if that queue write fails in the activation second, operator queueing is required.
- Tokens and secrets stay in private server storage. Customer order responses omit procurement internals. Error messages do not include raw signed requests or provider bodies.

## Verified API contracts

Official API references were retrieved from the documentation site's `getApi.json` responses and checked against live read-only calls on 2026-10-30:

- [`/product/get`](https://open.taobao.global/doc/api.htm#/api?path=/product/get&methodType=GET/POST): source `item_url`, `mp_id`, source `sku_id`, native `mp_skuId`.
- [`/purchase/order/render`](https://open.taobao.global/doc/api.htm#/api?path=/purchase/order/render&methodType=GET/POST): `render_item_List`, domestic `warehouse_address`, `need_supplychain_service=false`; business data is nested in `result`. Total and shipping amounts are CNY fen.
- [`/purchase/order/create`](https://open.taobao.global/doc/api.htm#/api?path=/purchase/order/create&methodType=POST): native item/SKU identities, stable `outer_purchase_id`, domestic receiver/warehouse and planned amount. Creation is asynchronous; failed responses require query reconciliation.
- [`/purchase/orders/query`](https://open.taobao.global/doc/api.htm#/api?path=/purchase/orders/query&methodType=GET/POST): external-ID lookup, paginated parent/child orders and `logistic_orders`. A live nonexistent external-ID lookup returned business error `B-50-10-001`; this is treated as unresolved, not as permission to retry create.
- [`/purchase/order/batch/pay`](https://open.taobao.global/doc/api.htm#/api?path=/purchase/order/batch/pay&methodType=GET/POST): at most ten parent IDs. Submission is not proof of payment; paid/shipped states must come from subsequent order queries.

## Acceptance status

Isolated fake-provider tests cover QPay-to-job persistence, native mapping, stock, budget holds, duplicate callbacks, crash/timeout recovery, split and paginated orders, no duplicate payment, parcel deduplication, account/provider/address binding, locks, cancellation and refresh rotation. Browser tests cover admin session and CSRF, settings, procurement controls, confirmation cancellation, uncertain payment controls and mobile layout.

Cron was installed on 2026-10-30 through the hosting user's available `proc_open` capability and `/usr/bin/crontab`, preserving the three existing lines. CLI PHP 8.3.36 was verified. The original crontab is private at `taoworld/cron-before-20261030.txt`; worker output is private at `taoworld/worker.log`. Independent scheduled runs were observed at 13:10:02, 13:12:09 and 13:14:02 (Asia/Ulaanbaatar), without manufacturing or manually writing a heartbeat.

The paid pilot's exact SKU/quantity and Erenhot receiver were checked. The 13:12 scheduled run created one supplier order; an explicit CNY 12.21 API payment was sent at 13:13:36 and confirmed as `WAIT_SELLER_SEND_GOODS` at 13:13:46. Native purchase, child and Taobao order IDs are stored in the private order record. No shipment tracking number existed yet; the worker continues polling and will merge one when returned. Physical shipment/warehouse receipt remain future events, not completed acceptance checks.

Automatic creation and automatic supplier payment were enabled at 13:14:30 on 2026-10-30 (Asia/Ulaanbaatar), channel `PANAMA_DG`, after the pilot was confirmed paid. Newly confirmed QPay orders are eligible; older payments are not backfilled. Existing price/stock/account/receiver checks, per-order budgets and no-repeat submission guards remain in force. Domestic shipping above the original goods-plus-estimated-shipping budget still causes `preflight_review`.

For rollback, disable new automatic procurement and automatic payment; retain this module, its private data and the reconciliation worker until all submitted orders have a known outcome. Do not delete purchase records or replay native orders through OT.
