import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { usePalette } from "@/lib/palette";
import { Icon } from "@/components/shop-ui";

export function SelfCargoEntry() {
  const c = usePalette();
  return <Pressable testID="self-cargo-home" accessibilityRole="button" accessibilityLabel="Өөрөө захиалах. Агуулахын хаяг авах, ачаа бүртгэх" onPress={() => router.navigate("/cargo")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: c.accentSurface, opacity: pressed ? 0.75 : 1 })}>
    <Icon name="truck" size={28} color={c.accentText} />
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: c.navy, fontSize: 16, fontWeight: "800" }}>Өөрөө захиал, бид хүргэе</Text>
      <Text style={{ color: c.accentText, fontSize: 12 }}>Taobao · 1688 · Pinduoduo</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>Хаягаа ав → Захиал → Ачаагаа бүртгэ</Text>
    </View>
    <Text style={{ color: c.accentText, fontSize: 22 }}>→</Text>
  </Pressable>;
}
