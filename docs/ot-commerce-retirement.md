# OT Commerce retirement (2026-11-07)

The live catalog moved to TaoWorld on 2026-10-30: search, image search, details, recommendations, deals,
official stores and domestic logistics all use TaoWorld when `catalog_provider` is `taoworld`, and
procurement uses TaoWorld purchasing. The owner decided on 2026-11-07 to cancel the OT Commerce
subscription (cancellation itself happens in the OT Commerce account, outside this repository).

- Admin → Ханш ба карго → "Каталогийн холболт" no longer offers OT Commerce once the catalog is TaoWorld,
  so a cancelled OT key cannot be selected by accident. Legacy OT-mode installs still see both options.
- The OT code paths, operator panel and tests remain for now (they only run in OT mode). Removing them is a
  separate clean-up.
- The OT catalog snapshot cron still runs daily on the host but returns `disabled`; it can be removed in
  cPanel → Cron Jobs (the line running `server/cache-refresh.php`).
- `server/config.local.php` on the host still contains the OT API key; it is unused in TaoWorld mode and can
  be blanked after cancellation.
