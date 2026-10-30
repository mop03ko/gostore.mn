# GOStore mobile

Expo SDK 58 iOS/Android app connected to the GOStore PHP backend.

```powershell
npm ci
npx expo start
```

Checks: `npm run typecheck`, `npm run lint`, `npx expo-doctor`.
Builds: `npm run build:android` (APK), `npm run build:ios` (Apple signing required).

See [mobile integration and release notes](../docs/mobile-app.md) for API security, isolated checkout tests, deployment, account deletion and store release requirements. Only the API origin belongs in `EXPO_PUBLIC_*`; supplier/payment secrets stay on the server.