# Direct TaoWorld authorization

The initial direct integration supports buyer authorization and explicit token refresh
only. It does not replace the OT catalog, create purchases, submit supplier payments,
or enable automatic procurement. Catalog API permissions still require verification
after the buyer authorizes the app.

## Operator steps

1. In Taobao Global App Console, register exactly:
   `https://gostore.mn/api/taoworld/callback.php`.
2. Sign in at `https://gostore.mn/admin/`, then open
   `https://gostore.mn/api/taoworld/connect.php` in the same browser.
3. Select **TaoWorld дансаа холбох** and authorize with the approved TaoWorld
   purchasing account. The developer-console identity may be different.
4. The provider returns to the callback; GOStore exchanges the code server-side and
   redirects to a clean status page. Check that the account is connected. Confirm
   granted product API permissions separately before a read-only integration test.

Reference: [Alibaba's Taobao Global development manual, sections 2.6.4 and 3.2](https://developer.alibaba.com/docs/doc.htm?articleId=121120&docType=1&treeId=735).
The signing implementation passes the manual's published HMAC-SHA256 vector. The
manual is dated 2022; account-specific permissions and current schemas still need
confirmation. No assumed fixed token lifetime is used: expiry comes from the response.

## Configuration and safeguards

- `scripts/configure-taoworld.php` imports AppKey/AppSecret from the owner's local
  text file into ignored `server/taoworld.local.php`. It prints no credential values.
  It refuses to overwrite an existing configuration. Both private files are ignored
  by Git; the original text filename is explicitly denied by Apache as well.
- AppSecret and buyer tokens are never embedded in JavaScript, HTML or authorization links.
  The public AppKey identifies the app in the provider authorization URL; AppSecret
  stays on the server. The protected server directory blocks HTTP access.
- The flow requires an authenticated admin session, POST CSRF validation to initiate,
  a random session-bound one-use state with a ten-minute lifetime, and matching app
  credentials. A new attempt replaces that session's previous state. Missing cookies,
  an expired session, replay or a mismatched state require starting again.
- Tokens live under the private configured `data_dir/taoworld/auth.json`, with a
  directory mode of 0700 and an atomic file replacement using mode 0600. Token state
  is separate from OT credentials and bound to a hash of the current app credentials.
  Changing the app configuration requires new authorization.
- Token exchange and refresh share a non-blocking exclusive lock. Refresh rotates
  both tokens together, preserves the existing state on failure and cannot extend
  the previously recorded refresh lifetime or switch a known account identity.
- The token transport allows only `/auth/token/create` and `/auth/token/refresh`,
  uses signed HTTPS POSTs, verifies TLS and follows no redirects. It never
  automatically retries token exchanges. Raw provider bodies are not shown or logged.
- Pages are non-cacheable, disallow framing and send `Referrer-Policy: no-referrer`.
  The callback removes its code-bearing URL through a redirect. Host access logs may
  still record the inbound callback query; restrict those logs as operational data.

## Validation

`tests/taoworld-signature.php` checks the official signing vector, ordering and
sign exclusion, denied purchase endpoints and the disabled-network guard.
`tests/taoworld-auth.php` uses isolated fake credentials/transport for admin gates,
state expiry/replay, cancellation, app/account binding, lock contention, token
rotation and expiry, failure preservation and public-state redaction.
`tests/taoworld-web.cjs` runs an isolated copied app with synthetic credentials and
transport, verifying login/CSRF, redirects, cross-session rejection, callback
cleanup, token persistence and mobile layout. No live buyer token, order or payment
is created by these tests.
