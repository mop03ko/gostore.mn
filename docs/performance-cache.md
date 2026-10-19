# Cache and checkout freshness — 2026-10-20

## Observed baseline

Production served Brotli for HTML/JavaScript but no explicit static Cache-Control. A gzip-only JavaScript request was uncompressed (25,254 bytes); Brotli transferred 8,004 bytes for the same file. The actual configured supplier budget was 800/day and snapshots were enabled, not the source default of 40/day. These are HTTP/config observations, not field Core Web Vitals measurements.

## Release behavior

- Successful versioned static assets (`?v=...`) receive one-year immutable caching. Unversioned assets revalidate; HTML uses `no-cache`. Every changed CSS/JS URL must receive a new version in every referencing page. PHP API cache policies remain application-controlled: customer, orders, payments and authenticated dashboard responses stay `no-store`.
- Gzip is configured as a fallback; existing Brotli remains available. Apache references: [mod_headers](https://httpd.apache.org/docs/2.4/mod/mod_headers.html), [mod_deflate](https://httpd.apache.org/docs/2.4/mod/mod_deflate.html).
- Twenty percent of the shared daily supplier budget is reserved for order/checkout checks. Background work, including English-title calls, has a half-budget ceiling and cannot consume the reserve. SQLite savepoints atomically check and increment existing daily counters; rejected requests do not increment totals. Counters reset by UTC date. This is the application's request budget, not the provider account balance.
- Snapshot refresh cadence allows for both page and optional title requests: max(2 hours, 25 × 2 × 86400 / background daily budget). At 800/day this is 3 hours; at 40/day it is 60 hours. Other background activity can still defer a build. Unfinished builds resume without losing recently fetched departments. Previous complete snapshots remain available, labelled stale, for up to seven days after expiry; this never makes their prices valid for ordering. Detail/search cache lifetime is not extended.
- Ordering reuses supplier data only when fetched less than 120 seconds ago, unexpired and not stale. Older data triggers a provider refresh; retry/lock/network fallback cannot authorize an order. The entire cart must still fit this freshness window after all items have been checked.
- Before a new automatic-checkout QPay invoice, SKU/stock and unit prices are checked again, outside the SQLite order transaction. Changed price or insufficient stock blocks invoice creation; a changed price requires a new checkout. The invoice transaction checks both freshness deadline and unchanged order fields. Already-issued invoices retain their amounts and callback/idempotency behavior. Manually quoted legacy orders retain the operator's workflow.
- Freshness refers to when GOStore fetched from OT. OT may itself return cached data; this does not guarantee a direct live inventory read at the source store. No real payment was made during verification.

## Cron and monitoring

The admin API integrations page now shows daily use/reserve, background use, refresh cadence, worker result, last success, build progress/errors and a separate cron heartbeat. A web shutdown refresh is never reported as a cron invocation. Unknown/overdue cron is explicitly indicated after 30 minutes.

The CLI worker records a private heartbeat/result and exits nonzero for refresh errors. Configure the hosting scheduler once, every ten minutes (the worker skips fresh snapshots and has an overlap lock):

```cron
*/10 * * * * /opt/cpanel/ea-php83/root/usr/bin/php /home/gostorem/public_html/server/cache-refresh.php
```

Existing hosting cron could not be inspected: PHP exec is disabled, and the browser connector failed to start. Do not infer that cron is absent or enabled. Its setup/actual scheduled invocation remains unverified until hosting access or a genuine heartbeat is available. Do not simulate a heartbeat to clear this warning.

## Validation and deployment

Targeted tests cover reserve/cap/rejected counters, adaptive cadence, old/backoff/lock/network/future cache rejection, fresh reuse, invoice price/stock rechecks, unchanged issued invoices, complete snapshot publication/resume, English-only title fallback, card pricing, 50-item batches, checkout, QPay mock flows, shared cache privacy, concurrent order idempotency, admin monitoring and responsive catalog behavior.

Deploy the new `server/supplier-budget.php` first, then supplier and snapshot dependencies, checkout before QPay, API/worker/admin assets, and `.htaccess` last. Keep verified private backups and roll back on a failed HTTP check. No schema or configuration changes are required. Image/font conversion, route-specific JavaScript, prefetch changes, popularity scheduling and field performance telemetry are outside this first package.
