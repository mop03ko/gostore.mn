import { useEffect, useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { catalog } from "@/lib/api";
import type { Product } from "@/lib/types";
import { usePalette } from "@/lib/palette";
import { OfficialStores, type OfficialStore } from "@/components/official-stores";
import { DiscoveryCard } from "@/components/discovery";
import { Busy, Button, Copy, ErrorBox } from "@/components/ui";
import { Choice } from "@/components/shop-ui";

function StoreProducts({ shop }: { shop: string }) {
  const colors = usePalette();
  const [page, setPage] = useState(1), [sort, setSort] = useState("-price"), [retry, setRetry] = useState(0);
  const [items, setItems] = useState<Product[]>([]), [store, setStore] = useState<OfficialStore>();
  const [busy, setBusy] = useState(true), [more, setMore] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true); setError("");
    void catalog<{ products: Product[]; store: OfficialStore; more: boolean }>("supplier-search", { shop, page, sort, limit: 20, refresh: 1 }, c.signal)
      .then(r => { if (!c.signal.aborted) {
        if (r.store?.id !== shop) throw Error("Дэлгүүрийн мэдээлэл зөрлөө.");
        setStore(r.store); setMore(r.more);
        setItems(old => [...new Map((page === 1 ? r.products : [...old, ...r.products]).map(p => [p.id, p])).values()].sort((a, b) => {
          const pa = a.mnt ?? a.approx_mnt, pb = b.mnt ?? b.approx_mnt;
          if (pa == null || pb == null) return pa == null ? (pb == null ? 0 : 1) : -1;
          return sort === "price" ? pa - pb : pb - pa;
        }));
      } }).catch(e => { if (!c.signal.aborted) setError(e.message); }).finally(() => { if (!c.signal.aborted) setBusy(false); });
    return () => c.abort();
  }, [shop, page, sort, retry]);
  return <View style={{ flex: 1, backgroundColor: colors.bg }}><Stack.Screen options={{ title: store?.display_name || "Дэлгүүр" }} />
    <FlatList data={items} numColumns={2} keyExtractor={p => p.id} contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 12 }} columnWrapperStyle={{ gap: 10 }}
      renderItem={({ item }) => <View style={{ flex: 1, maxWidth: "50%" }}><DiscoveryCard product={item} /></View>}
      ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 12 }}><Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink }}>{store?.display_name}</Text><Copy>{store?.name}</Copy><View style={{ flexDirection: "row", gap: 8 }}>{[["-price", "Үнэ ↓"], ["price", "Үнэ ↑"]].map(([value, label]) => <Choice key={value} label={label} selected={sort === value} onPress={() => { if (value === sort) return; setItems([]); setPage(1); setSort(value); }} />)}</View><ErrorBox message={error} retry={() => setRetry(n => n + 1)} /></View>}
      ListEmptyComponent={!busy && !error ? <Copy>Энэ хуудсанд бараа олдсонгүй.</Copy> : undefined}
      ListFooterComponent={busy ? <Busy /> : more && !error ? <Button secondary title="Дараагийн бараанууд" onPress={() => setPage(n => n + 1)} /> : undefined} />
  </View>;
}
export default function OfficialStoresRoute() {
  const { shop } = useLocalSearchParams<{ shop?: string }>();
  return shop ? <StoreProducts key={shop} shop={shop} /> : <ScrollView contentContainerStyle={{ padding: 12 }}><OfficialStores /></ScrollView>;
}
