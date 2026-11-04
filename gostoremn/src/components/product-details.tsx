import { ProductReviews } from "./product-reviews";
import { ProductDiscountBadge, ProductOffers } from "./product-offers";
import { usePalette, type Palette } from "@/lib/palette";
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { catalog } from "@/lib/api";
import type { Product, Variant } from "@/lib/types";
import { Icon } from "./shop-ui";
import { Busy, Button, Card, Copy, ErrorBox, money } from "./ui";

const tabs = [
  { id: "overview", label: "Тойм" }, { id: "reviews", label: "Үнэлгээ" },
  { id: "details", label: "Үзүүлэлт" }, { id: "recommend", label: "Санал болгох" },
] as const;
type Section = typeof tabs[number]["id"];

function useRecommendations(id: string) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [more, setMore] = useState(true);
  const state = useRef({ page: 1, loading: false, more: true, failed: false, controller: new AbortController(), seen: new Set([id]) });
  const load = useCallback(async (retry = false) => {
    const current = state.current;
    if (current.loading || !current.more || current.controller.signal.aborted || (current.failed && !retry)) return;
    current.loading = true;
    current.failed = false;
    setLoading(true);
    setError("");
    try {
      const result = await catalog<{ products: Product[]; more?: boolean }>("supplier-recommend", { id, page: current.page }, current.controller.signal);
      if (current.controller.signal.aborted) return;
      const next = result.products.filter(product => {
        const price = product.mnt ?? product.approx_mnt;
        if (!product.id || current.seen.has(product.id) || product.sellable === false || !(price && price > 0)) return false;
        current.seen.add(product.id);
        return true;
      });
      current.page++;
      current.more = result.more === true;
      setItems(previous => [...previous, ...next]);
      setMore(current.more);
    } catch (reason) {
      if (!current.controller.signal.aborted) {
        current.failed = true;
        setError(reason instanceof Error ? reason.message : "Бараа ачаалж чадсангүй.");
      }
    } finally {
      current.loading = false;
      if (!current.controller.signal.aborted) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    // Isolate canceled requests when React replays effects during development.
    state.current = { page: 1, loading: false, more: true, failed: false, controller: new AbortController(), seen: new Set([id]) };
    void load();
    const current = state.current;
    return () => current.controller.abort();
  }, [id, load]);
  return { items, loading, error, more, load };
}

