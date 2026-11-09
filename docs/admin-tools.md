# Admin tools

Added 2026-11-09. Four new admin pages (Тайлан, TaoWorld лимит, Сайтын тохиргоо, Админ ба аудит), staff accounts with roles, an audit log, two-step sign-in, TaoWorld after-sales in the order view and dashboard alerts.

Server: `server/admin-users.php`, `server/admin-reports.php`, `server/taoworld-aftersale.php`, `server/catalog-controls.php`. Browser: `admin/admin-extra.js`, which loads before `admin/admin.js` and hooks into its `render()` and `editOrder()`, and `admin/admin-ux.js` (below), which loads after it.

## Layout and navigation (admin-ux.js)

`admin/admin-ux.js` replaces several `admin.js` render functions (`tag`, `orderTable`, `ordersList`, `overview`) and wraps `modal`, `editOrder` and `render`. The plan it follows, with before/after screens, is the «GOStore админы шинэчлэл» artifact.

- **Menu.** Grouped into Борлуулалт, Каталог ба маркетинг, Шинжилгээ, Тохиргоо. Orders show the new count; Хятад захиалга shows TaoWorld orders to review.
- **Search (Ctrl + K, or «Хайх» in the header).** Finds pages, orders (number, name, phone digits), products, customers (operator and above, from `admin-customers`), and opens a Taobao item number or link on the store.
- **Dashboard.** Four figures: today's orders against yesterday, today's paid revenue against the 7-day average, unpaid orders, and TaoWorld API use. Below them:
  - «Хийх ажил»: new orders, TaoWorld review, unpaid, ready in Ulaanbaatar. Each opens the matching order tab.
  - A 7-day revenue chart and the latest orders.
- **Orders.**
  - Tabs with counts: Бүгд, Шинэ, Үнийн санал, Төлбөр хүлээж, Баталгаажсан, Эрээн/замд, Улаанбаатарт, Дууссан, Цуцалсан, and TaoWorld шалгах when there are any. Counts follow the other filters.
  - Filters for exact status, payment and period; three sort orders; 25 orders per page.
  - Each row shows how long the order has waited (bold after 24 hours for new orders). Clicking a row opens it.
  - Several orders can change status at once through the bulk bar, after an in-app confirmation. Each change goes through `order-update` and is audited; orders the server refuses (warehouse batches, invoices) are listed in the message.
- **Order drawer.** The editor opens from the right (full width on phones). A sticky summary holds the status, amount, payment, age, phone copy, «Ачааны явц» and «Хадгалах», plus links to each section of the order. Missing quantities and variants show «—».
- **Status colours** by meaning: new orange, waiting amber, paid and ready green, moving blue, done and cancelled grey.
- **Confirmations.** `window.uiConfirm()` is an in-app dialog, used for TaoWorld cancel (with a reason), refund cancel, refund submit, store-list reset and bulk changes. Older OT and TaoWorld purchase confirmations keep the browser dialog.
- **Loading.** Grey placeholder rows instead of «Ачаалж байна…».
- **Phones.**
  - A bottom tab bar (Самбар, Захиалга, Хайх, Тайлан, Цэс) replaces the scrolling side menu.
  - The page picker stays in the header; «Цэс» opens it.
- **Tests.** `node tests/run-logistics.cjs admin-ux-ui` covers dashboard tasks, tabs and counts, paging, filters and the reset, the drawer, bulk change with cancel and confirm, Ctrl + K, the phone tab bar and the full-width drawer.

## Accounts, roles and audit

- **Owner account.** The configured administrator (`admin_email` + `admin_password_hash`) is the built-in owner. It cannot be disabled from the admin.
- **Staff accounts.** Stored in `admin_users` and managed by an owner under «Админ ба аудит».
- **Roles.** `admin_action_role()` maps every admin action to the lowest role allowed; unknown actions need the owner.

  | Role | Can do |
  |---|---|
  | Эзэмшигч (owner) | Everything, including shipping and API limits, TaoWorld settings and payment, warehouses, accounts, audit log and customer export |
  | Оператор (operator) | Orders, refunds, products, reviews, messages, customers, TaoWorld preview/run/cancel/refunds/bills, site controls |
  | Зөвхөн харах (viewer) | Reads only: dashboard, reports, TaoWorld usage, site settings. No customer list |

- **Session revocation.** Changing an account's role, status, e-mail or password ends its sessions.
- **Own password.** Staff change their own password under «Нууц үг солих». The owner's password change is unchanged.
- **Sign-in limits.** Only failures count: 20 per address and 8 per account in 15 minutes. Several staff behind one office address can still sign in.
- **Audit log (`admin_audit`).** Records every successful admin write with its actor, role, target and fields, plus sign-ins, failed sign-ins, sign-outs and file exports.
  - Order changes record the before → after status, amount and TaoWorld state.
  - Passwords, codes, tokens and secrets are never written.
