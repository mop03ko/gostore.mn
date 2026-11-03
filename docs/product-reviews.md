# GOStore product reviews

The website product page exposes GOStore customer ratings separately from supplier shop ratings. Signed-in customers may leave one 1–5 star rating per product, optional text (2,000 characters), and up to three JPEG/PNG/WebP photos. They may edit or delete their own review. New selected photos replace existing photos; leaving the picker empty preserves them unless removal is checked. These are not presented as verified-purchase reviews or imported Taobao reviews.

`server/product-reviews.php` lazily creates review, photo and report tables in the private SQLite database. Images are decoded and re-encoded as JPEG (maximum 1,200 pixels on the longest side) before storage; original files and metadata are not published. Public photo reads require a currently visible review. Each original upload is limited to 5 MB and 20 MP; each resulting JPEG to 1.5 MB. The web client also resizes before upload.

All writes use the existing customer session and CSRF guard. A unique product/customer constraint prevents duplicate ratings, customer ownership protects deletion, and write/report rate limits constrain abuse. Product names are resolved on the server. Names are masked in public responses; emails, customer IDs and order details are never exposed. User text is rendered as escaped text. Account deletion removes associated reviews, reports and image bytes within the existing deletion transaction.

`product-reviews` returns 20 visible reviews per page, average, count and the signed-in customer's review. `review-save` accepts multipart form data; `review-delete` and `review-report` accept JSON. Admin actions `reviews-admin` and `review-moderate` use only the admin session. The admin “Үнэлгээ, сэтгэгдэл” page prioritizes reported reviews and supports hiding/restoring them. Customer edits preserve the moderation state. Public responses and photos are not cached.

This release covers the website, including mobile browsers and dark mode. Native Expo product screens are unchanged.

Validation: `node tests/run-logistics.cjs product-reviews-ui product-page-ui customers` and `node scripts/bundle.cjs --check`. Fixtures and uploads run against isolated local databases, never production accounts.
