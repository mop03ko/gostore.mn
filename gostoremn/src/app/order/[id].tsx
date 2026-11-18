import { useCallback, useEffect, useRef, useState } from "react";
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
  const [now, setNow] = useState(Date.now);
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
  const deadline = order?.payment_due ? Date.parse(order.payment_due) : 0;
  const timedPayment = !!order?.invoice && !order.paid && order.status === "quoted" && !!deadline;
  const expired = timedPayment && now >= deadline;
  useEffect(() => {
    if (!timedPayment) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [timedPayment]);
  useEffect(() => {
    if (!expired) return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [expired, load]);
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
              value={order.shipment_parent ? "Үндсэн захиалгад бүртгэгдсэн" : order.type === "forwarding" ? "Барааг өөрөө худалдан авсан" : order.paid ? "Төлөгдсөн" : "Төлөгдөөгүй"}
            />
            {order.shipment_parent ? <Copy>{order.shipment_parent} захиалгын тусдаа илгээж буй хэсэг. Барааны төлбөр давхар тооцогдохгүй.</Copy> : order.type === "forwarding" ? <Copy>Өөрөө худалдан авсан бараа. Зөвхөн тээврийн төлбөрийг GOStore-д төлнө.</Copy> : <Row label="Захиалгын дүн" value={money(order.amount)} />}
            <Copy>{dateText(order.created)}</Copy>
            {!!order.payment_due && !order.paid && order.status === "quoted" && (
              <Copy>Төлөх хугацаа: {dateText(order.payment_due)}</Copy>
            )}
            <Button
              title="Төлөв шинэчлэх"
              secondary
              disabled={busy}
              onPress={() => void load()}
            />
          </Card>
          {!!order.shipment_parts?.length && (
            <Card>
              <Title>Захиалгын хэсгүүд</Title>
              <Copy>Барааны төлбөр үндсэн захиалгад нэг удаа, тээврийн төлбөр хэсэг бүрд тусдаа тооцогдоно. Хэсгээ нээж явц, зураг, төлбөрөө харна уу.</Copy>
              {order.shipment_parts.map((part) => (
                <Card key={part.id}>
                  <Copy>{part.id}{part.remainder ? " · Үлдсэн хэсэг" : ""}</Copy>
                  <Row label="Төлөв" value={statusName(part.status)} />
                  <Row label={part.unit === "parcel" ? "Хайрцаг" : "Тоо ширхэг"} value={String(part.quantity)} />
                  {!!part.numbers.length && <Copy>{part.numbers.join("\n")}</Copy>}
                  <Row label="Төлөх үлдэгдэл" value={money(part.billing.due)} />
                  {part.id !== order.id && <Button title="Хэсгийг харах" secondary onPress={() => router.push({ pathname: "/order/[id]", params: { id: part.id } })} />}
                </Card>
              ))}
            </Card>
          )}
          {timedPayment && <Copy>{expired
            ? "Төлөх хугацаа дууссан. Төлбөрийн төлөвийг тулгаж байна."
            : `Төлөх хугацаа: ${Math.floor(Math.max(0, Math.ceil((deadline-now)/1000))/60)}:${String(Math.max(0, Math.ceil((deadline-now)/1000))%60).padStart(2,"0")} · Хугацаандаа төлөөгүй захиалга автоматаар цуцлагдана.`}</Copy>}
          {order.cancel_reason === "payment_timeout" && <Copy>Төлбөрийн хугацаа дууссан тул захиалга цуцлагдсан. Сагсаа дахин шалгаж захиална уу.</Copy>}
          {order.items?.map((i) => (
            <Card key={i.id + i.sku}>
              <Copy>
                {i.name}
                {"\n"}
                {i.variant} · {i.qty} ш
              </Copy>
              {order.type !== "forwarding" && <Row label="Барааны дүн" value={"¥" + i.goods_cny?.toFixed(2)} />}
            </Card>
          ))}
          {order.type !== "forwarding" && !order.paid && order.status === "quoted" && !expired && (
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
          {(order.paid || order.type === "forwarding") && bill?.finalized && bill.due > 0 && (
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
