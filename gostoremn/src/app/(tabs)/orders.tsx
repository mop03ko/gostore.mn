import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { statusName, dateText } from "@/lib/orders";
import {
  Page,
  Card,
  Title,
  Copy,
  Button,
  Busy,
  ErrorBox,
  Row,
  money,
} from "@/components/ui";
function Orders() {
  const { customer, ready } = useStore();
  const [orders, setOrders] = useState<Order[]>([]),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async (offset = 0) => {
    setBusy(true);
    try {
      const r = await api<{ orders: Order[]; more: boolean }>(
        "customer-orders",
        undefined,
        { offset },
      );
      setOrders((old) =>
        offset
          ? [...old, ...r.orders.filter((o) => !old.some((x) => x.id === o.id))]
          : r.orders,
      );
      setMore(r.more);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (customer) void load();
    }, [customer, load]),
  );
  if (!ready)
    return (
      <Page>
        <Busy />
      </Page>
    );
  if (!customer)
    return (
      <Page>
        <Title>Миний захиалгууд</Title>
        <Copy>Захиалгуудаа харахын тулд нэвтэрнэ үү.</Copy>
        <Button title="Нэвтрэх" onPress={() => router.push("/login")} />
      </Page>
    );
  return (
    <Page>
      <Title>Миний захиалгууд</Title>
      <Button
        title="Шинэчлэх"
        secondary
        disabled={busy}
        onPress={() => void load()}
      />
      <ErrorBox message={error} />
      {orders.map((o) => (
        <Card key={o.id}>
          <Title>{o.id}</Title>
          <Copy>{o.title}</Copy>
          <Row label={statusName(o.status)} value={money(o.amount)} />
          <Copy>
            {dateText(o.created)} · {o.paid ? "Төлөгдсөн" : "Төлөгдөөгүй"}
          </Copy>
          <Button
            title="Дэлгэрэнгүй харах"
            secondary
            onPress={() =>
              router.push({ pathname: "/order/[id]", params: { id: o.id } })
            }
          />
        </Card>
      ))}
      {busy ? (
        <Busy />
      ) : !orders.length && !error ? (
        <Copy>Одоогоор захиалга байхгүй.</Copy>
      ) : null}
      {more && (
        <Button
          title="Өмнөх захиалгууд"
          disabled={busy}
          onPress={() => void load(orders.length)}
        />
      )}
    </Page>
  );
}
export default function OrdersRoute() {
  const { customer } = useStore();
  return <Orders key={customer?.id || "guest"} />;
}
