import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Notice } from "@/lib/types";
import { dateText } from "@/lib/orders";
import { Page, Card, Copy, Button, ErrorBox } from "@/components/ui";
function Notifications() {
  const [rows, setRows] = useState<Notice[]>([]),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: Notice[] }>(
        "customer-notifications",
      );
      setRows(r.notifications);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Page>
      <ErrorBox message={error} retry={() => void load()} />
      <Button title="Шинэчлэх" secondary onPress={() => void load()} />
      {rows.some((n) => !n.read_at) && (
        <Button
          title="Бүгдийг уншсан болгох"
          secondary
          onPress={() => {
            void api("customer-notifications-read", {
              through_id: Math.max(...rows.map((n) => Number(n.id))),
            })
              .then(load)
              .catch((e) => setError(e.message));
          }}
        />
      )}
      {rows.map((n) => (
        <Card key={n.id}>
          <Copy>
            {!n.read_at ? "● " : ""}
            {n.message}
          </Copy>
          <Copy>{dateText(n.created)}</Copy>
          <Button
            title={n.order_id}
            secondary
            onPress={() =>
              router.push({
                pathname: "/order/[id]",
                params: { id: n.order_id },
              })
            }
          />
        </Card>
      ))}
      {!rows.length && !error && <Copy>Мэдэгдэл байхгүй.</Copy>}
    </Page>
  );
}
export default function NotificationsRoute() {
  const { customer } = useStore();
  return <Notifications key={customer?.id || "guest"} />;
}
