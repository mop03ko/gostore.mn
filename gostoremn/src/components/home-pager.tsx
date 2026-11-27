import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, AppState, FlatList, Platform, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { CarouselTouch, HomeCategories, HomeCategoryPhotos, HomeDealHighlights, HomeSubcategories, homeCategories } from "./home-deals";
import { DiscoveryCard } from "./discovery";
import { Busy, Button, Copy, ErrorBox } from "./ui";
import { catalog } from "@/lib/api";
import { usePalette } from "@/lib/palette";
import { productSavings } from "@/lib/product-offers";
import type { Product } from "@/lib/types";

type Snapshot = { products: Product[]; page: number; more: boolean; fetched: number; offset: number };
type Results = { products: Product[]; more: boolean; revalidate?: boolean; stale?: boolean };
const empty: Snapshot = { products: [], page: 0, more: false, fetched: 0, offset: 0 };

function CategoryFeed({ index, active, initial, onSave, onSelect }: { index: number; active: boolean; initial: Snapshot; onSave: (index: number, data: Snapshot) => void; onSelect: (index: number) => void }) {
  const c = usePalette(), { width } = useWindowDimensions(), columns = width >= 800 ? 4 : 2;
  const [data, setData] = useState(initial), [page, setPage] = useState(Math.max(1, initial.page));
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0), [tick, setTick] = useState(0);
  const list = useRef<FlatList<Product>>(null), lock = useRef(false), offset = useRef(initial.offset);
  const [restoreOffset] = useState(initial.offset);
  const restored = useRef(initial.offset === 0), snapshotRef = useRef(initial);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [stale, setStale] = useState(false);
  useEffect(() => () => clearTimeout(scrollTimer.current), []);
  useEffect(() => {
    if (!active) return;
    const resume = AppState.addEventListener("change", state => { if (state === "active") setTick(x => x + 1); });
    const expiry = Math.min(...data.products.map(p => p.card_discount?.expires || 0).filter(t => t * 1000 > Date.now()));
    const timer = Number.isFinite(expiry) ? setTimeout(() => setTick(x => x + 1), Math.min(2147483647, Math.max(20, expiry * 1000 - Date.now() + 20))) : undefined;
    return () => { clearTimeout(timer); resume.remove(); };
  }, [active, data.products, tick]);
  useEffect(() => {
    if (!active || (data.page === page && Date.now() - data.fetched < 300000 && !retry)) return;
    const controller = new AbortController();
    // This effect owns a cancellable request for this page only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true); setError(""); lock.current = true;
    const params = { q: homeCategories[index].query, page, limit: 12, sort: "default" };
    void (async () => {
      try {
        let result = await catalog<Results>(index ? "supplier-search" : "supplier-deals", index ? params : { page }, controller.signal);
        if (controller.signal.aborted) return;
        setStale(!!result.stale || !!result.revalidate);
        if (index && result.revalidate) {
          result = await catalog<Results>("supplier-search", { ...params, refresh: 1 }, controller.signal);
          if (controller.signal.aborted) return;
          setStale(!!result.stale);
        }
        const products = page === 1 ? result.products : [...data.products.filter(p => !result.products.some(next => next.id === p.id)), ...result.products];
        const next = { products, page, more: result.more, fetched: Date.now(), offset: offset.current };
        snapshotRef.current = next; setData(next); onSave(index, next);
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) { setBusy(false); lock.current = false; } }
    })();
    return () => { controller.abort(); lock.current = false; };
    // data is the snapshot captured when this request starts, not a trigger for a second request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, page, retry, onSave]);
  // Only the dedicated deals tab excludes full-price products.
  const products = index === 0 ? data.products.filter(p => productSavings(p, p.mnt || p.approx_mnt).sale) : data.products;
  const nextPage = () => { if (active && !busy && !lock.current && data.more && !error) { lock.current = true; setPage(x => x + 1); } };
  const saveScroll = () => onSave(index, { ...snapshotRef.current, offset: offset.current });
  return <FlatList ref={list} testID={`home-feed-${index}`} key={columns} numColumns={columns} data={products} keyExtractor={p => p.id}
    nestedScrollEnabled directionalLockEnabled keyboardShouldPersistTaps="handled" initialNumToRender={6} windowSize={5}
    contentOffset={{ x: 0, y: restoreOffset }}
    onContentSizeChange={(_, height) => { if (!restored.current && height > restoreOffset) { restored.current = true; list.current?.scrollToOffset({ offset: restoreOffset, animated: false }); } }}
    onScroll={e => { if (!restored.current) return; offset.current = e.nativeEvent.contentOffset.y; clearTimeout(scrollTimer.current); scrollTimer.current = setTimeout(saveScroll, 150); }} scrollEventThrottle={100}
    onScrollEndDrag={saveScroll} onMomentumScrollEnd={saveScroll}
    contentContainerStyle={{ padding: 8, paddingBottom: 24, gap: 8 }} columnWrapperStyle={{ gap: 8 }}
    onEndReached={() => { if (products.length) nextPage(); }} onEndReachedThreshold={0.4}
    ListHeaderComponent={<View style={{ gap: 12, marginBottom: 8 }}>
      {index === 0 && <><HomeDealHighlights products={products} /><HomeCategoryPhotos onSelect={onSelect} /></>}
      <View testID="home-deals-heading" style={{ padding: 5, gap: 6 }}><Text accessibilityRole="header" style={{ color: c.navy, fontSize: 21, fontWeight: "800" }}>{index ? homeCategories[index].name : "Хямдралтай бараа"}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{index ? "Ангиллын бүх бараа · Ангиллыг хоёр тийш шударна уу" : "Бодит үнэ буурсан бараа · Ангиллыг хоёр тийш шударна уу"}</Text></View>
      {index > 0 && <HomeSubcategories categoryId={homeCategories[index].id} />}
      {stale && <Copy>Мэдээллийг шинэчилж байна…</Copy>}<ErrorBox message={error} retry={() => setRetry(x => x + 1)} />
    </View>}
    renderItem={({ item }) => <View style={{ flex: 1, maxWidth: columns === 4 ? "25%" : "50%" }}><DiscoveryCard product={item} /></View>}
    ListFooterComponent={<View style={{ paddingVertical: 12, gap: 8 }}>
      {busy ? <Busy /> : !products.length && !error ? <Copy>{index ? "Энэ ангилалд одоогоор бараа олдсонгүй." : "Одоогоор баталгаажсан хямдралтай бараа алга."}</Copy> : null}
      {!busy && data.more && !error && <Button title="Дараагийн бараанууд" onPress={nextPage} />}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: "center" }}>Эцсийн үнэ, хүргэлтийг захиалахын өмнө шалгана.</Text>
    </View>} />;
}

