import { Text, View } from "react-native";
import { useEffect, useState } from "react";
import { usePalette } from "@/lib/palette";
import type { Discount, Product } from "@/lib/types";
import { money } from "./ui";

export function ProductOffers({ product, amount, discount = product.card_discount, details = false }: {
  product: Product; amount: number | null | undefined; discount?: Discount | null; details?: boolean;
}) {
  const colors = usePalette();
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const expiry = Math.min(...[discount?.expires, product.offers?.expires].filter((n): n is number => !!n && n > now));
    if (!Number.isFinite(expiry)) return;
    const timer = setTimeout(() => setNow(Date.now() / 1000), Math.min(expiry * 1000 - Date.now() + 20, 2147483647));
    return () => clearTimeout(timer);
  }, [discount?.expires, product.offers?.expires, now]);
  const sale = product.sellable !== false && discount && discount.expires > now &&
    discount.current_mnt === amount && discount.was_mnt > discount.current_mnt ? discount : null;
  const offers = product.sellable !== false && product.offers && product.offers.expires > now ? product.offers : null;
  if (!sale && !offers?.coupon_mnt && !offers?.promotions.length) return null;
  return <View style={{ gap: 4 }}>
    {sale && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
      <Text accessibilityLabel="Үндсэн үнэ" style={{ color: colors.muted, textDecorationLine: "line-through", fontSize: 12 }}>{money(sale.was_mnt)}</Text>
      {sale.percent > 0 && <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 12 }}>−{sale.percent}%</Text>}
    </View>}
    {offers?.coupon_mnt ? <Text style={{ color: colors.accentText, fontSize: 12 }}>Купонтой ≈ {money(offers.coupon_mnt)} · нөхцөлтэй</Text> : offers?.promotions.length ? <Text style={{ color: colors.accentText, fontSize: 12 }}>Урамшуулалтай · нөхцөлтэй</Text> : null}
    {details && <>
      {offers?.promotions.map(p => <Text key={p.name} style={{ color: colors.muted, fontSize: 12 }}>{p.name}</Text>)}
      <Text style={{ color: colors.muted, fontSize: 12 }}>Нийлүүлэгчийн лавлах үнэ. Купоны нөхцөл, сонгосон хувилбарын эцсийн үнийг захиалах үед шалгана.</Text>
    </>}
  </View>;
}
