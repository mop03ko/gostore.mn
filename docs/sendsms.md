# SendSMS.mn: verification and order notices

The customer receives a six-digit SMS code for phone verification / PIN reset. The login PIN remains four digits. Current web/Expo clients request `delivery: otp`; old clients retain the verify.mn mobile-originated flow. Codes expire after five minutes and allow five guesses; only a correct code creates the session-bound proof used by PIN setup. Resetting the PIN revokes previous logins.

Order notices are queued when payment first becomes confirmed and when the order becomes `ready_pickup`. Pickup notices use the assigned warehouse's city (including dynamically created branches). No historical notifications are backfilled. Cancellation and promotional messages are not enabled.

## Server configuration

Store credentials only in environment variables or protected, mode-600 `server/sendsms.env` (ignored by Git). Never put them in JavaScript, Expo public variables or logs.

```dotenv
SENDSMS_API_KEY=replace_on_server
SENDSMS_API_TOKEN=replace_on_server
SENDSMS_ENABLED=1
SENDSMS_ORDER_EVENTS=1
SENDSMS_OTP_ENABLED=1
SENDSMS_TYPE=standard
```

The user's supplied tariff is 20₮ per standard SMS. Both verification and notifications use this type. The provider must have an active plan and sufficient balance. Queue acceptance is not proof of delivery. GOStore records the returned cost when available.

The transport posts to the fixed SendSMS HTTPS endpoint, verifies TLS and validates a single eight-digit Mongolian phone number and 160 ASCII / 70 Unicode character limits. Provider responses and secrets are not logged. Verification codes are cryptographically random and stored only as a keyed hash in the session.

Rate limits before billed OTP calls: one/minute, five/hour and twenty/day per phone, ten/hour per IP, plus a global cap of 1,000/day. These are abuse/spend guards, not provider quotas. The code-entry UI never automatically resends a code. Rejected sends fail safely; ambiguous sends retain the challenge so a delayed code still works.

## Worker

Run `scripts/sms-worker.php` every minute using PHP CLI. It takes a file lock. `sms_order_queue` is inserted in the same savepoint as the order update and deduplicated by `(order_id,event)`. Immediately before sending, the worker rechecks the relevant order state.

Queue states: pending, sending, accepted, failed, uncertain, cancelled. A timed-out/ambiguous request or interrupted worker becomes uncertain and is **not automatically retried**: the API provides no idempotency key and the provider already retries delivery. Inspect SendSMS history before any manual retry. Rejected requests are also retained for operator inspection. `meta.sms_worker_last` records the worker heartbeat. Sending failures never cancel a customer's payment or order.

For tests, set `GOSTORE_DISABLE_SENDSMS=1`. Automated tests use disposable data and mocked transport; they do not send billable messages. Coverage: phone/text validation, standard tariff, transactional queue, duplicate events, dynamic pickup branches, stale events, ambiguous/rejected requests, OTP expiry/guessing limits/session binding, registration, PIN reset and session revocation, plus web OTP and legacy verify.mn flows. Real handset delivery requires a separate user verification.

## Deployment

2026-11-16: backend, web UI, privacy text and the minute worker deployed after a database/file backup (`sms-1794836135764`). Both feature flags are enabled with standard type. Credentials were loaded from the operator's ignored local file into a protected server-only configuration. No billable test messages were sent.
