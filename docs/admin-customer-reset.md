# Admin customer credential recovery

The owner can open **Admin → Хэрэглэгчид → customer → Нууц үг / PIN сэргээх** and enter a new credential twice. Email accounts support a password of at least 10 characters (maximum 72 bytes); Phone-linked accounts support a four-digit PIN. Accounts supporting both login methods show separate forms. Existing passwords cannot be viewed or recovered in plaintext. The administrator passes the new credential to the customer; this feature does not send SMS or email.

The existing CSRF-protected `admin-customer-save` endpoint handles `operation: reset-credential`. Although operators may edit customer profiles, the reset handler explicitly requires the owner role. It validates the credential kind, confirmation, account status, login identity and expected credential version under a write transaction. Deleted accounts cannot be restored. Adding a phone login requires the explicit owner-assisted enrollment described below. Concurrent changes require reopening the customer.

Passwords use the existing bcrypt rules; PINs use the existing peppered digest and bcrypt. Updating a credential increments the customer's `auth_version`, invalidating old browser/mobile sessions and push registrations. Other customers are unaffected. The target's email/PIN lockout is cleared while shared IP limits remain enforced. For existing credential resets, the customer profile, orders, login phone and the other login method are retained.

The existing admin audit records the operator, customer ID, operation and credential kind. Secret fields use `new_password` and `password_confirm`, which are excluded by the audit redaction rules. Responses never include the new credential or stored hashes.

## Owner-assisted PIN enrollment

Customers without a phone login now also have a **PIN нэвтрэлт нэмэх** form. The owner enters the customer's Mongolian phone number, confirms that it belongs to this customer, and enters a four-digit PIN twice. This explicitly bypasses SMS verification; `verified_at` remains empty rather than claiming an SMS check. The audit records `enable_pin`, the phone and owner attestation, but never the PIN.

The request uses `enable_pin: "1"`, `confirm_phone_owner: "1"`, the existing empty `expected_login`, and `expected_phone`. Enrollment checks the current profile and credential version inside the write transaction. A number already linked to another account is rejected; an existing PIN login cannot be replaced through this enrollment path. The profile phone is updated to the enrolled number. Existing email login remains available, while all previous sessions are revoked. Ordinary customer enrollment still requires SMS verification.

Integration tests cover enrollment through both API and the mobile admin form, owner/CSRF guards, explicit consent, invalid/duplicate numbers, stale forms, email login preservation, and web/mobile PIN login. No real customer credentials are changed by these tests.

## Verification

- PHP lint and JavaScript syntax checks passed.
- `node tests/run-logistics.cjs admin-customer-reset admin-customers admin-customers-ui`
- Integration tests cover password/PIN login, old web/mobile session rejection, other-user isolation, owner-only access, CSRF, confirmation/length checks, stale forms, unavailable methods, deleted accounts, lockout recovery, audit redaction, and mobile admin submission.
- Existing customer directory/profile tests pass, including 320px/390px layout and mobile navigation.

Deployment is limited to `server/admin-customers.php` and the four affected admin assets. No real customer credential was changed during development or verification.

Remote baseline and published hashes were verified. Backup: `/gostore-backups/admin-customer-reset-20261115-e18da00eea`. Live admin HTML references the new script; both assets and the anonymous admin session endpoint returned HTTP 200, with the session remaining unauthenticated.

PIN enrollment deployment: four affected PHP/admin files backed up at `/gostore-backups/admin-pin-enroll-20261115-106a270d63`, published and hash-verified. Live admin HTML and script returned HTTP 200 with the new cache version; the anonymous admin session remained unauthenticated.
