# Warehouse device login

Warehouse password login issues a random 256-bit device credential in a host-only HttpOnly cookie, Secure over HTTPS and SameSite=Lax. Only its SHA-256 hash is stored in the private database, bound to the warehouse and current account version. The password is never retained on the device. Existing valid warehouse sessions are enrolled automatically when they next access a warehouse API.

The device cookie survives app/browser closure and expires after 90 days, renewed at most once per day during use. It restores short PHP sessions after inactivity or session garbage collection, preserving the device CSRF value so an idle form remains usable. Native Android already flushes WebView cookies on pause; no APK change is required.

Explicit logout removes the credential and invalidates older PHP sessions associated with it. Disabled warehouses/accounts and changed account versions reject restoration. Admin/customer sessions do not use warehouse device credentials. Push subscription session ownership follows restoration so logout still revokes the same device's subscription.

Tests cover cold restart with only the persistent cookie, an expired idle session, deleted PHP session files, unchanged CSRF, hashed storage, forged/expired tokens, logout replay, account password/disable changes, warehouse binding, and admin/customer separation. Tests use an isolated database and session directory. A manager whose session has already expired before rollout needs to sign in once to enroll.


## iOS persistence correction — 2026-11-15

The warehouse iOS wrapper had `sharedCookiesEnabled` with `cacheEnabled={false}`.
In the installed react-native-webview 14.0.1 Apple implementation, that combination
selects `WKWebsiteDataStore nonPersistentDataStore`, so even an unexpired device
cookie can disappear on cold app restart. The warehouse variant now explicitly
uses `incognito={false}` and enables the persistent data store via `cacheEnabled`.
The admin variant retains its prior cache setting. API responses still send
`Cache-Control: no-store`; passwords are not saved or exposed to JavaScript.

TypeScript, the five native navigation/identity tests and the isolated warehouse
session suite passed. The latter covers cold restart, idle/GC recovery, daily
expiry renewal, logout and account revocation. Android already enables cookies
and flushes them on page load and pause; it needs no change for this issue.

This is an iOS app-source fix and requires a new warehouse app build. The current
staff app has no expo-updates integration, so the installed binary cannot receive
it through the website or OTA. A physical-iPhone force-close/relaunch test remains
part of validating the next build. This change has not yet been distributed.
