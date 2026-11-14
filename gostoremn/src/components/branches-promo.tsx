import { Text, View } from "react-native";
import { usePalette } from "@/lib/palette";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui";

export function BranchesPromo({ onBrowse }: { onBrowse: () => void }) {
  const c = usePalette();
  const { shipping } = useStore();
  const branches = shipping?.pickup_locations?.filter((p) => p.city === "Замын-Үүд" || p.city === "Сайншанд") ?? [];
  if (!branches.length) return null;
  return <View testID="branches-home" style={{ padding: 16, gap: 12, borderRadius: 18, backgroundColor: c.accentSurface }}>
    <Text style={{ color: c.accentText, fontSize: 12, fontWeight: "800" }}>ГОСТОРЫН ШИНЭ САЛБАРУУД</Text>
    <Text style={{ color: c.navy, fontSize: 22, fontWeight: "800" }}>Захиалгаа ойр салбараасаа аваарай</Text>
    <Text style={{ color: c.muted, fontSize: 13 }}>Захиалга баталгаажуулахдаа авах салбараа сонгоно.</Text>
    {branches.map((p) => <View key={p.location} style={{ gap: 4 }}>
      <Text style={{ color: c.navy, fontSize: 16, fontWeight: "700" }}>{p.name}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{p.address}</Text>
      <Text selectable style={{ color: c.accentText, fontWeight: "700" }}>{p.phone}</Text>
    </View>)}
    <Button title="Бараа үзэж захиалах →" onPress={onBrowse} />
  </View>;
}
