# TaoWorld domestic shipping at checkout

Verified on 2026-10-30 against the [official logistics API documentation](https://open.taobao.global/doc/api.htm#/api?cid=21&path=/traffic/item/batchGetSourceItemLogisticPrice&methodType=GET/POST) and read-only live requests. This covers delivery inside China to GOStore's Erenhot warehouse. It does not provide product weight, volume or international freight.

## API contract and limits

`/traffic/item/batchGetSourceItemLogisticPrice` accepts `item_resource=taobao`, `address_info` and one identifier list. GOStore uses `mi_id_list`; the documented priority is `mi_id_list > item_url_list > tao_password_list`. Deprecated `item_ids` are not sent.

`address_info` contains `country`, `state`, `city` and optional `district`. GOStore uses `中国 / 内蒙古自治区 / 锡林郭勒盟 / 二连浩特市`, matching procurement. This endpoint does not accept a street address, recipient, SKU, quantity, seller grouping or a cart. Its `data[]` rows contain per-item `success`, `post_fee` in CNY fen, `currency`, identifiers and optional error information. A returned `mi_id` can be newly issued, so results are matched by source item ID or an exact identifier, never response position. Unmatched or incomplete results are unavailable reference data.

Consequently, adding per-item `post_fee` values cannot establish the shipping charge for several items from one shop, a particular SKU or multiple units. GOStore never bills that sum. Chunks of 10 are an application choice, not a documented provider maximum.

## Checkout behavior

1. Revalidate the selected source SKU, quantity, stock and catalog price.
2. Try the logistics endpoint for private reference data. A permission/error response is held for 10 minutes per connected account to avoid repeated failed requests.
3. Map exact source SKUs with `/product/get`, then submit the entire cart to [`/purchase/order/render`](https://open.taobao.global/doc/api.htm#/api?path=/purchase/order/render&methodType=GET/POST). Both receiver and warehouse addresses use the stored Erenhot destination, including street and phone. Preview uses a fixed `QUOTE GOStore` recipient; procurement retains the actual GS order recipient.
4. Sum the render's `mainland_shipping_fee` once per returned seller group. Verify every requested mapped SKU and quantity. A known zero shipping charge stays zero, not a charge deferred until later. Reject unavailable items, inconsistent money, or a supplier goods total above the checked catalog goods total.
5. Include rendered domestic shipping in the MNT checkout total before QPay, with the configured conversion/rounding. Service fees and later international/UB delivery calculations retain their existing rules.

Quotes are private, account/cart/SKU/quantity/price/address-specific and valid for at most 120 seconds. Identical fresh quotes reuse the cache. Expired quotes never serve as a fallback after a failed render. Duplicate product mappings within one quote share a read. Calls respect supplier limits and the checkout quota reserve.

Order creation verifies the displayed total and the receiver/account snapshot. Before creating a new QPay invoice, goods and domestic shipping are rechecked against the saved order destination; changed shipping or address requires a new checkout. A concurrent order/warehouse edit is rejected. Already issued invoices keep their original amount and reconciliation path. Older native orders without a domestic quote must be recreated before issuing a new invoice. Private reference/account/receiver proof is not returned to customers.

The paid-order worker still performs its independent final product/SKU/stock/render check before supplier purchase. Its existing goods-plus-domestic-shipping ceiling, approval requirement for excess cost, account/address pins and durable create/pay guards remain intact. A successful checkout quote does not itself create or pay a TaoWorld order.

## Customer calculation display

The product page now has an on-demand Erenhot reference-price lookup (`GET supplier-logistics&id=tb-…`). It uses the stored Erenhot destination and an existing native catalog mapping; clients cannot submit an arbitrary address, supplier URL or access token. A successful fee is cached for 30 minutes per account, item mapping and receiver. Concurrent requests share a lock, actual reads consume the normal browsing API budget, and the existing 10-minute provider-failure cooldown applies. Only the reference price, current currency conversion and check/expiry times are public. A known zero is displayed as zero; unavailable fees are never treated as free. The reference is not multiplied by quantity or used as the cart's payable shipping amount. Cart render remains authoritative.

TaoWorld's inspected product and logistics schemas do not supply structured packed weight or dimensions. The product page explicitly leaves them unknown instead of estimating from a title/photo. Its calculator, also available on Help, accepts total kg, total m³, or one package's length × width × height in cm and the number of identically sized packages. Volume is `length × width × height × packages / 1,000,000`. Package count is independent of SKU quantity. The selected weight-step or volume tariff and CNY conversion are shown with the formula; this estimate is not added to the initial payment.

Warehouse measurement entry previews total kg and m³ before saving. The recorded dimensions represent the whole order's packed measurement, so item count is not multiplied again. The server stores volume to nine decimal places to retain small positive measurements. Customer tracking shows this saved measurement; final settlement continues to use warehouse measurements and the order's saved tariffs.

The cart shows the current indicative CNY conversion and service-fee formula. Checkout displays server-validated item names/options, unit CNY price × quantity, total goods CNY × the applied rate, domestic CNY × that rate, service percentage plus fixed fee, and the initial MNT payment total. Displayed totals come from the server; whole-MNT upward rounding is explained. Unknown domestic delivery remains explicitly deferred and known zero shipping remains zero.

The order detail includes the original calculation using that order's saved rates and items, independent of current settings. Once final settlement exists, the original calculation is collapsed under its own label; the existing final bill continues to show charges, paid amount, outstanding balance and any overpayment. International cargo and optional UB delivery remain marked as later charges until measured/confirmed; they are not presented as free or as part of the initial payment. Supplier procurement costs and private account/receiver proofs are not displayed.

## Validation and API permission

- After TaoWorld reported activation, a fresh read-only request using the live GOStore configuration succeeded on 2026-11-02 at 13:40:07 UTC (21:40:07 Ulaanbaatar). HTTP 200, `code=0`, item `538452788616`, `success=true`, `post_fee=1000` fen (CNY 10), `currency=CNY`; request ID `2140f97b17936268111366864`. The temporary authenticated diagnostic endpoint was removed after the check. No order creation or payment was performed. This confirms access and one item's reference fee; live multi-item behavior remains unverified.
- Historical failure: the 2026-10-31 request `2102fe1517934149116913098` returned `API_CAN_NOT_USE`. The fresh request above supersedes that permission status. An existing 10-minute unavailable-reference cooldown can still delay the application's next reference lookup; the diagnostic request bypassed that cache, while retaining the API call budget check.
- The deployed product-reference endpoint and mobile UI were checked on 2026-11-02: item `tb-538452788616` returned CNY 10 / MNT 5,800 at the live rate of 580. Two reads retained the same `checked_at` value. The live 390 px product calculator returned 0.12 m³ and MNT 41,691 for two 50 × 40 × 30 cm packages, with no page overflow or JavaScript errors. These are reference/estimate checks, not a purchase or final freight bill.
- Live read-only render of the existing pilot's SKU: quantity 1 returned goods CNY 2.21 plus shipping CNY 10, total CNY 12.21; quantity 2 returned goods CNY 4.42 plus shipping CNY 10, total CNY 14.42. This is one product example, not a universal shipping rule.
- Isolated tests cover same-seller distinct items without double charging, different sellers, multiple SKUs, quantity-dependent shipping, free shipping, reversed reference rows, cache expiry/account identity, failed render, changed goods/shipping, QPay blocking, concurrent warehouse edits and issued-invoice immutability. Multi-product seller grouping is validated against controlled fixtures; GOStore trusts the actual render for each real cart.
- Native browser checkout tests verify the rendered domestic amount in the displayed/server total and private proof redaction. Existing QPay, freight, checkout, concurrency, auth and procurement checks pass. No new live orders, invoices or payments were created for these checks.

Previous permission request for the TaoWorld team (access confirmed above):

> 我们调用 /traffic/item/batchGetSourceItemLogisticPrice 返回 API_CAN_NOT_USE。请协助检查并开通 GOStore 应用的接口权限。另外，请确认该接口不支持 SKU、数量及同店多商品合并运费，实际购物车运费应以 /purchase/order/render 的 mainland_shipping_fee 为准。
