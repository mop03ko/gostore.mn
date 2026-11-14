import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { usePalette } from "@/lib/palette";
import { useStore } from "@/lib/store";
import { Button, ErrorBox } from "@/components/ui";

const cities = ["Улаанбаатар", "Замын-Үүд", "Сайншанд"];
export function BranchesPromo({ onBrowse }: { onBrowse: () => void }) {
  const c = usePalette();
  const { shipping } = useStore();
  const [error, setError] = useState("");
  const branches = (shipping?.pickup_locations ?? []).filter((p) => cities.includes(p.city)).sort((a, b) => cities.indexOf(a.city) - cities.indexOf(b.city));
  if (!branches.length) return null;
  const call = (phone: string) => {
    setError("");
    void Linking.openURL("tel:" + phone.replace(/[^+0-9]/g, "")).catch(() => setError("Залгах цонх нээгдсэнгүй. " + phone + " дугаараар холбогдоорой."));
  };
  return <View testID="branches-home" style={{ padding: 16, gap: 12, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
    <Text style={{ color: c.accentText, fontSize: 11, letterSpacing: 1, fontWeight: "800" }}>GOSTORE · БАРАА АВАХ ЦЭГҮҮД</Text>
    <Text accessibilityRole="header" style={{ color: c.navy, fontSize: 23, fontWeight: "800" }}>Хүлээн авах боломжтой агуулах</Text>
    <Text style={{ color: c.muted, fontSize: 13 }}>Захиалга хийхдээ авах салбараа сонгоорой.</Text>
    {branches.map((p) => <View key={p.location} testID={"pickup-card-" + p.location} style={{ gap: 8, padding: 14, borderRadius: 14, backgroundColor: c.subtle, borderWidth: 1, borderColor: c.line }}>
      <Text accessibilityRole="header" style={{ color: c.navy, fontSize: 19, fontWeight: "800" }}>{p.city}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>Бараа авах агуулах</Text>
      <Text selectable style={{ color: c.ink, fontSize: 13, lineHeight: 20 }}>{p.address}</Text>
      {!!p.hours && <Text style={{ color: c.muted, fontSize: 12 }}>{p.hours}</Text>}
      {!!p.phone && <Pressable accessibilityRole="button" accessibilityLabel={p.city + " салбар руу залгах " + p.phone} onPress={() => call(p.phone)} style={({ pressed }) => ({ minHeight: 44, padding: 12, borderRadius: 10, backgroundColor: c.surface, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ color: c.accentText, fontWeight: "700" }}>Залгах</Text><Text style={{ color: c.accentText, fontWeight: "800" }}>{p.phone} ↗</Text>
      </Pressable>}
    </View>)}
    <ErrorBox message={error} />
    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Салбарт ирж, авахад бэлэн болмогц захиалгын төлөвөөс шалгаад бараагаа авна.</Text>
    <Button title="Бараа үзэж захиалах →" onPress={onBrowse} />
  </View>;
}
