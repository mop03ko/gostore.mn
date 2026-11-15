# Admin product reviews

Open `/admin/#reviews` → **Үнэлгээ, сэтгэгдэл**. The default view groups customer reviews by product, with a product link, review count, average rating, published/hidden counts, reported-review count and latest review date. Open **Сэтгэгдэл харах** for that product's reviews, photos and report reasons; existing hide/show moderation remains available.

Search uses the stored product title or code, with optional published, hidden or reported filters. Counts and averages reflect the matching reviews, including hidden reviews when no status filter is selected. **Бүх сэтгэгдэл** switches to the review list. Both views paginate on the server (20 rows per page). No supplier API calls are made.

`reviews-admin` still defaults to the review list for existing clients; `view=products` enables aggregation. All access requires an admin session. Customer-visible reviews and photos retain their existing moderation rules; hidden photos remain unavailable publicly.

Validation (isolated local database, no provider requests):

```powershell
node tests/run-logistics.cjs product-reviews-ui admin-review-products
```

These checks cover grouping, averages, filtering, literal wildcard search, pagination, authorization, escaped content, product drill-down, moderation, customer photo handling and mobile layout.
