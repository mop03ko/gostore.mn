import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Address } from "@/lib/types";
import {
  Page,
  Card,
  Title,
  Copy,
  Field,
  Button,
  ErrorBox,
} from "@/components/ui";
const empty = {
  id: "",
  label: "",
  recipient: "",
  phone: "",
  address: "",
  is_default: false,
};
function Addresses() {
  const { customer, refresh } = useStore();
  const [rows, setRows] = useState<Address[]>([]),
    [form, setForm] = useState(empty),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState("");
  const change = useCallback(
    async (action: string, body?: object) => {
      setBusy(true);
      try {
        const r = await api<{ addresses: Address[] }>(action, body);
        setRows(r.addresses);
        setError("");
        if (body) {
          setForm(empty);
          setDeleting("");
          await refresh();
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );
  useFocusEffect(
    useCallback(() => {
      void change("customer-addresses");
    }, [change]),
  );
  if (!customer)
    return (
      <Page>
        <Button title="Нэвтрэх" onPress={() => router.push("/login")} />
      </Page>
    );
  return (
    <Page>
      <ErrorBox message={error} />
      {rows.map((a) => (
        <Card key={a.id}>
          <Title>
            {a.label}
            {a.is_default ? " · Үндсэн" : ""}
          </Title>
          <Copy>
            {a.recipient} · {a.phone}
          </Copy>
          <Copy>{a.address}</Copy>
          <Button title="Засах" secondary onPress={() => setForm(a)} />
          <Button
            title={deleting === a.id ? "Устгахыг батлах" : "Устгах"}
            secondary
            disabled={busy}
            onPress={() =>
              deleting === a.id
                ? void change("customer-address-delete", { id: a.id })
                : setDeleting(a.id)
            }
          />
        </Card>
      ))}
      <Card>
        <Title>{form.id ? "Хаяг засах" : "Шинэ хаяг"}</Title>
        {(["label", "recipient", "phone", "address"] as const).map((k, i) => (
          <Field
            key={k}
            label={
              ["Хаягийн нэр", "Хүлээн авагч", "Утас", "Дэлгэрэнгүй хаяг"][i]
            }
            value={form[k]}
            onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
            multiline={k === "address"}
            keyboardType={k === "phone" ? "phone-pad" : "default"}
          />
        ))}
        <Button
          title={form.is_default ? "✓ Үндсэн хаяг" : "Үндсэн хаяг болгох"}
          secondary
          onPress={() => setForm((f) => ({ ...f, is_default: !f.is_default }))}
        />
        <Button
          title="Хадгалах"
          disabled={busy || !form.recipient || !form.phone || !form.address}
          onPress={() => void change("customer-address-save", form)}
        />
        {!!form.id && (
          <Button title="Болих" secondary onPress={() => setForm(empty)} />
        )}
      </Card>
    </Page>
  );
}
export default function AddressesRoute() {
  const { customer } = useStore();
  return <Addresses key={customer?.id || "guest"} />;
}
