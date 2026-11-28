import { useCompactAndroid } from "@/hooks/use-compact-android";
import { createContext, use, useEffect, useRef, useState, type ComponentProps, type ComponentRef } from "react";
import { Animated, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { CategoryPhoto, categories } from "./discovery";
import { Icon } from "./shop-ui";
import { money } from "./ui";
import { useWarehousePreference } from "./warehouse-preference";
import { usePalette } from "@/lib/palette";
import { percentLabel, productSavings } from "@/lib/product-offers";
import type { Product } from "@/lib/types";

export const homeCategories = [{ id: "all", name: "Хямдрал", query: "__all__", image: "" }, ...categories];
export const CarouselTouch = createContext<((active: boolean) => void) | null>(null);
function HomeCarousel(props: ComponentProps<typeof ScrollView>) {
  const touch = use(CarouselTouch);
  return <ScrollView {...props} nestedScrollEnabled directionalLockEnabled onTouchStart={() => touch?.(true)} onTouchEnd={() => touch?.(false)} onTouchCancel={() => touch?.(false)} />;
}

export function HomeCategories({ selected, onSelect, position, pageWidth }: { selected: number; onSelect: (index: number) => void; position: Animated.Value; pageWidth: number }) {
  const compact = useCompactAndroid();
  const c = usePalette(), scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  useEffect(() => { const tab = layouts[selected]; if (tab) scroll.current?.scrollTo({ x: Math.max(0, tab.x + tab.width / 2 - pageWidth / 2), animated: true }); }, [selected, layouts, pageWidth]);
  return <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} testID="home-category-tabs" contentContainerStyle={{ gap: compact ? 14 : 22, paddingHorizontal: compact ? 10 : 16 }} style={{ flexGrow: 0, backgroundColor: c.surface }}>
    {homeCategories.map((category, index) => <Pressable key={category.id} onLayout={e => { const { x, width } = e.nativeEvent.layout; setLayouts(prev => prev[index]?.x === x && prev[index]?.width === width ? prev : { ...prev, [index]: { x, width } }); }} accessibilityRole="tab" accessibilityState={{ selected: selected === index }} aria-selected={selected === index} onPress={() => onSelect(index)} style={{ minHeight: 48, justifyContent: "center" }}>
      <Text style={{ color: selected === index ? c.ink : c.muted, fontSize: compact ? 14 : 16, fontWeight: selected === index ? "800" : "500" }}>{category.name}</Text>
    </Pressable>)}
    {Object.keys(layouts).length === homeCategories.length && <Animated.View testID="home-tab-indicator" pointerEvents="none" style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: 24, borderRadius: 2, backgroundColor: c.orange, transform: [{ translateX: position.interpolate({ inputRange: homeCategories.map((_, i) => i * pageWidth), outputRange: homeCategories.map((_, i) => layouts[i].x + (layouts[i].width - 24) / 2), extrapolate: "clamp" }) }] }} />}
  </ScrollView>;
}

function priceLabel(product: Product) { return (product.mnt ? "" : "≈ ") + money(product.mnt || product.approx_mnt || 0); }

function DealPhoto({ product, large = false }: { product: Product; large?: boolean }) {
  const c = usePalette();
  const { sale } = productSavings(product, product.mnt || product.approx_mnt);
  return <Pressable accessibilityRole="button" accessibilityLabel={product.name} onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })} style={{ flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: c.surface }}>
    <Image source={product.image || undefined} contentFit="cover" style={{ width: "100%", height: "100%" }} />
    {sale && <Text style={{ position: "absolute", top: 5, left: 5, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2, backgroundColor: "#b93609", color: "#fff", fontSize: 11, fontWeight: "800" }}>{percentLabel(sale.percent)}</Text>}
    <Text numberOfLines={1} style={{ position: "absolute", bottom: 0, left: 0, maxWidth: "100%", borderTopRightRadius: 8, backgroundColor: c.surface, color: c.ink, paddingHorizontal: 6, paddingVertical: 4, fontSize: large ? 17 : 12, fontWeight: "800" }}>{priceLabel(product)}</Text>
  </Pressable>;
}

