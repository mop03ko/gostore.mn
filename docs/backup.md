# Database backup and daily report

`server/daily-worker.php` runs once a day from cron (07:30 Ulaanbaatar):

1. **Backup**: `VACUUM INTO` makes a consistent copy of the live SQLite database while the site keeps
   writing. The copy must pass `PRAGMA integrity_check`, is gzipped to
   `<data_dir>/backups/daily/gostore-YYYYMMDD-HHMMSS.sqlite.gz` (mode 0600), and the newest 30 are kept.
   The pre-deployment snapshots in `<data_dir>/backups/*.sqlite` (October 2026) are separate and untouched.
2. **Google Drive copy** (when `<data_dir>/backup-drive.json` exists): resumable upload into the
   configured folder, MD5 verified against the local file; this app's backup files older than 90 days
   are deleted from the folder. A Drive failure never removes the local copy and is reported.
3. **Report e-mail** to `report_email` (default `shop@gostore.mn`): backup result, last-24-hour order and
   customer counts, TaoWorld API budget, push queues, disk space and grouped PHP error-log messages.
   It contains counts and error kinds only, never customer names, phones, addresses or order IDs.
   The subject starts with ⚠ when something needs attention.

Status of the last run: `<data_dir>/backup-status.json`.

## Google Drive setup (once, by the account owner)

Google no longer gives service accounts storage in personal Drives, so the backup uploads with the
owner's own Google account through an OAuth refresh token limited to `drive.file` (it can only see
files it created).

1. Google Cloud Console → create a project → **APIs & Services → Library → Google Drive API → Enable**.
2. **OAuth consent screen**: External, app name "gostore.mn backup", add the scope
   `.../auth/drive.file`, then **Publish app → In production**. (In "Testing", Google expires refresh
   tokens after 7 days. `drive.file` does not require Google verification.)
3. **Credentials → Create credentials → OAuth client ID → Desktop app**. Copy the client ID and secret.
4. On the workstation, from the repository root:
   `node scripts/drive-backup-authorize.cjs <client_id> <client_secret>`
   Sign in with the Google account that should hold the backups and allow access. The script creates
   the Drive folder **gostore.mn backups** and writes `tmp/backup-drive.json` (never committed).
5. Upload that file to the server as `/gostore-data/backup-drive.json` (mode 0600), then delete the local
   copy. The next daily run (or a manual run) uploads to Drive.

To revoke: myaccount.google.com/permissions → remove "gostore.mn backup", and delete the server file.

## Restore

1. Put the site in maintenance or stop writes (temporarily rename `api/index.php`).
2. Copy the chosen `gostore-….sqlite.gz`, `gunzip` it, check `sqlite3 file 'PRAGMA integrity_check'`.
3. Keep the current `gostore.sqlite` (and any `-wal`/`-shm` files) aside, then move the restored file to
   `<data_dir>/gostore.sqlite` with mode 0600. Restore `api/index.php`.

## Manual run

`/opt/cpanel/ea-php83/root/usr/bin/php /home/gostorem/public_html/server/daily-worker.php`
(`--no-mail` skips the e-mail). Tests: `tests/backup.php`.
