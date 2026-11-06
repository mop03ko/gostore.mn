# Meta Pixel — GOStore web

Installed 2026-11-06. Public Pixel/Dataset ID: 1649469149899328.

The shared index.html loads Meta's async base script and sends one PageView per
full document load. A page-scoped guard prevents duplicate execution. The
JavaScript-disabled image fallback is in the body, not the head. No extra
PageView is sent for search-filter replaceState or account subtab navigation.

The customer-facing privacy modal mentions analytics and advertising tracking
in both the initial fallback and server-loaded copy. Admin, warehouse and native
iOS/Android screens do not include this snippet.

This change installs browser PageView only. It does not implement server-side
Conversions API, Purchase, AddToCart, advanced matching or native app events.
The supplied private access token is not stored in repository files or HTML.

Validation: isolated browser check with Meta/Google requests intercepted, one
init/PageView even if the snippet executes twice, existing-fbq handling, valid
body noscript image, blocked tracking script leaves storefront usable, bundle
freshness and deployment hash checks. Meta Events Manager receipt is a separate
account-side check.

Deployed storefront app.js and index.html with verified backup at
`/gostore-backups/meta-pixel-1793949247982`. Live HTTP reads matched the
local files and confirmed exactly one PageView call for the configured Pixel.
