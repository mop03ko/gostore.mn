import { Tabs } from "expo-router";
import { Icon } from "@/components/shop-ui";
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
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: "white" },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "GOStore",
          tabBarLabel: "Нүүр",
          headerShown: false,
          tabBarIcon: ({ color }) => <Icon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Ангилал",
          tabBarLabel: "Ангилал",
          tabBarIcon: ({ color }) => <Icon name="grid" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Миний захиалгууд",
          tabBarLabel: "Захиалга",
          tabBarIcon: ({ color }) => <Icon name="box" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Миний сагс",
          tabBarLabel: "Сагс",
          tabBarBadge: cart.length || undefined,
          tabBarIcon: ({ color }) => <Icon name="cart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Миний бүртгэл",
          tabBarLabel: "Миний",
          tabBarIcon: ({ color }) => <Icon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
