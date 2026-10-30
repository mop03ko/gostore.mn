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

## Validation and remaining permission

- Live logistics request: HTTP 200 with `code=API_CAN_NOT_USE`, no fee data. TaoWorld must enable or otherwise resolve access to this endpoint for GOStore's application. Successful live logistics output and its multi-item behavior remain unverified until access works.
- Live read-only render of the existing pilot's SKU: quantity 1 returned goods CNY 2.21 plus shipping CNY 10, total CNY 12.21; quantity 2 returned goods CNY 4.42 plus shipping CNY 10, total CNY 14.42. This is one product example, not a universal shipping rule.
- Isolated tests cover same-seller distinct items without double charging, different sellers, multiple SKUs, quantity-dependent shipping, free shipping, reversed reference rows, cache expiry/account identity, failed render, changed goods/shipping, QPay blocking, concurrent warehouse edits and issued-invoice immutability. Multi-product seller grouping is validated against controlled fixtures; GOStore trusts the actual render for each real cart.
- Native browser checkout tests verify the rendered domestic amount in the displayed/server total and private proof redaction. Existing QPay, freight, checkout, concurrency, auth and procurement checks pass. No new live orders, invoices or payments were created for these checks.

Permission request for the TaoWorld team:

> 我们调用 /traffic/item/batchGetSourceItemLogisticPrice 返回 API_CAN_NOT_USE。请协助检查并开通 GOStore 应用的接口权限。另外，请确认该接口不支持 SKU、数量及同店多商品合并运费，实际购物车运费应以 /purchase/order/render 的 mainland_shipping_fee 为准。
