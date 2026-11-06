import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { pushConfigured, type PushConfig } from "./push-config";

const preference = "gostore-push-opt-in", savedToken = "gostore-push-token";
export const pushAvailable = Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
export async function pushOptedIn() { return (await SecureStore.getItemAsync(preference)) === "1"; }
export async function disablePush() {
  const token = await SecureStore.getItemAsync(savedToken);
  if (token) await api("customer-push-unregister", { token });
  await SecureStore.setItemAsync(preference, "0");
  await SecureStore.deleteItemAsync(savedToken);
}
export async function enablePush(requestPermission = true, stillCurrent: () => boolean = () => true) {
  if (!pushAvailable) throw Error("Утасны мэдэгдлийг шинэ build суулгасан бодит утсан дээр идэвхжүүлнэ.");
  const config = await api<PushConfig>("customer-push-config");
  if (!pushConfigured(config, Platform.OS)) throw Error("Утасны мэдэгдлийн тохиргоо удахгүй бэлэн болно.");
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("orders", { name: "Захиалгын мэдэгдэл", importance: AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted" && requestPermission) permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    if (stillCurrent()) await disablePush();
    throw Error("Утасны тохиргооноос gostore.mn-ийн мэдэгдлийг зөвшөөрнө үү.");
  }
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw Error("Мэдэгдлийн тохиргоо олдсонгүй.");
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!stillCurrent()) return;
  await api("customer-push-register", { token, platform: Platform.OS });
  if (!stillCurrent()) return;
  await SecureStore.setItemAsync(savedToken, token);
  await SecureStore.setItemAsync(preference, "1");
}
export function watchPush(open: () => void) {
  let last = "", active = true;
  const handle = (r: Notifications.NotificationResponse | null) => {
    if (!active || !r || r.notification.request.content.data?.screen !== "notifications") return;
    const id = r.notification.request.identifier;
    if (id === last) return;
    last = id; void Notifications.clearLastNotificationResponseAsync(); open();
  };
  const listener = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => { active = false; listener.remove(); };
}
export function watchPushToken(refresh: () => void) {
  const listener = Notifications.addPushTokenListener(refresh);
  return () => listener.remove();
}
