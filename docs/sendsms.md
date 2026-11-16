# SendSMS.mn: verification and order notices

The customer receives a six-digit SMS code for phone verification / PIN reset. The login PIN remains four digits. SendSMS.mn is the sole provider; there is no verify.mn fallback. Web/Expo clients request `delivery: otp`; older clients without a code-entry screen receive HTTP 426 with an update/reload instruction before any billable SMS. Codes expire after five minutes and allow five guesses; only a correct SendSMS code creates the session-bound proof used by PIN setup. Resetting the PIN revokes previous logins.

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

Production checks: web/mobile configuration both expose OTP enabled; secret and worker URLs return 403; deployed web bundle contains OTP UI; worker heartbeat observed at `2026-11-16T13:36:02+00:00`. Backend, OTP/PIN regression, web verification/PIN, SQLite compatibility, Expo typecheck/lint and export checks passed.

Expo updates published from `92e0c5e` (no new native build required):

| Channel | Platform | Runtime | Update group |
| --- | --- | --- | --- |
| production | iOS | a8dd376b5cdfd560a1feff8949377a4204ebaa5f | 4f9a0a1f-be58-46b6-a4b3-c7ead0f9fb49 |
| production | Android | 12e475e0cbbc9ab91d7ecfa01d472e04d133f2a1 | c551339f-0467-4582-8656-be9f26a86a66 |
| preview | iOS | a8dd376b5cdfd560a1feff8949377a4204ebaa5f | 03f7a980-1da3-44f8-9a56-a9f94de07045 |
| preview | Android | 12e475e0cbbc9ab91d7ecfa01d472e04d133f2a1 | d44f1d70-053e-444a-96ea-151a784bcac3 |

Only compatible installed runtimes receive these updates. Publication does not confirm installation on individual devices or delivery of a real SMS; the latter still needs a user handset check.

### Permanent provider change

2026-11-16: verify.mn retired at the user's request. Its transport is disabled even if an old environment key exists. Existing account modules retain a compatibility phone-normalization helper only; it performs no provider calls. Old verify.mn proofs cannot set/reset a PIN. Existing logins and PINs remain valid. The unused native `expo-sms` package is retained for runtime compatibility but no longer imported or invoked by verification UI.

Production deployment `sms-only-1794836789378` cleared the old server key file and deployed the SendSMS-only API/UI. Read-only configuration checks confirm SendSMS enabled; a legacy start request returns 426 before sending and the served bundle has no 144773 instructions. Tests cover retired transport/environment, legacy-client rejection, no fallback on SendSMS outage, rejection of old proofs, OTP/PIN and browser/mobile API flows. Typecheck, lint and SQLite compatibility checks passed.

SendSMS-only OTA release from `870f441`, using the same compatible runtimes listed above:

| Channel | iOS update group | Android update group |
| --- | --- | --- |
| production | e6daa252-2e17-4e51-b7be-752cf6f37f46 | 45867455-c35d-4293-923c-970644b2fbb2 |
| preview | 798e1600-428c-4c0f-82f1-3bcd41f7fca9 | b25bee0d-08ff-45d1-93cd-974952e7f659 |
