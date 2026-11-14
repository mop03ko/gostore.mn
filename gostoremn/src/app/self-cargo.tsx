import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { usePalette } from "@/lib/palette";
import { CargoAddressCard, type CargoAddress } from "@/components/cargo-address-card";
import { randomUUID } from "expo-crypto";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { statusName } from "@/lib/orders";
import { Page, Card, Title, Copy, Field, Button, Busy, ErrorBox } from "@/components/ui";
import { SelfCargoGuide } from "@/components/self-cargo-entry";
import { WarehouseContact } from "@/components/warehouse-contact";

type Cargo = Order & { cargo_id?: string; warehouse: { label: string }; inbound?: { numbers: { no: string; company: string }[] } };

export default function CargoRoute() {
  const { customer, ready } = useStore();
  if (!ready) return <Page><Busy /></Page>;
  if (!customer) return <Page><Title>Өөрөө захиал, бид хүргэе</Title><SelfCargoGuide /><Copy>Утасны дугаараараа нэвтрээд өөрийн карго ID, хаягаа аваарай.</Copy><Button title="Нэвтрэх / Бүртгүүлэх" onPress={() => router.push({ pathname: "/login", params: { next: "/self-cargo" } })} /><WarehouseContact /></Page>;
  return <CargoScreen key={customer.id} owner={customer.id} initialPhone={customer.phone} />;
}

