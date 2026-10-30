import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { departments, brands } from "@/lib/departments";
import { Icon } from "@/components/shop-ui";
import { colors } from "@/components/ui";
export default function Categories() {
  const [selected, setSelected] = useState(0),
    current = departments[selected];
  const search = (q: string) =>
    router.navigate({ pathname: "/", params: { q } });
  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Бараа хайх"
        onPress={() => router.navigate("/")}
        style={{
          margin: 12,
          padding: 13,
          backgroundColor: "#f5f5f5",
          borderRadius: 24,
          flexDirection: "row",
          gap: 9,
        }}
      >
        <Icon name="search" size={20} />
        <Text style={{ color: colors.muted }}>Бүх бараанаас хайх</Text>
      </Pressable>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <ScrollView
          style={{ width: 92, flexGrow: 0, backgroundColor: "#f5f5f5" }}
          contentInsetAdjustmentBehavior="automatic"
        >
          {departments.map((d, n) => (
            <Pressable
              key={d.query}
              accessibilityRole="button"
              accessibilityState={{ selected: n === selected }}
              onPress={() => setSelected(n)}
              style={{
                minHeight: 58,
                justifyContent: "center",
                paddingHorizontal: 8,
                borderLeftWidth: 3,
                borderLeftColor: n === selected ? colors.orange : "transparent",
                backgroundColor: n === selected ? "white" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: n === selected ? "700" : "400",
                  color: n === selected ? "#bd3b00" : colors.ink,
                }}
              >
                {d.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 14, gap: 20, paddingBottom: 30 }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => search(current.query)}
            style={{
              padding: 16,
              backgroundColor: current.color,
              borderRadius: 12,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 44 }}>{current.icon}</Text>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>
              {current.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Бүгдийг үзэх →
            </Text>
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>
            Ангиллаар үзэх
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {current.terms.map((t) => (
              <Pressable
                accessibilityRole="button"
                key={t}
                  accessibilityLabel={t}
                onPress={() => search(t)}
                style={{
                  width: "47%",
                  minHeight: 84,
                  backgroundColor: "#fafafa",
                  borderRadius: 10,
                  padding: 10,
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 26 }}>{current.icon}</Text>
                <Text style={{ fontSize: 12 }}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Брэндүүд</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {brands.map((b) => (
              <Pressable
                accessibilityRole="button"
                key={b}
                onPress={() => search(b)}
                style={{
                  padding: 12,
                  minHeight: 44,
                  backgroundColor: "#f7f7f7",
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600" }}>{b}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
