import { usePalette, type Palette } from "@/lib/palette";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { ComponentRef } from "react";
import { CategoryPhoto, DiscoveryShelf, categories } from "@/components/discovery";
import { Icon, IconButton } from "@/components/shop-ui";
export default function Categories() {
  const colors = usePalette(), inset = useSafeAreaInsets();
  const s = createStyles(colors);
  const [selected, setSelected] = useState(-1), [query, setQuery] = useState(""), [expanded, setExpanded] = useState(false);
  const content = useRef<ComponentRef<typeof ScrollView>>(null), current = categories[selected];
  const tiles = current?.children || categories;
  const search = (q: string) => { if (q.trim()) router.navigate({ pathname: "/", params: { q: q.trim(), image: "" } }); };
  return <View style={[s.screen, { paddingTop: inset.top }]}>
    <View style={s.search}><Icon name="search" size={18} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => search(query)} placeholder="Нэр, брэндээр хайх" placeholderTextColor={colors.muted} accessibilityLabel="Ангиллаас бараа хайх" returnKeyType="search" style={s.input} />
      <IconButton name="camera" label="Зургаар хайх" onPress={() => router.navigate("/search")} /><Pressable onPress={() => search(query)} accessibilityRole="button" accessibilityLabel="Хайх" style={s.searchButton}><Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Хайх</Text></Pressable></View>
    <View style={s.body}>
      <ScrollView style={s.rail} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: selected === -1 }} onPress={() => { setSelected(-1); setExpanded(false); content.current?.scrollTo({ y: 0, animated: false }); }} style={[s.railItem, selected === -1 && s.active]}><Text style={[s.railLabel, selected === -1 && { color: colors.accentText, fontWeight: "700" }]}>Танд зориулсан</Text></Pressable>
        {categories.map((d, n) => <Pressable key={d.id} accessibilityRole="tab" accessibilityLabel={d.name} accessibilityState={{ selected: n === selected }} onPress={() => { setSelected(n); setExpanded(false); content.current?.scrollTo({ y: 0, animated: false }); }} style={[s.railItem, n === selected && s.active]}><Text style={[s.railLabel, n === selected && { color: colors.accentText, fontWeight: "700" }]}>{d.name}</Text></Pressable>)}
      </ScrollView>
      <ScrollView ref={content} style={{ flex: 1 }} contentContainerStyle={s.content}>
        <View style={s.heading}><Text style={s.section}>{current?.name || "Онцлох ангиллууд"}</Text><Pressable accessibilityRole="button" accessibilityLabel={(current?.name || "Бүх бараа") + " бүгдийг үзэх"} onPress={() => search(current?.query || "__all__")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={s.accent}>Бүгд ›</Text></Pressable></View>
        <View testID="category-photo-grid" style={s.tiles}>{tiles.slice(0, expanded ? undefined : 9).map(t => <Pressable accessibilityRole="button" key={t.query} accessibilityLabel={t.name} onPress={() => search(t.query)} style={s.tile}><CategoryPhoto key={t.image} image={t.image} size={54} /><Text numberOfLines={2} style={s.tileLabel}>{t.name}</Text></Pressable>)}</View>
        {tiles.length > 9 && <Pressable accessibilityRole="button" onPress={() => setExpanded(x => !x)} style={s.more}><Text style={s.accent}>{expanded ? "Хураах ∧" : "Цааш үзэх ∨"}</Text></Pressable>}
        <DiscoveryShelf key={current?.id || "all"} query={current?.query || "__all__"} />
      </ScrollView>
    </View>
  </View>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, search: { margin: 12, paddingLeft: 10, paddingRight: 3, borderWidth: 1.5, borderColor: colors.orange, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 5 },
  input: { flex: 1, minWidth: 0, minHeight: 46, fontSize: 13, color: colors.ink }, searchButton: { minWidth: 48, minHeight: 38, borderRadius: 22, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, flexDirection: "row" }, rail: { width: 92, flexGrow: 0, backgroundColor: colors.subtle }, railItem: { minHeight: 68, paddingVertical: 14, paddingHorizontal: 8, justifyContent: "center", borderLeftWidth: 3, borderLeftColor: "transparent" }, active: { borderLeftColor: colors.orange, backgroundColor: colors.surface }, railLabel: { fontSize: 12, lineHeight: 18, color: colors.muted },
  content: { padding: 10, paddingBottom: 30, gap: 12 }, heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }, section: { fontSize: 17, flex: 1, fontWeight: "800", color: colors.ink }, accent: { color: colors.accentText, fontWeight: "600", fontSize: 12 }, tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 }, tile: { width: "31%", alignItems: "center", gap: 6, minHeight: 96 }, tileLabel: { fontSize: 11, lineHeight: 15, textAlign: "center", color: colors.ink }, more: { minHeight: 44, justifyContent: "center", alignItems: "center" },
});