export function homeDealGroups(deals: Product[]): Product[][] {
  const festive = deals.filter(p => p.new_year_deal).slice(0, 12);
  const regular = deals.filter(p => !p.new_year_deal);
  return (festive.length
    ? [...Array.from({ length: Math.ceil(festive.length / 3) }, (_, index) => festive.slice(index * 3, index * 3 + 3)), regular.slice(0, 3)]
    : [deals.slice(0, 3), deals.slice(3, 6)]).filter(group => group.length);
}

export function HomeDealHighlights({ groups }: { groups: Product[][] }) {
  const compact = useCompactAndroid();
  const c = usePalette(), { width } = useWindowDimensions();
  if (!groups.length) return null;
  return <View testID="home-deal-highlights">
    <HomeCarousel testID="home-deal-carousel" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {groups.map((group, index) => <View key={group[0].id} style={{ width: Math.min(compact ? 260 : 330, width * (compact ? 0.70 : 0.79)), borderRadius: compact ? 14 : 20, padding: compact ? 8 : 12, gap: compact ? 5 : 8, backgroundColor: index % 2 ? c.accentSurface : c.subtle }}>
        <Text numberOfLines={1} style={{ fontSize: compact ? 16 : 18, fontWeight: "800", color: c.navy }}>{group[0].new_year_deal ? "Шинэ жилийн хямдрал" : index ? "Өнөөдрийн олз" : "Хямдралын сонголт"}</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>Үнэ буурсан бараанууд</Text>
        <View style={{ height: compact ? 132 : 190, flexDirection: "row", gap: 7 }}>
          <View style={{ flex: 2 }}><DealPhoto product={group[0]} large /></View>
          {group.length > 1 && <View style={{ flex: 1, gap: 7 }}>{group.slice(1).map(p => <DealPhoto key={p.id} product={p} />)}</View>}
        </View>
      </View>)}
    </HomeCarousel>
  </View>;
}

export function HomeCategoryPhotos({ onSelect }: { onSelect: (index: number) => void }) {
  const compact = useCompactAndroid();
  const c = usePalette();
  return <HomeCarousel horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: compact ? 8 : 12, paddingVertical: 4 }} testID="home-category-photos">
    {categories.map((category, index) => <Pressable key={category.id} accessibilityRole="button" accessibilityLabel={category.name} onPress={() => onSelect(index + 1)} style={{ width: compact ? 62 : 72, alignItems: "center", gap: 7 }}>
      <CategoryPhoto image={category.image} size={compact ? 50 : 64} /><Text numberOfLines={2} style={{ fontSize: 12, textAlign: "center", color: c.ink }}>{category.name}</Text>
    </Pressable>)}
  </HomeCarousel>;
}

export function HomeSubcategories({ categoryId }: { categoryId: string }) {
  const c = usePalette();
  const category = categories.find(item => item.id === categoryId);
  if (!category?.children.length) return null;

  return <HomeCarousel horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 5 }} testID="home-subcategories">
    {category.children.map(item => (
      <Pressable key={item.query} accessibilityRole="button" accessibilityLabel={item.name}
        onPress={() => router.navigate({ pathname: "/", params: { q: item.query, image: "" } })}
        style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 22, backgroundColor: c.subtle }}>
        <Text style={{ color: c.ink, fontWeight: "600", fontSize: 13 }}>{item.name}</Text>
      </Pressable>
    ))}
  </HomeCarousel>;
}

export function HomeWarehouseLinks() {
  const c = usePalette(), { selected, loaded, open } = useWarehousePreference();
  return <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.surface, paddingHorizontal: 14, paddingVertical: 3, gap: 10 }}>
    <Pressable testID="warehouse-preference" accessibilityRole="button" accessibilityLabel={"Авах салбар: " + (selected?.name ?? "Сонгоогүй") + ". Солих"} disabled={!loaded} onPress={open} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 }}>
      <Icon name="pin" size={16} color={c.accentText} /><Text numberOfLines={1} style={{ flex: 1, color: c.ink, fontSize: 12 }}>{selected?.name ?? "Салбараа сонгох"} ›</Text>
    </Pressable>
    <Pressable testID="self-cargo-home" accessibilityRole="button" accessibilityLabel="Өөрөө захиалах. Агуулахын хаяг авах, ачаа бүртгэх" onPress={() => router.navigate("/cargo")} style={{ minHeight: 36, justifyContent: "center" }}><Text style={{ fontWeight: "700", fontSize: 12, color: c.accentText }}>Өөрөө захиалах ↗</Text></Pressable>
  </View>;
}
