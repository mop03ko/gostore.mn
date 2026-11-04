import { AppState, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { usePalette } from "@/lib/palette";
import type { Discount, Product } from "@/lib/types";
import { percentLabel, productSavings } from "@/lib/product-offers";
import { money } from "./ui";

type Props = { product: Product; amount: number | null | undefined; discount?: Discount | null; details?: boolean };
function useSavings({ product, amount, discount = product.card_discount }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick(value => value + 1);
    const now = Date.now() / 1000;
    const expiry = Math.min(...[discount?.expires, product.offers?.expires].filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > now));
    const timer = Number.isFinite(expiry) ? setTimeout(update, Math.max(20, Math.min(expiry * 1000 - Date.now() + 20, 2147483647))) : undefined;
    const subscription = AppState.addEventListener("change", state => { if (state === "active") update(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [discount?.expires, product.offers?.expires, tick]);
  return productSavings(product, amount, discount);
}

export function ProductDiscountBadge(props: Props) {
  const { sale, coupon } = useSavings(props), offer = sale || coupon;
  if (!offer) return null;
  const label = percentLabel(offer.percent);
  return <View testID="product-discount-badge" pointerEvents="none" accessible accessibilityLabel={(sale ? "" : "Купонтой, нөхцөлтэй ") + label + " хямдрал"}
    style={{ position: "absolute", top: 8, left: 8, zIndex: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, alignItems: "center", backgroundColor: sale ? "#b93609" : "#6240a4" }}>
    {!sale && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Купонтой</Text>}
    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{label}</Text>
  </View>;
}

export function ProductOffers({ details = false, ...props }: Props) {
  const colors = usePalette();
  const { sale, coupon, offers } = useSavings(props);
  if (!sale && !coupon && !offers?.promotions?.length) return null;
  return <View style={{ gap: 4 }}>
    {sale && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
      <Text accessibilityLabel="Үндсэн үнэ" style={{ color: colors.muted, textDecorationLine: "line-through", fontSize: 12 }}>{money(sale.was_mnt)}</Text>
      <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 12 }}>{percentLabel(sale.percent)}</Text>
    </View>}
    {coupon ? <Text style={{ color: colors.accentText, fontSize: 12 }}>Купонтой {percentLabel(coupon.percent)} · ≈ {money(coupon.amount)} · нөхцөлтэй</Text> : offers?.promotions?.length ? <Text style={{ color: colors.accentText, fontSize: 12 }}>Урамшуулалтай · нөхцөлтэй</Text> : null}
    {details && <>
      {offers?.promotions?.map(p => <Text key={p.name} style={{ color: colors.muted, fontSize: 12 }}>{p.name}</Text>)}
      <Text style={{ color: colors.muted, fontSize: 12 }}>Нийлүүлэгчийн лавлах үнэ. Купоны нөхцөл, сонгосон хувилбарын эцсийн үнийг захиалах үед шалгана.</Text>
    </>}
  </View>;
}
