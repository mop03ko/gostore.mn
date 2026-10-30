import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { router } from "expo-router";
import { brands, logos, type Brand } from "@/lib/brands";
import { Icon } from "./shop-ui";
import { colors } from "./ui";

export function BrandMark({ brand, size = 34 }: { brand: Brand; size?: number }) {
  return <View testID={"brand-logo-" + brand.id} accessible accessibilityRole="image" accessibilityLabel={brand.name + " лого"}>
    <SvgXml xml={logos[brand.id]} width={size} height={size} fill="#171717"
      {...(Platform.OS === "web" ? { "aria-hidden": true as const } : { accessible: false })} />
  </View>;
}
export function BrandTile({ brand, onPress }: { brand: Brand; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={brand.name + " брэндийн бараа үзэх"}
    onPress={onPress || (() => router.navigate({ pathname: "/", params: { q: brand.name } }))}
    style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.6 : 1 }]}>
    <BrandMark brand={brand} size={30} />
    <Text numberOfLines={1} style={styles.name}>{brand.name}</Text>
  </Pressable>;
}
export function BrandShelf({ onSelect }: { onSelect: (name: string) => void }) {
  return <View testID="home-brand-shelf" style={styles.shelf}>
    <View style={styles.heading}>
      <Text style={styles.title}>Дэлхийн брэндүүд</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Бүх брэндийг үзэх" onPress={() => router.push("/brands")} style={styles.all}>
        <Text style={styles.allText}>Бүгд</Text><Icon name="chevron" size={14} color={colors.muted} />
      </Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingBottom: 10 }}>
      {Array.from({ length: Math.ceil(brands.length / 2) }, (_, column) => <View key={column} style={{ width: 80, gap: 6 }}>
        {brands.slice(column * 2, column * 2 + 2).map(brand => <BrandTile key={brand.id} brand={brand} onPress={() => onSelect(brand.name)} />)}
      </View>)}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  shelf: { backgroundColor: "white", borderRadius: 14, overflow: "hidden" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 12, paddingRight: 6 },
  title: { fontSize: 14, fontWeight: "700", color: colors.ink },
  all: { minHeight: 44, minWidth: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  allText: { fontSize: 12, color: colors.muted },
  tile: { minHeight: 64, padding: 6, gap: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa", borderRadius: 12 },
  name: { fontSize: 10, color: colors.ink, fontWeight: "500", maxWidth: "100%" },
});
