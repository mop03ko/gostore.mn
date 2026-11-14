# Branch pickup at checkout

Web and Expo checkout send `pickup_location` with the customer's fulfillment choice. The backend validates it against active destination warehouses (role `ulaanbaatar`) before pricing and again under the order write lock. It stores the chosen location in `warehouse_locations.ulaanbaatar`. Existing warehouse visibility, batching, pickup details and customer tracking use that assignment.

- Omitted location defaults to Ulaanbaatar for older app versions.
- Home delivery remains Ulaanbaatar-only. Branch orders use pickup.
- Inactive, unknown and Chinese/source warehouses cannot be selected as pickup points.
- Internal operational route/status keys remain unchanged. They are not literal destination city labels; customer tracking uses warehouse names.
- Prices and cargo tariffs remain unchanged. Shipping is settled after warehouse measurement; this change does not offer free delivery.

Both catalogue endpoints expose a sanitized `shipping.pickup_locations` list (location, city, name, address, phone, hours). Legacy `shipping.pickup` remains the UB profile. No manager email or credentials are exposed. Homepage promotions read the same list and disappear for inactive branches.

Configured branches:

- Замын-Үүд: 1-р баг Захиргааны замын эсрэг талд 117-р байр 3-р подваль; 91117189.
- Сайншанд: Цахилгаан түгээхийн баруун талд Билэг дугуй сервис; 88563280.

Validation: isolated checkout-branches, checkout-ui, warehouse-branches and home-refresh-ui suites; PHP checkout regression test; Expo typecheck and lint. Tests use synthetic products and disable supplier network/QPay. Production checks are read-only.

Web/backend deployed 2026-11-15 with verified before/after snapshots. Expo source is ready; installed apps require a compatible update/build. No native build or OTA release is performed by this change.
