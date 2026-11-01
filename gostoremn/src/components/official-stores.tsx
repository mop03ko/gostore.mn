import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { catalog, siteOrigin } from "@/lib/api";
import type { Product } from "@/lib/types";
import { usePalette } from "@/lib/palette";
import { Busy, Button, Copy, ErrorBox } from "./ui";
import { DiscoveryCard } from "./discovery";

export type OfficialStore = { id: string; name: string; display_name: string; logo: string; products: Product[] };
export function OfficialStores({ compact = false }: { compact?: boolean }) {
  const colors = usePalette();
  const [data, setData] = useState<{ stores: OfficialStore[]; incomplete: boolean }>();
  const [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    void catalog<{ stores: OfficialStore[]; incomplete: boolean }>("supplier-official-stores", {}, c.signal)
      .then(r => { if (!c.signal.aborted) { setData(r); setError(""); } })
      .catch(e => { if (!c.signal.aborted) setError(e.message); });
    return () => c.abort();
  }, [retry]);
  return <View testID="official-stores" style={{ gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 12 }}>
    <Text style={{ fontSize: 20, fontWeight: "700", color: colors.ink }}>Албан ёсны дэлгүүрүүд</Text>
    <Copy>API-аар бараа ирж буй баталгаажсан дэлгүүрүүд.</Copy>
    <ErrorBox message={error} retry={() => setRetry(n => n + 1)} />
    {!data && !error && <Busy />}
    {data?.incomplete && <><Copy>Зарим дэлгүүрийн мэдээлэл түр ирсэнгүй.</Copy><Button secondary title="Дахин шалгах" onPress={() => setRetry(n => n + 1)} /></>}
    {data && !data.stores.length && <Copy>Одоогоор баталгаажсан дэлгүүрүүдээс бараа ирээгүй байна.</Copy>}
    {data?.stores.map(s => <View key={s.id} style={{ gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Image source={siteOrigin + s.logo} contentFit="contain" style={{ width: 52, height: 52, backgroundColor: "white", borderRadius: 10 }} /><View style={{ flex: 1 }}><Text style={{ fontWeight: "700", color: colors.ink }}>{s.display_name}</Text><Copy>{s.name}</Copy></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{s.products.map(p => <View key={p.id} style={{ width: 160 }}><DiscoveryCard product={p} /></View>)}</ScrollView>
      <Button secondary title="Дэлгүүрийн бараа →" onPress={() => router.push({ pathname: "/official-stores", params: { shop: s.id } })} />
    </View>)}
    {compact && <Button secondary title="Дэлгүүрүүдийг үзэх" onPress={() => router.push("/official-stores")} />}
    <Copy>Баталгаажсан жагсаалтад тулгуурласан. Tmall-ийн бүх дэлгүүрийг хамраагүй.</Copy>
  </View>;
}
