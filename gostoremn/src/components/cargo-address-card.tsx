import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { usePalette } from "@/lib/palette";
import { Card, Copy, Title } from "@/components/ui";

export type CargoAddress = { cargo_id: string; name: string; recipient: string; phone: string; address: string; label: string };

export function CargoAddressCard({ address }: { address: CargoAddress }) {
  const c = usePalette(), [message, setMessage] = useState("");
  async function copy(value: string, label: string) {
    try { if (!await Clipboard.setStringAsync(value)) throw Error("Clipboard unavailable"); setMessage(label + " хууллаа ✓"); }
    catch { setMessage("Хуулж чадсангүй. Текстийг удаан дарж хуулна уу."); }
  }
  const rows = [["Таны карго ID", address.cargo_id], ["Хүлээн авагч", address.recipient], ["Утасны дугаар", address.phone], ["Хаяг", address.address]];
  return <Card style={{ borderRadius: 24, padding: 20 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      <Title>Эрээн агуулах</Title>
      <Pressable accessibilityRole="button" onPress={() => void copy(address.label, "Бүх мэдээллийг")} style={{ backgroundColor: c.orange, borderRadius: 14, padding: 12, minHeight: 44 }}>
        <Text style={{ color: "#18142e", fontWeight: "700" }}>Бүгдийг хуулах ⧉</Text>
      </Pressable>
    </View>
    {rows.map(([label, value]) => <View key={label} style={{ borderBottomWidth: 1, borderColor: c.line, paddingVertical: 10, gap: 6 }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text selectable style={{ flex: 1, color: c.navy, fontWeight: label === "Таны карго ID" ? "800" : "500", fontSize: label === "Таны карго ID" ? 24 : 16, lineHeight: 25 }}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={label + " хуулах"} onPress={() => void copy(value, label)} style={{ padding: 12, minHeight: 44, minWidth: 44, borderRadius: 12, backgroundColor: c.bg }}><Text style={{ color: c.navy, fontSize: 22 }}>⧉</Text></Pressable>
      </View>
    </View>)}
    <Text accessibilityLiveRegion="polite" style={{ color: c.navy, fontSize: 13 }}>{message || "Энэ ID таны бүх ачаанд тогтмол ашиглагдана."}</Text>
    <Copy>Хаяг, хүлээн авагчийн нэр дэх карго ID-г хэвээр үлдээгээрэй. Худалдан авсны дараа ачаа, хүргэлтийн дугаараа доор бүртгэнэ.</Copy>
  </Card>;
}
