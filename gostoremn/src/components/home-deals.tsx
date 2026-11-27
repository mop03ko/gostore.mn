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
  const c = usePalette(), scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  useEffect(() => { const tab = layouts[selected]; if (tab) scroll.current?.scrollTo({ x: Math.max(0, tab.x + tab.width / 2 - pageWidth / 2), animated: true }); }, [selected, layouts, pageWidth]);
  return <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} testID="home-category-tabs" contentContainerStyle={{ gap: 22, paddingHorizontal: 16 }} style={{ flexGrow: 0, backgroundColor: c.surface }}>
    {homeCategories.map((category, index) => <Pressable key={category.id} onLayout={e => { const { x, width } = e.nativeEvent.layout; setLayouts(prev => prev[index]?.x === x && prev[index]?.width === width ? prev : { ...prev, [index]: { x, width } }); }} accessibilityRole="tab" accessibilityState={{ selected: selected === index }} aria-selected={selected === index} onPress={() => onSelect(index)} style={{ minHeight: 48, justifyContent: "center" }}>
      <Text style={{ color: selected === index ? c.ink : c.muted, fontSize: 16, fontWeight: selected === index ? "800" : "500" }}>{category.name}</Text>
    </Pressable>)}
    {Object.keys(layouts).length === homeCategories.length && <Animated.View testID="home-tab-indicator" pointerEvents="none" style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: 24, borderRadius: 2, backgroundColor: c.orange, transform: [{ translateX: position.interpolate({ inputRange: homeCategories.map((_, i) => i * pageWidth), outputRange: homeCategories.map((_, i) => layouts[i].x + (layouts[i].width - 24) / 2), extrapolate: "clamp" }) }] }} />}
  </ScrollView>;
}

function priceLabel(product: Product) { return (product.mnt ? "" : "≈ ") + money(product.mnt || product.approx_mnt || 0); }

function DealPhoto({ product, large = false }: { product: Product; large?: boolean }) {
  const c = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={product.name} onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })} style={{ flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: c.surface }}>
    <Image source={product.image || undefined} contentFit="cover" style={{ width: "100%", height: "100%" }} />
    <Text numberOfLines={1} style={{ position: "absolute", bottom: 0, left: 0, maxWidth: "100%", borderTopRightRadius: 8, backgroundColor: c.surface, color: c.ink, paddingHorizontal: 6, paddingVertical: 4, fontSize: large ? 17 : 12, fontWeight: "800" }}>{priceLabel(product)}</Text>
  </Pressable>;
}

export function HomeDealHighlights({ products }: { products: Product[] }) {
  const c = usePalette(), { width } = useWindowDimensions();
  // Reuse the list response: no extra recommendation, campaign or product requests.
  const deals = products.filter(p => productSavings(p, p.mnt || p.approx_mnt).sale).slice(0, 9);
  if (!deals.length) return null;
  const groups = [deals.slice(0, 3), deals.slice(3, 6)].filter(group => group.length);
  return <View testID="home-deal-highlights" style={{ gap: 14 }}>
    <HomeCarousel testID="home-deal-carousel" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {groups.map((group, index) => <View key={group[0].id} style={{ width: Math.min(330, width * 0.79), borderRadius: 20, padding: 12, gap: 8, backgroundColor: index % 2 ? c.accentSurface : c.subtle }}>
        <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "800", color: c.navy }}>{index ? "Өнөөдрийн олз" : "Хямдралын сонголт"}</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>Үнэ буурсан бараанууд</Text>
        <View style={{ height: 190, flexDirection: "row", gap: 7 }}>
          <View style={{ flex: 2 }}><DealPhoto product={group[0]} large /></View>
          {group.length > 1 && <View style={{ flex: 1, gap: 7 }}>{group.slice(1).map(p => <DealPhoto key={p.id} product={p} />)}</View>}
        </View>
      </View>)}
    </HomeCarousel>
    <View style={{ borderRadius: 18, overflow: "hidden", backgroundColor: c.accentSurface }}>
      <View style={{ backgroundColor: c.orange, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="bag" color={c.onPrimary} size={24} />
        <Text style={{ color: c.onPrimary, fontWeight: "800", fontSize: 20, flex: 1 }}>Хямд үнээр аваарай</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, padding: 10 }}>
        {deals.slice(0, 3).map(p => { const sale = productSavings(p, p.mnt || p.approx_mnt).sale; return sale && <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })} style={{ flex: 1, minWidth: 0, backgroundColor: c.surface, borderRadius: 12, overflow: "hidden", paddingBottom: 10, gap: 6 }}>
          <Image source={p.image || undefined} contentFit="cover" style={{ width: "100%", aspectRatio: 1 }} />
          <Text numberOfLines={1} style={{ color: c.accentText, fontSize: 14, fontWeight: "800", textAlign: "center" }}>{priceLabel(p)}</Text>
          <Text style={{ color: c.accentText, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{percentLabel(sale.percent)}</Text>
        </Pressable>; })}
      </View>
    </View>
  </View>;
}

export function HomeCategoryPhotos({ onSelect }: { onSelect: (index: number) => void }) {
  const c = usePalette();
  return <HomeCarousel horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }} testID="home-category-photos">
    {categories.map((category, index) => <Pressable key={category.id} accessibilityRole="button" accessibilityLabel={category.name} onPress={() => onSelect(index + 1)} style={{ width: 72, alignItems: "center", gap: 7 }}>
      <CategoryPhoto image={category.image} /><Text numberOfLines={2} style={{ fontSize: 12, textAlign: "center", color: c.ink }}>{category.name}</Text>
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
    <Pressable testID="warehouse-preference" accessibilityRole="button" accessibilityLabel={"Авах агуулах: " + (selected?.name ?? "Сонгоогүй") + ". Солих"} disabled={!loaded} onPress={open} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 }}>
      <Icon name="pin" size={16} color={c.accentText} /><Text numberOfLines={1} style={{ flex: 1, color: c.ink, fontSize: 12 }}>{selected?.name ?? "Агуулахаа сонгох"} ›</Text>
    </Pressable>
    <Pressable testID="self-cargo-home" accessibilityRole="button" accessibilityLabel="Өөрөө захиалах. Агуулахын хаяг авах, ачаа бүртгэх" onPress={() => router.navigate("/cargo")} style={{ minHeight: 36, justifyContent: "center" }}><Text style={{ fontWeight: "700", fontSize: 12, color: c.accentText }}>Өөрөө захиалах ↗</Text></Pressable>
  </View>;
}
