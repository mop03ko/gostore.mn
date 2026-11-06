import Constants, { ExecutionEnvironment } from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const analyticsAvailable = !__DEV__ && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const preference = "gostore-analytics-enabled";
let sdk: typeof import("@react-native-firebase/analytics") | undefined;
let initialized = false, enabled = false, lastScreen: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => {}).then(work);
  queue = next;
  return next;
}
async function initialize() {
  if (initialized || !analyticsAvailable) return;
  const allow = (await SecureStore.getItemAsync(preference)) !== "0";
  // Defer native module loading so Expo Go and development previews stay usable.
  sdk = await import("@react-native-firebase/analytics");
  const analytics = sdk.getAnalytics();
  await sdk.setConsent(analytics, {
    analytics_storage: allow, ad_storage: false, ad_user_data: false, ad_personalization: false,
  });
  await sdk.setAnalyticsCollectionEnabled(analytics, allow);
  enabled = allow; initialized = true;
}
export function analyticsEnabled(): Promise<boolean> {
  return serial(async () => { await initialize(); return enabled; });
}
export function setAnalyticsEnabled(allow: boolean): Promise<void> {
  return serial(async () => {
    await initialize(); if (!sdk) return;
    const analytics = sdk.getAnalytics();
    await sdk.setAnalyticsCollectionEnabled(analytics, allow);
    enabled = allow; lastScreen = null;
    await sdk.setConsent(analytics, {
      analytics_storage: allow, ad_storage: false, ad_user_data: false, ad_personalization: false,
    });
    await SecureStore.setItemAsync(preference, allow ? "1" : "0");
    if (!allow) await sdk.resetAnalyticsData(analytics);
  });
}
export async function trackScreen(screen: string | null): Promise<void> {
  try {
    await serial(async () => {
      await initialize();
      if (!enabled || !sdk || !screen || screen === lastScreen) return;
      await sdk.logScreenView(sdk.getAnalytics(), { screen_name: screen, screen_class: screen });
      lastScreen = screen;
    });
  } catch { /* Measurement must never interrupt shopping or navigation. */ }
}
