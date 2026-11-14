# Homepage redesign — 2026-11-15

The storefront home page now has a navy/orange hero, a compact forwarding entry,
consistent category/product cards, and direct actions for discounts, verified
China-to-Erenhot free shipping and order tracking. Mobile places the hero before
its category grid and uses horizontally scrollable service cards. Desktop keeps
the category flyout and customer shortcuts. Dark mode uses semantic surface colors.

`home-refresh.css` and `home-refresh.js` are intentionally separate from the shared
bundle for a focused release. The `home-refresh` root class is initialized before
paint and follows route changes; product, category, cart, account and authentication
pages do not inherit the redesign. Existing discovery tabs and APIs handle the
shortcuts. No new product requests, claims, prices or payment behavior were added.

The self-cargo entry is pre-rendered to reserve its space; the existing script
recognizes it and avoids duplication. Category placeholders reserve their filled
height. The hero uses existing local images, with no new image-generation payload.

Validation:
- `node tests/run-logistics.cjs home-hub-ui home-refresh-ui self-cargo-ui` passed.
- Home/category navigation, Back, flyout keyboard behavior, account entry and
  existing grouped-cart behavior passed.
- 320, 390, 768, 1024 and 1440 px layouts checked; light/dark screenshots inspected.
- Exact release HTML previewed against production assets before publication.
- Live homepage checked after deployment; the free-shipping shortcut displayed
  eight real API products, with international freight still explicitly separate.

Production release: `home-refresh-1794674864086`.
Backup: `/gostore-backups/home-refresh-1794674864086`.
Only `home-refresh.css`, `home-refresh.js` and targeted homepage HTML were published.
Unrelated local catalogue changes were preserved. This is a website release, not
an Expo/native app release.
