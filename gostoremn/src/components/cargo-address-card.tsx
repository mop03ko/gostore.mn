import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { usePalette } from "@/lib/palette";
import { Icon } from "@/components/shop-ui";
import { Card, Title } from "@/components/ui";
import type { CargoAddress } from "@/lib/self-cargo";

export function CargoAddressCard({ address }: { address: CargoAddress }) {
  const c = usePalette();
  const [message, setMessage] = useState("");

  async function copy(value: string, label: string) {
    try {
      if (!await Clipboard.setStringAsync(value)) throw Error("Clipboard unavailable");
      setMessage(label + " хууллаа ✓");
    } catch {
      setMessage("Хуулж чадсангүй. Текстийг удаан дарж хуулна уу.");
    }
  }

  const rows = [
    { label: "Таны карго ID", value: address.cargo_id, identity: true },
    { label: "Хүлээн авагч", value: address.recipient },
    { label: "Утасны дугаар", value: address.phone },
    { label: "Хаяг", value: address.address },
  ];

  return <Card style={{ borderRadius: 18, padding: 12, gap: 6 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
      <Title>Эрээн агуулах</Title>
      <Pressable accessibilityRole="button" onPress={() => void copy(address.label, "Бүх мэдээллийг")}
        style={({ pressed }) => ({
          backgroundColor: c.orange, borderRadius: 10, paddingHorizontal: 9, minHeight: 44,
          flexDirection: "row", alignItems: "center", gap: 5, opacity: pressed ? 0.68 : 1,
        })}>
        <Icon name="copy" color={c.onPrimary} size={15} />
        <Text style={{ color: c.onPrimary, fontSize: 12, fontWeight: "800" }}>Бүгдийг хуулах</Text>
      </Pressable>
    </View>

    {rows.map(({ label, value, identity }) => <View key={label}
      style={{
        flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, paddingLeft: 7,
        borderRadius: identity ? 10 : 0, backgroundColor: identity ? c.accentSurface : c.surface,
        borderBottomWidth: identity ? 0 : 1, borderColor: c.line,
      }}>
      <Text style={{ color: identity ? c.accentText : c.muted, width: 86, fontSize: 11 }}>{label}</Text>
      <Text selectable style={{
        flex: 1, minWidth: 0, textAlign: "right", color: c.navy, paddingVertical: 5,
        fontWeight: identity ? "800" : "500", fontSize: identity ? 18 : 13, lineHeight: 19,
      }}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label + " хуулах"} onPress={() => void copy(value, label)}
        style={({ pressed }) => ({ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.55 : 1 })}>
        <Icon name="copy" size={17} color={identity ? c.accentText : c.navy} />
      </Pressable>
    </View>)}

    <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 12 }}>
      {message || "Карго ID таны бүх ачаанд ашиглагдана."}
    </Text>
  </Card>;
}