function CargoScreen({ owner, initialPhone }: { owner: string; initialPhone: string }) {
  const colors = usePalette();
  const [delivery, setDelivery] = useState<CargoAddress | null>(null);
  const [orders, setOrders] = useState<Cargo[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(""), [qty, setQty] = useState("1"), [phone, setPhone] = useState(initialPhone), [note, setNote] = useState("");
  const [number, setNumber] = useState(""), [company, setCompany] = useState("");
  const lock = useRef(false), requestKey = useRef("");
  const load = useCallback(async () => {
    const result = await api<{ orders: Cargo[]; delivery: CargoAddress }>("customer-self-cargo"); setOrders(result.orders); setDelivery(result.delivery);
  }, []);
  useFocusEffect(useCallback(() => { let active = true; void api<{ orders: Cargo[]; delivery: CargoAddress }>("customer-self-cargo").then(r => { if (active) { setOrders(r.orders); setDelivery(r.delivery); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []));
  async function create() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const me = await api<{ customer: { id: string } | null }>("customer-me");
      if (me.customer?.id !== owner) throw Error("Бүртгэл өөрчлөгдсөн. Дахин нэвтэрнэ үү.");
      requestKey.current ||= randomUUID();
      const result = await api<{ order: Cargo }>("customer-self-cargo-create", { title, qty: Number(qty), phone, note, number: number.trim(), company, request_key: requestKey.current });
      setOrders(old => [result.order, ...old.filter(o => o.id !== result.order.id)]);
      requestKey.current = ""; setTitle(""); setQty("1"); setNote(""); setNumber(""); setCompany("");
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Page>
    <View style={{ padding: 24, borderRadius: 24, gap: 12, backgroundColor: colors.accentSurface }}>
      <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 12 }}>GOSTORE КАРГО · ЭРЭЭН → УЛААНБААТАР</Text>
      <Text style={{ color: colors.navy, fontSize: 30, fontWeight: "800", lineHeight: 36 }}>{"Та захиал,\nбид тээвэрлэе."}</Text>
      <Copy>Хятадаас өөрөө худалдан аваад өөрийн карго ID-гаар хүлээн аваарай.</Copy>
    </View>
    {delivery ? <CargoAddressCard address={delivery} /> : !error && <Busy />}
    <SelfCargoGuide />
    <Card><Title>Шинэ ачаа</Title><Copy>Барааны үнэ, Хятад доторх хүргэлтийг та худалдагчид өөрөө төлнө. GOStore-д тээвэрлүүлэх ачаагаа бүртгэнэ.</Copy>
      <Field label="Барааны нэр" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
      <Field label="Нийт барааны тоо ширхэг" value={qty} onChangeText={setQty} keyboardType="number-pad" maxLength={5} editable={!busy} />
      <Field label="Холбоо барих утас" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} editable={!busy} />
      <Field label="Хятадын хүргэлтийн дугаар (байгаа бол)" value={number} onChangeText={setNumber} autoCapitalize="characters" autoCorrect={false} maxLength={40} editable={!busy} placeholder="YT1234567890123" />
      <Copy>Худалдагч хараахан илгээгээгүй бол дараа нэмээрэй. Дэлгүүрийн захиалгын дугаараас ялгаатай.</Copy>
      <Field label="Хүргэлтийн компани (сонголтоор)" value={company} onChangeText={setCompany} maxLength={80} editable={!busy} />
      <Field label="Тайлбар / өнгө / хэмжээ" value={note} onChangeText={setNote} maxLength={500} multiline editable={!busy} />
      <ErrorBox message={error} /><Button title={busy ? "Бүртгэж байна…" : "Ачаа бүртгэх"} disabled={busy || !title.trim() || !phone.trim() || !/^\d+$/.test(qty) || Number(qty) < 1 || Number(qty) > 10000 || (!!number.trim() && !/^[A-Z0-9-]{6,40}$/i.test(number.trim()))} onPress={() => void create()} />
    </Card>
    <Title>Миний өөрөө захиалсан ачаа</Title>
    <Button title="Шинэчлэх" secondary disabled={busy} onPress={() => void load().then(() => setError("")).catch(e => setError(e.message))} />
    {!orders.length && <Copy>Одоогоор ачаа бүртгээгүй байна. Таны карго ID дээрх картанд бэлэн байна.</Copy>}
    {orders.map(o => <CargoCard key={o.id} order={o} owner={owner} update={next => setOrders(old => old.map(x => x.id === next.id ? next : x))} />)}
    <WarehouseContact />
  </Page>;
}

function CargoCard({ order: o, owner, update }: { order: Cargo; owner: string; update: (o: Cargo) => void }) {
  const [number, setNumber] = useState(""), [company, setCompany] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function add() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const me = await api<{ customer: { id: string } | null }>("customer-me");
      if (me.customer?.id !== owner) throw Error("Бүртгэл өөрчлөгдсөн. Дахин нэвтэрнэ үү.");
      const r = await api<{ order: Cargo }>("customer-self-cargo-tracking", { id: o.id, number: number.trim(), company });
      update(r.order); setNumber(""); setCompany("");
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Card><Title>{o.id} · {o.title}</Title><Copy>{o.status === "confirmed" ? "Бүртгэгдсэн · хүргэлтийн дугаар хүлээж байна" : statusName(o.status)}</Copy>
    <Copy>{o.cargo_id ? "Карго ID: " + o.cargo_id : "Өмнө бүртгэсэн ачааны хаяг"}</Copy><Copy>Доорх хаягийг удаан дарж хуулна уу. Хаягт байгаа кодыг хэвээр үлдээнэ.</Copy><Copy>{o.warehouse.label}</Copy>
    <Copy>Хүргэлт: {o.inbound?.numbers?.map(n => n.no + " " + n.company).join(" · ") || "Дугаар хараахан нэмээгүй"}</Copy>
    {["confirmed", "shipping"].includes(o.status) && <>
      <Field label="Хятадын хүргэлтийн дугаар" value={number} onChangeText={setNumber} autoCapitalize="characters" autoCorrect={false} maxLength={40} editable={!busy} />
      <Field label="Хүргэлтийн компани (сонголтоор)" value={company} onChangeText={setCompany} maxLength={80} editable={!busy} />
      <ErrorBox message={error} /><Button title="Дугаар нэмэх" secondary disabled={busy || !/^[A-Z0-9-]{6,40}$/i.test(number.trim())} onPress={() => void add()} />
    </>}
    <Copy>Тээврийн үнийг агуулахад хэмжиж баталгаажуулна.</Copy>
    <Button title="Явц, агуулахын зураг, төлбөр" onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })} />
  </Card>;
}
