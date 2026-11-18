# Persistent staff login

Admin web sessions now have a rolling 365-day HttpOnly, SameSite=Lax cookie (Secure over HTTPS). Session files live in the private `admin-sessions` directory so cPanel's default short session cleanup cannot remove them. The daily worker prunes inactive files after 365 days. Valid legacy sessions are moved to that directory on first use, retaining their CSRF and MFA state. The original file is moved, not copied, so logout cannot be bypassed by replaying a legacy copy.

Warehouse device credentials retain their existing hashed, account-bound restoration mechanism; their rolling lifetime is now also 365 days. Android already persists and flushes WebView cookies. Explicit logout, account/password/TOTP/role version changes and disabled warehouse accounts still invalidate authorization. No passwords are saved by this change. Clearing app data or more than a year of inactivity requires a fresh sign-in.

Both iOS staff variants now use `cacheEnabled` with `sharedCookiesEnabled` and `incognito={false}`. In the installed WebView implementation this selects the persistent WKWebsiteDataStore. Admin previously selected a nonpersistent store. Server API responses remain no-store. These wrappers do not include expo-updates, so the change requires new iOS binaries.

Validation: isolated `staff-session`, `warehouse-session`, `admin-accounts` API suites; native TypeScript and eight native tests. Tests cover cold restart, 60-day inactivity, daily expiry renewal, legacy migration, logout replay, account revocation, MFA and realm separation. Physical iPhone force-close/relaunch remains a device acceptance check.
