import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import {
  Page,
  Card,
  Title,
  Copy,
  Field,
  Button,
  Busy,
  ErrorBox,
} from "@/components/ui";
function Account() {
  const { customer, ready, refresh, logout } = useStore();
  const [name, setName] = useState<string | null>(null),
    [phone, setPhone] = useState<string | null>(null),
    [old, setOld] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(action: string, body: object) {
    setBusy(true);
    setMessage("");
    try {
      await api(action, body);
      await refresh();
      setOld("");
      setPassword("");
      setConfirm("");
      setError("");
      setMessage("Амжилттай хадгаллаа.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <Page>
        <Busy />
      </Page>
    );
  if (!customer)
    return (
      <Page>
        <Title>Миний бүртгэл</Title>
        <Copy>Сайтын бүртгэлээрээ нэвтрээрэй.</Copy>
        <Button
          title="Нэвтрэх / Бүртгүүлэх"
          onPress={() => router.push("/login")}
        />
        <Button
          title="Тусламж"
          secondary
          onPress={() => router.push("/help")}
        />
      </Page>
    );
  return (
    <Page>
      <Title>{customer.name}</Title>
      <Copy>{customer.email}</Copy>
      <ErrorBox message={error} />
      {!!message && <Copy>{message}</Copy>}
      <Button
        title="Миний хаягууд"
        secondary
        onPress={() => router.push("/addresses")}
      />
      <Button
        title="Захиалгын мэдэгдлүүд"
        secondary
        onPress={() => router.push("/notifications")}
      />
      <Card>
        <Title>Хувийн мэдээлэл</Title>
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
          title="Хадгалах"
          disabled={busy}
          onPress={() =>
            void save("customer-profile", {
              name: name ?? customer.name,
              phone: phone ?? customer.phone,
            })
          }
        />
      </Card>
      <Card>
        <Title>Нууц үг солих</Title>
        <Field
          label="Одоогийн нууц үг"
          value={old}
          onChangeText={setOld}
          secureTextEntry
        />
        <Field
          label="Шинэ нууц үг"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Field
          label="Шинэ нууц үг давтах"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        <Button
          title="Нууц үг шинэчлэх"
          disabled={
            busy || !old || password.length < 10 || password !== confirm
          }
          onPress={() =>
            void save("customer-password", {
              current_password: old,
              password,
              password_confirm: confirm,
            })
          }
        />
      </Card>
      <Button
        title="Тусламж, нууцлал"
        secondary
        onPress={() => router.push("/help")}
      />
      <Button
        title="Бүртгэл устгах"
        secondary
        onPress={() => router.push("/delete-account")}
      />
      <Button
        title="Гарах"
        secondary
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void logout()
            .then(() => {
              setName(null);
              setPhone(null);
              setOld("");
              setPassword("");
              setConfirm("");
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      />
    </Page>
  );
}
export default function AccountRoute() {
  const { customer } = useStore();
  return <Account key={customer?.id || "guest"} />;
}
