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

Server support: PHP OpenSSL and cURL. A P-256 VAPID key is generated once in private
`data_dir/warehouse-vapid.json` (outside public_html, mode 0600). Back up this file;
replacing it requires browsers to subscribe again. Only its public key is exposed.
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

Native delivery needs a push-provider project. The owner confirmed none exists.
For Firebase/FCM, register Android package **mn.gostore.warehouse**, provide its
`google-services.json` locally (never put server credentials in the APK), and place
an FCM service-account JSON outside public_html. Do not send private keys in chat.
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
