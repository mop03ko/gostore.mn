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

## Admin usage dashboard

`/admin/#sms` is a read-only view for authenticated admin roles, including viewers.
`GET admin-sms-usage` accepts `from`, `to`, `kind` (all/otp/order), and `page`;
dates use Asia/Ulaanbaatar, with 50 rows per page and the existing 400-day range
limit. Customer, warehouse and mobile API sessions cannot access the report.

The dashboard combines existing order queue history with the new `sms_otp_usage`
ledger. OTP attempts are recorded immediately before a provider call, after rate
limits, and marked accepted, failed or uncertain afterward. Interrupted sending
attempts older than five minutes display as uncertain. Correct OTP confirmation
is recorded separately, once; it does not rewrite an uncertain provider response.
Reporting-result failures never resend SMS or invalidate a correct OTP.

Only masked phone numbers are returned. The OTP ledger stores no full phone,
code, challenge, message, API key or token. OTP history starts when the ledger is
initialized; earlier usage is not reconstructed from sessions or rate limits.
Totals are selected by request creation date and show current states. Known cost
is the sum of nonnegative provider-reported accepted amounts; unknown prices are
counted separately. This is not the wallet balance, proof of handset delivery, or
net cost after later provider refunds. SendSMS wallet/delivery reconciliation is
available through the dashboard link; no balance API was supplied.

Checks: `tests/sms-usage.php`, `tests/sms-otp.php`, `tests/sendsms.php`,
`node tests/run-logistics.cjs admin-sms-ui`, and SQLite compatibility. They cover
authentication, masking, timezone boundaries, pagination/filtering, real OTP
accounting, ambiguous/rejected attempts, empty/error/retry UI and mobile layout.

Deployed 2026-11-18 (Ulaanbaatar), release `sms-usage-1794932642226`, after a
SQLite integrity-checked backup and backups of the replaced files. The production
SQLite 3.7.17 report query passed; the worker heartbeat was healthy. Live admin
HTML/JS/CSS match the reviewed files, anonymous reporting is rejected with 401,
the mobile API rejects the admin action with 404, and direct server source access
is forbidden. OTP remains enabled. No billable test SMS was sent.

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

### iOS build 20 compatibility correction — 2026-11-17

The November 16 iOS updates above targeted the ordinary EAS fingerprint, not the
Mac-built public 1.0.2 (20). Build 20 has runtime
`646e611a39796fd0c8cb87ef08a4ea35cc51abba`: its signing plugin, Apple team and
production request headers are included in the fingerprint. The native packages
and their hashes match; no new native module is needed for SendSMS.

The subsequent home-screen release from `d6c5057` includes the SendSMS registration
changes and correctly targets build 20. Production group
`5cd6f440-f3dc-4d03-b68d-047ad11b27d3`, iOS update
`01a1e9ec-e60f-71c6-b90e-cfa180746182`, was checked through the Expo update endpoint
using the installed runtime/channel. It returns this update, and its launch asset
downloads successfully using the protocol-provided asset headers with a matching
SHA-256 hash. The staged login, OTP component, API client and lockfile match the
reviewed source: `delivery: otp`, six-digit input, server `VERIFIED` confirmation,
and no verify.mn SMS composer. Expo typecheck and lint pass.

Use `node scripts/customer-ios-ota.cjs` to reproduce and check build 20's native
fingerprint before future iOS OTA releases; `--publish` publishes the verified
staging project. Do not simply publish iOS from the ordinary EAS config or override
the runtime string. No additional OTA was published during this verification:
the compatible home-screen release already contains the fix. Handset update
installation and real SMS delivery still require a user-device check.