- **Two-step sign-in (TOTP).** RFC 6238, SHA-1, 30-second, 6-digit codes, with one step of clock drift allowed.
  - Setup: a QR code from `assets/vendor/qrcode-generator`, or the key typed by hand, then a confirmation code.
  - A used code cannot be reused.
  - Turning it off needs the password and a current code. An owner can reset a staff member's two-step sign-in.

## Reports (Тайлан)

- **Totals for a date range** (Ulaanbaatar days, up to 400 days): orders, paid orders, net revenue (QPay + freight − refunds), average order, refunds, cancellations, and status counts. Demo orders are excluded.
- **Gross margin per order.** Revenue minus the paid TaoWorld purchase (goods + domestic shipping), at the order's quoted rate.
  - Cargo and operating costs are not included.
  - Orders without a paid purchase show an unknown cost.
- **Charts.** A revenue chart with a hover tooltip and a table view; ranges over 62 days are grouped by month.
- **CSV exports.** Orders with margin, payments and refunds, and (owner only) customers. The files are UTF-8 with a BOM, and cells that start like a formula are prefixed with `'`.
- **Search insights.** Top searches and zero-result searches over 7, 30 or 90 days, from `search_log`.
  - Each finished first page of a public search is counted once; a partial preview is completed by its follow-up request.
  - No shopper identity is stored. Category page views are included.

## TaoWorld usage (TaoWorld лимит)

- **Daily usage history.** `supplier_budget_daily` counts every budget call per UTC day by kind: search, detail, image, official store, brand, home, shipping, recommend, checkout, background or OT.
  - Calls refused because the limit was reached are counted as `rejected`.
  - Rows are kept for 120 days.
- **30-day chart.** Stacked by kind, with the daily limit line and a table view.
- **Purchase threshold.** TaoWorld's CNY 10,000 threshold (see [taoworld-open-platform.md](taoworld-open-platform.md)) is shown with:
  - paid GOStore purchases;
  - purchases made outside GOStore, entered by the owner;
  - the 30-day trial end date, from the trial start the owner enters.
- **Supplier bills.** `/purchase/bills/query` and `/refund/bills/query` for up to 62 days are matched to orders by `outer_purchase_id`.
  - Amount differences are flagged.
  - Paid orders missing from the bills are listed.
  - Website purchases outside GOStore are listed separately.

## Order after-sales (TaoWorld)

In the order view, for a submitted TaoWorld purchase:

- **Cancel.** Allowed before shipping (`/purchase/order/asyn/cancel`).
  - Automatic supplier payment stops first.
  - A cancel request blocks later payment, and the worker re-reads the status.
- **Refund or return-and-refund.** For a paid sub-order.
  - The template (`/order/refund/render`) gives reasons and the refund range.
  - The server checks the type, goods status, reason and amount before submitting.
  - An uncertain submission is kept and recovered from `/order/refund/queryList`.
  - Admins can refresh status, cancel the request, message the seller and register the return parcel (company, tracking, phone).
- **Delivery timeline.** The Taobao → Erenhot timeline, read from `/logistics/detail/get`.

## Site controls (Сайтын тохиргоо)

Stored in `meta.catalog_controls`:

- **Hidden items and shops.** Applied by `product_policy_blocked()` to every catalog, product, cart and order path, on the website and in the app.
- **Home keyword mix.** Six or more checked Chinese keywords replace the built-in mix; an empty list restores it.
- **Official store list.** Each store needs a shop ID, the exact shop name, a Tmall/Taobao https source and a verification note.
  - «Турших» runs one shop search and shows the returned shop names.
  - The list can be reset to the shipped `server/official-stores.json`.
- **11.11 campaign.**
  - Modes: automatic (1–11 November), extended to a date (up to 60 days), or ended early.
  - The public `?action=campaign` returns `active: null` in automatic mode, so `eleven-sale.js` keeps its date rule. Only an explicit on/off overrides it.
  - The app's 11.11 section still follows the date.

## Dashboard alerts

The overview shows:
- API usage at 80% or 100% of the browse limit, and calls rejected today;
- the trial ending within 7 days below the threshold, or a missing trial date;
- TaoWorld orders that need review;
- open supplier refunds.

## Tests

| Command | What it covers |
|---|---|
| `node tests/run-logistics.cjs admin-accounts` | Roles, audit details, two-step sign-in with replay protection, revocation |
| `node tests/run-logistics.cjs admin-extra-ui` | Pages, chart, CSV, quota, site controls, staff, audit search, two-step sign-in in the browser, viewer navigation, 390 px |
| `php tests/admin-reports.php` | Revenue and margin, day buckets, CSV safety, search log, usage kinds, rejections, threshold, trial, alerts |
| `php tests/taoworld-aftersale.php` | Cancel, refunds, recovery, messages, returns, timeline and bills, against a fake provider |
| `php tests/catalog-controls.php` | Hidden items and shops, home mix, store list validation and reset, campaign modes |
