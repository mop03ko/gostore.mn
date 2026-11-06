# verify.mn phone verification

The website profile has an optional **Утас баталгаажуулах** action. `window.verifyPhone(phone): Promise<boolean>` opens an accessible SMS dialog and resolves true only when the backend has independently read `sessionStatus === VERIFIED` from verify.mn. Cancel, expiry, invalid response, and failure return false. Pending/transient status requests retry every approximately 3 seconds until the five-minute deadline. The user must send the SMS; opening the SMS app alone is not confirmation.

## Configuration

Set `VERIFY_MN_API_KEY` in the PHP server process environment. It is read with `getenv`, never bundled or returned. On shared hosting without Apache SetEnv, the server-only `server/verify-mn.env` file can contain `VERIFY_MN_API_KEY=<value>`; the integration imports only this named variable into the process environment. This file is ignored by Git and its entire directory is denied over HTTP. A process environment value takes precedence. `verifymn.txt` is a local credential reference, ignored by Git and denied by Apache; the runtime does not read it or expose it. Do not upload this file. Test runners disable provider networking (`GOSTORE_DISABLE_VERIFY_MN=1` or `GOSTORE_DISABLE_SUPPLIER_NETWORK=1`).

## Routes and flow

- GET `/api/index.php?action=phone-verification-config`: availability boolean and customer-session CSRF token; no credentials.
- POST `phone-verification-start` with `{phone}`: CSRF required, normalize Mongolia 8 digits / +976, rate limit by IP and phone, create a unique ASCII SMS text and provider session. No callback or custom carrier reply is registered. Return an opaque local challenge, safe SMS URI, provider instruction as plain text, and deadline.
- POST `phone-verification-status` with `{challenge}`: CSRF required, match current session and customer, call provider GET `/sessions/{id}` without Authorization; verify exact provider session ID and status; cache polls for 3 seconds and enforce local/provider expiry.

The confirmed phone and timestamp are held only in `$_SESSION['phone_verified']`, bound to the current customer and exact normalized phone. This is **not** a permanent profile verification flag, phone-based login, account recovery mechanism, or checkout requirement. Never trust a client boolean as authorization. A future protected operation must check the server proof's customer, normalized phone and freshness. Signing out clears the proof; starting another verification clears the earlier proof. Expo native UI is not changed in this release.

## Validation

`tests/verify-mn.php` checks normalization, session ownership, stale challenges, rate limits, exact VERIFIED confirmation, callback/verifiedAt spoofing, errors and expiry with a fake provider transport. `tests/verify-phone-ui.cjs` checks the actual dialog and promise in headless Chrome with mocked backend responses. `tests/verify-phone-api.mjs` checks CSRF and session routing against the isolated PHP API. No real subscriber SMS is sent by automated tests. A physical-phone SMS test is required to confirm the production key and carrier flow end to end.