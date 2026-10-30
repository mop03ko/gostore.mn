import { useState } from "react";
import { Text, View, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Icon, Quantity } from "@/components/shop-ui";
import { EmptyState } from "@/components/account-ui";
import { useStore } from "@/lib/store";
import type { CartLine } from "@/lib/types";
import {
  Card,
  Copy,
  Button,
  ErrorBox,
  colors,
  money,
} from "@/components/ui";
export default function Cart() {
  const { cart, saveCart, shipping, cartReady, customer } = useStore();
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const save = async (next: CartLine[]) => {
    if (saving) return;
    setSaving(true);
    try {
      await saveCart(next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const goods = cart.reduce((s, i) => s + i.cny * i.qty, 0),
    rate = shipping?.cny_rate || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 10,
          gap: 12,
          paddingBottom: 20,
          maxWidth: 820,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <ErrorBox message={error} />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 4,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "800" }}>
            Сагс{" "}
            <Text style={{ fontSize: 15, fontWeight: "400" }}>
              ({cart.length})
            </Text>
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Бүх сонгосон бараа
          </Text>
        </View>
        {cart.length ? (
          <Card style={{ padding: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingBottom: 5,
              }}
            >
              <Icon name="home" size={19} />
              <Text style={{ fontSize: 14, fontWeight: "700" }}>
                Taobao бараанууд
              </Text>
            </View>
            {cart.map((i) => (
              <View
                key={i.id + i.sku}
                style={{
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderColor: colors.line,
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={i.name}
                  onPress={() =>
                    router.push({
                      pathname: "/product/[id]",
                      params: { id: i.id },
                    })
                  }
                >
                  <Image
                    source={i.image}
                    style={{ width: 100, height: 112, borderRadius: 9 }}
                  />
                </Pressable>
                <View style={{ flex: 1, gap: 7 }}>
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 13, lineHeight: 19 }}
                  >
                    {i.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#f4f4f4",
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      numberOfLines={2}
                      style={{ fontSize: 11, color: colors.muted }}
                    >
                      {i.variant}
                    </Text>
                  </View>
                  <Text
                    selectable
                    style={{
                      fontSize: 19,
                      color: "#d84500",
                      fontWeight: "700",
                    }}
                  >
                    {rate ? money(Math.ceil(i.cny * rate)) : "¥" + i.cny}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 4,
                    }}
                  >
                    <Quantity
                      qty={i.qty}
                      min={i.min_qty}
                      step={i.step}
                      max={Math.min(i.stock || 0, 9999)}
                      disabled={saving}
                      onChange={(qty) =>
                        void save(
                          cart.map((v) => (v === i ? { ...v, qty } : v)),
                        )
                      }
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Хасах"
                      disabled={saving}
                      onPress={() => void save(cart.filter((v) => v !== i))}
                      style={{
                        padding: 8,
                        minHeight: 40,
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        Хасах
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="cart" title="Сагс тань хоосон байна" description="Таалагдсан барааныхаа өнгө, хэмжээг сонгоод сагсандаа нэмээрэй."
            action="Бараа үзэх" onPress={() => router.navigate("/")} />
        )}
        {!!cart.length && (
          <Card>
            <Text style={{ fontWeight: "700", fontSize: 14 }}>
              Төлбөр хэрхэн тооцогдох вэ?
            </Text>
            <Copy>
              Бараа + Хятад доторх хүргэлт + үйлчилгээний төлбөрийг дараагийн
              алхамд шалгана. Карго болон УБ хүргэлт дараа тооцогдоно.
            </Copy>
          </Card>
        )}
      </ScrollView>
      {!!cart.length && (
        <View
          style={{
            backgroundColor: "white",
            borderTopWidth: 1,
            borderColor: colors.line,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              Барааны урьдчилсан дүн
            </Text>
            <Text
              selectable
              style={{ fontSize: 22, fontWeight: "800", color: "#d84500" }}
            >
              {rate
                ? money(Math.ceil((Math.round(goods * 100) / 100) * rate))
                : "Ханш шалгаж байна"}
            </Text>
          </View>
          <Button
            title={customer ? "Тооцоо шалгах" : "Нэвтэрч үргэлжлүүлэх"}
            disabled={!cartReady || saving}
            onPress={() =>
              router.push(
                customer
                  ? "/checkout"
                  : { pathname: "/login", params: { next: "checkout" } },
              )
            }
          />
        </View>
      )}
    </View>
  );
}