export function HomePager() {
  const c = usePalette(), { width } = useWindowDimensions();
  const [selected, setSelected] = useState(0), [visited, setVisited] = useState([0]), [snapshots, setSnapshots] = useState<Record<number, Snapshot>>({});
  const [carouselActive, setCarouselActive] = useState(false);
  const [position] = useState(() => new Animated.Value(0));
  const pager = useRef<ComponentRef<typeof ScrollView>>(null), settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = useRef(0), dragging = useRef(false), lastX = useRef(0), target = useRef<number | null>(null);
  const save = useCallback((index: number, data: Snapshot) => setSnapshots(prev => ({ ...prev, [index]: data })), []);
  const commit = useCallback((index: number) => {
    const next = Math.max(0, Math.min(homeCategories.length - 1, index));
    current.current = next; setSelected(next);
    setVisited(prev => [...prev.filter(i => i !== next), next].slice(-5));
  }, []);
  const select = useCallback((index: number) => {
    clearTimeout(settleTimer.current);
    const adjacent = Math.abs(index - current.current) === 1;
    target.current = index;
    commit(index);
    pager.current?.scrollTo({ x: index * width, animated: adjacent });
  }, [commit, width]);
  useEffect(() => { pager.current?.scrollTo({ x: current.current * width, animated: false }); position.setValue(current.current * width); }, [width, position]);
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  const settleAt = (x: number) => {
    if (target.current !== null && Math.abs(x - target.current * width) > 1) return;
    target.current = null; commit(Math.round(x / width));
  };
  const settled = (e: NativeSyntheticEvent<NativeScrollEvent>) => settleAt(e.nativeEvent.contentOffset.x);
  // Animated.event invokes the listener on scroll, never during render.
  // eslint-disable-next-line react-hooks/refs
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: position } } }], { useNativeDriver: Platform.OS !== "web", listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // RN Web uses CSS scroll snapping and has no momentum-end callback.
    if (Platform.OS !== "web") return;
    const x = e.nativeEvent.contentOffset.x; lastX.current = x;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => { if (!dragging.current) settleAt(x); }, 140);
  } });
  return <View style={{ flex: 1 }}>
    <HomeCategories selected={selected} onSelect={select} position={position} pageWidth={width} />
    <CarouselTouch value={setCarouselActive}>
      <Animated.ScrollView ref={pager} testID="home-category-pager" horizontal pagingEnabled snapToInterval={width} disableIntervalMomentum decelerationRate="fast"
        directionalLockEnabled nestedScrollEnabled bounces={false} overScrollMode="never" showsHorizontalScrollIndicator={false}
        scrollEnabled={Platform.OS === "web" || !carouselActive} style={{ flex: 1 }} scrollEventThrottle={16}
        onTouchStart={() => { if (Platform.OS === "web") { dragging.current = true; target.current = null; clearTimeout(settleTimer.current); } }}
        onTouchEnd={() => { if (Platform.OS === "web") { dragging.current = false; clearTimeout(settleTimer.current); settleTimer.current = setTimeout(() => settleAt(lastX.current), 180); } }}
        onTouchCancel={() => { if (Platform.OS === "web") dragging.current = false; }}
        onScrollBeginDrag={() => { dragging.current = true; target.current = null; clearTimeout(settleTimer.current); }}
        onScrollEndDrag={() => { dragging.current = false; }} onMomentumScrollEnd={settled}
        onScroll={onScroll}>
        {homeCategories.map((category, index) => <View key={category.id} testID={`home-page-${index}`} accessibilityElementsHidden={selected !== index} importantForAccessibility={selected === index ? "auto" : "no-hide-descendants"} aria-hidden={selected !== index} style={{ width, height: "100%", backgroundColor: c.surface }}>
          {visited.includes(index) ? <CategoryFeed index={index} active={selected === index} initial={snapshots[index] || empty} onSave={save} onSelect={select} /> : <View style={{ padding: 24, gap: 20 }}><Text style={{ color: c.navy, fontSize: 21, fontWeight: "800" }}>{category.name}</Text>{[0, 1, 2].map(row => <View key={row} style={{ flexDirection: "row", gap: 12 }}>{[0, 1].map(col => <View key={col} style={{ flex: 1, height: 170, borderRadius: 16, backgroundColor: c.subtle }} />)}</View>)}</View>}
        </View>)}
      </Animated.ScrollView>
    </CarouselTouch>
  </View>;
}