export function ProductDetails({ product, variant, rate, onChoose }: { product: Product; variant?: Variant; rate: number; onChoose: () => void }) {
  const colors = usePalette();
  const styles = createStyles(colors);
  const scroll = useRef<ComponentRef<typeof FlatList<Product>>>(null), positions = useRef<Partial<Record<Section, number>>>({ overview: 0 });
  const [active, setActive] = useState<Section>("overview"), [expanded, setExpanded] = useState(false), [fullName, setFullName] = useState(false);
  const recommendations = useRecommendations(product.id);
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
  function jump(id: Section) { setActive(id); scroll.current?.scrollToOffset({ offset: positions.current[id] || 0, animated: true }); }
  return <View style={{ flex: 1 }}>
    <View style={styles.tabs}>{tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active === tab.id }}
      onPress={() => jump(tab.id)} style={[styles.tab, active === tab.id && { borderBottomColor: colors.orange }]}>
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: active === tab.id ? "700" : "500", color: active === tab.id ? colors.accentText : colors.muted }}>{tab.label}</Text>
    </Pressable>)}</View>
    <FlatList ref={scroll} testID="product-content"
      data={recommendations.items} numColumns={2} keyExtractor={item => item.id}
      initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
      onEndReached={() => { void recommendations.load(); }} onEndReachedThreshold={0.7}
      columnWrapperStyle={{ paddingHorizontal: 10, gap: 8 }}
      renderItem={({ item: p }) => <Pressable testID="recommendation-card" accessibilityRole="button" accessibilityLabel={p.name}
        onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })} style={styles.product}>
        <Image source={p.image || undefined} recyclingKey={p.id} contentFit="cover" style={{ width: "100%", aspectRatio: 1 }} />
        <ProductDiscountBadge product={p} amount={p.mnt || p.approx_mnt} />
        <View style={{ padding: 10, gap: 6 }}>
          <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 19, minHeight: 38, color: colors.ink }}>{p.name}</Text>
          <Text style={{ fontSize: 19, fontWeight: "800", color: colors.accentText }}>{p.mnt ? money(p.mnt) : "≈ " + money(p.approx_mnt!)}</Text>
          <ProductOffers product={p} amount={p.mnt || p.approx_mnt} />
        </View>
      </Pressable>}
      ListFooterComponent={<View testID="recommendation-status" style={{ padding: 16, gap: 12 }}>
        {recommendations.loading && <Busy />}
        {!!recommendations.error && <ErrorBox message={recommendations.error} retry={() => { void recommendations.load(true); }} />}
        {!recommendations.loading && !recommendations.error && recommendations.more && <Button title="Дараагийн бараа" secondary onPress={() => { void recommendations.load(); }} />}
        {!recommendations.loading && !recommendations.error && !recommendations.more && <Copy>{recommendations.items.length ? "Бүх санал болгох барааг үзлээ." : "Санал болгох бараа одоогоор алга байна."}</Copy>}
        <Text style={styles.muted}>Үнэ, үлдэгдэл захиалга үүсгэхэд дахин шалгагдана.</Text>
      </View>} scrollEventThrottle={80} contentInsetAdjustmentBehavior="never"
      onScroll={e => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        if (contentOffset.y > 0 && contentOffset.y + layoutMeasurement.height >= contentSize.height - 12) { setActive("recommend"); return; }
        const y = e.nativeEvent.contentOffset.y + 40;
        const current = [...tabs].reverse().find(t => positions.current[t.id] !== undefined && y >= positions.current[t.id]!);
        if (current) setActive(current.id);
      }} contentContainerStyle={{ paddingBottom: 24, gap: 10, maxWidth: 820, width: "100%", alignSelf: "center" }}
      ListHeaderComponent={<View style={{ gap: 10 }}>
      <View onLayout={e => { positions.current.overview = e.nativeEvent.layout.y; }} style={{ gap: 10 }}>
        <View style={{ backgroundColor: colors.surface }}>
          <ScrollView key={width} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {images.map(uri => <Image key={uri} source={uri} contentFit="contain" style={{ width, height: width }} />)}
          </ScrollView>
          {!!images.length && <View style={styles.counter}><Text style={{ color: "white", fontSize: 12 }}>{Math.min(imageIndex + 1, images.length)} / {images.length}</Text></View>}
        </View>
        <View style={styles.summary}>
          <Text style={styles.price}>{variant?.cny && rate ? money(Math.ceil(variant.cny * rate)) : product.mnt ? money(product.mnt) : "Үнэ шалгах"}<Text style={{ fontSize: 12, color: colors.muted }}> / нэгж</Text></Text>
          <ProductOffers product={product} amount={variant?.cny && rate ? Math.ceil(variant.cny * rate) : product.mnt} discount={variant ? variant.card_discount ?? null : product.card_discount} details />
          <Pressable accessibilityRole="button" accessibilityLabel="Барааны нэрийг дэлгэрүүлэх" accessibilityState={{ expanded: fullName }} onPress={() => setFullName(v => !v)}>
            <Text numberOfLines={fullName ? undefined : 2} style={{ fontSize: 17, lineHeight: 24, fontWeight: "600", color: colors.ink }}>{product.name}</Text>
            <Text style={styles.more}>{fullName ? "Хураах" : "Бүтэн нэрийг харах"}</Text>
          </Pressable>
          <Text style={styles.muted}>Барааны үнэ · Хүргэлт тусдаа тооцогдоно</Text>
        </View>
        <View style={styles.inset}><Card>
          <Pressable accessibilityRole="button" accessibilityLabel="Хувилбар сонгох" onPress={onChoose} style={styles.row}>
            <Text style={styles.muted}>Сонголт</Text><Text numberOfLines={2} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600" }}>{variant?.label || "Өнгө, хэмжээ, тоо сонгох"}</Text><Icon name="chevron" size={18} />
          </Pressable>
          <View style={styles.separator} />
          <View style={styles.row}><Icon name="truck" color={colors.success} /><View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: colors.ink, fontWeight: "600" }}>Хятад → Эрээн → Улаанбаатар</Text><Text style={styles.muted}>Хятад хүргэлтийг захиалахын өмнө, каргоны төлбөрийг бодит хэмжилтээр тооцно.</Text>
          </View></View>
          <View style={styles.separator} />
          <Pressable accessibilityRole="button" onPress={() => router.push("/help")} style={styles.row}><Icon name="shield" color={colors.success} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 14 }}>Хүргэлт, төлбөрийн нөхцөл</Text><Icon name="chevron" size={18} /></Pressable>
        </Card></View>
      </View>
      <View onLayout={e => { positions.current.reviews = e.nativeEvent.layout.y; }} style={styles.inset} testID="product-reviews"><Card>
        <Text style={styles.heading}>Үнэлгээ, сэтгэгдэл</Text>
        {!!product.vendor_name && <View style={styles.row}><Icon name="home" size={22} color={colors.accentText} /><Text style={{ color: colors.ink, flex: 1, fontWeight: "600" }}>{product.vendor_name}</Text></View>}
        {rating !== null && <View style={styles.rating}><Text style={{ fontSize: 27, fontWeight: "800", color: colors.accentText }}>★ {rating.toFixed(1)}<Text style={{ color: colors.ink, fontSize: 14 }}> / 5</Text></Text>
          <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: "600" }}>Дэлгүүрийн үнэлгээ</Text><Text style={styles.muted}>Taobao дэлгүүрийн нийт үзүүлэлт</Text></View></View>}
        <View style={styles.separator} />
        <ProductReviews key={product.id} productId={product.id} />
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
      <View onLayout={e => { positions.current.recommend = e.nativeEvent.layout.y; }} style={[styles.inset, { gap: 8 }]} testID="product-recommendations">
        <Text style={styles.heading}>Танд санал болгох</Text>
        <Text style={styles.muted}>Олон ангиллын бараанаас сонгоорой</Text>
      </View>
      </View>}
    />
  </View>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  tabs: { flexDirection: "row", backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  tab: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  summary: { backgroundColor: colors.surface, padding: 16, gap: 10 },
  price: { fontSize: 30, fontWeight: "800", color: colors.accentText },
  inset: { paddingHorizontal: 10 },
  heading: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 12, lineHeight: 19, color: colors.muted },
  more: { fontSize: 12, color: colors.accentText, marginTop: 5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  separator: { height: 1, backgroundColor: colors.line },
  rating: { flexDirection: "row", gap: 16, alignItems: "center", backgroundColor: colors.accentSurface, borderRadius: 10, padding: 12 },
  fact: { flexDirection: "row", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  expand: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  counter: { position: "absolute", bottom: 12, right: 12, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: "#00000080" },
  product: { width: "48%", flexGrow: 1, maxWidth: "50%", backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
});
