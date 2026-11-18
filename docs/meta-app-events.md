# Meta App Events in the mobile app

The iOS and Android app (`gostoremn`) reports installs, launches and shopping events to Meta so
Facebook and Instagram ads can be measured and optimised. The website keeps its own Meta Pixel
(`1649469149899328`); the app uses the Meta app `1031552466623435` ("Gostore").

## What is sent

| Event | When | Data |
| --- | --- | --- |
| Install, launch | Logged by the native SDK | Device and app metadata |
| `fb_mobile_content_view` | Product page loaded | Product ID, MNT price |
| `fb_mobile_add_to_cart` | Variant added to the cart | Product ID, quantity, MNT value |
| `fb_mobile_initiated_checkout` | First quote on the checkout screen | Product IDs, quantities, MNT total |
| Purchase | A paid order that was created in this app is first seen paid | Product IDs, quantities, MNT amount |

Never sent: name, phone, email, address, account ID, search terms, order numbers. Product IDs are
the catalog IDs (`tb-…`). Purchases are counted once per order: checkout stores the new order ID
on the device (`gostore-meta-pending-orders`), and the order screen logs the purchase and removes
the ID when the order is paid. Orders placed on the website are not counted by the app.

## Consent

- **Account → Аппын хэрэглээний статистик** is one switch for Firebase Analytics and Meta. Off
  stops explicit events, automatic SDK events and advertiser ID collection; the SDK persists both
  flags, so later launches honour the choice before JavaScript starts.
- **iOS**: the App Tracking Transparency prompt is shown once after launch. The answer is passed
  to the SDK on every launch. Without permission Meta receives events without the IDFA.
- **Android**: the advertising ID is collected unless the switch is off.
- Development builds and Expo Go never load the SDK from JavaScript.

## Code and configuration

- `gostoremn/src/lib/meta-events.native.ts` (events, consent), `meta-events.ts` (web no-ops).
- Calls: `product/[id].tsx`, `checkout.tsx`, `order/[id].tsx`, `components/analytics-settings.tsx`.
- `gostoremn/app.json`: `react-native-fbsdk-next` (app ID, client token, auto init, auto logging,
  advertiser ID) and `expo-tracking-transparency` (prompt text, Android `AD_ID` permission).
- Test: `node tests/expo-meta-events.cjs`.

## Before the first build

1. Put the **client token** (Meta App Dashboard → App settings → Advanced → Security) in
   `gostoremn/app.json` in place of `META_CLIENT_TOKEN`. The test fails until it is set. The token
   ships inside every app binary, so it is not a secret like the app secret.
2. Meta App Dashboard → App settings → Basic → Add platform: iOS bundle ID `mn.gostore.app`
   (App Store ID `6828991827`) and Android package `mn.gostore.app`. Advanced → Authorized ad
   account IDs: the GOStore ad account.
3. The SDK is native code: it needs new store builds. With `runtimeVersion.policy: fingerprint`
   the runtime changes, so OTA updates published after this change do not reach older builds.
4. Update the store declarations to match `gostoremn/store/privacy-declaration.json`: App Store
   privacy labels (tracking: device ID, product interaction, purchases, advertising data) and
   Google Play Data safety plus the advertising ID declaration.
5. Publish `mobile-privacy.html` together with the release.
6. Verify on a real device in Events Manager → Test events (or the App Ads Helper).

The native build has not been compiled yet; the first EAS build is the check that
`react-native-fbsdk-next` 13.4 links with React Native 0.88 and dynamic iOS frameworks.
