import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { catalog } from "@/lib/api";
import type { Product } from "@/lib/types";
import { Busy, colors, money } from "@/components/ui";
import { Icon } from "@/components/shop-ui";
import categories from "@/lib/discovery.json";
import { categoryImages } from "@/lib/category-images";
export { categories };
export function CategoryPhoto({ image, size = 64 }: { image: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", borderRadius: 12, overflow: "hidden", backgroundColor: "#f7f7f7" }}>
    {image && !failed ? <Image source={categoryImages[image] || image} contentFit="contain" style={{ width: "100%", height: "100%" }} onError={() => setFailed(true)} /> : <Icon name="grid" size={24} color={colors.muted} />}
  </View>;
}
export function DiscoveryCard({ product: p }: { product: Product }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={p.name} onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })} style={s.card}>
    <Image source={p.image || undefined} contentFit="cover" recyclingKey={p.id} style={{ width: "100%", aspectRatio: 1 }} />
    <View style={{ padding: 8, gap: 5 }}><Text numberOfLines={2} style={s.name}>{p.name}</Text><Text style={s.price}>{p.mnt ? money(p.mnt) : p.approx_mnt ? "≈ " + money(p.approx_mnt) : "Үнэ шалгах"}</Text></View>
  </Pressable>;
}
export function DiscoveryShelf({ query, free = false }: { query?: string; free?: boolean }) {
  const [data, setData] = useState<{ products: Product[]; status?: string } | null>(null);
  const [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    // A new category owns its own cancellable request; no previous category cards are shown.
    void catalog<{ products: Product[]; status?: string }>(free ? "supplier-free-shipping" : "supplier-search", free ? {} : { q: query || "home storage", page: 1, limit: 12 }, controller.signal)
      .then(r => { if (!controller.signal.aborted) { setData(r); setError(false); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [query, free, retry]);
  return <View testID={free ? "free-shipping-shelf" : "category-products"} style={{ gap: 10 }}>
    <Text style={s.heading}>{free ? "Хятад дотор үнэгүй хүргэлт" : "Танд санал болгох"}</Text>
    {free && <Text style={s.note}>Эрээн агуулах хүртэлх лавлах үнэ 0¥. Монгол хүртэлх тээвэр тусдаа; сонгосон хувилбар, тоо ширхэгийн эцсийн хүргэлтийг сагсанд шалгана.</Text>}
    {!data && !error && <Busy />}
    {error ? <Pressable accessibilityRole="button" onPress={() => setRetry(x => x + 1)} style={s.empty}><Text>Ачаалж чадсангүй. Дахин оролдох</Text></Pressable> : data && !data.products.length ? <View style={s.empty}><Text style={s.note}>{free ? data.status === "available" ? "Одоогоор 0¥ хүргэлттэй бараа олдсонгүй." : "Үнэгүй хүргэлттэй барааны мэдээлэл түр боломжгүй байна." : "Энэ ангилалд бараа олдсонгүй."}</Text></View> : null}
    <View style={s.grid}>{data?.products.slice(0, free ? 8 : 6).map(p => <View key={p.id} style={{ width: "48%" }}><DiscoveryCard product={p} /></View>)}</View>
  </View>;
}
export function HomeDiscovery({ onSearch }: { onSearch: (q: string) => void }) {
  const [tab, setTab] = useState("explore");
  const channels = [["explore", "Танд зориулсан"], ["free", "0¥ хүргэлт"], ["fashion", "Хувцас"], ["home", "Гэр ахуй"], ["tech", "Технологи"]];
  return <View style={{ gap: 14 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
      {channels.map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[s.tab, tab === id && { borderBottomColor: colors.orange }]}><Text style={{ fontSize: 15, fontWeight: "700", color: id === "free" ? "#087850" : tab === id ? colors.ink : colors.muted }}>{label}</Text></Pressable>)}
    </ScrollView>
    {tab !== "explore" ? <DiscoveryShelf key={tab} free={tab === "free"} query={tab === "fashion" ? "women clothing" : tab === "tech" ? "electronics" : "home storage"} /> : <>
      <View style={{ flexDirection: "row", gap: 8 }}>{[{ q: "women clothing", title: "Өөрийн хэв маяг", photo: "women" }, { q: "home storage", title: "Тухтай гэр", photo: "home" }].map(c => <Pressable key={c.q} onPress={() => onSearch(c.q)} accessibilityRole="button" style={s.collection}><Text style={s.heading}>{c.title}</Text><Text style={s.note}>Сонголтоо нээгээрэй ›</Text><CategoryPhoto image={categories.find(x => x.id === c.photo)?.image || ""} size={100} /></Pressable>)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {categories.slice(0, 12).map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.name} onPress={() => onSearch(c.query)} style={{ width: 72, alignItems: "center", gap: 6 }}><CategoryPhoto image={c.image} /><Text numberOfLines={2} style={{ fontSize: 11, textAlign: "center", color: colors.ink }}>{c.name}</Text></Pressable>)}
      </ScrollView>
      <Pressable onPress={() => setTab("free")} accessibilityRole="button" accessibilityLabel="Үнэгүй хүргэлттэй бараа харах" style={s.freeBanner}><Icon name="truck" size={28} color="#087850" /><View style={{ flex: 1, gap: 3 }}><Text style={{ fontWeight: "800", color: "#087850" }}>Хятад дотор 0¥ хүргэлт</Text><Text style={s.note}>Эрээн хүртэл · Монголын тээвэр тусдаа</Text></View><Icon name="chevron" size={16} /></Pressable>
    </>}
  </View>;
}
const s = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: "800", color: colors.ink }, note: { fontSize: 12, lineHeight: 18, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  card: { borderRadius: 12, overflow: "hidden", backgroundColor: "white" }, name: { fontSize: 12, lineHeight: 17, minHeight: 34, color: colors.ink }, price: { fontSize: 17, fontWeight: "800", color: "#c44000" },
  empty: { padding: 16, borderRadius: 12, backgroundColor: "#f4f6f5" }, tab: { minHeight: 44, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  collection: { flex: 1, backgroundColor: "#f2f0fc", borderRadius: 16, padding: 12, gap: 8, alignItems: "center" }, freeBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#e9f7ef", borderRadius: 14 },
});
