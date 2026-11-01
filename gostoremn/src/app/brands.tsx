import { usePalette, type Palette } from "@/lib/palette";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { brands, brandGroups, type BrandGroup } from "@/lib/brands";
import { BrandTile } from "@/components/brands";
import { Icon, IconButton } from "@/components/shop-ui";
export default function Brands() {
  const colors = usePalette();
  const styles = createStyles(colors);
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
          style={[styles.tab, group === g.id && { backgroundColor: colors.accentSurface, borderColor: colors.line }]}>
          <Text style={{ color: group === g.id ? colors.accentText : colors.muted, fontSize: 13, fontWeight: "600" }}>{g.label}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, gap: 14, paddingBottom: 36 }}>
      <Text style={styles.caption}>{visible.length} брэнд · Албан ёсны дэлгүүрүүд</Text>
      <View testID="brand-directory-grid" style={styles.grid}>{visible.map(brand => <View key={brand.id} style={styles.cell}><BrandTile brand={brand} /></View>)}</View>
      {!visible.length && <View style={styles.empty}><Icon name="search" size={32} color={colors.muted} /><Text style={{ color: colors.muted }}>Тохирох брэнд олдсонгүй.</Text>
        <Pressable onPress={() => { setQuery(""); setGroup("all"); }} accessibilityRole="button" style={styles.tab}><Text style={{ color: colors.ink }}>Бүх брэндийг харах</Text></Pressable></View>}
    </ScrollView>
  </View>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  controls: { backgroundColor: colors.surface, padding: 12, gap: 12 },
  search: { paddingLeft: 12, paddingRight: 4, borderRadius: 14, backgroundColor: colors.subtle, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { minHeight: 48, flex: 1, minWidth: 0, fontSize: 15, color: colors.ink },
  tab: { paddingHorizontal: 15, minHeight: 44, justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: colors.line },
  caption: { color: colors.muted, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "31%", flexGrow: 1, minWidth: 84, maxWidth: "32%", backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 10 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 16 },
});
