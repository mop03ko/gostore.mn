import { useCallback, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import { api, ApiError } from "@/lib/api";
import { selection } from "@/lib/cart";
import { useStore } from "@/lib/store";
import type { Address, Order, Quote, PricedLine } from "@/lib/types";
import { partName } from "@/lib/orders";
import {
  Page,
  Card,
  Title,
  Copy,
  Field,
  Button,
  Busy,
  ErrorBox,
  Row,
  money,
} from "@/components/ui";
type Preview = { quote: Quote; items: PricedLine[] };
type Submission = {
  token: string;
  items: ReturnType<typeof selection>;
  expected_total: number;
  type: string;
  title: string;
  customer: string;
  family_name: string;
  phone: string;
  address: string;
  notes: string;
  fulfillment: string;
  require_account: boolean;
};
function Checkout() {
  const { customer, cart, cartReady, saveCart, shipping } = useStore(),
    [preview, setPreview] = useState<Preview | null>(null),
    [addresses, setAddresses] = useState<Address[]>([]),
    [name, setName] = useState<string | null>(null),
    [family, setFamily] = useState(""),
    [phone, setPhone] = useState<string | null>(null),
    [address, setAddress] = useState<string | null>(null),
    [method, setMethod] = useState("pickup"),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Submission | null>(null),
    [loaded, setLoaded] = useState(false),
    [quotedItems, setQuotedItems] = useState("");
  const locked = useRef(false),
    quoteAt = useRef(0),
    key = "gostore-pending-" + (customer?.id || "guest"),
    signature = JSON.stringify(selection(cart));
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (customer) {
        void Promise.all([
          api<{ addresses: Address[] }>("customer-addresses"),
          AsyncStorage.getItem(key),
        ])
          .then(([a, p]) => {
            if (active) {
              setAddresses(a.addresses);
              setPending(p ? JSON.parse(p) : null);
              setLoaded(true);
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          });
      }
      return () => {
        active = false;
      };
    }, [customer, key]),
  );
  async function quote() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const r = await api<Preview>("checkout-quote", {
        items: selection(cart),
      });
      setQuotedItems(signature);
      quoteAt.current = Date.now();
      setPreview(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function submit(retry = false) {
    if (locked.current || !customer) return;
    if (
      !retry &&
      (!preview ||
        signature !== quotedItems ||
        Date.now() - quoteAt.current > 120000)
    ) {
      setPreview(null);
      setError("Тооцоог дахин шинэчилнэ үү.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const body =
        retry && pending
          ? pending
          : {
              type: "checkout",
              title: "GOStore app order",
              customer: (name ?? customer.name).trim(),
              family_name: family.trim(),
              phone: (phone ?? customer.phone).trim(),
              address: (address ?? customer.address).trim(),
              notes,
              fulfillment: method,
              require_account: true,
              items: selection(cart),
              expected_total: preview!.quote.total,
              token: Array.from(Crypto.getRandomBytes(32), (v) =>
                v.toString(16).padStart(2, "0"),
              ).join(""),
            };
      await AsyncStorage.setItem(key, JSON.stringify(body));
      setPending(body);
      const r = await api<{ order: Order }>("order-create", body);
      // Remove only the submitted quantities. A retried order cannot consume later additions.
      await saveCart(
        cart.flatMap((line) => {
          const sent = body.items.find(
            (i) => i.id === line.id && i.sku === line.sku,
          );
          if (!sent) return [line];
          const qty = line.qty - sent.qty;
          return qty >= line.min_qty ? [{ ...line, qty }] : [];
        }),
      );
      await AsyncStorage.removeItem(key);
      setPending(null);
      router.replace({ pathname: "/order/[id]", params: { id: r.order.id } });
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        ![401, 403, 408, 429].includes(e.status)
      ) {
        await AsyncStorage.removeItem(key);
        setPending(null);
        setPreview(null);
      }
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (!customer)
    return (
      <Page>
        <Copy>Захиалга үүсгэхийн тулд нэвтэрнэ үү.</Copy>
        <Button
          title="Нэвтрэх"
          onPress={() =>
            router.replace({ pathname: "/login", params: { next: "checkout" } })
          }
        />
      </Page>
    );
  if (!cartReady)
    return (
      <Page>
        <Busy />
      </Page>
    );
  return (
    <Page>
      <ErrorBox message={error} />
      {pending ? (
        <Card>
          <Title>Өмнөх хүсэлтийг шалгах</Title>
          <Copy>
            Захиалга хадгалагдсан эсэхийг ижил хүсэлтийн дугаараар шалгана.
            Давхар захиалга үүсгэхгүй.
          </Copy>
          <Row
            label="Баталгаажуулсан дүн"
            value={money(pending.expected_total)}
          />
          <Button
            title="Захиалгын үр дүнг шалгах"
            disabled={busy}
            onPress={() => void submit(true)}
          />
          <Button
            title="Миний захиалгууд"
            secondary
            onPress={() => router.push("/orders")}
          />
        </Card>
      ) : !cart.length ? (
        <Copy>Сагс хоосон байна.</Copy>
      ) : (
        <>
          <Card>
            <Title>Хүлээн авагч</Title>
            <Field label="Овог" value={family} onChangeText={setFamily} />
            <Field
              label="Нэр"
              value={name ?? customer.name}
              onChangeText={setName}
            />
            <Field
              label="Утас"
              value={phone ?? customer.phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Button
              title="Улаанбаатар агуулахаас авах"
              secondary={method !== "pickup"}
              onPress={() => setMethod("pickup")}
            />
            <Button
              title="Улаанбаатарт хүргүүлэх"
              secondary={method !== "delivery"}
              onPress={() => setMethod("delivery")}
            />
            {method === "pickup" ? (
              <Copy>
                {shipping?.pickup?.name}
                {"\n"}
                {shipping?.pickup?.address}
              </Copy>
            ) : (
              <>
                {addresses.map((a) => (
                  <Button
                    key={a.id}
                    title={a.label + " · " + a.address}
                    secondary
                    onPress={() => {
                      setAddress(a.address);
                      setName(a.recipient);
                      setPhone(a.phone);
                    }}
                  />
                ))}
                <Field
                  label="Хүргэлтийн хаяг"
                  value={address ?? customer.address}
                  onChangeText={setAddress}
                  multiline
                />
                <Copy>
                  Улаанбаатар хүргэлтийн төлбөр эцсийн тооцоонд нэмэгдэнэ.
                </Copy>
              </>
            )}
            <Field
              label="Нэмэлт тайлбар"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </Card>
          <Button
            title={busy ? "Шалгаж байна…" : "Үнэ, хүргэлтийг шалгах"}
            disabled={busy || !loaded}
            onPress={() => void quote()}
          />
          {preview && signature === quotedItems && (
            <>
              <Card>
                <Title>Таны сонгосон бараа</Title>
                {preview.items.map((i) => (
                  <Copy key={i.id + i.sku}>
                    {i.name}
                    {"\n"}
                    {i.variant} · {i.qty} ш × ¥{i.unit_cny.toFixed(2)} = ¥
                    {i.goods_cny.toFixed(2)}
                  </Copy>
                ))}
              </Card>
              <Card>
                <Title>Төлөх дүн</Title>
                <Row
                  label="Тооцооны ханш"
                  value={"¥1 = " + money(preview.quote.cny_rate)}
                />
                {Object.entries(preview.quote.breakdown)
                  .filter(([k]) => k !== "cargo_mnt")
                  .map(([k, v]) => (
                    <Row key={k} label={partName(k)} value={money(v)} />
                  ))}
                <Copy>
                  Бараа ¥{preview.quote.goods_cny.toFixed(2)} · Хятад хүргэлт ¥
                  {preview.quote.domestic_cny.toFixed(2)} ·{" "}
                  {preview.quote.vendors} дэлгүүр
                </Copy>
                <Copy>
                  Үйлчилгээ: барааны үнийн {preview.quote.service_percent}% +{" "}
                  {money(preview.quote.service_fee_mnt)}.
                </Copy>
                {preview.quote.domestic_later && (
                  <Copy>
                    Хятад доторх хүргэлт одоогийн дүнд ороогүй. Бодит зардлаар
                    дараа тооцно.
                  </Copy>
                )}
                <Row label="Одоо төлөх" value={money(preview.quote.total)} />
                <Copy>
                  Карго тээврийг агуулахын бодит жин, эзэлхүүнээр дараа тооцно.
                  Энэ нь үнэгүй хүргэлт гэсэн үг биш.
                </Copy>
                <Copy>
                  Захиалга үүсгэснээс хойш {preview.quote.payment_window_hours}{" "}
                  цагийн дотор QPay-ээр төлнө. Төлбөр дараагийн дэлгэцэд
                  хийгдэнэ.
                </Copy>
                <Button
                  title={money(preview.quote.total) + " · Захиалга үүсгэх"}
                  disabled={
                    busy ||
                    !family.trim() ||
                    !(name ?? customer.name).trim() ||
                    !(phone ?? customer.phone).trim() ||
                    (method === "delivery" &&
                      !(address ?? customer.address).trim())
                  }
                  onPress={() => void submit()}
                />
              </Card>
            </>
          )}
        </>
      )}
      {busy && <Busy />}
    </Page>
  );
}
export default function CheckoutRoute() {
  const { customer } = useStore();
  return <Checkout key={customer?.id || "guest"} />;
}
