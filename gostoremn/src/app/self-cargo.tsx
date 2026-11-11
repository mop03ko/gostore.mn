import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { statusName } from "@/lib/orders";
import { Page, Card, Title, Copy, Field, Button, Busy, ErrorBox } from "@/components/ui";

type Cargo = Order & { warehouse: { label: string }; inbound?: { numbers: { no: string; company: string }[] } };

export default function CargoRoute() {
  const { customer, ready } = useStore();
  if (!ready) return <Page><Busy /></Page>;
  if (!customer) return <Page><Copy>Ачаагаа өөрийн бүртгэлтэй холбоно.</Copy><Button title="Нэвтрэх / Бүртгүүлэх" onPress={() => router.push({ pathname: "/login", params: { next: "/self-cargo" } })} /></Page>;
  return <CargoScreen key={customer.id} owner={customer.id} initialPhone={customer.phone} />;
}

function CargoScreen({ owner, initialPhone }: { owner: string; initialPhone: string }) {
  const [orders, setOrders] = useState<Cargo[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(""), [qty, setQty] = useState("1"), [phone, setPhone] = useState(initialPhone), [note, setNote] = useState("");
  const lock = useRef(false), requestKey = useRef("");
  const load = useCallback(async () => {
    const result = await api<{ orders: Cargo[] }>("customer-self-cargo"); setOrders(result.orders);
  }, []);
  useFocusEffect(useCallback(() => { let active = true; void api<{ orders: Cargo[] }>("customer-self-cargo").then(r => { if (active) setOrders(r.orders); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []));
  async function create() {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const me = await api<{ customer: { id: string } | null }>("customer-me");
      if (me.customer?.id !== owner) throw Error("Бүртгэл өөрчлөгдсөн. Дахин нэвтэрнэ үү.");
      requestKey.current ||= randomUUID();
      const result = await api<{ order: Cargo }>("customer-self-cargo-create", { title, qty: Number(qty), phone, note, request_key: requestKey.current });
      setOrders(old => [result.order, ...old.filter(o => o.id !== result.order.id)]);
      requestKey.current = ""; setTitle(""); setQty("1"); setNote("");
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Page>
    <Card><Title>Хятадаас өөрөө худалдан аваад тээвэрлүүлээрэй</Title><Copy>1. Ачаагаа бүртгэж GS код, агуулахын хаяг авна.</Copy><Copy>2. Худалдагчид кодтой хаягаа өгч, хүргэлтийн дугаараа энд нэмнэ.</Copy><Copy>3. Агуулахад ирэхэд зураг, хэмжилт, явцыг хянаж тээврийн төлбөрөө төлнө.</Copy></Card>
    <Card><Title>Шинэ ачаа</Title><Copy>Барааны үнэ, Хятад доторх хүргэлтийг та худалдагчид өөрөө төлнө. GOStore-д тээвэрлүүлэх ачаагаа бүртгэнэ.</Copy>
      <Field label="Барааны нэр" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
      <Field label="Нийт барааны тоо ширхэг" value={qty} onChangeText={setQty} keyboardType="number-pad" maxLength={5} editable={!busy} />
      <Field label="Холбоо барих утас" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} editable={!busy} />
      <Field label="Тайлбар / өнгө / хэмжээ" value={note} onChangeText={setNote} maxLength={500} multiline editable={!busy} />
      <ErrorBox message={error} /><Button title={busy ? "Бүртгэж байна…" : "Код болон агуулахын хаяг авах"} disabled={busy || !title.trim() || !phone.trim() || !/^\d+$/.test(qty) || Number(qty) < 1 || Number(qty) > 10000} onPress={() => void create()} />
    </Card>
    <Title>Миний өөрөө захиалсан ачаа</Title>
    <Button title="Шинэчлэх" secondary disabled={busy} onPress={() => void load().then(() => setError("")).catch(e => setError(e.message))} />
    {!orders.length && <Copy>Ачаа бүртгэсний дараа кодтой хаяг энд харагдана.</Copy>}
    {orders.map(o => <CargoCard key={o.id} order={o} owner={owner} update={next => setOrders(old => old.map(x => x.id === next.id ? next : x))} />)}
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
    <Copy>Доорх хаягийг удаан дарж хуулна уу. Хүлээн авагчийн GS кодыг хэвээр үлдээнэ.</Copy><Copy>{o.warehouse.label}</Copy>
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
