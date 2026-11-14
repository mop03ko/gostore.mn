import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { usePalette } from "@/lib/palette";
import { Icon } from "@/components/shop-ui";
import { Card, Copy, Title } from "@/components/ui";

export function SelfCargoEntry() {
  const c = usePalette();
  return <Pressable testID="self-cargo-home" accessibilityRole="button" accessibilityLabel="Өөрөө захиалах. Агуулахын хаяг авах, ачаа бүртгэх" onPress={() => router.push("/self-cargo")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: c.accentSurface, opacity: pressed ? 0.75 : 1 })}>
    <Icon name="truck" size={28} color={c.accentText} />
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: c.navy, fontSize: 16, fontWeight: "800" }}>Өөрөө захиал, бид хүргэе</Text>
      <Text style={{ color: c.accentText, fontSize: 12 }}>Taobao · 1688 · Pinduoduo</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>Хаягаа ав → Захиал → Ачаагаа бүртгэ</Text>
    </View>
    <Text style={{ color: c.accentText, fontSize: 22 }}>→</Text>
  </Pressable>;
}

export function SelfCargoGuide() {
  return <Card><Title>Өөрөө захиалах 3 алхам</Title>
    <Copy>1. Нэвтрээд өөрийн карго ID-тай Эрээн агуулахын хаягийг хуулна.</Copy>
    <Copy>2. Taobao, 1688 эсвэл Pinduoduo-д хүргэлтийн хаягаа оруулж, бараагаа өөрөө төлж авна. Карго ID-г хаягт үлдээгээрэй.</Copy>
    <Copy>3. Ачаагаа бүртгэнэ. Худалдагч илгээсний дараа 物流单号 / 运单号 буюу хүргэлтийн дугаарыг нэмнэ.</Copy>
    <Copy>Худалдагчид: бараа + Хятад доторх хүргэлт. GOStore-д: тээврийн төлбөр, хүргүүлэх бол нэмэлт хүргэлт. Тээврийн дүнг агуулахад хэмжиж батална.</Copy>
  </Card>;
}
