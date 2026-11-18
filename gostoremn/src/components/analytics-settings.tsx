import { useEffect, useState } from "react";
import { useSegments } from "expo-router";
import { Switch, View } from "react-native";
import { analyticsAvailable, analyticsEnabled, setAnalyticsEnabled, trackScreen } from "@/lib/analytics";
import { analyticsScreen } from "@/lib/analytics-screens";
import { metaAvailable, metaEnabled, requestMetaTracking, setMetaEnabled } from "@/lib/meta-events";
import { usePalette } from "@/lib/palette";
import { Card, Copy, ErrorBox } from "./ui";

const measured = analyticsAvailable || metaAvailable;
export function AnalyticsLifecycle() {
  const segments = useSegments();
  const screen = analyticsScreen(segments);
  useEffect(() => { void trackScreen(screen); }, [screen]);
  useEffect(() => { void requestMetaTracking(); }, []);
  return null;
}
export function AnalyticsSettings() {
  const colors = usePalette();
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (measured) void (analyticsAvailable ? analyticsEnabled() : metaEnabled()).then(v => { if (active) setEnabled(v); })
      .catch(() => { if (active) setError("Статистикийн тохиргоог ачаалж чадсангүй."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  if (!measured) return null;
  return <Card>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}><Copy>Аппын хэрэглээний статистик</Copy></View>
      <Switch accessibilityLabel="Аппын хэрэглээний статистик" value={enabled} disabled={busy}
        trackColor={{ true: colors.orange }} onValueChange={async value => {
          setBusy(true); setError("");
          try { await setAnalyticsEnabled(value); await setMetaEnabled(value); setEnabled(value); }
          catch { setError("Тохиргоог хадгалж чадсангүй. Дахин оролдоно уу."); }
          finally { setBusy(false); }
        }} />
    </View>
    <Copy>{analyticsAvailable ? "Firebase Analytics-аар дэлгэцийн хэрэглээг хэмжинэ. " : ""}Facebook, Instagram дээрх зарын үр дүнг хэмжихийн тулд апп нээсэн, бараа үзсэн, сагсалсан, төлбөр төлсөн үйлдлийг барааны код, тоо ширхэг, дүнгийн хамт Meta-д илгээнэ. Нэр, утас, хаяг, захиалгын дугаарыг илгээхгүй.</Copy>
    <ErrorBox message={error} />
  </Card>;
}
