# Warehouse device login

Warehouse password login issues a random 256-bit device credential in a host-only HttpOnly cookie, Secure over HTTPS and SameSite=Lax. Only its SHA-256 hash is stored in the private database, bound to the warehouse and current account version. The password is never retained on the device. Existing valid warehouse sessions are enrolled automatically when they next access a warehouse API.

The device cookie survives app/browser closure and expires after 90 days, renewed at most once per day during use. It restores short PHP sessions after inactivity or session garbage collection, preserving the device CSRF value so an idle form remains usable. Native Android already flushes WebView cookies on pause; no APK change is required.

Explicit logout removes the credential and invalidates older PHP sessions associated with it. Disabled warehouses/accounts and changed account versions reject restoration. Admin/customer sessions do not use warehouse device credentials. Push subscription session ownership follows restoration so logout still revokes the same device's subscription.

Tests cover cold restart with only the persistent cookie, an expired idle session, deleted PHP session files, unchanged CSRF, hashed storage, forged/expired tokens, logout replay, account password/disable changes, warehouse binding, and admin/customer separation. Tests use an isolated database and session directory. A manager whose session has already expired before rollout needs to sign in once to enroll.
