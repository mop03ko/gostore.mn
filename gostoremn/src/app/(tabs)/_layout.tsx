import { usePalette } from "@/lib/palette";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/shop-ui";
import { useStore } from "@/lib/store";
export default function TabLayout() {
  const colors = usePalette();
  const { cart } = useStore();
  const inset = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.muted,
        headerTintColor: colors.navy,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: colors.surface, height: 64 + inset.bottom, paddingBottom: Math.max(inset.bottom, 6), paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { paddingTop: 0 },
        tabBarBadgeStyle: { backgroundColor: colors.orange, color: colors.onPrimary, fontSize: 10 },
        headerTitleStyle: { fontWeight: "700", fontSize: 18 },
        headerTitleAlign: "left",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "gostore.mn",
          tabBarLabel: "Нүүр",
          headerShown: false,
          tabBarIcon: ({ color }) => <Icon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Ангилал",
          headerShown: false,
          tabBarLabel: "Ангилал",
          tabBarIcon: ({ color }) => <Icon name="grid" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Хайлт",
          headerShown: false,
          tabBarIcon: ({ color }) => <Icon name="camera" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Миний сагс",
          headerShown: false,
          tabBarLabel: "Сагс",
          tabBarBadge: cart.length || undefined,
          tabBarIcon: ({ color }) => <Icon name="cart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Миний",
          headerShown: false,
          tabBarIcon: ({ color }) => <Icon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
