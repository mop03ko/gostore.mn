# Warehouse order notifications

Newly confirmed orders notify the assigned Erenhot and Ulaanbaatar warehouse accounts.
Unpaid drafts do not notify. A branch assignment creates a notice for the new branch;
the former branch loses access. A unique location/order key prevents duplicate notices
on repeated payment callbacks or later order updates. Order writes and notices share a
savepoint. Existing orders are not bulk-notified when the feature is installed.

The manager panel has an inbox, unread count, mark-read and order links. Erenhot uses
Chinese; Ulaanbaatar uses Mongolian. The visible panel refreshes the inbox every 30
seconds. This is separate from background Web Push.

## Browser push

Log in at `/warehouse/`, choose **Push мэдэгдэл идэвхжүүлэх / 开启推送通知**, and grant
the browser permission. Each device must opt in. A service worker scoped to
`/warehouse/` receives an empty Web Push wake-up and fetches the order code using a
revocable, device-scoped bearer token. It never caches pages or API responses and
never sends customer names, phone numbers or order contents to a push provider.
The notification opens the authenticated warehouse order screen.

Server support: PHP OpenSSL and cURL. A P-256 VAPID key is kept in private
`data_dir/warehouse-vapid.json` (outside public_html, mode 0600). Back up this file;
replacing it requires browsers to subscribe again. Only its public key is exposed.
The live host could sign EC keys but failed EC key generation, so its key was
generated locally and provisioned over verified FTPS with mode 0600; live signing
was then verified. The scoped token uses `X-GOStore-Push-Token` because this host
does not forward the standard Authorization header to PHP. Authorization remains
accepted for other environments.
Push POSTs use RFC 8030 empty bodies and RFC 8292 VAPID authentication; no payload
encryption library is needed because the provider receives no payload. Redirects
are disabled and only known browser push-service hosts are accepted.

Logout revokes that session's registered devices. The service worker also revokes
its own token and unsubscribes on logout/session expiry. Disabling a warehouse or
changing its manager credentials invalidates device delivery immediately. Devices
expire after 90 days and can be rebound using the same button.

New notices enter an outbox on each subscribed device. A bounded shutdown worker
attempts immediate delivery (after `fastcgi_finish_request` when available).
The live host has FastCGI response finishing, OpenSSL and cURL (verified during
deployment). Without response finishing, the shutdown worker can add up to about
14 seconds to the request (10-second budget plus an in-flight timeout). Inbox requests
also retry due deliveries. HTTP 404/410 subscriptions are removed; transient
failures back off up to one hour. HTTP success means the push service accepted the
message, not proof that a phone displayed it.

For reliable retries without any open manager page, use this cron:

```text
* * * * * /opt/cpanel/ea-php83/root/usr/bin/php /home/gostorem/public_html/server/warehouse-push-worker.php >/dev/null 2>&1
```

The CLI worker takes a process lock and handles up to 20 devices per run. Its last
run is stored as `warehouse_push_worker_last` in meta. No HTTP cron/secret URL is
exposed. Existing two-hour product-cache cron is unchanged.

The one-minute push cron was installed and verified on 2026-11-03, preserving
the existing crontab. A later read-only audit confirmed a fresh worker timestamp.

## Android APK — native FCM

`warehouse-android/` is a separate Java WebView application, not the customer Expo
app. Android WebView does not provide the browser Push API. Version 1.1.0 adds
native Firebase Messaging, Android notification permissions and a notification
channel. Managers opt in after login and can use **测试推送 / Push турших** to send
a test to their own device without creating an order. Receiving a notification
does not require the warehouse page to remain open; OS force-stop, permissions,
device restrictions and network availability still affect delivery.

Firebase project **GOStore Warehouse** (`gostore-warehouse`) was created on
2026-11-03 with the no-cost Spark plan, without Google Analytics or Gemini enabled
during setup. Android app **GOStore Warehouse Android** is registered with package
**mn.gostore.warehouse**, project number `681834677731`, and app ID
`1:681834677731:android:d0f28b5e733db439ed8cd6`.
Firebase Cloud Messaging API (V1) is enabled (verified in the console); the legacy
API remains disabled.

Console: https://console.firebase.google.com/project/gostore-warehouse/overview

The downloaded Android client configuration is stored locally as
`warehouse-android/google-services.json` (Git-ignored). It is not a server
credential. With explicit owner authorization, the dedicated service account
`warehouse-push-sender@gostore-warehouse.iam.gserviceaccount.com` was created with
only the Firebase Cloud Messaging API Admin role. Its JSON is stored in private
`data_dir/warehouse-fcm-service-account.json` outside public_html, mode 0600.
OAuth access tokens are cached privately for at most one hour. Neither secret is
included in Git, the APK or JavaScript. HTTP v1 uses only the firebase.messaging
OAuth scope and fixed Google endpoints; redirects are disabled.

The server sends only a high-priority data wake-up (no order/customer data).
Native code retrieves order information using a revocable device credential,
stored in app-private preferences with Android backup disabled. Token registration
requires a manager session and CSRF; refresh and test requests use the scoped
device credential. Logout clears native state, revokes server binding and removes
displayed notifications. Assignment/account checks and duplicate suppression run
before display. Lock-screen public content is generic. Native actions use guarded
main-frame navigation, without exposing credentials through a JavaScript bridge.

Web and FCM share the existing device/outbox lifecycle and retry worker. An FCM
UNREGISTERED response removes the device; a project-level 404 stays queued. API
acceptance is not evidence that a handset displayed the message. The live OAuth
and a validation-only request have been checked without sending an actual push.
Physical phone delivery still requires installing the APK, enabling notifications
and receiving a test. FCM needs compatible Google Play services and network access,
which must be checked on the Erenhot manager's handset.

## Checks

`tests/warehouse-notifications.php`: confirmation, deduplication, assignment,
rollback, token revocation, SSRF allowlist, retry queue and ES256 verification.

`node tests/run-logistics.cjs warehouse-notifications-ui`: real service-worker push
event via Chrome DevTools with a fake provider subscription, inbox permissions,
Chinese/Mongolian UI, read state, logout, order links and phone layout. This does
not assert real FCM/APNs/Firefox delivery or test physical devices.

`tests/warehouse-fcm.php`: scoped native registration/rotation, signed OAuth/cache,
minimal FCM payload, error classification, delivery scope and logout revocation.
The UI suite also checks native enable/test states and logout.

`warehouse-android/build.ps1`: navigation tests, seven Robolectric notification
tests, Android lint, release build, alignment and signature verification. Version
1.1.0 uses the existing signing certificate so it can update version 1.0.0.

Release download: https://gostore.mn/downloads/warehouse-1.1.0/GOStore-Erenhot-1.1.0.apk

SHA256: `a6379e05f846be5a9c327725324df38e9daa8aa16d32267b6a751bae7a281298`.
Public download bytes and all seven deployed source files were verified against
local hashes. The live credential is outside public_html with mode 0600. No native
device was subscribed at deployment, so physical FCM receipt remains unverified.
