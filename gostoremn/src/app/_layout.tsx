import { PushLifecycle } from "@/components/push-settings";
import { AnalyticsLifecycle } from "@/components/analytics-settings";
import { usePalette } from "@/lib/palette";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { WarehousePreferenceProvider } from "@/components/warehouse-preference";
import { StoreProvider } from "@/lib/store";
export default function Root() {
  const colors = usePalette();
  return (
    <StoreProvider>
      <WarehousePreferenceProvider>
      <PushLifecycle />
      <AnalyticsLifecycle />
      <StatusBar style={colors.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerTintColor: colors.navy,
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="official-stores" options={{ title: "Албан ёсны дэлгүүрүүд", headerTransparent: false }} />
        <Stack.Screen name="brands" options={{ title: "Албан ёсны дэлгүүрүүд", headerTransparent: false }} />
        <Stack.Screen name="brand/[id]" options={{ title: "Албан ёсны дэлгүүр" }} />
        <Stack.Screen
          name="product/[id]"
          options={{ title: "Барааны дэлгэрэнгүй" }}
        />
        <Stack.Screen
          name="checkout"
          options={{ title: "Захиалга баталгаажуулах" }}
        />
        <Stack.Screen
          name="order/[id]"
          options={{ title: "Захиалгын дэлгэрэнгүй" }}
        />
        <Stack.Screen
          name="login"
          options={{ title: "Нэвтрэх / Бүртгүүлэх", presentation: "modal" }}
        />
        <Stack.Screen name="email-login" options={{ title: "Өмнөх бүртгэлээр нэвтрэх" }} />
        <Stack.Screen name="reviews/[id]" options={{ title: "Үнэлгээ, сэтгэгдэл" }} />
        <Stack.Screen name="addresses" options={{ title: "Миний хаягууд" }} />
        <Stack.Screen name="notifications" options={{ title: "Мэдэгдэл" }} />
        <Stack.Screen name="orders" options={{ title: "Миний захиалгууд" }} />
        <Stack.Screen name="self-cargo" options={{ title: "Өөрөө захиалах · Эрээн карго" }} />
        <Stack.Screen
          name="delete-account"
          options={{ title: "Бүртгэл устгах" }}
        />
        <Stack.Screen
          name="help"
          options={{ title: "Тусламж, үйлчилгээний нөхцөл" }}
        />
      </Stack>
      </WarehousePreferenceProvider>
    </StoreProvider>
  );
}
