# QPay payment deadline

New order invoices have a 15-minute payment window. The clock starts when QPay returns a usable invoice and GOStore saves it as ready, not when the cart or order is first created. `invoice.issued_at`, `invoice.payment_window_seconds` (900), and `payment_due` are stored once. Reopening the payment screen never extends the deadline.

Before an invoice exists, the existing draft quote lifetime still applies. Previously issued invoices retain their original deadlines. Freight balance invoices are unaffected; a freight timeout must never cancel an already purchased order.

At expiry, GOStore checks QPay's authoritative payment status. Fully paid orders are confirmed and never cancelled. Partial payments are marked `payment_review=partial_payment` and retained for reconciliation. If QPay is unavailable, cancellation is deferred and retried. For new timed invoices, the worker cancels the invoice with `DELETE /v2/invoice/{invoice_id}`, then checks payment again to protect an in-flight payment. It never calls a payment cancellation or refund endpoint. The final transaction reloads the order before marking `cancel_reason=payment_timeout`.

Expired QR codes and bank links are omitted from the public order API, including for older app versions. Web and mobile payment screens display the deadline and hide payment controls when it passes. Payment callbacks continue to reconcile payments even after a timeout, so incoming money is never silently discarded.

Run `scripts/checkout-expiry-worker.php` every minute with the production PHP CLI. The process uses a nonblocking file lock and records `checkout_expiry_worker_last` in meta. Browser traffic is not required. Normally cancellation is recorded on the next minute tick after the 15-minute deadline; QPay/network errors can delay reconciliation. Existing request-triggered expiry checks remain as a fallback.

Validation: `tests/qpay-flow.php`, `tests/qpay.php`, `tests/checkout.php`, `tests/checkout-freshness.php`, `tests/checkout-expiry-lock.php`, and `tests/payment-countdown.cjs`. All payment fixtures use fake transport and isolated SQLite; no real charges are created.

QPay reference: https://developer.qpay.mn/mn/docs/merchant?version=2.0.0

## Release — 2026-11-16

Production PHP and web bundle deployed with file/database backups. The every-minute cron was verified running (`checkout_expiry_worker_last` advanced independently). The worker URL is blocked from public HTTP access. Payment flow, quote freshness, freight balance regression, SQLite compatibility, web checkout/countdown, mobile TypeScript and lint checks passed; iOS/Android bundles exported successfully.

Expo updates were published to production and preview. Delivery requires a compatible installed native runtime; device receipt has not been manually confirmed:

| Platform | Runtime | Production group | Preview group |
| --- | --- | --- | --- |
| iOS | `a8dd376b5cdfd560a1feff8949377a4204ebaa5f` | `4957b6ad-12ca-496a-82ab-1d5791ac0afd` | `b68bd038-2084-4c6b-9ce5-7613738a7432` |
| Android | `12e475e0cbbc9ab91d7ecfa01d472e04d133f2a1` | `b52d2e81-f7bf-41fb-9363-3be3a691ad2a` | `fa006c1a-06b4-486e-8be6-aca45f13e1b5` |
