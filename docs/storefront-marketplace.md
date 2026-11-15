# Marketplace storefront refresh

Reference: https://usashop.mn/ (reviewed 2026-11-15). The broad search header, category navigation, main banner with supporting tiles, and image-led category row informed the layout. GOStore retains its logo, orange/navy palette, existing assets and actual shopping/forwarding services.

`home-refresh.js` builds eight header category links, three promotional entry points and six category tiles from existing catalog data. Links lead to real category, help and self-cargo pages. It moves the warehouse directory below the catalog. No supplier endpoints, prices, campaigns, cart rules or permissions change, and the presentation introduces no additional supplier requests.

`home-refresh.css` provides the desktop two-column banner, horizontal mobile category rows, responsive cards, dark appearance, reduced-motion behavior and initial layout reservations. Homepage presentation is scoped to `home-refresh`; existing route synchronization hides the homepage cards on search/product/account/cart routes. Header category links remain available on desktop storefront routes.

Validation:

- JavaScript syntax and diff whitespace checks.
- `home-refresh-ui`: 320/390/768/1024/1440px, dark search contrast, category links, keyboard-compatible links, search, Back navigation, discovery shortcuts and route isolation. Also tested with a snapshot of the deployed JS/CSS bundles, independently of unrelated local catalog edits.
- `warehouse-preference-ui`: persisted pickup selection, privacy, optional GPS, mobile/dark dialog, clipboard and checkout/forwarding destinations.
- `home-hub-ui`: header/tile navigation, keyboard access, grouped cart selection and estimates, mobile checkout bar, route isolation, and reserved hero geometry before/after deferred scripts at 320/390/1024/1440px.
- Desktop and mobile screenshots inspected in `tmp/storefront-reference/` (not committed).
- Deployment changes only `home-refresh.css`, `home-refresh.js` and their version references in `index.html`. Preserve live bundle version references and unrelated local edits.

Published files were backed up and hash-verified at `/gostore-backups/storefront-market-final-20261115-1f20a2d978`. The live homepage was checked at 1440px and 390px.
