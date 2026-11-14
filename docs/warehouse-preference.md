# App pickup warehouse preference

Implemented 2026-11-15 for the customer Expo app.

## Customer flow

- On the first home visit of each cold app launch, show a warehouse reminder. The previous choice is preselected; returning from another app does not repeatedly show it. Auth/payment/product deep links are not interrupted.
- Show the active pickup warehouses from `catalog.shipping.pickup_locations`: Ulaanbaatar, Zamyn-Uud and Sainshand. Show current addresses and telephone numbers, not a duplicate static address list.
- Save only `{version:1, location}` in device AsyncStorage (`gostore-pickup-warehouse-v1`). This is a device preference, not an account address. It persists across app restarts and account changes. The customer can skip and choose before ordering.
- The home card, checkout and self-cargo form open the same picker. New pickup orders and new forwarding orders use the selected destination. Changing the preference never reroutes an existing order or changes an idempotent retry. Ulaanbaatar home delivery remains separate.
- Removed/inactive destinations cannot be selected or used in new orders. The server validates the destination under the order write transaction. Old clients omitting the forwarding destination retain the Ulaanbaatar default.
- The warehouse reminder takes precedence over the existing promotional popup.

## Location design and limitations

The **Байршлаар ойр агуулах санал болгох** button requests foreground permission and a single balanced-accuracy position through Expo Location. No location request runs at startup or in the background. Denial, disabled services, unsupported native module and a 20-second acquisition timeout leave manual selection available. A late result cannot overwrite a manual selection. A recommendation never automatically changes the saved or draft destination; the customer chooses and confirms it.

Coordinates stay in memory on the device; they are not stored, logged, sent to GOStore, sent to analytics or reverse-geocoded. Only the selected warehouse identifier is persisted and sent with an order. There is no background location entitlement or foreground location service. iOS Always permission descriptions are disabled.

We do not have verified warehouse GPS pins. Haversine distance therefore ranks **city reference points**, not buildings or driving routes. The UI explicitly explains this. Reference coordinates: [Ulaanbaatar](https://www.wikidata.org/wiki/Q23430), [Zamyn-Uud](https://www.wikidata.org/wiki/Q2084833), [Sainshand](https://www.wikidata.org/wiki/Q943290). No live geocoding dependency or fee is needed.

Recommendations require a valid, non-mocked position no older than two minutes, reported accuracy at most 10 km, and a city within 150 km. A gap of at most `10 km + 2 × accuracy` between the closest two destinations is ambiguous and produces no recommendation. Multiple branches in one city also require manual selection until actual pins exist. These are conservative product thresholds, not transport coverage boundaries.

API references: [Expo SDK 58 Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/) and [React Native Modal](https://reactnative.dev/docs/modal).

## Verification and release

- `node tests/warehouse-preference.cjs`: preference validation, active options, all three cities, inaccurate/stale/mocked/far locations, ambiguity, permission denial, disabled services and timeout.
- `node tests/run-logistics.cjs self-cargo checkout-branches`: isolated backend, no real payment; destination validation, checkout/forwarding routing and idempotent retry.
- Start Expo web on localhost:8093, then `node tests/expo-warehouse-preference-ui.cjs` (or set `MOBILE_WEB_BASE`): mocked catalogue, persisted reminder, explicit GPS, recommendation without switching, small/dark layouts, deep-link handling and actual checkout request payload.
- Run Expo lint and TypeScript checks.

`expo-location` is a new native dependency. Existing installed binaries cannot receive this feature through an OTA-only release; build matching new iOS and Android binaries. Do not override the fingerprint runtime to target old binaries. Before distribution, test foreground permission denial/approximate location and cold-start/resume on physical iOS and Android devices, and review store permission/privacy text against this on-device-only design. Do not declare location uploaded or collected when it is not.

The backend forwarding change is backward compatible and should precede app distribution. No live customer order is required to validate this release.

### Verified state, 2026-11-15

Unit tests, isolated self-cargo and checkout/forwarding integration tests, Expo browser interaction tests, TypeScript and lint passed. Checked the generated native configuration: iOS includes only the When-In-Use location description; Android includes coarse/fine location, with no background location, activity recognition or foreground location service permission. Small-screen confirmation buttons stay visible while the options scroll; light/dark previews were inspected.

Deployed only `server/self-cargo.php` through FTPS with verified backup and content hashes. Backup: `/gostore-backups/warehouse-picker-1794679626846`. Public mobile and web catalogue endpoints returned HTTP 200 with all three active pickup warehouses after deployment. No live order or payment was created. Native app build/distribution and physical-device QA remain pending; no OTA was sent to existing runtimes.
