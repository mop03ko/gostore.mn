import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { catalog } from "@/lib/api";
import { addLine } from "@/lib/cart";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import {
  Page,
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
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Page>
      <ErrorBox message={error} retry={() => setRetry((x) => x + 1)} />
      {!product && !error ? (
        <Busy />
      ) : (
        product && (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator
              contentContainerStyle={{ gap: 10 }}
            >
              {[
                ...new Set([
                  variant?.image || product.image,
                  ...(product.images || []),
                ]),
              ]
                .filter(Boolean)
                .slice(0, 12)
                .map((uri) => (
                  <Image
                    key={uri}
                    source={uri}
                    contentFit="contain"
                    style={{
                      width: 285,
                      height: 285,
                      borderRadius: 16,
                      backgroundColor: "white",
                    }}
                  />
                ))}
            </ScrollView>
            <Title>{product.name}</Title>
            <Text
              selectable
              style={{ fontSize: 27, fontWeight: "800", color: colors.orange }}
            >
              {variant?.cny && rate
                ? money(Math.ceil(variant.cny * rate))
                : product.mnt
                  ? money(product.mnt)
                  : "Хувилбараа сонгоно уу"}
            </Text>
            <Copy>
              Хүргэлт тусдаа тооцогдоно. Үнэ, үлдэгдэл захиалга баталгаажуулах
              үед дахин шалгагдана.
            </Copy>
            <Card>
              <Title>Хувилбар сонгох</Title>
              {product.variants.map((v) => (
                <Button
                  key={v.id}
                  title={`${v.label}${v.cny !== null ? " · ¥" + v.cny : ""}${v.stock === 0 ? " · Дууссан" : ""}`}
                  secondary={sku !== v.id}
                  disabled={v.cny === null || v.stock === 0 || v.stock === null}
                  onPress={() => {
                    setSku(v.id);
                    setQty(product.min_qty);
                    setAdded(false);
                  }}
                />
              ))}
            </Card>
            <Card>
              <Copy>
                Тоо нь сонгосон хувилбарын нэгж. Багцын бүрдлийг хувилбарын
                нэрээс шалгана уу.
              </Copy>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 18 }}
              >
                <Button
                  title="−"
                  secondary
                  disabled={qty - product.step < product.min_qty}
                  onPress={() => {
                    setQty((q) => q - product.step);
                    setAdded(false);
                  }}
                />
                <Text selectable style={{ fontSize: 22, fontWeight: "700" }}>
                  {qty}
                </Text>
                <Button
                  title="+"
                  secondary
                  disabled={
                    !variant ||
                    qty + product.step > Math.min(variant.stock || 0, 9999)
                  }
                  onPress={() => {
                    setQty((q) => q + product.step);
                    setAdded(false);
                  }}
                />
              </View>
              <Button
                title={
                  saving
                    ? "Хадгалж байна…"
                    : added
                      ? "Сагсанд нэмэгдлээ ✓"
                      : "Сагсанд нэмэх"
                }
                disabled={
                  !variant || saving || !cartReady || product.sellable === false
                }
                onPress={() => void add()}
              />
              <Button
                title="Сагс руу очих"
                secondary
                onPress={() => router.push("/cart")}
              />
            </Card>
            {product.attributes?.length ? (
              <Card>
                <Title>Үзүүлэлт</Title>
                {product.attributes.slice(0, 30).map((p, i) => (
                  <Copy key={i}>
                    {p.name}: {p.value}
                  </Copy>
                ))}
              </Card>
            ) : null}
          </>
        )
      )}
    </Page>
  );
}
