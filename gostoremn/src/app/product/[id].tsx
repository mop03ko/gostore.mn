import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Choice, Quantity } from "@/components/shop-ui";
import { ProductDetails } from "@/components/product-details";
import { catalog } from "@/lib/api";
import { addLine } from "@/lib/cart";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import {
  Title,
  Copy,
  Button,
  Busy,
  ErrorBox,
  colors,
  money,
} from "@/components/ui";
export default function ProductScreen() {
  const inset = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false),
    [intent, setIntent] = useState<"cart" | "buy">("cart");
  const { id } = useLocalSearchParams<{ id: string }>(),
    { cart, saveCart, shipping, cartReady } = useStore();
  const [product, setProduct] = useState<Product | null>(null),
    [sku, setSku] = useState(""),
    [qty, setQty] = useState(1),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [saving, setSaving] = useState(false),
    [added, setAdded] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    // Clear a previous product while the new route's network request is pending.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProduct(null);
    setError("");
    void catalog<{ product: Product }>("supplier-product", { id }, c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setProduct(r.product);
        setQty(r.product.min_qty);
        setSku("");
        setAdded(false);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id, retry]);
  const variant = product?.variants.find((v) => v.id === sku),
    rate = shipping?.cny_rate || 0;
  async function add() {
    if (!product || !variant) return;
    setSaving(true);
    try {
      await saveCart(addLine(cart, product, variant, qty));
      setAdded(true);
      if (intent === "buy") {
        setSheet(false);
        router.push("/cart");
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const open = (mode: "cart" | "buy") => {
    setIntent(mode);
    setAdded(false);
    setSheet(true);
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerTransparent: false,
        headerTitle: () => <Pressable accessibilityRole="button" accessibilityLabel="Бараа хайх" onPress={() => router.push("/")}
          style={{ backgroundColor: "#f5f5f5", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}><Text style={{ color: colors.muted, fontSize: 14 }}>Бараа хайх</Text></Pressable>,
        headerRight: () => <IconButton name="cart" label="Сагс нээх" onPress={() => router.push("/cart")} />,
      }} />
      <ErrorBox message={error} retry={() => setRetry(x => x + 1)} />
      {!product ? <View style={{ flex: 1 }}>{!error && <Busy />}</View> :
        <ProductDetails key={product.id} product={product} variant={variant} rate={rate} onChoose={() => open("cart")} />}
      <View
        style={{
          backgroundColor: "white",
          borderTopWidth: 1,
          borderColor: colors.line,
          padding: 10,
          paddingBottom: Math.max(inset.bottom, 10),
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <IconButton
          name="help"
          label="Тусламж"
          onPress={() => router.push("/help")}
        />
        <IconButton
          name="cart"
          label="Сагс руу очих"
          onPress={() => router.push("/cart")}
        />
        <View style={{ flex: 1 }}>
          <Button
            title="Сагсанд нэмэх"
            secondary
            disabled={!product || product.sellable === false}
            onPress={() => open("cart")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Захиалах"
            disabled={!product || product.sellable === false}
            onPress={() => open("buy")}
          />
        </View>
      </View>
      <Modal
        visible={sheet}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!saving) setSheet(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000066",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Хувилбарын цонх хаах"
            onPress={() => {
              if (!saving) setSheet(false);
            }}
            style={{ flex: 1 }}
          />
          <View
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "82%",
              padding: 16,
              paddingBottom: Math.max(inset.bottom, 16),
              gap: 14,
            }}
          >
            <View
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <Image
                source={variant?.image || product?.image}
                style={{ width: 86, height: 86, borderRadius: 10 }}
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{ fontSize: 24, fontWeight: "800", color: "#d84500" }}
                >
                  {variant?.cny && rate
                    ? money(Math.ceil(variant.cny * rate))
                    : "Хувилбар сонгох"}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 12, color: colors.muted }}
                >
                  {variant?.label || "Өнгө, хэмжээ сонгоно уу"}
                </Text>
              </View>
              <IconButton
                name="close"
                label="Хаах"
                onPress={() => {
                  if (!saving) setSheet(false);
                }}
              />
            </View>
            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
            >
              <Title>Хувилбар сонгох</Title>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {product?.variants.map((v) => (
                  <Choice
                    key={v.id}
                    label={
                      v.label +
                      (v.cny !== null ? " · ¥" + v.cny : "") +
                      (v.stock === 0 ? " · Дууссан" : "")
                    }
                    selected={sku === v.id}
                    disabled={
                      saving ||
                      v.cny === null ||
                      v.stock === 0 ||
                      v.stock === null
                    }
                    onPress={() => {
                      setSku(v.id);
                      setQty(product.min_qty);
                      setAdded(false);
                    }}
                  />
                ))}
              </View>
              {product && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600" }}>
                    Тоо ширхэг
                  </Text>
                  <Quantity
                    qty={qty}
                    min={product.min_qty}
                    step={product.step}
                    max={Math.min(variant?.stock || 0, 9999)}
                    disabled={saving}
                    onChange={(v) => {
                      setQty(v);
                      setAdded(false);
                    }}
                  />
                </View>
              )}
              <Copy>Багцын бүрдлийг хувилбарын нэрээс шалгана уу.</Copy>
              <ErrorBox message={error} />
            </ScrollView>
            <Button
              title={
                saving
                  ? "Хадгалж байна…"
                  : added
                    ? "Сагсанд нэмэгдлээ ✓"
                    : intent === "buy"
                      ? "Сагсанд оруулаад захиалах"
                      : "Сагсанд нэмэх"
              }
              disabled={
                !variant ||
                saving ||
                !cartReady ||
                product?.sellable === false ||
                added
              }
              onPress={() => void add()}
            />
            {added && (
              <Button
                title="Сагс руу очих"
                secondary
                onPress={() => {
                  setSheet(false);
                  router.push("/cart");
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
