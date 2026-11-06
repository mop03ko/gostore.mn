import { usePalette } from "@/lib/palette";
import { useState } from "react";
import { Text, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DiscoveryShelf } from "@/components/discovery";
import type { IconName } from "@/components/shop-ui";
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
  money,
} from "@/components/ui";
export default function Cart() {
  const colors = usePalette(), inset = useSafeAreaInsets();
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
      <View style={{ paddingTop: inset.top + 8, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "800", color: colors.navy }}>Сагс ({cart.length})</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Хүргэлтийн хаяг" onPress={() => router.push(customer ? "/addresses" : { pathname: "/login", params: { next: "/addresses" } })} style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44 }}><Icon name="pin" size={18} /><Text style={{ color: colors.ink, fontSize: 12 }}>Хүргэлтийн хаяг</Text><Icon name="chevron" size={14} /></Pressable>
        </View>
      </View>
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
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>
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
                    contentFit="cover"
                    style={{ width: 96, height: 110, borderRadius: 12 }}
                  />
                </Pressable>
                <View style={{ flex: 1, gap: 7 }}>
                  <Text
                    numberOfLines={2}
                    style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}
                  >
                    {i.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.subtle,
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
                      color: colors.accentText,
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
        <Card style={{ borderWidth: 0, gap: 20 }}>
          {([{ icon: "wallet", title: "Төлбөрөө урьдчилж шалгана", text: "Захиалахын өмнө бараа, үйлчилгээ, хүргэлтийн тооцоог харна." }, { icon: "truck", title: "Захиалгын явцаа хянана", text: "Эрээнээс Улаанбаатар хүртэлх төлөвийг апп дотроос харна." }, { icon: "help", title: "Тусламж, үйлчилгээ", text: "Төлбөр болон хүргэлтийн талаар мэдээлэл аваарай." }] as { icon: IconName; title: string; text: string }[]).map(a => <Pressable accessibilityRole="button" key={a.title} onPress={() => router.push("/help")} style={{ flexDirection: "row", gap: 14, alignItems: "center", minHeight: 56 }}><Icon name={a.icon} size={28} color={colors.navy} /><View style={{ flex: 1, gap: 4 }}><Text style={{ fontWeight: "700", color: colors.navy }}>{a.title}</Text><Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>{a.text}</Text></View></Pressable>)}
        </Card>
        {!!cart.length && (
          <Card>
            <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 14 }}>
              Төлбөр хэрхэн тооцогдох вэ?
            </Text>
            <Copy>
              Бараа + Хятад доторх хүргэлт + үйлчилгээний төлбөрийг дараагийн
              алхамд шалгана. Карго болон УБ хүргэлт дараа тооцогдоно.
            </Copy>
          </Card>
        )}
        <DiscoveryShelf query="__all__" />
      </ScrollView>
      {!!cart.length && (
        <View
          style={{
            backgroundColor: colors.surface,
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
              style={{ fontSize: 20, fontWeight: "800", color: colors.accentText }}
            >
              {rate
                ? money(Math.ceil((Math.round(goods * 100) / 100) * rate))
                : "Ханш шалгаж байна"}
            </Text>
          </View>
          <Button
            title={customer ? "Тооцоо шалгах" : "Нэвтрэх"}
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
