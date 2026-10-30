import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/shop-ui";
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
  const { customer, ready, refresh, logout, cart } = useStore();
  const [details, setDetails] = useState(false);
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
      <Card style={{ backgroundColor: "#fff0e5", borderWidth: 0, padding: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: "#ffd8bf",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 26, fontWeight: "800", color: "#a43800" }}>
              {customer.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Title>{customer.name}</Title>
            <Text style={{ fontSize: 12, color: "#8c6c5c" }}>
              Миний GOStore
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Хувийн мэдээлэл засах"
            onPress={() => setDetails(!details)}
            style={{ padding: 10 }}
          >
            <Icon name="settings" />
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingTop: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/cart")}
            style={{ minHeight: 44, alignItems: "center", gap: 5 }}
          >
            <Text style={{ fontWeight: "800", fontSize: 22 }}>
              {cart.length}
            </Text>
            <Text style={{ fontSize: 12 }}>Сагсанд</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/orders")}
            style={{ minHeight: 44, alignItems: "center", gap: 5 }}
          >
            <Icon name="box" />
            <Text style={{ fontSize: 12 }}>Захиалгууд</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/addresses")}
            style={{ minHeight: 44, alignItems: "center", gap: 5 }}
          >
            <Icon name="home" />
            <Text style={{ fontSize: 12 }}>Хаягууд</Text>
          </Pressable>
        </View>
      </Card>
      <Card>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title>Миний захиалгууд</Title>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/orders")}
            style={{ padding: 10 }}
          >
            <Text style={{ fontSize: 12 }}>Бүгдийг үзэх ›</Text>
          </Pressable>
        </View>
        <Copy>
          Төлбөр, тээврийн явц, агуулахад ирсэн бараагаа нэг дор хянаарай.
        </Copy>
        <Button
          title="Захиалгууд харах"
          secondary
          onPress={() => router.push("/orders")}
        />
      </Card>
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
      <Button
        title={details ? "Хувийн мэдээллийг хураах" : "Хувийн мэдээлэл засах"}
        secondary
        onPress={() => setDetails(!details)}
      />
      {details && (
        <>
          <Card>
            <Title>Хувийн мэдээлэл</Title>
            <Copy>{customer.email}</Copy>
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
        </>
      )}
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
