# Mobile navigation and brand assets

The Expo app uses the supplied `SVG/4x/logo@4x-8.png` wordmark, bundled as `gostoremn/assets/images/gostore-wordmark.png`. Preserve its aspect ratio; do not replace it with styled text. The application icon and splash assets are separate.

Navigation and category icons use `react-native-svg` primitives, not platform emoji or SVG image data URLs. This requires a new native build when upgrading from build 4. Category labels are Mongolian; their English supplier queries remain separate from the visible labels.

- Categories: independently scrolling category rail, category-specific tiles, search submission and compact brand links. Selecting a category resets its content scroll position.
- Orders: payment/active/completed/cancelled filters, pull to refresh, retry, pagination and guest/empty states. Filters apply to the loaded pages; the screen explicitly offers older orders when more pages exist. Cancelled and completed orders never appear in the unpaid filter.
- Profile: grouped order, address, notification, personal information, password, support and deletion actions. Profile/password forms expand separately. Logout requires a confirmation. Login returns only to an explicitly allowed app route.
- Tabs: explicit safe-area-aware height keeps icon labels visible; detail pages hide the internal route-group back label.

Validation from the repository root, with the local Expo web preview running on port 8086:

```powershell
node tests/expo-navigation-ui.cjs
```

The test uses the repository's Playwright tooling in `tmp/tooling`, intercepts all mobile API calls and verifies 320/390/430 px layouts, category queries, login return navigation, order filters/pagination/retry, and profile saving. Its preview screenshots contain synthetic data and must not be uploaded to App Store Connect.

The EAS `screenshots` profile captures actual native screens with public catalog data, including guest orders and profile. Use a fresh simulator archive after app changes; the older `screenshots-capture` archive does not include the new SVG native module or screens.
