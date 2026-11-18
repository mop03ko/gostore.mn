import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

// Meta App Events measure Facebook and Instagram ads. The native SDK logs installs and launches
// itself; the shopping events below send product IDs, quantities and MNT amounts — never names,
// phones, addresses, search terms or order numbers.
export const metaAvailable = !__DEV__ && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
// Shared with the Firebase switch so one Account setting covers all app measurement.
const preference = "gostore-analytics-enabled", pendingKey = "gostore-meta-pending-orders";
type Sdk = typeof import("react-native-fbsdk-next");
type Logger = Sdk["AppEventsLogger"];
type Line = { id: string; qty: number };
let sdk: Sdk | undefined, started: Promise<void> | null = null, enabled = false, pending: string[] | null = null;

function apply(allow: boolean) {
  if (!sdk) return;
  // The SDK stores both choices, so later launches honour an opt-out before JavaScript starts.
  sdk.Settings.setAutoLogAppEventsEnabled(allow);
  sdk.Settings.setAdvertiserIDCollectionEnabled(allow);
  enabled = allow;
}
export function startMeta(): Promise<void> {
  if (!metaAvailable) return Promise.resolve();
  started ??= (async () => {
    try {
      const allow = (await SecureStore.getItemAsync(preference)) !== "0";
      // Deferred so Expo Go and development previews never load the native module.
      sdk = await import("react-native-fbsdk-next");
      apply(allow);
    } catch { sdk = undefined; enabled = false; }
  })();
  return started;
}
export async function metaEnabled(): Promise<boolean> {
  await startMeta();
  return enabled;
}
export async function setMetaEnabled(allow: boolean): Promise<void> {
  if (!metaAvailable) return;
  await startMeta();
  apply(allow);
  await SecureStore.setItemAsync(preference, allow ? "1" : "0");
  if (allow) await requestMetaTracking();
  else if (Platform.OS === "ios") await sdk?.Settings.setAdvertiserTrackingEnabled(false).catch(() => {});
}
// iOS asks once for App Tracking Transparency, then tells the SDK the answer on every launch
// (iOS 17+ reads it itself; earlier versions rely on this flag).
export async function requestMetaTracking(): Promise<void> {
  try {
    if (Platform.OS !== "ios" || !(await metaEnabled()) || !sdk) return;
    if (AppState.currentState !== "active") await new Promise<void>(done => {
      const listener = AppState.addEventListener("change", state => {
        if (state === "active") { listener.remove(); done(); }
      });
    });
    const att = await import("expo-tracking-transparency");
    let permission = await att.getTrackingPermissionsAsync();
    if (permission.status === att.PermissionStatus.UNDETERMINED && permission.canAskAgain)
      permission = await att.requestTrackingPermissionsAsync();
    await sdk.Settings.setAdvertiserTrackingEnabled(enabled && permission.granted);
  } catch { /* The prompt is optional; shopping continues without it. */ }
}
const amount = (v: number | null | undefined) => (v != null && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
const content = (lines: Line[]) => JSON.stringify(lines.map(l => ({ id: l.id, quantity: l.qty })));
const count = (lines: Line[]) => lines.reduce((n, l) => n + l.qty, 0);
function event(name: (l: Logger) => string, value: number, params: (l: Logger) => Record<string, string | number>) {
  void startMeta().then(() => {
    if (!enabled || !sdk) return;
    const l = sdk.AppEventsLogger;
    const p = { [l.AppEventParams.ContentType]: "product", [l.AppEventParams.Currency]: "MNT", ...params(l) };
    if (value) l.logEvent(name(l), value, p); else l.logEvent(name(l), p);
  }).catch(() => { /* Measurement must never interrupt shopping. */ });
}
export function metaViewedProduct(id: string, mnt: number | null): void {
  event(l => l.AppEvents.ViewedContent, amount(mnt), l => ({ [l.AppEventParams.ContentID]: id }));
}
export function metaAddedToCart(id: string, qty: number, mnt: number | null): void {
  event(l => l.AppEvents.AddedToCart, amount(mnt), l => ({
    [l.AppEventParams.ContentID]: id, [l.AppEventParams.Content]: content([{ id, qty }]),
  }));
}
export function metaInitiatedCheckout(lines: Line[], mnt: number): void {
  event(l => l.AppEvents.InitiatedCheckout, amount(mnt), l => ({
    [l.AppEventParams.Content]: content(lines), [l.AppEventParams.NumItems]: count(lines),
  }));
}
async function loadPending(): Promise<void> {
  if (pending) return;
  let stored: unknown = [];
  try { stored = JSON.parse((await AsyncStorage.getItem(pendingKey)) || "[]"); } catch { /* Start empty. */ }
  pending ??= Array.isArray(stored) ? stored.filter((v): v is string => typeof v === "string") : [];
}
// Orders created in this app wait here until their payment is seen. The list stays on the device.
export async function metaOrderPlaced(orderId: string): Promise<void> {
  try {
    if (!metaAvailable) return;
    await loadPending();
    if (pending!.includes(orderId)) return;
    pending = [...pending!, orderId].slice(-50);
    await AsyncStorage.setItem(pendingKey, JSON.stringify(pending));
  } catch { /* Measurement must never interrupt checkout. */ }
}
// Counts a purchase once, when a paid order that was created in this app is first seen.
export async function metaPurchased(orderId: string, mnt: number, lines: Line[]): Promise<void> {
  try {
    if (!metaAvailable) return;
    await loadPending();
    if (!pending!.includes(orderId)) return;
    pending = pending!.filter(v => v !== orderId);
    await AsyncStorage.setItem(pendingKey, JSON.stringify(pending));
    await startMeta();
    if (!enabled || !sdk || !amount(mnt)) return;
    const l = sdk.AppEventsLogger;
    l.logPurchase(amount(mnt), "MNT", {
      [l.AppEventParams.ContentType]: "product", [l.AppEventParams.Content]: content(lines),
      [l.AppEventParams.NumItems]: count(lines),
    });
  } catch { /* Measurement must never interrupt payment. */ }
}
