import { useCallback, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { statusName, dateText, matchesOrderFilter, orderFilters, type OrderFilter } from "@/lib/orders";
import { Page, Button, Busy, ErrorBox, colors, money } from "@/components/ui";
import { Icon, IconButton } from "@/components/shop-ui";
import { EmptyState } from "@/components/account-ui";
function Orders() {
  const { customer, ready, error: bootError, refresh } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const load = useCallback(async (offset = 0) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const r = await api<{ orders: Order[]; more: boolean }>("customer-orders", undefined, { offset });
      setOrders(old => offset ? [...old, ...r.orders.filter(o => !old.some(x => x.id === o.id))] : r.orders);
      setMore(r.more); setError(""); setLoaded(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); inFlight.current = false; }
  }, []);
  useFocusEffect(useCallback(() => { if (customer) void load(); }, [customer, load]));
  if (!ready) return <Page><Busy /></Page>;
  if (!customer) return <Page>
    <ErrorBox message={bootError} retry={() => void refresh().catch(() => {})} />
    <EmptyState icon="box" title="Захиалга бүрээ нэг дор" description="Төлбөрөөс хүргэлт хүртэлх явцыг хянахын тулд бүртгэлээрээ нэвтрээрэй."
      action="Нэвтрэх / Бүртгүүлэх" onPress={() => router.push({ pathname: "/login", params: { next: "/orders" } })} />
    <Button title="Бараа үзэх" secondary onPress={() => router.navigate("/")} />
  </Page>;
  const visible = orders.filter(o => matchesOrderFilter(o, filter));
  return <Page refreshControl={<RefreshControl refreshing={busy && loaded} onRefresh={() => void load()} tintColor={colors.orange} />}>
    <View style={styles.summary}>
      <View style={styles.summaryIcon}><Icon name="truck" size={28} color="#ad421b" /></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={styles.heading}>Захиалгын явц</Text><Text style={styles.muted}>Төлбөр · Тээвэр · Хүлээн авах</Text></View>
      <IconButton name="refresh" label="Захиалга шинэчлэх" onPress={() => void load()} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {orderFilters.map(f => <Pressable key={f.key} accessibilityRole="tab" accessibilityState={{ selected: filter === f.key }}
        onPress={() => setFilter(f.key)} style={[styles.filter, filter === f.key && styles.selectedFilter]}>
        <Text style={[styles.filterText, filter === f.key && { color: "#ad3c10" }]}>{f.label}</Text>
      </Pressable>)}
    </ScrollView>
    <ErrorBox message={error} retry={() => void load()} />
    {visible.map(o => {
      const terminal = ["completed", "cancelled"].includes(o.status);
      return <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={o.id + ", " + statusName(o.status) + ", дэлгэрэнгүй"}
        onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })}
        style={({ pressed }) => [styles.order, { opacity: pressed ? 0.75 : 1 }]}>
        <View style={styles.orderTop}><Text style={styles.orderId}>{o.id}</Text>
          <View style={[styles.status, o.status === "completed" && { backgroundColor: "#eaf6ef" }]}>
            <Text style={[styles.statusText, o.status === "completed" && { color: "#276444" }]}>{statusName(o.status)}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.product}>{o.title || "Таны захиалга"}</Text>
        <Text style={styles.muted}>{dateText(o.created)}</Text>
        <View style={styles.orderBottom}>
          <View style={{ gap: 4 }}><Text style={styles.amount}>{money(o.amount)}</Text>
            <Text style={{ fontSize: 12, color: o.paid ? "#276444" : colors.muted }}>{o.paid ? "Төлбөр төлөгдсөн" : "Төлбөр төлөгдөөгүй"}</Text></View>
          <View style={styles.detail}><Text style={styles.detailText}>{!o.paid && !terminal ? "Төлбөр харах" : "Дэлгэрэнгүй"}</Text><Icon name="chevron" size={16} color="#ad3c10" /></View>
        </View>
      </Pressable>;
    })}
    {busy && !loaded && <Busy />}
    {loaded && !busy && !visible.length && !error && <EmptyState icon={filter === "all" ? "bag" : "box"}
      title={orders.length ? "Энэ төлөвт захиалга алга" : "Анхны захиалгаа эхлүүлээрэй"}
      description={more ? "Өмнөх захиалгуудаа ачаалж үргэлжлүүлэн шалгах боломжтой." : orders.length ? "Өөр төлөв сонгож захиалгуудаа хараарай." : "Сонгосон барааныхаа захиалга, төлбөр, хүргэлтийг эндээс хянана."}
      action={orders.length ? "Бүх захиалга" : "Бараа үзэх"} onPress={() => orders.length ? setFilter("all") : router.navigate("/")} />}
    {more && <Button title={busy ? "Ачаалж байна…" : "Өмнөх захиалгуудыг ачаалах"} secondary disabled={busy} onPress={() => void load(orders.length)} />}
    {more && <Text style={styles.footnote}>Шүүлтүүр нь одоогоор ачаалсан захиалгуудад үйлчилнэ.</Text>}
  </Page>;
}
export default function OrdersRoute() { const { customer } = useStore(); return <Orders key={customer?.id || "guest"} />; }
const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#fff0e6", borderRadius: 20 },
  summaryIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderRadius: 16 },
  heading: { fontSize: 17, fontWeight: "700", color: colors.ink }, muted: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  filter: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: colors.line },
  selectedFilter: { backgroundColor: "#fff0e7", borderColor: "#f7c5ac" }, filterText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  order: { padding: 16, borderRadius: 18, backgroundColor: "white", gap: 10 },
  orderTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  orderId: { fontSize: 14, fontWeight: "700", color: colors.ink },
  status: { backgroundColor: "#f4f3f8", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  statusText: { color: "#615579", fontSize: 11, fontWeight: "600" },
  product: { fontSize: 14, lineHeight: 21, color: colors.ink },
  orderBottom: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  amount: { fontSize: 19, fontWeight: "800", color: colors.ink, fontVariant: ["tabular-nums"] },
  detail: { flexDirection: "row", alignItems: "center", gap: 4 }, detailText: { color: "#ad3c10", fontWeight: "600", fontSize: 12 },
  footnote: { color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 18 },
});
