import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  Modal,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconButton, Choice, Quantity } from "@/components/shop-ui";
import { catalog } from "@/lib/api";
import { addLine } from "@/lib/cart";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import {
  Card,
  Title,
  Copy,
  Button,
  Busy,
  ErrorBox,
  colors,
  money,
} from "@/components/ui";
export default function ProductScreen() {
  const inset = useSafeAreaInsets(),
    { width } = useWindowDimensions(),
    galleryWidth = Math.min(width, 820);
  const [sheet, setSheet] = useState(false),
    [intent, setIntent] = useState<"cart" | "buy">("cart"),
    [imageIndex, setImageIndex] = useState(0);
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

  const images = product
    ? [...new Set([product.image, ...(product.images || [])])]
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const open = (mode: "cart" | "buy") => {
    setIntent(mode);
    setAdded(false);
    setSheet(true);
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: 20,
          gap: 10,
          maxWidth: 820,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <ErrorBox message={error} retry={() => setRetry((x) => x + 1)} />
        {!product && !error ? (
          <Busy />
        ) : (
          product && (
            <>
              <View style={{ backgroundColor: "white" }}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) =>
                    setImageIndex(
                      Math.round(e.nativeEvent.contentOffset.x / galleryWidth),
                    )
                  }
                >
                  {images.map((uri) => (
                    <Image
                      key={uri}
                      source={uri}
                      contentFit="contain"
                      style={{ width: galleryWidth, height: galleryWidth }}
                    />
                  ))}
                </ScrollView>
                <View
                  style={{
                    position: "absolute",
                    bottom: 14,
                    right: 14,
                    backgroundColor: "#00000066",
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 18,
                  }}
                >
                  <Text style={{ color: "white", fontSize: 12 }}>
                    {Math.min(imageIndex + 1, images.length)} / {images.length}
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: "white", padding: 16, gap: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <Text
                    selectable
                    style={{
                      fontSize: 30,
                      fontWeight: "800",
                      color: "#d84500",
                    }}
                  >
                    {variant?.cny && rate
                      ? money(Math.ceil(variant.cny * rate))
                      : product.mnt
                        ? money(product.mnt)
                        : "Үнэ шалгах"}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {" "}
                    / нэгж
                  </Text>
                </View>
                <Text
                  selectable
                  style={{ fontSize: 18, fontWeight: "600", lineHeight: 26 }}
                >
                  {product.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  Барааны үнэ · Хүргэлт тусдаа тооцогдоно
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, gap: 10 }}>
                <Card>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Хувилбар сонгох"
                    onPress={() => open("cart")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 48,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: colors.muted }}>
                      Сонголт
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{ flex: 1, fontSize: 14, fontWeight: "600" }}
                    >
                      {variant?.label || "Өнгө, хэмжээ, тоо сонгох"}
                    </Text>
                    <Icon name="chevron" size={18} />
                  </Pressable>
                  <View style={{ height: 1, backgroundColor: colors.line }} />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Text style={{ fontSize: 13, color: colors.muted }}>
                      Хүргэлт
                    </Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 14 }}>
                        Хятад → Эрээн → Улаанбаатар
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.muted,
                          lineHeight: 18,
                        }}
                      >
                        Хятад хүргэлтийг захиалахын өмнө, каргоны төлбөрийг
                        бодит хэмжилтээр тооцно.
                      </Text>
                    </View>
                  </View>
                </Card>
                {!!product.vendor_name && (
                  <Card>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          padding: 10,
                          backgroundColor: "#fff1e8",
                          borderRadius: 10,
                        }}
                      >
                        <Icon name="home" color="#c44000" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700" }}>
                          {product.vendor_name}
                        </Text>
                        <Copy>Taobao дэлгүүр</Copy>
                      </View>
                    </View>
                  </Card>
                )}
                <Card>
                  <Title>Барааны дэлгэрэнгүй</Title>
                  {product.attributes?.length ? (
                    product.attributes.slice(0, 30).map((p, i) => (
                      <View
                        key={i}
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          borderBottomWidth: 1,
                          borderColor: colors.line,
                          paddingVertical: 8,
                        }}
                      >
                        <Text
                          style={{
                            width: "35%",
                            fontSize: 12,
                            color: colors.muted,
                          }}
                        >
                          {p.name}
                        </Text>
                        <Text selectable style={{ flex: 1, fontSize: 13 }}>
                          {p.value}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Copy>
                      Өнгө, хэмжээ, бүрдлийг сонгосон хувилбарын нэрээс шалгана
                      уу.
                    </Copy>
                  )}
                </Card>
                <Copy>
                  Үнэ, үлдэгдэл захиалга үүсгэхэд серверээр дахин шалгагдана.
                </Copy>
              </View>
            </>
          )
        )}
      </ScrollView>
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
