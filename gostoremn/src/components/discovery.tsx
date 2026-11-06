import { ProductDiscountBadge, ProductOffers } from "./product-offers";
import { usePalette, type Palette } from "@/lib/palette";
import { useEffect, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { catalog } from "@/lib/api";
import type { Product } from "@/lib/types";
import { Busy, money } from "@/components/ui";
import { Icon } from "@/components/shop-ui";
import categories from "@/lib/discovery.json";
import { categoryImages } from "@/lib/category-images";
import { elevenSaleActive, elevenSaleProducts } from "@/lib/eleven-sale";
export { categories };
export function CategoryPhoto({ image, size = 64 }: { image: string; size?: number }) {
  const colors = usePalette();
  const [failed, setFailed] = useState(false);
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", borderRadius: 12, overflow: "hidden", backgroundColor: colors.subtle }}>
    {image && !failed ? <Image source={categoryImages[image] || image} contentFit="contain" style={{ width: "100%", height: "100%" }} onError={() => setFailed(true)} /> : <Icon name="grid" size={24} color={colors.muted} />}
  </View>;
}
export function DiscoveryCard({ product: p }: { product: Product }) {
  const colors = usePalette();
  const s = createStyles(colors);
  return <Pressable accessibilityRole="button" accessibilityLabel={p.name} onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id, ...(p.official_shop_id ? { shop: p.official_shop_id } : p.brand_id ? { brand: p.brand_id } : {}) } })} style={s.card}>
    <Image source={p.image || undefined} contentFit="cover" recyclingKey={p.id} style={{ width: "100%", aspectRatio: 1 }} />
    <ProductDiscountBadge product={p} amount={p.mnt || p.approx_mnt} />
    <View style={{ padding: 8, gap: 5 }}><Text numberOfLines={2} style={s.name}>{p.name}</Text><Text style={s.price}>{p.mnt ? money(p.mnt) : p.approx_mnt ? "≈ " + money(p.approx_mnt) : "Үнэ шалгах"}</Text><ProductOffers product={p} amount={p.mnt || p.approx_mnt} />{p.brand_id && p.shop_rating ? <Text style={s.note}>Дэлгүүрийн үнэлгээ {p.shop_rating}/5</Text> : null}</View>
  </Pressable>;
}
export function DiscoveryShelf({ query, free = false }: { query?: string; free?: boolean }) {
  const colors = usePalette();
  const s = createStyles(colors);
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
    {error ? <Pressable accessibilityRole="button" onPress={() => setRetry(x => x + 1)} style={s.empty}><Text style={{ color: colors.ink }}>Ачаалж чадсангүй. Дахин оролдох</Text></Pressable> : data && !data.products.length ? <View style={s.empty}><Text style={s.note}>{free ? data.status === "available" ? "Одоогоор 0¥ хүргэлттэй бараа олдсонгүй." : "Үнэгүй хүргэлттэй барааны мэдээлэл түр боломжгүй байна." : "Энэ ангилалд бараа олдсонгүй."}</Text></View> : null}
    <View style={s.grid}>{data?.products.slice(0, free ? 8 : 6).map(p => <View key={p.id} style={{ width: "48%" }}><DiscoveryCard product={p} /></View>)}</View>
  </View>;
}
function ElevenSale() {
  const colors = usePalette();
  const [now, setNow] = useState(() => Date.now());
  const [data, setData] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const active = elevenSaleActive(now);
  useEffect(() => {
    // Clock checks do not request the API; resume also removes offers that expired in the background.
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") setNow(Date.now()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(() => controller.abort(), 15000);
    void catalog<{ products: Product[] }>("supplier-deals", { page: 1 }, controller.signal)
      .then(result => {
        if (!Array.isArray(result.products)) throw new Error("Invalid offers");
        if (!cancelled) { setData(result.products); setError(false); setNow(Date.now()); }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [active]);
  if (!active) return null;
  const products = elevenSaleProducts(data || [], now);
  if (error || (data && !products.length)) return null;
  return <View testID="eleven-sale" style={{ padding: 12, gap: 12, borderRadius: 18, backgroundColor: colors.accentSurface, borderWidth: 1, borderColor: colors.line }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ color: colors.orange, fontSize: 42, fontWeight: "900", letterSpacing: -2 }}>11.11</Text>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: colors.accentText, fontSize: 10, fontWeight: "700" }}>11.11-ИЙН СОНГОЛТ</Text>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 19, fontWeight: "800" }}>Хямдрал, купонтой бараа</Text>
      </View>
    </View>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Нийлүүлэгчийн хямдрал, купон · Нөхцөл болон эцсийн үнийг захиалах үед шалгана.</Text>
    {!data && !error && <View accessibilityLabel="11.11 хямдрал ачаалж байна"><Busy /></View>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="eleven-sale-grid" contentContainerStyle={{ gap: 10 }}>
      {products.map(p => <View key={p.id} testID="eleven-sale-item" style={{ width: 152 }}><DiscoveryCard product={p} /></View>)}
    </ScrollView>
  </View>;
}
function DealsShelf() {
  const colors = usePalette();
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [data, setData] = useState<{ products: Product[]; more: boolean } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void catalog<{ products: Product[]; more: boolean }>("supplier-deals", { page }, controller.signal)
      .then(r => { if (!controller.signal.aborted) { setData(r); setError(false); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [page, retry]);
  return <View style={{ gap: 10 }}>
    <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "800" }}>Хямдрал, купон</Text>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Каталогийн сонголт. Купон хэрэглэх нөхцөлтэй бөгөөд эцсийн үнийг захиалах үед шалгана.</Text>
    {!data && !error && <Busy />}
    {error && <Pressable accessibilityRole="button" onPress={() => { setError(false); setRetry(x => x + 1); }}><Text style={{ color: colors.accentText }}>Дахин оролдох</Text></Pressable>}
    {data && !data.products.length && <Text style={{ color: colors.muted }}>Энэ сонголтод баталгаатай хямдрал, купон олдсонгүй.</Text>}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
      {data?.products.map(p => <View key={p.id} style={{ width: "48%" }}><DiscoveryCard product={p} /></View>)}
    </View>
    {data?.more && <Pressable accessibilityRole="button" onPress={() => { setData(null); setError(false); setPage(x => x + 1); }} style={{ padding: 14 }}><Text style={{ color: colors.accentText }}>Дараагийн сонголт →</Text></Pressable>}
  </View>;
}
export function HomeDiscovery({ onSearch }: { onSearch: (q: string) => void }) {
  const colors = usePalette();
  const s = createStyles(colors);
  const [tab, setTab] = useState("explore");
  const channels = [["explore", "Танд зориулсан"], ["deals", "Хямдрал"], ["free", "0¥ хүргэлт"], ["fashion", "Хувцас"], ["home", "Гэр ахуй"], ["tech", "Технологи"]];
  return <View style={{ gap: 14 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
      {channels.map(([id, label]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[s.tab, tab === id && { borderBottomColor: colors.orange }]}><Text style={{ fontSize: 15, fontWeight: "700", color: id === "free" ? colors.success : tab === id ? colors.ink : colors.muted }}>{label}</Text></Pressable>)}
    </ScrollView>
    {tab === "deals" ? <DealsShelf /> : tab !== "explore" ? <DiscoveryShelf key={tab} free={tab === "free"} query={tab === "fashion" ? "women clothing" : tab === "tech" ? "electronics" : "home storage"} /> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}>
        {[{ id: "home", title: "Тухтай гэр", sub: "Өдөр тутмыг хялбар болгоё" }, { id: "women", title: "Өөрийн хэв маяг", sub: "Шинэ сонголтоо олоорой" }, { id: "tech", title: "Ухаалаг хэрэглээ", sub: "Танд хэрэгтэй технологи" }].map((c, n) => {
          const category = categories.find(x => x.id === c.id) || categories[n];
          return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.title} onPress={() => onSearch(category.query)} style={[s.collection, { backgroundColor: n % 2 ? colors.accentSurface : colors.subtle }]}>
            <Text style={s.heading}>{c.title} ↗</Text><Text style={s.note}>{c.sub}</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <CategoryPhoto image={category.image} size={132} />
              <View style={{ gap: 8 }}>{category.children.slice(0, 2).map(t => <CategoryPhoto key={t.query} image={t.image} size={62} />)}</View>
            </View>
          </Pressable>;
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {categories.slice(0, 12).map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.name} onPress={() => onSearch(c.query)} style={{ width: 72, alignItems: "center", gap: 6 }}><CategoryPhoto image={c.image} /><Text numberOfLines={2} style={{ fontSize: 11, textAlign: "center", color: colors.ink }}>{c.name}</Text></Pressable>)}
      </ScrollView>
      <ElevenSale />
      <Pressable onPress={() => setTab("free")} accessibilityRole="button" accessibilityLabel="Үнэгүй хүргэлттэй бараа харах" style={s.freeBanner}><Icon name="truck" size={28} color={colors.success} /><View style={{ flex: 1, gap: 3 }}><Text style={{ fontWeight: "800", color: colors.success }}>Хятад дотор 0¥ хүргэлт</Text><Text style={s.note}>Эрээн хүртэл · Монголын тээвэр тусдаа</Text></View><Icon name="chevron" size={16} /></Pressable>
    </>}
  </View>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  heading: { fontSize: 17, fontWeight: "800", color: colors.ink }, note: { fontSize: 12, lineHeight: 18, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  card: { borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface }, name: { fontSize: 13, lineHeight: 18, minHeight: 36, color: colors.ink }, price: { fontSize: 19, fontWeight: "800", color: colors.accentText },
  empty: { padding: 16, borderRadius: 12, backgroundColor: colors.subtle }, tab: { minHeight: 44, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  collection: { width: 238, backgroundColor: colors.subtle, borderRadius: 18, padding: 14, gap: 8 }, freeBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: colors.successSurface, borderRadius: 14 },
});
