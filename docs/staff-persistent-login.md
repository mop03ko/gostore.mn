# Persistent staff login

Admin web sessions now have a rolling 365-day HttpOnly, SameSite=Lax cookie (Secure over HTTPS). Session files live in the private `admin-sessions` directory so cPanel's default short session cleanup cannot remove them. The daily worker prunes inactive files after 365 days. Valid legacy sessions are moved to that directory on first use, retaining their CSRF and MFA state. The original file is moved, not copied, so logout cannot be bypassed by replaying a legacy copy.

Warehouse device credentials retain their existing hashed, account-bound restoration mechanism; their rolling lifetime is now also 365 days. Android already persists and flushes WebView cookies. Explicit logout, account/password/TOTP/role version changes and disabled warehouse accounts still invalidate authorization. No passwords are saved by this change. Clearing app data or more than a year of inactivity requires a fresh sign-in.

Both iOS staff variants now use `cacheEnabled` with `sharedCookiesEnabled` and `incognito={false}`. In the installed WebView implementation this selects the persistent WKWebsiteDataStore. Admin previously selected a nonpersistent store. Server API responses remain no-store. These wrappers do not include expo-updates, so the change requires new iOS binaries.

Validation: isolated `staff-session`, `warehouse-session`, `admin-accounts` API suites; native TypeScript and eight native tests. Tests cover cold restart, 60-day inactivity, daily expiry renewal, legacy migration, logout replay, account revocation, MFA and realm separation. Physical iPhone force-close/relaunch remains a device acceptance check.

## Release — 2026-11-18

Server files were deployed with hash verification and an anonymous authorization check. Backup: `/gostore-backups/staff-session-20261118-5e3f6f41`. The live admin session endpoint issues a Secure, HttpOnly, SameSite=Lax cookie with a 31,536,000-second lifetime. Android's existing cookie persistence requires no new APK.

Native builds from commit `8da36c2` were successfully signed and uploaded to App Store Connect:

- Admin 1.0.0 (7): [GitHub run 44327615348](https://github.com/mop03ko/gostore.mn/actions/runs/44327615348), Apple build `28ce57e3-e1ad-456a-ab4f-184c7dcad251`, VALID and assigned to the existing internal TestFlight group.
- Ulaanbaatar warehouse 1.0.1 (7): [GitHub run 44327624911](https://github.com/mop03ko/gostore.mn/actions/runs/44327624911), Apple build `e84deffb-4198-4d07-af35-cc541d15332e`, VALID and assigned to the existing warehouse TestFlight group. Beta review was submitted; final Apple external state is IN_BETA_TESTING.

Both temporary GitHub signing secrets were deleted after successful upload; the repository secret list was verified empty. No new public App Store version was released by this change.

Device acceptance: install the updated staff iOS build, sign in once, force-close and reopen the app, then repeat after restarting the phone. The same account and warehouse should remain selected. Explicit logout must return to sign-in, including after another restart. Also verify server-side password change or account disable prevents reuse of the previous login. An old admin session already lost by the previous nonpersistent iOS store requires one fresh sign-in.
