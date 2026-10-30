import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { catalog } from "@/lib/api";
import type { Product, Variant } from "@/lib/types";
import { Icon } from "./shop-ui";
import { Busy, Button, Card, Copy, ErrorBox, colors, money } from "./ui";

const tabs = [
  { id: "overview", label: "Тойм" }, { id: "reviews", label: "Үнэлгээ" },
  { id: "details", label: "Үзүүлэлт" }, { id: "recommend", label: "Санал болгох" },
] as const;
type Section = typeof tabs[number]["id"];

function Recommendations({ id }: { id: string }) {
  const [items, setItems] = useState<Product[]>([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void catalog<{ products: Product[] }>("supplier-recommend", { id }, controller.signal)
      .then(r => {
        if (controller.signal.aborted) return;
        const seen = new Set([id]);
        setItems((r.products || []).filter(p => p?.id && !seen.has(p.id) && !!seen.add(p.id)).slice(0, 12));
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  return <View testID="product-recommendations" style={{ gap: 12 }}>
    <Text style={styles.heading}>Танд санал болгох</Text>
    <Text style={styles.muted}>Олон ангиллын бараанаас сонгоорой</Text>
    {loading ? <Busy /> : error ? <ErrorBox message={error} retry={() => { setError(""); setLoading(true); setRetry(r => r + 1); }} /> : !items.length ?
      <Card><Copy>Санал болгох бараа одоогоор алга байна.</Copy><Button title="Бусад бараа үзэх" secondary onPress={() => router.push("/")} /></Card> :
      <View testID="recommendation-grid" style={styles.grid}>{items.map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name}
        onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })} style={styles.product}>
        <Image source={p.image || undefined} recyclingKey={p.id} contentFit="cover" style={{ width: "100%", aspectRatio: 1 }} />
        <View style={{ padding: 10, gap: 6 }}><Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 19, minHeight: 38, color: colors.ink }}>{p.name}</Text>
          <Text style={{ fontSize: 19, fontWeight: "800", color: "#c44000" }}>{p.mnt ? money(p.mnt) : "Үнэ шалгах"}</Text></View>
      </Pressable>)}</View>}
  </View>;
}

