import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StoreProvider } from "@/lib/store";
import { colors } from "@/components/ui";
export default function Root() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.navy,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
        <Stack.Screen name="addresses" options={{ title: "Миний хаягууд" }} />
        <Stack.Screen name="notifications" options={{ title: "Мэдэгдэл" }} />
        <Stack.Screen
          name="delete-account"
          options={{ title: "Бүртгэл устгах" }}
        />
        <Stack.Screen
          name="help"
          options={{ title: "Тусламж, үйлчилгээний нөхцөл" }}
        />
      </Stack>
    </StoreProvider>
  );
}
