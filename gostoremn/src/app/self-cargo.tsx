import { useWarehousePreference, WarehousePreferenceCard } from "@/components/warehouse-preference";
import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useSelfCargo, type SelfCargoOrder } from "@/lib/self-cargo";
import { statusName } from "@/lib/orders";
import { Page, Card, Title, Copy, Field, Button, Busy, ErrorBox } from "@/components/ui";

export default function CargoRoute() {
  const { customer, ready } = useStore();
  const { view } = useLocalSearchParams<{ view?: string }>();
  if (!ready) return <Page><Busy /></Page>;
  if (!customer) return <Page><Title>Карго ачаа</Title><Copy>Ачаагаа бүртгэх, явцаа хянахын тулд нэвтэрнэ үү.</Copy><Button title="Нэвтрэх / Бүртгүүлэх" onPress={() => router.push({ pathname: "/login", params: { next: "/self-cargo" } })} /></Page>;
  return <CargoScreen key={customer.id} owner={customer.id} initialPhone={customer.phone} view={view} />;
}

function CargoScreen({ owner, initialPhone, view }: { owner: string; initialPhone: string; view?: string }) {
  const { selected: pickup } = useWarehousePreference();
  const showForm = view !== "shipments", showShipments = view !== "register";
  const { data, error: shipmentError, loading, refresh } = useSelfCargo(showShipments);
  const orders = data?.orders ?? [];
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(""), [qty, setQty] = useState("1"), [phone, setPhone] = useState(initialPhone), [note, setNote] = useState("");
  const [number, setNumber] = useState(""), [company, setCompany] = useState("");
  const lock = useRef(false), requestKey = useRef("");
  async function create() {
    if (!pickup) { setError("Авах агуулахаа сонгоно уу."); return; }
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const me = await api<{ customer: { id: string } | null }>("customer-me");
      if (me.customer?.id !== owner) throw Error("Бүртгэл өөрчлөгдсөн. Дахин нэвтэрнэ үү.");
      requestKey.current ||= randomUUID();
      await api("customer-self-cargo-create", { title, qty: Number(qty), phone, note, pickup_location: pickup.location, number: number.trim(), company, request_key: requestKey.current });
      requestKey.current = ""; setTitle(""); setQty("1"); setNote(""); setNumber(""); setCompany("");
      if (!showShipments) router.replace({ pathname: "/self-cargo", params: { view: "shipments" } });
      else void refresh();
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Page>
    {showForm && <>
    <WarehousePreferenceCard disabled={busy} />
    <Card><Title>Ачаа бүртгэх</Title><Copy>Барааны үнэ, Хятад доторх хүргэлтийг та худалдагчид өөрөө төлнө. GOStore-д тээвэрлүүлэх ачаагаа бүртгэнэ.</Copy>
      <Field label="Барааны нэр" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
      <Field label="Нийт барааны тоо ширхэг" value={qty} onChangeText={setQty} keyboardType="number-pad" maxLength={5} editable={!busy} />
      <Field label="Холбоо барих утас" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} editable={!busy} />
      <Field label="Хятадын хүргэлтийн дугаар (байгаа бол)" value={number} onChangeText={setNumber} autoCapitalize="characters" autoCorrect={false} maxLength={40} editable={!busy} placeholder="YT1234567890123" />
      <Copy>Худалдагч хараахан илгээгээгүй бол дараа нэмээрэй. Дэлгүүрийн захиалгын дугаараас ялгаатай.</Copy>
      <Field label="Хүргэлтийн компани (сонголтоор)" value={company} onChangeText={setCompany} maxLength={80} editable={!busy} />
      <Field label="Тайлбар / өнгө / хэмжээ" value={note} onChangeText={setNote} maxLength={500} multiline editable={!busy} />
      <ErrorBox message={error} /><Button title={busy ? "Бүртгэж байна…" : "Ачаа бүртгэх"} disabled={busy || !pickup || !title.trim() || !phone.trim() || !/^\d+$/.test(qty) || Number(qty) < 1 || Number(qty) > 10000 || (!!number.trim() && !/^[A-Z0-9-]{6,40}$/i.test(number.trim()))} onPress={() => void create()} />
    </Card>
    </>}
    {showShipments && <>
      <Title>Миний өөрөө захиалсан ачаа</Title>
      {loading ? <Busy /> : <>
        <Button title="Шинэчлэх" secondary onPress={() => void refresh()} />
        <ErrorBox message={shipmentError} />
        {!orders.length && !shipmentError && <Copy>Одоогоор ачаа бүртгээгүй байна.</Copy>}
        {orders.map(o => <CargoCard key={o.id} order={o} owner={owner} update={() => void refresh()} />)}
      </>}
    </>}
    <Button title="Эрээн агуулахын хаяг, тариф харах" secondary onPress={() => router.navigate("/cargo")} />
  </Page>;
}

function CargoCard({ order: o, owner, update }: { order: SelfCargoOrder; owner: string; update: () => void }) {
  const [number, setNumber] = useState(""), [company, setCompany] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function add() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const me = await api<{ customer: { id: string } | null }>("customer-me");
      if (me.customer?.id !== owner) throw Error("Бүртгэл өөрчлөгдсөн. Дахин нэвтэрнэ үү.");
      await api("customer-self-cargo-tracking", { id: o.id, number: number.trim(), company });
      update(); setNumber(""); setCompany("");
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Card><Title>{o.id} · {o.title}</Title><Copy>{o.status === "confirmed" ? "Бүртгэгдсэн · хүргэлтийн дугаар хүлээж байна" : statusName(o.status)}</Copy>
    {!!o.warehouse_names?.ulaanbaatar && <Copy>Авах агуулах: {o.warehouse_names.ulaanbaatar}</Copy>}
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
