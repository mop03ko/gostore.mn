# Amazon integration security readiness

Prepared 2026-11-18 for Arvis Trans KLTC / GOStore. This is an implementation and evidence checklist, **not a claim of Amazon approval or completed compliance**.

## Intended business and registration

The owner confirmed purchasing from Amazon, not selling on Amazon or managing other sellers. The SP-API Solution Provider Profile may therefore be the wrong application path. Confirm eligibility for Amazon Business product information and Ordering APIs, off-Amazon product display and resale, supported business country and delivery regions before requesting seller/vendor roles.

The browser form contains organization/contact details and an accurate purchasing-only use case. Register was not submitted. Save as draft refused the incomplete required fields. Security attestations, organization type, roles and agreement remain unanswered. Do not mark unknown controls as Yes or choose an unrelated role to pass validation.

## Implemented and deployed

- Admin passwords must have at least 12 characters, a punctuation/symbol character, and at most 72 bytes (bcrypt limit). Passwords remain bcrypt hashes.
- Creation, reset and password change record a hash-bound change timestamp. Unknown legacy credentials require rotation when enforcement is enabled; changing unrelated profile details does not extend password age. Expiry is exactly 365 days.
- MFA enrollment and password rotation are allowed in a restricted session; other admin actions are blocked server-side when enforcement is on. MFA-disabled, expired-password and non-MFA-authenticated sessions cannot access the dashboard or operational data.
- Enrolling/resetting MFA invalidates previous sessions. An MFA proof is bound to the enrolled secret. An enforced account cannot turn MFA off. Role-based authorization remains active after enrollment.
- The UI guides restricted accounts to security setup and refreshes state after password/MFA changes. Account-status responses never expose the secret or password hash.
- Existing repository exclusions were extended to the locally named Amazon credentials and Firebase key files. This does not rotate credentials or establish that repository history is clean.
- Apache denies named credential exports even if accidentally uploaded to the public root.

Deployment `admin-security-1794937960269` completed on 2026-11-18 after file and SQLite backups. The live audit reported one active admin, one missing MFA and one requiring a policy-recorded password change. Enforcement remains off pending account-holder enrollment and recovery verification. Public API health/session/phone-verification configuration returned 200; credential export paths and the new server module returned 403. No real OTP/SMS or supplier order was sent. The audit endpoint was temporary, authenticated and removed after use.

After the owner reported MFA enrollment, a fresh live audit confirmed the single active admin had both MFA and a current policy-recorded password. Enforcement was then enabled in protected server configuration under release `admin-security-1794938203423`, with a protected configuration backup. Live verification returned `enforced=true`, no missing MFA, no required password rotation, and healthy API. Temporary audit probes were removed. This confirms the application account controls, not hosting/KMS compliance or completion of a recovery exercise.

Validation: password expiry/binding/recovery-guard unit tests; enforced browser enrollment and password rotation at phone width; existing admin account/management/UI tests; staff push tests; TaoWorld web authorization tests; SQLite 3.7 compatibility and changed-source syntax checks. The full unrelated catalog test suite was not rerun.

## Rollout and recovery

1. Test changes in isolation and deploy the listed files with enforcement **off**. Do not disable existing authentication.
2. Each active admin opens `/admin/#security`, changes their password and enrolls their own Authenticator. The account holder must scan the QR and confirm a code themselves; do not send credentials or OTPs through chat. An owner without an alternate enrolled owner needs a tested server-side recovery procedure before enforcement.
3. Run `php scripts/admin-security-audit.php` on the actual server. Output contains aggregate readiness only, no names, secrets, password hashes or OTPs. All active accounts must be ready.
4. Enable `admin_security_enforced => true` in protected server configuration or set `GOSTORE_ADMIN_SECURITY_ENFORCED=1` in the PHP runtime. Verify a fresh MFA login, password-only refusal, existing-session behavior and unauthorized route refusals.
5. Incident recovery: an enrolled owner can reset a staff member's TOTP; their sessions are revoked and re-enrollment is required. For sole-owner loss, use authenticated hosting administrator access, independently verify the owner, preserve an audit record, revoke sessions and rotate the password before repairing enrollment. There is no public bypass endpoint. Do not globally disable enforcement as routine recovery.
6. Annual password rotation is enforced by the access guard. Track provider/key rotation separately; this timestamp is not evidence of KMS or host account password rotation.

Deployment files: `server/admin-security.php`, `server/admin-users.php`, `server/bootstrap.php`, `server/config.example.php`, `server/taoworld-web.php`, `server/staff-push.php`, `api/index.php` (dispatch marker only), `api/taoworld/connect.php`, `api/taoworld/callback.php`, `admin/admin.js`, `admin/admin-extra.js`, `admin/index.html`. The CLI audit script is optional and must remain blocked from HTTP. The MFA binding change ends existing MFA-enabled sessions and invalidates their old admin push registrations; re-login/re-register after deployment. Warehouse sessions are not changed.

## Evidence still needed before attestation

| Control | Current evidence / remaining work |
|---|---|
| Network firewall, IDS/IPS, anti-malware, network segmentation | Shared hosting/cPanel only, confirmed by owner. Root/WHM control is unavailable. Obtain provider evidence for this account and remediation if any control is absent. PHP rate limiting is not a network IDS/IPS. |
| Job-based access | Existing owner/operator/viewer controls and tests; review production account assignments and limit Amazon data to approved personnel. Customer and warehouse roles are separate. |
| Encryption in transit | API requires HTTPS; site HSTS already configured. Verify minimum TLS 1.2 at host and all future Amazon integrations, backups, mail and deployment channels; no raw FTP or certificate verification bypass. |
| Incident response | Prepared in `security-incident-response.md`; owner must record adoption, contacts, a tabletop exercise and recurring six-month reviews. A document alone does not prove operation. |
| Passwords and MFA | Code ready; deployment, account-holder enrollment, enforcement and actual account audit still required. cPanel, Amazon and GitHub authentication settings also require owner setup. |
| Secrets and storage | Server config is excluded from git and HTTP access. Existing TOTP secrets are currently stored in SQLite, not a separate KMS. Encrypted storage/backups and a managed key lifecycle require architecture/provider verification; not attested as complete. |
| Outside parties | Review hosting, deployment services, analytics, payment and shipping processors against actual Amazon data flow. Do not answer None just because the integration is not live yet. Never send Amazon credentials/PII to analytics. |

## Provider request (draft, not sent)

Please confirm controls protecting the GOStore shared hosting account: network and application firewall coverage; IDS/IPS monitoring and response; scheduled malware scanning and remediation; isolation from other tenants and network segmentation; minimum TLS 1.2; encryption of server storage and backups; administrator MFA/access logging; and procedures to notify us of incidents in time for a 24-hour Amazon reporting deadline. Please provide dated evidence and identify controls that require a different hosting plan. We are assessing readiness, not claiming certification.

References: [Amazon encryption guidance](https://developer-docs.amazon.com/sp-api/docs/protecting-amazon-api-applications-data-encryption), [Amazon Business Ordering](https://docs.business.amazon.com/docs/placing-an-order). Confirm the applicable Amazon Business terms and current security requirements with Amazon; the pasted SP-API questionnaire is not proof that its access path is appropriate.
