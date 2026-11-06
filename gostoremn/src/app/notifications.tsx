import { PushSettings } from "@/components/push-settings";
import { useCallback, useState } from "react";
import { Linking } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { CustomerMessage, Notice } from "@/lib/types";
import { dateText } from "@/lib/orders";
import { Page, Card, Copy, Button, ErrorBox } from "@/components/ui";
const maxId = (ids: number[]) => (ids.length ? Math.max(...ids) : 0);
function Notifications() {
  const [rows, setRows] = useState<Notice[]>([]),
    [messages, setMessages] = useState<CustomerMessage[]>([]),
    [promo, setPromo] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [r, settings] = await Promise.all([
        api<{ notifications: Notice[]; messages?: CustomerMessage[] }>(
          "customer-notifications",
        ),
        api<{ promo_push: boolean }>("customer-message-settings").catch(
          () => null,
        ),
      ]);
      setRows(r.notifications);
      setMessages(r.messages ?? []);
      if (settings) setPromo(settings.promo_push);
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
  const unread =
    rows.some((n) => !n.read_at) || messages.some((m) => !m.read_at);
  return (
    <Page>
      <PushSettings />
      {promo !== null && (
        <Card>
          <Copy>Хямдрал, урамшууллын мэдэгдэл</Copy>
          <Copy>
            {promo
              ? "Хямдрал, урамшууллын мэдээг утсандаа авна."
              : "Асаавал хямдрал, урамшууллын мэдээ утсанд ирнэ. Утасны мэдэгдэл зөвшөөрсөн байх шаардлагатай."}
          </Copy>
          <Button
            title={promo ? "Урамшууллын мэдэгдэл унтраах" : "Урамшууллын мэдэгдэл асаах"}
            secondary={promo}
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void api<{ promo_push: boolean }>("customer-message-settings-save", {
                promo_push: !promo,
              })
                .then((r) => setPromo(r.promo_push))
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          />
        </Card>
      )}
      <ErrorBox message={error} retry={() => void load()} />
      <Button title="Шинэчлэх" secondary onPress={() => void load()} />
      {unread && (
        <Button
          title="Бүгдийг уншсан болгох"
          secondary
          onPress={() => {
            void api("customer-notifications-read", {
              through_id: maxId(rows.map((n) => Number(n.id))),
              messages_through_id: maxId(messages.map((m) => Number(m.id))),
            })
              .then(load)
              .catch((e) => setError(e.message));
          }}
        />
      )}
      {messages.map((m) => (
        <Card key={"m" + m.id}>
          <Copy>
            {!m.read_at ? "● " : ""}
            {m.title}
          </Copy>
          <Copy>{m.body}</Copy>
          <Copy>
            {m.kind === "promo" ? "Урамшуулал" : "GOStore мэдээлэл"} ·{" "}
            {dateText(m.created)}
          </Copy>
          {/^\/(?!\/)/.test(m.link) && (
            <Button
              title="Дэлгэрэнгүй"
              secondary
              onPress={() => void Linking.openURL("https://gostore.mn" + m.link)}
            />
          )}
        </Card>
      ))}
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
      {!rows.length && !messages.length && !error && (
        <Copy>Мэдэгдэл байхгүй.</Copy>
      )}
    </Page>
  );
}
export default function NotificationsRoute() {
  const { customer } = useStore();
  return <Notifications key={customer?.id || "guest"} />;
}
