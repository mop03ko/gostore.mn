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

For reliable retries without any open manager page, add this cPanel cron:

```text
* * * * * /opt/cpanel/ea-php83/root/usr/bin/php /home/gostorem/public_html/server/warehouse-push-worker.php >/dev/null 2>&1
```

The CLI worker takes a process lock and handles up to 20 devices per run. Its last
run is stored as `warehouse_push_worker_last` in meta. No HTTP cron/secret URL is
exposed. Existing two-hour product-cache cron is unchanged.

## Android APK — not yet connected

`warehouse-android/` is a separate Java WebView application, not the customer Expo
app. Android WebView does not provide the browser Push API. It currently displays
the inbox while open and clearly directs managers to Chrome/Edge for browser push.
Closing that APK does not deliver native Android push.

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
credential. No server private key has been generated or deployed yet. A dedicated
FCM sender service account should have only the permissions needed for messaging;
keep its JSON outside public_html and never put it in Git or the APK. Do not send
private keys in chat.
The native SDK, notification permission/channel, token registration/revocation,
server FCM delivery and updated signed APK still need implementation after this
provider setup. Do not mark native push as complete or ship the current APK as a
push-capable build. FCM needs a compatible Google Play services device; confirm
the Erenhot manager's handset and network before choosing it for China use.

## Checks

`tests/warehouse-notifications.php`: confirmation, deduplication, assignment,
rollback, token revocation, SSRF allowlist, retry queue and ES256 verification.

`node tests/run-logistics.cjs warehouse-notifications-ui`: real service-worker push
event via Chrome DevTools with a fake provider subscription, inbox permissions,
Chinese/Mongolian UI, read state, logout, order links and phone layout. This does
not assert real FCM/APNs/Firefox delivery or test physical devices.
