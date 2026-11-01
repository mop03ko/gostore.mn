import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { brands } from "@/lib/brands";
import { catalog } from "@/lib/api";
import type { Product } from "@/lib/types";
import { usePalette } from "@/lib/palette";
import { BrandMark } from "@/components/brands";
import { DiscoveryCard } from "@/components/discovery";
import { Busy, Button, Copy, ErrorBox } from "@/components/ui";
import { Choice, Icon } from "@/components/shop-ui";

type StoreResults = { products: Product[]; more: boolean; brand?: { id: string; name: string; store_name: string; shop_id: string } };
function BrandStore({ id }: { id: string }) {
  const colors = usePalette(), insets = useSafeAreaInsets();
  const brand = brands.find(b => b.id === id);
  const [page, setPage] = useState(1), [sort, setSort] = useState("default"), [retry, setRetry] = useState(0);
  const [items, setItems] = useState<Product[]>([]), [store, setStore] = useState<StoreResults["brand"]>();
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [more, setMore] = useState(false);
  useEffect(() => {
    if (!brand) return;
    const abort = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true); setError("");
    void catalog<StoreResults>("supplier-search", { brand: id, page, limit: 12, sort }, abort.signal)
      .then(r => {
        if (abort.signal.aborted) return;
        if (r.brand?.id !== id || !r.brand.shop_id || !r.brand.store_name) throw Error("Дэлгүүрийн мэдээллийг баталгаажуулж чадсангүй.");
        setStore(r.brand); setMore(r.more);
        setItems(old => { const rows = page === 1 ? r.products : [...old, ...r.products]; return [...new Map(rows.map(p => [p.id, { ...p, brand_id: id }])).values()]; });
      }).catch(e => { if (!abort.signal.aborted) setError(e.message); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [id, brand, page, sort, retry]);
  if (!brand) return <ErrorBox message="Брэнд олдсонгүй." />;
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Stack.Screen options={{ title: brand.name, headerTransparent: false }} />
    <FlatList data={items} numColumns={2} keyExtractor={p => p.id}
      contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24, gap: 12 }} columnWrapperStyle={{ gap: 10 }}
      renderItem={({ item }) => <View style={{ flex: 1, maxWidth: "50%" }}><DiscoveryCard product={item} /></View>}
      ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 12 }}>
        <View testID="official-brand-store" style={{ backgroundColor: colors.surface, padding: 18, borderRadius: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}><BrandMark brand={brand} size={42} />
            <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontSize: 22, fontWeight: "700" }}>{brand.name}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>Tmall · Албан ёсны дэлгүүр</Text></View></View>
          {store && <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Icon name="shield" color={colors.success} size={20} /><Text selectable style={{ flex: 1, color: colors.ink }}>{store.store_name}</Text></View>}
          <Copy>Энэ дэлгүүрийн бараануудыг GOStore-оор захиална. Үнэ, үлдэгдэл худалдан авах үед дахин шалгагдана.</Copy>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[["default", "Санал болгох"], ["price", "Үнэ ↑"], ["-price", "Үнэ ↓"]].map(([key, label]) => <Choice key={key} label={label} selected={sort === key} onPress={() => { setItems([]); setPage(1); setSort(key); }} />)}
        </View>
        <ErrorBox message={error} retry={() => setRetry(n => n + 1)} />
      </View>}
      ListEmptyComponent={!busy && !error ? <Copy>Одоогоор энэ дэлгүүрийн баталгаажсан бараа олдсонгүй.</Copy> : undefined}
      ListFooterComponent={busy ? <Busy /> : more && !error ? <Button secondary title="Дараагийн бараанууд" onPress={() => setPage(n => n + 1)} /> : undefined} />
  </View>;
}
export default function BrandRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BrandStore key={id} id={id} />;
}
