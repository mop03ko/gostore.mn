import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { pushConfigured, type PushConfig } from "@/lib/push-config";
import { pushAvailable, pushOptedIn, enablePush, disablePush, watchPush, watchPushToken } from "@/lib/push";
import { Button, Card, Copy, ErrorBox } from "./ui";

export function PushLifecycle() {
  const { customer, ready } = useStore();
  const customerId = customer?.id;
  const owner = useRef(customerId);
  useEffect(() => { owner.current = customerId; }, [customerId]);
  useEffect(() => {
    if (!pushAvailable || !ready) return;
    return watchPush(() => {
      if (owner.current) router.push("/notifications");
      else router.push({ pathname: "/login", params: { next: "/notifications" } });
    });
  }, [ready]);
  useEffect(() => {
    if (!customerId || !pushAvailable) return;
    let active = true, busy = false;
    const id = customerId;
    const current = () => active && owner.current === id;
    const renew = async () => {
      if (busy || !current()) return; busy = true;
      try { if (await pushOptedIn()) await enablePush(false, current); } catch {} finally { busy = false; }
    };
    void renew();
    const state = AppState.addEventListener("change", value => { if (value === "active") void renew(); });
    const token = watchPushToken(() => void renew());
    return () => { active = false; state.remove(); token(); };
  }, [customerId]);
  return null;
}
export function PushSettings() {
  const { customer } = useStore();
  const [enabled, setEnabled] = useState(false), [configured, setConfigured] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    let active = true;
    if (customer && pushAvailable) void Promise.all([pushOptedIn(), api<PushConfig>("customer-push-config")]).then(([on, config]) => { if (active) { setEnabled(on); setConfigured(pushConfigured(config, Platform.OS)); } }).catch(() => {});
    return () => { active = false; };
  }, [customer]));
  if (!customer || !pushAvailable) return null;
  return <Card>
    <Copy>Утасны мэдэгдэл</Copy>
    <Copy>{configured ? "Захиалга, төлбөр, хүргэлтийн шинэ мэдээллийг апп хаалттай үед авна." : "Утасны мэдэгдлийн холболтыг бэлдэж байна. Захиалгын мэдээллээ доорх жагсаалтаас харна уу."}</Copy>
    <ErrorBox message={error} />
    <Button title={busy ? "Түр хүлээнэ үү…" : enabled ? "Мэдэгдэл унтраах" : "Мэдэгдэл зөвшөөрөх"} disabled={busy || (!configured && !enabled)} onPress={async () => {
      setBusy(true); setError("");
      try { if (enabled) await disablePush(); else await enablePush(); setEnabled(await pushOptedIn()); }
      catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }} />
    {error && <Button secondary title="Утасны тохиргоо нээх" onPress={() => void Linking.openSettings()} />}
  </Card>;
}
