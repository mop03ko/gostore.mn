import { fetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";

const origin = process.env.EXPO_PUBLIC_API_ORIGIN || "https://gostore.mn";
if (
  !/^https:\/\/[^/]+$/.test(origin) &&
  !(__DEV__ && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
)
  throw new Error("Invalid API origin");
const endpoint = origin + "/api/mobile.php";
let token = "",
  csrf = "",
  loaded = false;
let queue: Promise<unknown> = Promise.resolve();
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const key = "gostore-mobile-session";
async function saveToken(next: string) {
  if (next === token) return;
  token = next;
  if (process.env.EXPO_OS === "web") {
    if (typeof sessionStorage !== "undefined") {
      if (next) sessionStorage.setItem(key, next);
      else sessionStorage.removeItem(key);
    }
  } else if (next) await SecureStore.setItemAsync(key, next);
  else await SecureStore.deleteItemAsync(key);
}
async function loadToken() {
  if (loaded) return;
  token =
    process.env.EXPO_OS === "web"
      ? typeof sessionStorage === "undefined"
        ? ""
        : sessionStorage.getItem(key) || ""
      : (await SecureStore.getItemAsync(key)) || "";
  loaded = true;
}
async function request<T>(
  action: string,
  body?: object | FormData,
  params: Record<string, string | number> = {},
  signal?: AbortSignal,
  publicRead = false,
): Promise<T> {
  const url =
    endpoint +
    "?" +
    new URLSearchParams({
      action,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
    });
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), publicRead ? 45000 : 120000);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  if (signal?.aborted) cancel();
  try {
    const form = body instanceof FormData;
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      credentials: "omit",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(!publicRead && token ? { "X-GOStore-Mobile-Token": token } : {}),
        ...(body ? { "X-CSRF-Token": csrf } : {}),
        ...(body && !form ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
    });
    if (!publicRead) {
      const next = response.headers.get("X-GOStore-Mobile-Token");
      if (next) await saveToken(next);
    }
    const data = await response.json();
    if (!publicRead && typeof data.csrf === "string") csrf = data.csrf;
    if (!response.ok) {
      if (
        !publicRead &&
        response.status === 401 &&
        !response.headers.get("X-GOStore-Mobile-Token")
      ) {
        await saveToken("");
        csrf = "";
      }
      throw new ApiError(
        data.error || "Хүсэлт амжилтгүй. Дахин оролдоно уу.",
        response.status,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (signal?.aborted) throw e;
    throw new ApiError(
      "Сүлжээ тасарсан эсвэл хугацаа хэтэрлээ. Дахин оролдоно уу.",
      0,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
// Serialize session-changing requests so credential/CSRF rotation cannot race another request.
export function api<T>(
  action: string,
  body?: object | FormData,
  params: Record<string, string | number> = {},
): Promise<T> {
  const task = queue
    .catch(() => {})
    .then(async () => {
      await loadToken();
      if (!csrf) {
        try {
          await request("customer-me");
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 401) throw e;
          await request("customer-me");
        }
      }
      return request<T>(action, body, params);
    });
  queue = task;
  return task;
}
const cache = new Map<string, { expires: number; data: unknown }>();
export async function catalog<T>(
  action: string,
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<T> {
  const key = JSON.stringify([action, params]),
    cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data as T;
  const data = await request<
    T & { cache_ttl?: number; stale?: boolean; revalidate?: boolean }
  >(action, undefined, params, signal, true);
  if (!data.stale && !data.revalidate && data.cache_ttl) {
    if (cache.size >= 50) cache.delete(cache.keys().next().value!);
    cache.set(key, {
      data,
      expires: Date.now() + Math.min(data.cache_ttl, 300) * 1000,
    });
  }
  return data;
}
export const siteOrigin = origin;
