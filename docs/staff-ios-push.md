# Staff iOS push

Admin (`mn.gostore.admin`) and UB Warehouse (`mn.gostore.ubwarehouse`) use native Expo/APNs alert notifications with `sound: default`, high delivery priority and a one-hour TTL. Delivery does not require WebView/JavaScript to run in the background. iOS notification permission, Sounds and Lock Screen settings remain under the employee’s control. Silent Mode, Focus, network availability and Apple delivery conditions can suppress/delay sound. These are normal alerts, not critical alerts.

## Registration and security

The native Мэдэгдэл button requests permission and registers the Expo project-specific token through a same-origin WebView request to `/api/staff-push.php`. PHP session cookies and CSRF never leave WKWebView. The backend derives the account and warehouse; the client cannot choose recipients. Registration is renewed on launch/foreground and token rotation. Logout and changed/deactivated credentials revoke delivery. UB registrations additionally require the current persistent warehouse device session. Push payloads contain a generic notice only, no customer details or order identifiers. Notification taps open the authenticated order panel. The preference is stored in SecureStore.

## Events and operation

A SQLite 3.7-compatible insert trigger and the transactional save_order hook append events on creation, status, paid or warehouse assignment changes. JSON comparison runs in PHP; JSON1/unixepoch are not required. Registrations start at the current cursor (no historical flood). Admin receives order changes; UB receives eligible orders currently assigned and visible to Ulaanbaatar. Cancelled/reassigned orders cannot disclose information to a former warehouse. Multiple changes coalesce into one alert.

`server/warehouse-push-worker.php`, already scheduled every minute, also drains the staff queue. Expo tickets/receipts, retry backoff, invalid-token removal and a worker lock bound delivery attempts. Accepted alerts with unknown receipts are not blindly re-sent. Receipt errors retain events for retry. Events retain seven days; only changes in the latest day notify. `meta.staff_push_worker_last` reports worker liveness; device `last_error` reports delivery configuration errors. Expo acceptance does not prove on-device presentation.

## Release and acceptance

APNs signing key is attached to both EAS projects; App Store profiles must include `aps-environment=production`. Native dependencies require a new signed build, not an OTA-only update. The macOS build script checks the profile before signing and the embedded profile before upload.

After installing the new TestFlight build, sign in, choose Мэдэгдэл → Идэвхжүүлэх, then Дэлгэц түгжиж турших. Close the app and lock the phone; the server schedules a test after 15 seconds, normally delivered by the next minute worker. Verify banner, audible sound, tap routing, foreground behavior and logout revocation on both physical iPhones. No fake orders/payment are needed. This physical device acceptance must be recorded separately; automated tests do not prove sound.

Checks: `tests/staff-push.php`, `staff-ios/tests/push-bridge.test.cjs`, staff typecheck/navigation tests, existing customer/warehouse push regression tests.
