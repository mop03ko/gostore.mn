import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { usePalette } from "@/lib/palette";
import { Icon } from "@/components/shop-ui";
import { Card, Title } from "@/components/ui";

import type { CargoAddress } from "@/lib/self-cargo";

export function CargoAddressCard({ address }: { address: CargoAddress }) {
  const c = usePalette(), [message, setMessage] = useState("");
  async function copy(value: string, label: string) {
    try { if (!await Clipboard.setStringAsync(value)) throw Error("Clipboard unavailable"); setMessage(label + " хууллаа ✓"); }
    catch { setMessage("Хуулж чадсангүй. Текстийг удаан дарж хуулна уу."); }
  }
  const rows = [["Таны карго ID", address.cargo_id], ["Хүлээн авагч", address.recipient], ["Утасны дугаар", address.phone], ["Хаяг", address.address]];
  return <Card style={{ borderRadius: 20, padding: 14, gap: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <Title>Эрээн агуулахын хаяг</Title>
      <Pressable accessibilityRole="button" onPress={() => void copy(address.label, "Бүх мэдээллийг")} style={{ backgroundColor: c.accentSurface, borderRadius: 10, paddingHorizontal: 10, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon name="copy" color={c.accentText} size={16} />
        <Text style={{ color: c.accentText, fontSize: 13, fontWeight: "700" }}>Бүгдийг хуулах</Text>
      </Pressable>
    </View>
    {rows.map(([label, value]) => <View key={label} style={{ borderTopWidth: 1, borderColor: c.line, flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2, paddingVertical: 3 }}>
        <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
        <Text selectable style={{ color: c.navy, fontWeight: label === "Таны карго ID" ? "800" : "500", fontSize: label === "Таны карго ID" ? 20 : 15, lineHeight: 22 }}>{value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={label + " хуулах"} onPress={() => void copy(value, label)} style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: c.subtle }}><Icon name="copy" size={19} color={c.navy} /></Pressable>
    </View>)}
    <Text accessibilityLiveRegion="polite" style={{ color: c.navy, fontSize: 13 }}>{message || "Энэ ID таны бүх ачаанд тогтмол ашиглагдана."}</Text>
  </Card>;
}
