import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useStore } from "@/lib/store";
import { colors } from "@/components/ui";
export default function TabLayout() {
  const { cart } = useStore();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.muted,
        headerTintColor: colors.navy,
        headerShadowVisible: false,
        tabBarStyle: { borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "GOStore",
          tabBarLabel: "Дэлгүүр",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 22 }}>⌂</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Миний сагс",
          tabBarLabel: "Сагс",
          tabBarBadge: cart.length || undefined,
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>▣</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Миний захиалгууд",
          tabBarLabel: "Захиалга",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>≡</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Миний бүртгэл",
          tabBarLabel: "Бүртгэл",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>○</Text>
          ),
        }}
      />
    </Tabs>
  );
}
