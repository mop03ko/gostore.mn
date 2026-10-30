import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { brands, brandGroups, type BrandGroup } from "@/lib/brands";
import { BrandTile } from "@/components/brands";
import { Icon, IconButton } from "@/components/shop-ui";
import { colors } from "@/components/ui";
export default function Brands() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<BrandGroup>("all");
  const visible = brands.filter(b => (group === "all" || b.group === group) && b.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <View style={styles.controls}>
      <View style={styles.search}><Icon name="search" size={20} color={colors.muted} />
        <TextInput accessibilityLabel="Брэндийн нэрээр хайх" placeholder="Брэндийн нэрээр хайх" placeholderTextColor={colors.muted}
          autoCapitalize="none" autoCorrect={false} value={query} onChangeText={setQuery} style={styles.input} returnKeyType="search" />
        {!!query && <IconButton name="close" label="Брэндийн хайлт цэвэрлэх" onPress={() => setQuery("")} />}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {brandGroups.map(g => <Pressable key={g.id} accessibilityRole="tab" accessibilityState={{ selected: g.id === group }} onPress={() => setGroup(g.id)}
          style={[styles.tab, group === g.id && { backgroundColor: "#fff0e7", borderColor: "#ffcca9" }]}>
          <Text style={{ color: group === g.id ? "#ae3d0b" : colors.muted, fontSize: 13, fontWeight: "600" }}>{g.label}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, gap: 14, paddingBottom: 36 }}>
      <Text style={styles.caption}>{visible.length} брэнд · Лого дээр дарж бараа үзэх</Text>
      <View testID="brand-directory-grid" style={styles.grid}>{visible.map(brand => <View key={brand.id} style={styles.cell}><BrandTile brand={brand} /></View>)}</View>
      {!visible.length && <View style={styles.empty}><Icon name="search" size={32} color={colors.muted} /><Text style={{ color: colors.muted }}>Тохирох брэнд олдсонгүй.</Text>
        <Pressable onPress={() => { setQuery(""); setGroup("all"); }} accessibilityRole="button" style={styles.tab}><Text>Бүх брэндийг харах</Text></Pressable></View>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  controls: { backgroundColor: "white", padding: 12, gap: 12 },
  search: { paddingLeft: 12, paddingRight: 4, borderRadius: 14, backgroundColor: "#f5f5f7", flexDirection: "row", alignItems: "center", gap: 8 },
  input: { minHeight: 48, flex: 1, minWidth: 0, fontSize: 15, color: colors.ink },
  tab: { paddingHorizontal: 15, minHeight: 44, justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: colors.line },
  caption: { color: colors.muted, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "31%", flexGrow: 1, minWidth: 84, maxWidth: "32%", backgroundColor: "white", borderRadius: 14, paddingVertical: 10 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 16 },
});
