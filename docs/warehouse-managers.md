# Multiple managers per warehouse

The owner can use **Admin → Агуулахууд → Менежер нэмэх** to create independent warehouse logins. Enter the manager's name, email, initial password and enabled state. Each warehouse card lists its managers, with an edit action for name/email/password changes or disabling access. Saving an account revokes that manager's current login and push credentials; the other managers continue working.

The existing primary account is preserved. Additional accounts are stored in `meta` under `warehouse_managers_<location>` and have separate bcrypt password hashes and random authentication versions. The existing device and push tables already carry an account version, so no schema migration or password reset is required. Public admin responses expose no hash or authentication version.

The existing owner-only, CSRF-protected `warehouse-account-save` endpoint accepts `manager_id: new`, an existing `wm-…` ID, or `primary`. Email uniqueness is checked within each warehouse under a SQLite write transaction; a manager ID from another warehouse cannot be edited. A warehouse can have up to 50 additional managers. Warehouse operational roles and order visibility are unchanged; a warehouse manager cannot grant administrative access.

Login, persistent session restoration and push validity resolve the actual manager's version. Order history and logistics audit events record the signed-in manager's email. Disabling a warehouse rotates all its manager versions so reopening it cannot restore old sessions. Notification inbox/read state remains shared at the warehouse level, as before; subscriptions and revocation are individual.

## Validation

- PHP lint for all changed PHP files; JavaScript syntax checks for both admin scripts.
- `node tests/run-logistics.cjs warehouse-managers warehouse-session warehouse-branches`
- `node tests/run-logistics.cjs warehouse-notifications-ui`

New integration coverage includes owner UI create/edit/disable, duplicate emails, missing CSRF, non-owner denial, cross-warehouse edits and order access, independent password/session/push revocation, cold restart, and branch disable/re-enable revocation. Existing login, warehouse operations and notification UI tests pass.

## Deployment

Only the affected warehouse server modules and admin assets were published after baseline comparison and remote backup. Backup: `/gostore-backups/warehouse-managers-20261115-568ce521da`. Published hashes matched the local files. The live admin HTML and new script returned HTTP 200, and both anonymous admin/warehouse session checks returned HTTP 200 with `authenticated: false`. Existing accounts and production orders were not modified or used to create test managers. Deployment artifacts are recorded in the ignored `tmp/warehouse-managers-deployment/` directory.
