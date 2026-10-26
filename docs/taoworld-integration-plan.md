# TaoWorld integration plan — 2026-10-22

Recommendation: introduce direct TaoWorld procurement alongside the existing OT catalog, validate it with a small operator-controlled pilot, then evaluate migrating catalog reads. GOStore already has checkout, QPay, procurement controls and warehouse tracking to build on. Direct TaoWorld requires its own adapter and order lifecycle; changing the OT base URL or replacing its API key is insufficient.

This is a research and implementation plan, not an enabled integration. Repository baseline: `aab9151`. The supplied welcome email confirms partner approval; it does not establish developer-app approval, API permissions, buyer authorization or payment-channel eligibility. No private credentials, live account configuration, real orders or payments were inspected or changed.

## Status update — 2026-10-26

Reported by the owner, not verified from the repository: the OT Commerce API subscription is active, and the TaoWorld purchasing account is ready with Alipay linked. This resolves the supplier-payment channel question for stage 0 (Alipay, not WorldFirst). It also makes the operator pilot's fallback concrete: the operator pays on the TaoWorld website with the linked Alipay, and GOStore records/queries that payment. Still open: developer-app registration and AppKey/AppSecret, granted API groups, buyer OAuth authorization, and whether `/purchase/order/batch/pay` can charge the linked Alipay via API.

## Business model and onboarding

All four supplied Yuque guides were read in Chrome after the web reader could not access them. Their intended uses differ:

| Guide | Intended workflow | GOStore fit |
| --- | --- | --- |
| [A: purchasing agent + API](https://www.yuque.com/xiaocheng-cj46u/sqmzfl/rvxa2c1bc70af195?singleDoc) | Buy customer-selected Taobao products; connect a developer application | Closest initial fit for customer-directed purchasing and the existing service-fee model |
| [B: cross-border seller + API](https://www.yuque.com/xiaocheng-cj46u/sqmzfl/zbcg3idt1xyepodo?singleDoc) | Select products and obtain materials for editing and resale through sales channels | Relevant to GOStore's curated storefronts, translated content and independently presented prices |
| [C: purchasing agent without API](https://www.yuque.com/xiaocheng-cj46u/sqmzfl/gi71kqxn2tcztlgh?singleDoc) | Purchase using the website cart or a connected ERP | Operational fallback while API access is prepared |
| [D: cross-border seller without API](https://www.yuque.com/xiaocheng-cj46u/sqmzfl/abd61p4b4vrg2kmv?singleDoc) | Website/ERP purchasing; material synchronization still needs an API-capable service | Useful fallback, but does not itself provide catalog synchronization |

The recommendation to start with A is an inference from GOStore's code, not a classification granted by TaoWorld. Confirm with the account manager whether A, B or both cover the storefront and content usage. Do not infer the procurement channel solely from the website being an independent store. The guides also describe delivery to a mainland-China address, with onward cross-border logistics arranged separately; this fits the current Erenhot route. [Agent guide](https://www.yuque.com/xiaocheng-cj46u/sqmzfl/rvxa2c1bc70af195?singleDoc), [seller guide](https://www.yuque.com/xiaocheng-cj46u/sqmzfl/zbcg3idt1xyepodo?singleDoc).

The remaining onboarding sequence is:

1. Verify the approved TaoWorld purchasing account and its registered legal entity.
2. Register or identify the developer account at [Taobao Global Open Platform](https://open.taobao.global/); apply for the Global Supply and Marketing Platform application category. The Yuque API guides describe this as a separate account and approval process.
3. Register the app and its exact HTTPS callback URL; obtain AppKey/AppSecret, confirm granted API groups and authorize the purchasing account through OAuth. Partner approval alone is not proof these steps are complete. [Alibaba development manual](https://developer.alibaba.com/docs/doc.htm?articleId=121120&docType=1&treeId=735).
4. Confirm the account's payment method, currency, funding requirements, charges, API quotas, production activation process and test facilities with TaoWorld.

The Yuque guides list Alipay, AlipayBusiness and WorldFirst. Their WorldFirst country list includes Hong Kong, Taiwan, Japan, South Korea, Singapore, Malaysia and Thailand; Mongolia is not listed. The WorldFirst guide dated 2026-04-10 instead describes matching Hong Kong company entities for the two accounts. These documents differ in scope or currency; neither establishes GOStore's eligibility. Obtain a written answer for the actual registered entity rather than assuming that partner approval permits WorldFirst payments. [Yuque payment prerequisites](https://www.yuque.com/xiaocheng-cj46u/sqmzfl/rvxa2c1bc70af195?singleDoc), [WorldFirst account-linking guide](https://www.worldfirst.com.cn/content/articles/b2c_portal/taoworld-kjb).

## What the repository already implements

These findings describe source code, not a successful live OT or TaoWorld purchase.

| Area | Existing implementation | Direct TaoWorld work |
| --- | --- | --- |
| Catalog | [supplier.php](../server/supplier.php): OT REST and native OT methods; `tb-` / `abb-` product identities; OT `ConfiguredItems` SKU values | Separate source adapter, explicit product/SKU mapping and capability checks |
| Cache and quotas | [supplier-budget.php](../server/supplier-budget.php), [supplier-snapshot.php](../server/supplier-snapshot.php): shared OT budget, checkout reserve, stale display fallback | Separate provider/account budgets and cache namespaces; preserve checkout freshness |
| Checkout | [checkout.php](../server/checkout.php): up to 30 lines, server-side SKU/stock checks, expected-total comparison; domestic shipping estimated per vendor | Use TaoWorld render results for pilot procurement costs; later integrate verified quotes into checkout |
| Customer payment | [qpay.php](../server/qpay.php): checks payment, marks the order paid, invokes optional automatic procurement | Keep customer receipt separate from supplier payment; enqueue procurement work after confirmation |
| Buyer authentication | [taobao-purchase.php](../server/taobao-purchase.php): OT OAuth, refresh and private server-side token storage | Direct app credentials, OAuth callback/state validation and a separate buyer token namespace |
| Purchase transport | [taobao-http.php](../server/taobao-http.php): `rest.otapi.net`, `X-Api-Key`, `/v1/taobao/...` paths | Signed direct TaoWorld transport with its own response/error normalization |
| Purchase lifecycle | `taobao_purchase_create()`: paid-order guard, database lock, attempt number, `creating/created/review/failed` states | Asynchronous procurement and supplier-payment states, reconciliation and persistent idempotency |
| Tracking | `taobao_purchase_track()`: queries the first recorded provider order; merges recognized waybills | Query every purchase/sub-order and map each parcel to GOStore lines |
| Operator UI | [admin.js](../admin/admin.js): connect, preview, create, resolve, track, auto-purchase toggle | Show provider, supplier payment, partial outcomes, quote differences and recovery actions |
| Existing validation | [taobao-purchase.php tests](../tests/taobao-purchase.php) use fake transport; [checkout-freshness.php](../tests/checkout-freshness.php) covers freshness | Add direct-provider fixtures and asynchronous lifecycle tests before rollout |

The OT purchase code forwards the suffix of `tb-...` as `item_id` and the stored SKU as `sku_id`. It treats HTTP 200 plus an array body as created, and permits a new external order number after a non-5xx rejection. These are OT-specific assumptions that must not be carried into the direct adapter.

There is no supplier-payment operation in the inspected OT purchasing module. Its `created` state is not proof that a supplier has been paid. The optional QPay hook currently calls procurement inline; a direct integration should use a durable job so delayed upstream work does not hold the customer-payment response open.

## Verified direct API differences

The linked [agent solution](https://open.taobao.global/doc/doc.htm?nodeId=27493&docId=118729#/?docId=89) and [seller solution](https://open.taobao.global/doc/doc.htm?nodeId=27493&docId=118729#/?docId=90) display updates dated 2025-09-02. Their linked API pages were checked on 2026-10-22. Published documentation is not evidence that these permissions are enabled for GOStore.

| Capability | Documented direct interface | Implementation implication |
| --- | --- | --- |
| Authentication | `/auth/token/create`, `/auth/token/refresh`; gateway `https://api.taobao.global/rest` | Do not reuse an OT-issued token as a direct-app token. [Development manual](https://developer.alibaba.com/docs/doc.htm?articleId=121120&docType=1&treeId=735) |
| Signing | App secret and HMAC-SHA256, sorted parameters, API path and applicable body; uppercase hex | Prefer the app's PHP SDK after compatibility review; otherwise test signing against official vectors. [Signing specification](https://developer.alibaba.com/docs/doc.htm?articleId=119387&docType=1&treeId=735) |
| Product mapping | Agent sourcing links `/product/get` and `/batch/src/products/check` | Resolve source item/SKU to procurement identities. [Agent solution](https://open.taobao.global/doc/doc.htm?nodeId=27493&docId=118729#/?docId=89) |
| Quote | `/purchase/order/render` | Validate item availability, destination, shipping, prices and discounts before procurement. [Agent solution](https://open.taobao.global/doc/doc.htm?nodeId=27493&docId=118729#/?docId=89) |
| Create | `POST /purchase/order/create` | Requires procurement item/SKU IDs, an external idempotency key and an amount in minor units; asynchronous result. [Create API](https://open.taobao.global/doc/api.htm#/api?cid=16&path=/purchase/order/create&methodType=POST) |
| Reconcile | `/purchase/orders/query`, including `outer_purchase_id` lookup | Recover after a lost create response and inspect all returned sub-orders. [Query API](https://open.taobao.global/doc/api.htm#/api?cid=16&path=/purchase/orders/query&methodType=GET/POST) |
| Pay | `/purchase/order/batch/pay` | Payment submission and payment completion are distinct; seller-level partial payment is possible. [Agent solution](https://open.taobao.global/doc/doc.htm?nodeId=27493&docId=118729#/?docId=89) |
| Cancel, refund, reconcile bills | Cancellation, refund and bill APIs are listed separately | Begin with an operator runbook, then automate these operations in later milestones. [Seller solution](https://open.taobao.global/doc/doc.htm?nodeId=27493&docId=118729#/?docId=90) |

The create reference explicitly requires `mpId` and `mpSkuId` inside `order_line_list`, specifies `purchase_amount` in fen, and describes `outer_purchase_id` as an alphanumeric idempotency key. Preserve GOStore's display ID separately and generate a stable, unique external identifier whose accepted format is verified. Never forward `standard` or assume an OT SKU is a native TaoWorld SKU. Store identifiers as strings to avoid JavaScript precision loss. Verify every monetary field's unit and currency individually. [Create API](https://open.taobao.global/doc/api.htm#/api?cid=16&path=/purchase/order/create&methodType=POST).

The same API warns that a failed response does not necessarily mean procurement failed. HTTP status alone cannot authorize a fresh attempt. Its channel field distinguishes `PANAMA_DG` and `PANAMA`; business-model approval must determine the value. The documentation's sample response contains inconsistent success/error fields, so it is unsuitable as a production success predicate without query reconciliation and confirmed fixtures. [Create API](https://open.taobao.global/doc/api.htm#/api?cid=16&path=/purchase/order/create&methodType=POST).

For the catalog decision, confirm keyword search rather than assuming feature parity: the seller solution lists its search API as “to be provided.” It also describes approximate stock above 200 and ordinary sourcing prices that may exclude discounts. Retain the OT catalog until actual account capabilities, content rights, language support, coverage, latency and cost have been measured. [Seller solution](https://open.taobao.global/doc/doc.htm?nodeId=27493&docId=118729#/?docId=90).

## Proposed implementation

The filenames and fields below are design proposals, not existing components or official API names.

1. Add `server/taoworld-http.php` and `server/taoworld-auth.php` for signed transport and buyer authorization. Store secrets in ignored server configuration/private storage; redact tokens, signatures, authorization codes and addresses from diagnostics. Validate one-use OAuth state, callback/session binding and exact approved hosts; serialize token refreshes and respect returned expiration values.
2. Add a procurement router and `server/taoworld-purchase.php`. Keep source market (`taobao`), catalog provider (`ot`) and purchase provider (`taoworld`) distinct. Pin provider and buyer-account identity on every attempt. An order already submitted through OT must continue using OT for reconciliation.
3. Persist source item/SKU, `mp_id`, `mp_sku_id`, mapping timestamp, verified variant attributes, quoted quantities, warehouse snapshot and currency/amount units. Reject missing or ambiguous mappings. Do not silently substitute a similar product.
4. Add durable purchase jobs and child-order records, with unique keys for the account/provider/external order identity. Track create, supplier pay, refund and reconciliation separately from `orders.paid` and the customer's fulfillment status. Persist state before network calls and do not hold SQLite transactions during those calls.
5. Replace arbitrary response traversal for the direct provider with typed parsing of `purchase_id`, `sub_purchase_order_id`, line IDs and logistics arrays. Keep request IDs and bounded redacted diagnostics. Normalize business errors independently of HTTP status.
6. Add a CLI reconciliation worker plus authenticated provider-message handling if message access is granted. Messages should enqueue reconciliation; verify their signature and deduplicate delivery before accepting them. Poll with bounded backoff as recovery for missed or out-of-order messages. Expose worker heartbeat, oldest unresolved attempt, permission errors and payment failures to the admin.

Proposed procurement states are `queued → creating → awaiting_supplier_payment → paying → supplier_paid → shipped`, with `review`, `failed`, `cancelled` and refund states alongside them. These are internal names, not raw TaoWorld statuses. Record state per child order; a partial payment cannot mark the entire GOStore purchase paid. A supplier shipment must not mark the customer order delivered in Mongolia.

After a timeout, error, worker crash or uncertain create response, query using the **same** saved `outer_purchase_id`. An empty query immediately after submission is not proof of failure. Only a confirmed terminal outcome and an explicit retry decision may begin a new logical attempt. Do not automatically switch to OT or website purchasing while a TaoWorld attempt is unresolved. Apply the same reconciliation discipline to supplier payment retries. The query API supports external-key lookup and exposes parent/sub-order status and payment deadlines. [Query API](https://open.taobao.global/doc/api.htm#/api?cid=16&path=/purchase/orders/query&methodType=GET/POST).

### Pricing and cache rules

Keep [the existing freshness policy](performance-cache.md): the 120-second purchase window, whole-cart freshness checks, rejection of stale fallback for ordering, and immutable issued QPay invoices. Introduce a separate, expiring TaoWorld quote for the exact account, items, quantities, destination and procurement channel. Cache keys and quotas must distinguish provider and buyer account; private purchasing prices must not enter a public shared cache.

The initial pilot may retain OT customer quotes while the operator compares the TaoWorld rendered cost with the approved procurement budget. A mismatch must produce review before supplier payment. Later, integrate TaoWorld render results into customer quoting so actual China shipping and applicable discounts can replace assumptions. Store goods, China shipping, service fee, FX and later cargo charges separately to prevent double counting.

Re-render after customer payment before committing procurement because inventory and prices may have changed. Never silently alter an issued invoice or charge a customer again. Define an operator policy for absorbing a difference, obtaining a separate agreed adjustment, or refunding the customer. A supplier refund returns to the supplier-payment account and must be reconciled separately from any customer refund. QPay receiving money does not fund TaoWorld automatically.

### Rollout and acceptance gates

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| 0 — access and contract | Confirm business channel, app permissions, payment eligibility, quota, latest schemas and test process | Named account and authorized capabilities documented; unresolved requirements assigned |
| 1 — read and quote | Direct auth, signing, item/SKU mapping, render and read-only diagnostics | Controlled products match expected variants; exact amounts/units verified; no real purchasing |
| 2 — operator pilot | Stable idempotency, durable jobs, create/query, operator supplier payment, tracking and recovery runbook | A separately authorized small order is reconciled through supplier payment and China shipment; timeout and split-order cases pass fixtures |
| 3 — production procurement | Verified worker scheduling, alerts, message recovery, supplier payment controls and reconciliation | Duplicate callbacks/crashes cause no duplicate purchase/payment; manual exceptions and refunds are auditable |
| 4 — catalog evaluation | Compare TaoWorld sourcing/distribution against current OT features | Measured coverage, rights, quota, language, latency and total cost justify any migration |

Keep auto-procurement and automated supplier payment off during the initial pilot. Until the supplier-payment API is validated, the TaoWorld website can be the operator payment surface; record/query the resulting payment instead of treating an operator click as confirmation. The website cart is also a documented fallback, provided the existing purchase is resolved before another is created. [Website purchasing guide](https://www.yuque.com/xiaocheng-cj46u/sqmzfl/gi71kqxn2tcztlgh?singleDoc).

For rollout, default existing orders to their legacy provider, make additive schema changes and back up private data before migration. Rollback must disable new TaoWorld submissions while retaining reconciliation for existing TaoWorld orders. Do not replay those orders through OT. Confirm a real scheduler heartbeat; [the cache report](performance-cache.md) records that hosting cron had not been verified in the earlier work.

Required implementation validation: official signing examples, expired/revoked OAuth and concurrent refresh; SKU mapping and missing variants; fen/CNY/MNT conversion; shipping/discount changes; business errors inside HTTP 200; lost create/payment responses; duplicate jobs and callbacks; process crash after upstream acceptance; partial procurement/payment; multiple tracking numbers; late/out-of-order messages; stale quotes and issued-invoice preservation. Extend existing fake-transport tests and checkout/QPay regression tests. A real pilot requires its own item, spending limit and payment authorization; it is not part of this research task.

No reliable delivery date or cost saving can be calculated yet. Developer approval, payment eligibility, quota/pricing and current schema access are external dependencies. Estimate development after stage 0; measure actual catalog latency before promising a speed improvement.

## Questions ready for TaoWorld support

These questions are prepared for `taoworld@alibaba-inc.com` or the developer support channel; no message has been sent.

1. Our partner application is approved. Is a separate developer/app application still required, and which API groups are enabled for our account?
2. GOStore combines customer-directed purchasing with a curated, translated Mongolian storefront. Should we use the procuring-agent channel, global-seller channel, or both? Which content/display permissions and `channel_order_type` apply?
3. Which payment channels support our actual registered legal entity, especially if registered in Mongolia? Please confirm currencies, funding, fees and whether direct API payment is enabled.
4. Please provide the current PHP SDK, request/response schemas, API limits and pricing, callback/message verification specification, and test-account or sandbox arrangements. Does test application status still operate on live purchasing data?
5. Please confirm item/SKU mapping, amount units, external-ID character/length limits, create/payment idempotency, internal retry behavior and how long to wait before declaring an external-key lookup unsuccessful.
6. Are keyword search, image search, material distribution, translated titles, stock updates and discounts available under our permissions? Which data may be cached and displayed publicly, and for how long?
7. Please confirm delivery to our Erenhot warehouse, required receiver/warehouse fields, partial-order behavior, payment deadlines, after-sales access and bill reconciliation for the chosen payment method.

## Research validation

Reviewed the four supplied guides, their linked agent/seller technical solutions, create/query references, Alibaba signing/manual pages and the WorldFirst linking guide. Compared these with the repository files linked above. The development manual is dated 2022, API references 2023 and business solutions 2025; confirm current account-specific contracts before implementation. Only this planning document was added. Documentation links/file references and Git whitespace checks are the appropriate validation for this change; no application tests or live API transactions were run.
