# Catalog product restrictions

GOStore excludes knives and related listings from sale following the Alipay Global
support request supplied by the merchant on 2026-10-26. This applies to all customers
and payment methods, not only Alipay visitors.

- `server/product-policy.php` checks names, original supplier names, descriptions,
  categories, attributes, variants and promotions. English, Mongolian, Chinese and
  Russian terms cover knives, blades, related accessories and mixed sets. The Chinese
  `刀` rule is deliberately conservative and can also exclude tools containing that word.
- The shared normalization path filters ordinary, brand and image search, vendor
  recommendations and related products. Direct Taobao/1688 detail and checkout use
  the same policy. Known restricted Taobao IDs remain blocked if renamed.
- Old normalized snapshots are invalidated because they lack original supplier
  metadata. The home feed falls back to filtering raw cached responses while the
  scheduled worker builds a new snapshot. Existing raw caches are checked on every
  read; no database or cache deletion is required.
- Translation cannot replace a restricted source title with a generic allowed name.
  Cached detail metadata also screens generic search cards. Browser cache keys and
  asset versions change; saved items, carts, comparison lists and recent suggestions
  are filtered before display. The server remains authoritative.
- The knife navigation entry is removed. Local inventory remains visible to admins
  for correction, but restricted products are hidden publicly and cannot be activated.
  New QPay invoice requests and supplier purchases reject restricted order lines.
  Historical orders and payment callback reconciliation are preserved. Existing
  externally issued invoices are not automatically cancelled; any affected order
  needs operator reconciliation with the payment provider.

The initial live snapshot audit found eight restricted IDs among 300 department
entries. These IDs are explicitly denied in PHP and the browser policy. Review new
provider listings regularly and add confirmed IDs to both lists. Bump
`PRODUCT_POLICY_VERSION`, browser cache namespaces and asset versions when changing
the rules. Tests share multilingual cases in `tests/product-policy-cases.json`.

Text screening cannot identify every mislabelled or image-only product. This change
is not evidence of Alipay approval; request another review after checking the live
catalog. Do not claim that all possible supplier listings have been manually reviewed.

Validation: isolated PHP policy/cache/checkout/payment/procurement fixtures and
Playwright tests for navigation, cached browsing, saved items, carts and product pages.
These tests create no live orders or payments.
