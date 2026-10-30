import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { ComponentRef } from "react";
import { departments, brands } from "@/lib/departments";
import { Icon } from "@/components/shop-ui";
import { colors } from "@/components/ui";
export default function Categories() {
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const content = useRef<ComponentRef<typeof ScrollView>>(null);
  const current = departments[selected];
  const search = (q: string) => { if (q.trim()) router.navigate({ pathname: "/", params: { q: q.trim() } }); };
  return (
    <View style={styles.screen}>
      <View style={styles.search}>
        <Icon name="search" size={20} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => search(query)}
          placeholder="Нэр, брэндээр хайх" placeholderTextColor={colors.muted}
          accessibilityLabel="Ангиллаас бараа хайх" returnKeyType="search" style={styles.input} />
        <Pressable onPress={() => search(query)} accessibilityRole="button" accessibilityLabel="Хайх" style={styles.searchButton}>
          <Text style={styles.accent}>Хайх</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <ScrollView style={styles.rail} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {departments.map((d, n) => (
            <Pressable key={d.query} accessibilityRole="tab" accessibilityLabel={d.name}
              accessibilityState={{ selected: n === selected }}
              onPress={() => { setSelected(n); content.current?.scrollTo({ y: 0, animated: false }); }}
              style={[styles.railItem, n === selected && styles.activeItem]}>
              <Icon name={d.icon} size={22} color={n === selected ? "#bb420c" : "#777780"} />
              <Text style={[styles.railLabel, n === selected && styles.accent]}>{d.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView ref={content} style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <Pressable accessibilityRole="button" accessibilityLabel={current.name + " бүгдийг үзэх"}
            onPress={() => search(current.query)} style={[styles.banner, { backgroundColor: current.color }]}>
            <Icon name={current.icon} size={36} color="#993c18" />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.heading}>{current.name}</Text>
              <Text style={styles.accent}>Бүгдийг үзэх</Text>
            </View>
            <Icon name="chevron" size={18} color="#993c18" />
          </Pressable>
          <Text style={styles.section}>Ангиллаар үзэх</Text>
          <View style={styles.tiles}>
            {current.terms.map(t => (
              <Pressable accessibilityRole="button" key={t.query} accessibilityLabel={t.label}
                onPress={() => search(t.query)} style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.65 : 1 }]}>
                <View style={[styles.tileIcon, { backgroundColor: current.color }]}><Icon name={t.icon} size={26} color="#804b37" /></View>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.section}>Брэндээр хайх</Text>
          <View style={styles.brands}>
            {brands.map(b => <Pressable key={b} accessibilityRole="button" onPress={() => search(b)} style={styles.brand}>
              <Text style={styles.brandLabel}>{b}</Text>
            </Pressable>)}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "white" },
  search: { margin: 14, paddingLeft: 14, backgroundColor: "#f4f4f6", borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 14, color: colors.ink },
  searchButton: { minWidth: 52, minHeight: 48, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, flexDirection: "row" },
  rail: { width: 86, flexGrow: 0, backgroundColor: "#f7f7f9" },
  railItem: { minHeight: 76, paddingVertical: 12, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", gap: 7, borderLeftWidth: 3, borderLeftColor: "transparent" },
  activeItem: { borderLeftColor: colors.orange, backgroundColor: "white" },
  railLabel: { fontSize: 11, textAlign: "center", color: "#62626c" },
  accent: { color: "#b63d0c", fontWeight: "700", fontSize: 12 },
  content: { padding: 12, paddingBottom: 30, gap: 16 },
  banner: { padding: 14, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 104 },
  heading: { fontSize: 19, fontWeight: "800", color: colors.ink },
  section: { fontSize: 15, fontWeight: "700", color: colors.ink },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "47%", flexGrow: 1, padding: 10, alignItems: "center", borderRadius: 14, backgroundColor: "#fafafa", minHeight: 106, gap: 10 },
  tileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 12, textAlign: "center", color: colors.ink, fontWeight: "500" },
  brands: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  brand: { paddingHorizontal: 12, paddingVertical: 12, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  brandLabel: { fontSize: 11, fontWeight: "600", color: colors.ink },
});
