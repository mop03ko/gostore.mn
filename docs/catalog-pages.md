# Catalog pages

Categories, sub-categories, search results, all products, saved items and the 11.11 collection are pages of their own on the website. Each shows only the product list with a breadcrumb and a title; the home page keeps its hub, 11.11 section, discovery rows and recommendations.

| Address | Page |
|---|---|
| `/c/<category>` | A category, e.g. `/c/women` |
| `/c/<category>/<sub-category>` | A sub-category; the slug is its search term, e.g. `/c/women/dress`, `/c/home/storage-box` |
| `/search?q=<text>` | Search results (`/search?image=<id>` for photo search) |
| `/products` | All products (header «Бараанууд») |
| `/saved` | Saved items |
| `/11-11` | The 11.11 collection (during the campaign; afterwards it sends visitors home) |

Sorting, price limits and paging are query parameters on these addresses (`?sort=price`, `?price_min=…`, `?page=…`).

## How it works

- `script.js` defines `catalogRoute()` (address → catalog parameters) and `catalogHref()` (category/query → address). Category and sub-category links, the category menu, the home hub and discovery rows link to these addresses.
- `supplier.js` keeps the catalog state as before. `supplierUrl()` derives the page address from that state: a new list (category, sub-category, search, saved, all) adds a history entry; sorting, price and paging replace the current one. `catalogPageView()` toggles `html.listing-view`, the breadcrumb, the title and the document title.
- A search term equal to a category's or sub-category's term opens that category page (typing «dress» shows `/c/women/dress`).
- Back/Forward between catalog pages reload the list in place (`popstate` → `catalogApplyRoute()`); same-site links to catalog pages open in place too. New tabs, product, account, cart, help, official-store and 11.11 pages load normally.
- The `<head>` script sets `listing-view` (and `eleven-sale-view` for `/11-11`) before the first paint. The home sections start when the home page is shown, so a catalog page does not load discovery rows or 11.11 deals.
- Older links still work: `/?q=…`, `/?category=…`, `/?filter=saved`, `/?image=…` and `/?sale=11.11` open the matching page and the address is rewritten to the new form. An unknown category goes to `/products`; an unknown sub-category goes to its category.
- `.htaccess` and `scripts/router.php` serve `index.html` for these addresses; `sitemap.xml` lists `/products` and every `/c/<category>`.

## Tests

`node tests/run-logistics.cjs catalog-pages-ui`: category, sub-category, search, all products, saved and 11.11 pages; breadcrumbs and titles; sorting keeps the page; Back/Forward in place without reloads; direct, old and unknown addresses; the phone tab bar and width.
