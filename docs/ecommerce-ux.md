# Ecommerce UX improvements — 2026-10-19

The storefront now exposes the cart to guests, keeps the selected SKU through sign-in, and shows an upfront estimate separately from charges settled on arrival. The server still validates price, stock, customer ownership, total and payment state before an order is created.

## Implemented

- Persistent desktop/mobile cart with a line-count badge; add confirmation stays until dismissed.
- Cart preview includes goods, service percentage/fixed fee and seller-based domestic estimate. Old cart entries without seller metadata show an unknown domestic amount rather than guessing. Checkout re-quotes all amounts.
- Consistent now/later payment wording on the home notice and product details; interpolation bug removed.
- Sign-in resumes cart checkout or buy-now with the selected SKU and quantity. Closing sign-in cancels that continuation. Account authentication remains required; this release does not add SMS or guest order ownership.
- Supplier quantities are labelled as order units, not assumed individual pieces. Raw SKU pack descriptions remain visible. No pack size is inferred from titles and no order quantity conversion is performed.
- Recommended home order preserves the mixed department feed; search preserves supplier relevance. Ascending price is an explicit option. Unavailable items go last on the home feed.
- Shorter hero, products before a horizontally scrolling brand row, visible card actions, two-line names, category refinements and supplier-attributed sales counts.
- Compact, expandable SKU options without nested scrolling; selected SKU remains visible in the mobile purchase bar. Human-readable breadcrumbs and key facts near the description.
- Delivery/returns/cancellation links near purchase controls, clear unknown-arrival wording and a tariff calculator. The calculator uses user-provided measurements and current rates; it is not a shipping quote or a promised final total.
- Help explains evidence to submit for damage/shortage and identifies unknown refund outcomes without inventing a refund entitlement or deadline.
- Existing English title implementation is retained. No prices, descriptions or SKU attributes are translated by these changes.

## Requires business data or a separate integration

Confirmed delivery ranges and refund deadlines cannot be supplied from the current data. Populate these only after operational approval. Real supplier pack-size metadata is needed for guaranteed per-piece totals. Category-specific size/material filters need a normalized provider attribute feed; this release adds truthful subcategory navigation, not fake filters. Supplier photography and manual merchandising require a chosen product list. SMS OTP needs a provider and abuse controls. Real QPay success/failure requires the merchant's sandbox or controlled acceptance test.

## Deployment

Ship all changed runtime files together, including commerce-ui.js/css and the changed index.html cache versions. scripts/package.ps1 includes their runtime dependencies. No database migration or production setting changes are required. Deploy to staging, verify cart → sign-in → quote → order/payment using test credentials, then publish the reviewed commit.
