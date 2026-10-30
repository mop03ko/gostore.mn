import { useCallback, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { bankLink } from "@/lib/cart";
import { useStore } from "@/lib/store";
import type { Invoice, Order } from "@/lib/types";
import { statusName, partName, dateText } from "@/lib/orders";
import {
  Page,
  Card,
  Title,
  Copy,
  Row,
  Button,
  Busy,
  ErrorBox,
  money,
} from "@/components/ui";
export default function OrderRoute() {
  const { customer } = useStore(),
    { id } = useLocalSearchParams<{ id: string }>();
  return <OrderScreen key={(customer?.id || "guest") + ":" + id} />;
}
function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { customer, qpay } = useStore();
  const [order, setOrder] = useState<Order | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false),
    bankOpened = useRef(false);
  const load = useCallback(
    async (action = "order-get") => {
      if (locked.current) return;
      locked.current = true;
      setBusy(true);
      try {
        const r = await api<{ order: Order }>(action, { id });
        setOrder(r.order);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [id],
  );
  useFocusEffect(
    useCallback(() => {
      if (!customer) return;
      void load();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active" && bankOpened.current) {
          bankOpened.current = false;
          void load("payment-check");
        }
      });
      return () => listener.remove();
    }, [customer, load]),
  );
  async function open(link: string) {
    const safe = bankLink(link);
    if (!safe) {
      setError("Банкны холбоос буруу.");
      return;
    }
    try {
      bankOpened.current = true;
      await Linking.openURL(safe);
    } catch {
      bankOpened.current = false;
      setError(
        "Банкны апп нээгдсэнгүй. Тухайн апп суусан эсэхийг шалгах эсвэл QR ашиглана уу.",
      );
    }
  }
  if (!customer)
    return (
      <Page>
        <Button title="Нэвтрэх" onPress={() => router.push("/login")} />
      </Page>
    );
  const bill = order?.cargo?.billing;
  return (
    <Page>
      <ErrorBox message={error} retry={() => void load()} />
      {busy && <Busy />}
      {order && (
        <>
          <Card>
            <Title>{order.id}</Title>
            <Row label="Төлөв" value={statusName(order.status)} />
            <Row
              label="Эхний төлбөр"
              value={order.paid ? "Төлөгдсөн" : "Төлөгдөөгүй"}
            />
            <Row label="Захиалгын дүн" value={money(order.amount)} />
            <Copy>{dateText(order.created)}</Copy>
            {!!order.payment_due && !order.paid && (
              <Copy>Төлөх хугацаа: {dateText(order.payment_due)}</Copy>
            )}
            <Button
              title="Төлөв шинэчлэх"
              secondary
              disabled={busy}
              onPress={() => void load()}
            />
          </Card>
          {order.items?.map((i) => (
            <Card key={i.id + i.sku}>
              <Copy>
                {i.name}
                {"\n"}
                {i.variant} · {i.qty} ш
              </Copy>
              <Row label="Барааны дүн" value={"¥" + i.goods_cny?.toFixed(2)} />
            </Card>
          ))}
          {!order.paid && order.status !== "cancelled" && (
            <>
              {order.invoice ? (
                <InvoiceCard
                  i={order.invoice}
                  busy={busy}
                  onOpen={(link) => void open(link)}
                  onCheck={() => void load("payment-check")}
                />
              ) : (
                <Button
                  title="QPay нэхэмжлэл авах"
                  disabled={busy || !qpay}
                  onPress={() => void load("invoice")}
                />
              )}
              <Copy>Төлбөрийн төлөвийг GOStore сервер банкнаас шалгана.</Copy>
            </>
          )}
          {order.paid && (
            <Copy>
              Хэрэглэгчийн төлбөр баталгаажсан. Нийлүүлэгчийн худалдан авалт,
              тээвэрлэлтийн явц захиалгын төлөвөөр шинэчлэгдэнэ.
            </Copy>
          )}
          {bill && (
            <Card>
              <Title>
                {bill.finalized ? "Эцсийн тооцоо" : "Одоогийн тооцоо"}
              </Title>
              {Object.entries(bill.breakdown).map(([k, v]) => (
                <Row key={k} label={partName(k)} value={money(v)} />
              ))}
              <Row label="Нийт" value={money(bill.total)} />
              <Row label="Төлсөн" value={money(bill.paid)} />
              <Row label="Үлдэгдэл" value={money(bill.due)} />
              {!!bill.refund_due && (
                <Row label="Буцаан олгох дүн" value={money(bill.refund_due)} />
              )}
              {!bill.finalized && (
                <Copy>
                  Бодит жин, эзэлхүүнээр карго болон хүргэлтийн эцсийн төлбөр
                  нэмэгдэнэ.
                </Copy>
              )}
            </Card>
          )}
          {order.cargo?.measurement && (
            <Card>
              <Row
                label="Бодит жин"
                value={order.cargo.measurement.weight_kg + " кг"}
              />
              <Row
                label="Эзэлхүүн"
                value={order.cargo.measurement.volume_m3 + " м³"}
              />
            </Card>
          )}
          {order.paid && bill?.finalized && bill.due > 0 && (
            <>
              {order.cargo?.freight_invoice ? (
                <InvoiceCard
                  i={order.cargo.freight_invoice}
                  busy={busy}
                  onOpen={(link) => void open(link)}
                  onCheck={() => void load("payment-check")}
                />
              ) : (
                <Button
                  title="Хүргэлтийн үлдэгдэл төлөх"
                  disabled={busy || !qpay}
                  onPress={() => void load("freight-invoice")}
                />
              )}
            </>
          )}
          {!!order.cargo?.pickup_code && (
            <Card>
              <Title>Авах код: {order.cargo.pickup_code}</Title>
              <Copy>
                {order.pickup_warehouse?.name}
                {"\n"}
                {order.pickup_warehouse?.address}
              </Copy>
            </Card>
          )}
          {!!order.cargo?.issue_count && (
            <Copy>
              Захиалгад тодруулах асуудал байна. Тусламжийн хэсгээр холбогдоно
              уу.
            </Copy>
          )}
          <Card>
            <Title>Захиалгын явц</Title>
            {order.history?.map((h, n) => (
              <Row
                key={n}
                label={statusName(h.status)}
                value={dateText(h.at)}
              />
            ))}
          </Card>
          <Button
            title="Тусламж авах"
            secondary
            onPress={() => router.push("/help")}
          />
        </>
      )}
    </Page>
  );
}

function InvoiceCard({
  i,
  busy,
  onOpen,
  onCheck,
}: {
  i: Invoice | undefined;
  busy: boolean;
  onOpen: (link: string) => void;
  onCheck: () => void;
}) {
  return i?.state === "ready" ? (
    <Card>
      <Title>QPay төлбөр</Title>
      {!!i.qr_image && (
        <Image
          accessibilityLabel="QPay QR"
          source={
            i.qr_image.startsWith("data:")
              ? i.qr_image
              : "data:image/png;base64," + i.qr_image
          }
          style={{ width: 250, height: 250, alignSelf: "center" }}
          contentFit="contain"
        />
      )}
      <Copy>Банкны апп сонгоод төлбөрөө баталгаажуулна уу.</Copy>
      {i.urls?.map((u, n) => (
        <Button
          key={n}
          title={u.description || u.name}
          secondary
          disabled={busy || !bankLink(u.link)}
          onPress={() => onOpen(u.link)}
        />
      ))}
      <Button title="Төлбөр шалгах" disabled={busy} onPress={() => onCheck()} />
    </Card>
  ) : i ? (
    <Copy>Нэхэмжлэл боловсруулж байна. Төлөвийг шинэчилнэ үү.</Copy>
  ) : null;
}
