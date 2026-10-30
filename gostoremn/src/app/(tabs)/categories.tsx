import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { ComponentRef } from "react";
import { CategoryPhoto, DiscoveryShelf, categories } from "@/components/discovery";
import { Icon, IconButton } from "@/components/shop-ui";
import { colors } from "@/components/ui";
export default function Categories() {
  const [selected, setSelected] = useState(0), [query, setQuery] = useState(""), [expanded, setExpanded] = useState(false);
  const content = useRef<ComponentRef<typeof ScrollView>>(null), current = categories[selected];
  const search = (q: string) => { if (q.trim()) router.navigate({ pathname: "/", params: { q: q.trim() } }); };
  return <View style={s.screen}>
    <View style={s.search}><Icon name="search" size={18} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => search(query)} placeholder="Нэр, брэндээр хайх" placeholderTextColor={colors.muted} accessibilityLabel="Ангиллаас бараа хайх" returnKeyType="search" style={s.input} />
      <IconButton name="camera" label="Зургаар хайх" onPress={() => router.navigate({ pathname: "/", params: { photo: "1" } })} /><Pressable onPress={() => search(query)} accessibilityRole="button" accessibilityLabel="Хайх" style={s.searchButton}><Text style={{ color: "white", fontWeight: "700" }}>Хайх</Text></Pressable></View>
    <View style={s.body}>
      <ScrollView style={s.rail} showsVerticalScrollIndicator={false}>
        {categories.map((d, n) => <Pressable key={d.id} accessibilityRole="tab" accessibilityLabel={d.name} accessibilityState={{ selected: n === selected }} onPress={() => { setSelected(n); setExpanded(false); content.current?.scrollTo({ y: 0, animated: false }); }} style={[s.railItem, n === selected && s.active]}><Text style={[s.railLabel, n === selected && { color: "#b63d0c", fontWeight: "700" }]}>{d.name}</Text></Pressable>)}
      </ScrollView>
      <ScrollView ref={content} style={{ flex: 1 }} contentContainerStyle={s.content}>
        <View style={s.heading}><Text style={s.section}>{current.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={current.name + " бүгдийг үзэх"} onPress={() => search(current.query)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={s.accent}>Бүгд ›</Text></Pressable></View>
        <View testID="category-photo-grid" style={s.tiles}>{current.children.slice(0, expanded ? undefined : 6).map(t => <Pressable accessibilityRole="button" key={t.query} accessibilityLabel={t.name} onPress={() => search(t.query)} style={s.tile}><CategoryPhoto key={t.image} image={t.image} size={58} /><Text numberOfLines={2} style={s.tileLabel}>{t.name}</Text></Pressable>)}</View>
        {current.children.length > 6 && <Pressable accessibilityRole="button" onPress={() => setExpanded(x => !x)} style={s.more}><Text style={s.accent}>{expanded ? "Хураах ∧" : "Цааш үзэх ∨"}</Text></Pressable>}
        <DiscoveryShelf key={current.id} query={current.query} />
      </ScrollView>
    </View>
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "white" }, search: { margin: 12, paddingLeft: 10, paddingRight: 3, borderWidth: 1.5, borderColor: colors.orange, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 5 },
  input: { flex: 1, minWidth: 0, minHeight: 46, fontSize: 13, color: colors.ink }, searchButton: { minWidth: 48, minHeight: 38, borderRadius: 22, backgroundColor: "#d84600", alignItems: "center", justifyContent: "center" },
  body: { flex: 1, flexDirection: "row" }, rail: { width: 94, flexGrow: 0, backgroundColor: "#f6f6f6" }, railItem: { minHeight: 64, paddingVertical: 14, paddingHorizontal: 8, justifyContent: "center", borderLeftWidth: 3, borderLeftColor: "transparent" }, active: { borderLeftColor: colors.orange, backgroundColor: "white" }, railLabel: { fontSize: 12, lineHeight: 18, color: "#51515c" },
  content: { padding: 10, paddingBottom: 30, gap: 12 }, heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }, section: { fontSize: 17, flex: 1, fontWeight: "800", color: colors.ink }, accent: { color: "#b63d0c", fontWeight: "600", fontSize: 12 }, tiles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 }, tile: { width: "31%", alignItems: "center", gap: 6, minHeight: 96 }, tileLabel: { fontSize: 11, lineHeight: 15, textAlign: "center", color: colors.ink }, more: { minHeight: 44, justifyContent: "center", alignItems: "center" },
});
