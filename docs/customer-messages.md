# Customer messages from admin

Admin → «Мэдэгдэл илгээх» (web admin and the staff admin app, which opens the same page) sends a
message to customers.

- **Kinds**: *Үйлчилгээний мэдээлэл* (service notices) and *Хямдрал, урамшуулал* (promotions).
- **Audiences**: all customers, customers with an order not yet completed or cancelled, or one customer
  by phone (verified PIN phone first, then the profile phone; an ambiguous profile phone is refused).
  Deleted accounts are excluded. Recipients are fixed at send time.
- **Sending**: the first click shows the recipient and phone-device counts (a POST, so phone numbers stay out
  of URLs and access logs); the second click sends. Any edit
  asks again. A per-form request ID makes a repeated submit return the first send. Limit: 30 sends/hour.
- **Inbox**: every recipient gets a copy in the site bell, «Миний бүртгэл → Мэдэгдэл» and the app's
  Notifications screen. Read state is per customer (`customer-notifications-read` with
  `messages_through_id`). Messages are returned as `messages`/`messages_unread`, separate from order
  notices, so older app builds keep working. Links must be gostore.mn paths.
- **Phone push** (only when customer push is enabled on the server, see `firebase-push.md`): service
  notices go to devices that allowed notifications; promotions only to customers who also turned on
  «Урамшууллын мэдэгдэл» (account page or app). Turning it off skips queued promotional pushes.
  Pushes are sent in Expo batches of 100, receipts are checked after 15 minutes, unregistered devices are
  removed, transient failures retry up to four times, and revoked sessions (logout, PIN/password reset,
  account deletion) are skipped. The customer push cron (`server/customer-push-worker.php`) also drains
  message pushes.
- **Privacy**: admins should not put personal details in messages to many customers; deletion removes a
  customer's inbox, queued pushes and promotional choice.

Tests: `tests/customer-messages.php`, `tests/customer-messages-ui.cjs`.

## Promotional popup (2026-11-09)

Admin → «Мэдэгдэл илгээх» → «Сурталчилгааны popup»: an image (uploaded through `image-upload`, stored as `assets/uploads/<id>.jpg`), title (80), text (300), button label (30), link and optional start/end times. One popup at a time, stored in `meta.promo_popup` (`server/promo-popup.php`).

- Links are a page on this site (`/v/123456`, `/official-stores`, `/?q=цүнх`) or an `https://` address; anything else is rejected. Start/end are entered in local time and stored in UTC.
- `GET promo-popup` (`api/index.php` and `api/mobile.php`) is public and session-free, cached for 60 seconds, and returns `null` when the popup is off, empty or outside its dates.
- Website (`promo-popup.js`): only on the home page without a query, about a second after load, never over another dialog or the sign-in page. Escape, the × button or a backdrop click close it.
- App (`gostoremn/src/components/promo-popup.tsx`): once per launch on the home screen; site links open the matching app screen (product, official stores, brand, cart, help, search) and other links open in the browser. JavaScript only, delivered by OTA.
- Each device sees a popup at most once a day. Saving the same content keeps its id; changing the content shows it again.
- `node tests/run-logistics.cjs promo-popup-ui` covers the admin form, validation, scheduling, both APIs and the storefront behaviour.
