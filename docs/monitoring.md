# Monitoring

| Signal | Where | Who is told |
|---|---|---|
| Site down, admin unreachable, database unavailable | `.github/workflows/uptime.yml` every 15 min: storefront HTML, `/admin/`, `api/index.php?action=health` (3 retries) | GitHub e-mails the account that owns the repository when a scheduled run fails |
| Daily backup missing (> 36 h) | same workflow, `backup_age_hours` from the health endpoint | same |
| Backup/Drive failure, API budget spent, many PHP errors, low disk | `server/daily-worker.php` report (07:30 Ulaanbaatar) | `report_email` (`shop@gostore.mn`) |
| Unexpected API exceptions | PHP error log: `GOStore API: <class> action=<action> at <file>:<line>` plus the SQLite message for `PDOException` | daily report groups them |

`action=health` opens no session and is not cached. It returns `{"ok":true,"time":…,"backup_age_hours":…}`
(`null` until the first daily backup). A database failure returns 503.

GitHub sends failed-workflow e-mails to the GitHub account's notification address
(Settings → Notifications → Default notifications email; *Actions* → "Only notify for failed workflows").
GitHub pauses scheduled workflows in public repositories after 60 days without repository activity;
re-enable it under Actions → Uptime if that happens. Scheduled runs can start a few minutes late.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

- **server**: PHP 8.3 on Linux, `php -l` / `node --check` for every tracked PHP and JavaScript file, and
  every PHP suite registered in `tests/run-all.cjs` (`scripts/ci-php-tests.cjs` reads the list, so new
  suites are picked up automatically).
- **app**: `npm ci`, `npm run typecheck` and `npm run lint` in `gostoremn/`.

Browser and local HTTP-server suites (Playwright with Chrome, the Windows tool bundle) still run with
`node tests/run-all.cjs` before deployment. CI never deploys and holds no production credentials.
