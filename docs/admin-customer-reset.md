# Admin customer credential recovery

The owner can open **Admin → Хэрэглэгчид → customer → Нууц үг / PIN сэргээх** and enter a new credential twice. Email accounts support a password of at least 10 characters (maximum 72 bytes); SMS-linked phone accounts support a four-digit PIN. Accounts supporting both login methods show separate forms. Existing passwords cannot be viewed or recovered in plaintext. The administrator passes the new credential to the customer; this feature does not send SMS or email.

The existing CSRF-protected `admin-customer-save` endpoint handles `operation: reset-credential`. Although operators may edit customer profiles, the reset handler explicitly requires the owner role. It validates the credential kind, confirmation, account status, login identity and expected credential version under a write transaction. Deleted accounts and unavailable login methods cannot be restored. Concurrent changes require reopening the customer.

Passwords use the existing bcrypt rules; PINs use the existing peppered digest and bcrypt. Updating a credential increments the customer's `auth_version`, invalidating old browser/mobile sessions and push registrations. Other customers are unaffected. The target's email/PIN lockout is cleared while shared IP limits remain enforced. Customer profile, orders, verified phone and the other login method are retained.

The existing admin audit records the operator, customer ID, operation and credential kind. Secret fields use `new_password` and `password_confirm`, which are excluded by the audit redaction rules. Responses never include the new credential or stored hashes.

## Verification

- PHP lint and JavaScript syntax checks passed.
- `node tests/run-logistics.cjs admin-customer-reset admin-customers admin-customers-ui`
- Integration tests cover password/PIN login, old web/mobile session rejection, other-user isolation, owner-only access, CSRF, confirmation/length checks, stale forms, unavailable methods, deleted accounts, lockout recovery, audit redaction, and mobile admin submission.
- Existing customer directory/profile tests pass, including 320px/390px layout and mobile navigation.

Deployment is limited to `server/admin-customers.php` and the four affected admin assets. No real customer credential was changed during development or verification.

Remote baseline and published hashes were verified. Backup: `/gostore-backups/admin-customer-reset-20261115-e18da00eea`. Live admin HTML references the new script; both assets and the anonymous admin session endpoint returned HTTP 200, with the session remaining unauthenticated.