export function ProductDetails({ product, variant, rate, onChoose }: { product: Product; variant?: Variant; rate: number; onChoose: () => void }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), positions = useRef<Partial<Record<Section, number>>>({ overview: 0 });
  const [active, setActive] = useState<Section>("overview"), [expanded, setExpanded] = useState(false), [fullName, setFullName] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const width = Math.min(useWindowDimensions().width, 820);
  const images = [...new Set([product.image, ...(product.images || [])])].filter(Boolean).slice(0, 12);
  const attributes = (product.attributes || []).filter(a => a.name?.trim() && a.value?.trim());
  const find = (pattern: RegExp) => attributes.find(a => pattern.test(a.name) && !/^(other|others|其他|无)$/i.test(a.value))?.value;
  const facts = [
    { name: "Брэнд", value: product.brand || find(/^(brand|品牌|брэнд)$/i) },
    { name: "Материал", value: find(/material|fabric|材质|面料|материал/i) },
    { name: "Сонголт", value: product.variants.length ? `${product.variants.length} хувилбар` : undefined },
    { name: "Илгээх газар", value: product.ship_from },
  ].filter(a => a.value);
  const summary = facts.length ? facts : attributes.slice(0, 4);
  const rating = typeof product.shop_rating === "number" && product.shop_rating > 0 && product.shop_rating <= 5 ? product.shop_rating : null;
  function jump(id: Section) { setActive(id); scroll.current?.scrollTo({ y: positions.current[id] || 0, animated: true }); }
  return <View style={{ flex: 1 }}>
    <View style={styles.tabs}>{tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active === tab.id }}
      onPress={() => jump(tab.id)} style={[styles.tab, active === tab.id && { borderBottomColor: colors.orange }]}>
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: active === tab.id ? "700" : "500", color: active === tab.id ? "#c44000" : colors.muted }}>{tab.label}</Text>
    </Pressable>)}</View>
    <ScrollView ref={scroll} testID="product-content" scrollEventThrottle={80} contentInsetAdjustmentBehavior="never"
      onScroll={e => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        if (contentOffset.y > 0 && contentOffset.y + layoutMeasurement.height >= contentSize.height - 12) { setActive("recommend"); return; }
        const y = e.nativeEvent.contentOffset.y + 40;
        const current = [...tabs].reverse().find(t => positions.current[t.id] !== undefined && y >= positions.current[t.id]!);
        if (current) setActive(current.id);
      }} contentContainerStyle={{ paddingBottom: 24, gap: 10, maxWidth: 820, width: "100%", alignSelf: "center" }}>
      <View onLayout={e => { positions.current.overview = e.nativeEvent.layout.y; }} style={{ gap: 10 }}>
        <View style={{ backgroundColor: "white" }}>
          <ScrollView key={width} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {images.map(uri => <Image key={uri} source={uri} contentFit="contain" style={{ width, height: width }} />)}
          </ScrollView>
          {!!images.length && <View style={styles.counter}><Text style={{ color: "white", fontSize: 12 }}>{Math.min(imageIndex + 1, images.length)} / {images.length}</Text></View>}
        </View>
        <View style={styles.summary}>
          <Text style={styles.price}>{variant?.cny && rate ? money(Math.ceil(variant.cny * rate)) : product.mnt ? money(product.mnt) : "Үнэ шалгах"}<Text style={{ fontSize: 12, color: colors.muted }}> / нэгж</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Барааны нэрийг дэлгэрүүлэх" accessibilityState={{ expanded: fullName }} onPress={() => setFullName(v => !v)}>
            <Text numberOfLines={fullName ? undefined : 2} style={{ fontSize: 17, lineHeight: 24, fontWeight: "600", color: colors.ink }}>{product.name}</Text>
            <Text style={styles.more}>{fullName ? "Хураах" : "Бүтэн нэрийг харах"}</Text>
          </Pressable>
          <Text style={styles.muted}>Барааны үнэ · Хүргэлт тусдаа тооцогдоно</Text>
        </View>
        <View style={styles.inset}><Card>
          <Pressable accessibilityRole="button" accessibilityLabel="Хувилбар сонгох" onPress={onChoose} style={styles.row}>
            <Text style={styles.muted}>Сонголт</Text><Text numberOfLines={2} style={{ flex: 1, fontSize: 14, fontWeight: "600" }}>{variant?.label || "Өнгө, хэмжээ, тоо сонгох"}</Text><Icon name="chevron" size={18} />
          </Pressable>
          <View style={styles.separator} />
          <View style={styles.row}><Icon name="truck" color="#168267" /><View style={{ flex: 1, gap: 5 }}>
            <Text style={{ fontWeight: "600" }}>Хятад → Эрээн → Улаанбаатар</Text><Text style={styles.muted}>Хятад хүргэлтийг захиалахын өмнө, каргоны төлбөрийг бодит хэмжилтээр тооцно.</Text>
          </View></View>
          <View style={styles.separator} />
          <Pressable accessibilityRole="button" onPress={() => router.push("/help")} style={styles.row}><Icon name="shield" color="#168267" />
            <Text style={{ flex: 1, fontSize: 14 }}>Хүргэлт, төлбөрийн нөхцөл</Text><Icon name="chevron" size={18} /></Pressable>
        </Card></View>
      </View>
      <View onLayout={e => { positions.current.reviews = e.nativeEvent.layout.y; }} style={styles.inset} testID="product-reviews"><Card>
        <Text style={styles.heading}>Үнэлгээ, сэтгэгдэл</Text>
        {!!product.vendor_name && <View style={styles.row}><Icon name="home" size={22} color="#b43f0a" /><Text style={{ flex: 1, fontWeight: "600" }}>{product.vendor_name}</Text></View>}
        {rating !== null && <View style={styles.rating}><Text style={{ fontSize: 27, fontWeight: "800", color: "#b43f0a" }}>★ {rating.toFixed(1)}<Text style={{ fontSize: 14 }}> / 5</Text></Text>
          <View style={{ flex: 1 }}><Text style={{ fontWeight: "600" }}>Дэлгүүрийн үнэлгээ</Text><Text style={styles.muted}>Taobao дэлгүүрийн нийт үзүүлэлт</Text></View></View>}
        <View style={styles.separator} />
        <Text style={{ fontWeight: "600", fontSize: 14 }}>Худалдан авагчдын сэтгэгдэл</Text>
        <Text style={styles.muted}>Энэ барааны худалдан авагчдын сэтгэгдлийг одоогоор харуулах боломжгүй байна.</Text>
      </Card></View>
      <View onLayout={e => { positions.current.details = e.nativeEvent.layout.y; }} style={styles.inset} testID="product-specifications"><Card>
        <Text style={styles.heading}>Товч үзүүлэлт</Text>
        {(expanded ? attributes : summary).map((a, i) => <View key={i} style={styles.fact} testID="product-fact">
          <Text style={{ width: "34%", fontSize: 12, color: colors.muted }}>{a.name}</Text>
          <Text numberOfLines={expanded ? undefined : 2} style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.ink }}>{a.value}</Text>
        </View>)}
        {!summary.length && <Text style={styles.muted}>Өнгө, хэмжээ, бүрдлийг сонгосон хувилбарын нэрээс шалгана уу.</Text>}
        {!!attributes.length && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel="Бүх үзүүлэлтийг дэлгэрүүлэх"
          onPress={() => setExpanded(v => !v)} style={styles.expand}><Text style={styles.more}>{expanded ? "Үзүүлэлтийг хураах" : `Бүх ${attributes.length} үзүүлэлтийг харах`}</Text></Pressable>}
      </Card></View>
      <View onLayout={e => { positions.current.recommend = e.nativeEvent.layout.y; }} style={styles.inset}><Recommendations key={product.id} id={product.id} /></View>
      <Text style={[styles.muted, { paddingHorizontal: 16 }]}>Үнэ, үлдэгдэл захиалга үүсгэхэд дахин шалгагдана.</Text>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  tabs: { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderColor: colors.line },
  tab: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  summary: { backgroundColor: "white", padding: 16, gap: 10 },
  price: { fontSize: 30, fontWeight: "800", color: "#d84500" },
  inset: { paddingHorizontal: 10 },
  heading: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 12, lineHeight: 19, color: colors.muted },
  more: { fontSize: 12, color: "#b43f0a", marginTop: 5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  separator: { height: 1, backgroundColor: colors.line },
  rating: { flexDirection: "row", gap: 16, alignItems: "center", backgroundColor: "#fff4eb", borderRadius: 10, padding: 12 },
  fact: { flexDirection: "row", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  expand: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  counter: { position: "absolute", bottom: 12, right: 12, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: "#00000080" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  product: { width: "48%", flexGrow: 1, maxWidth: "50%", backgroundColor: "white", borderRadius: 12, overflow: "hidden" },
});
