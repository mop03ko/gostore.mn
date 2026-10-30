import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, BrandLogo } from "@/components/shop-ui";
import { MenuRow, EmptyState } from "@/components/account-ui";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Page, Card, Copy, Field, Button, Busy, ErrorBox, colors } from "@/components/ui";
function Account() {
  const { customer, ready, refresh, logout, cart, error: bootError } = useStore();
  const [panel, setPanel] = useState<"profile" | "password" | null>(null);
  const [name, setName] = useState<string | null>(null), [phone, setPhone] = useState<string | null>(null);
  const [old, setOld] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const toggle = (next: "profile" | "password") => { setPanel(panel === next ? null : next); setMessage(""); setError(""); };
  async function save(action: string, body: object) {
    setBusy(true); setMessage(""); setError("");
    try {
      await api(action, body); await refresh();
      setOld(""); setPassword(""); setConfirm("");
      setMessage("Амжилттай хадгаллаа.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function signOut() {
    Alert.alert("Бүртгэлээс гарах уу?", "Та хүссэн үедээ дахин нэвтрэх боломжтой.", [
      { text: "Болих", style: "cancel" },
      { text: "Гарах", style: "destructive", onPress: () => {
        setBusy(true);
        void logout().catch(e => setError(e.message)).finally(() => setBusy(false));
      } },
    ]);
  }
  if (!ready) return <Page><Busy /></Page>;
  const login = () => router.push({ pathname: "/login", params: { next: "/account" } });
  const protectedRoute = (path: "/orders" | "/addresses" | "/notifications") =>
    customer ? router.push(path) : router.push({ pathname: "/login", params: { next: path } });
  return <Page>
    <ErrorBox message={bootError} retry={() => void refresh().catch(() => {})} />
    {customer ? <View style={styles.hero}>
      <View style={styles.identity}>
        <View style={styles.avatar}><Text style={styles.initial}>{(customer.name.trim()[0] || "G").toUpperCase()}</Text></View>
        <View style={{ flex: 1, gap: 5 }}><Text style={styles.name}>{customer.name}</Text><Text style={styles.email}>{customer.email}</Text></View>
        <Pressable onPress={() => toggle("profile")} accessibilityRole="button" accessibilityLabel="Хувийн мэдээлэл засах" style={styles.edit}><Icon name="settings" color="#76513d" /></Pressable>
      </View>
      <View style={styles.shortcuts}>
        <Pressable onPress={() => router.navigate("/cart")} accessibilityRole="button" style={styles.shortcut}><Icon name="cart" color="#a14620" /><Text style={styles.shortcutLabel}>Сагс · {cart.length}</Text></Pressable>
        <Pressable onPress={() => router.navigate("/orders")} accessibilityRole="button" style={styles.shortcut}><Icon name="box" color="#a14620" /><Text style={styles.shortcutLabel}>Захиалга</Text></Pressable>
        <Pressable onPress={() => router.push("/addresses")} accessibilityRole="button" style={styles.shortcut}><Icon name="pin" color="#a14620" /><Text style={styles.shortcutLabel}>Миний хаяг</Text></Pressable>
      </View>
    </View> : <EmptyState icon="user" title="Таны GOStore" description="Бүртгэлээрээ нэвтэрч захиалга, хүргэлт, хаягуудаа нэг дор удирдаарай." action="Нэвтрэх / Бүртгүүлэх" onPress={login} />}
    <Text style={styles.section}>Захиалга ба хүргэлт</Text>
    <Card style={{ gap: 0, paddingVertical: 4 }}>
      <MenuRow icon="box" title="Миний захиалгууд" subtitle="Төлбөр, тээврийн явцаа хянах" onPress={() => protectedRoute("/orders")} />
      <View style={styles.divider} />
      <MenuRow icon="pin" title="Хүргэлтийн хаяг" subtitle="Хүлээн авагч, хадгалсан хаягууд" onPress={() => protectedRoute("/addresses")} />
      <View style={styles.divider} />
      <MenuRow icon="bell" title="Захиалгын мэдэгдэл" subtitle="Захиалгын шинэ мэдээллүүд" onPress={() => protectedRoute("/notifications")} />
    </Card>
    <ErrorBox message={error} />
    {!!message && <View accessibilityLiveRegion="polite" style={styles.success}><Icon name="check" color="#276444" size={18} /><Text style={{ color: "#276444", flex: 1 }}>{message}</Text></View>}
    {customer && <>
      <Text style={styles.section}>Бүртгэлийн тохиргоо</Text>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <MenuRow icon="user" title="Хувийн мэдээлэл" subtitle="Нэр, утасны дугаараа шинэчлэх" expanded={panel === "profile"} onPress={() => toggle("profile")} />
        {panel === "profile" && <View style={styles.form}>
          <Field label="Нэр" value={name ?? customer.name} onChangeText={setName} autoComplete="name" />
          <Field label="Утас" value={phone ?? customer.phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          <Button title={busy ? "Хадгалж байна…" : "Өөрчлөлт хадгалах"} disabled={busy || !(name ?? customer.name).trim()}
            onPress={() => void save("customer-profile", { name: (name ?? customer.name).trim(), phone: phone ?? customer.phone })} />
        </View>}
        <View style={styles.divider} />
        <MenuRow icon="shield" title="Нууц үг ба аюулгүй байдал" subtitle="Нэвтрэх нууц үгээ солих" expanded={panel === "password"} onPress={() => toggle("password")} />
        {panel === "password" && <View style={styles.form}>
          <Field label="Одоогийн нууц үг" value={old} onChangeText={setOld} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          <Field label="Шинэ нууц үг" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          <Copy>10-аас доошгүй тэмдэгт ашиглаарай.</Copy>
          <Field label="Шинэ нууц үг давтах" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          {!!confirm && password !== confirm && <Text style={{ color: "#b33128", fontSize: 12 }}>Нууц үгүүд таарахгүй байна.</Text>}
          <Button title={busy ? "Шинэчилж байна…" : "Нууц үг шинэчлэх"} disabled={busy || !old || password.length < 10 || password !== confirm}
            onPress={() => void save("customer-password", { current_password: old, password, password_confirm: confirm })} />
        </View>}
      </Card>
    </>}
    <Text style={styles.section}>Тусламж ба үйлчилгээ</Text>
    <Card style={{ gap: 0, paddingVertical: 4 }}>
      <MenuRow icon="help" title="Тусламж, үйлчилгээний нөхцөл" subtitle="Хүргэлт, төлбөр, нууцлалын мэдээлэл" onPress={() => router.push("/help")} />
      {customer && <><View style={styles.divider} /><MenuRow icon="close" title="Бүртгэл устгах" danger onPress={() => router.push("/delete-account")} /></>}
    </Card>
    {customer && <Button title={busy ? "Түр хүлээнэ үү…" : "Бүртгэлээс гарах"} secondary disabled={busy} onPress={signOut} />}
    <View style={styles.footer}><BrandLogo width={120} /><Text style={styles.footerText}>Таны сонголт. Таны дэлгүүр.</Text></View>
  </Page>;
}
export default function AccountRoute() { const { customer } = useStore(); return <Account key={customer?.id || "guest"} />; }
const styles = StyleSheet.create({
  hero: { backgroundColor: "#fff0e6", borderRadius: 22, padding: 18, gap: 20 },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 25, fontWeight: "800", color: "#a14620" },
  name: { fontSize: 20, fontWeight: "700", color: colors.ink }, email: { fontSize: 12, color: "#785c4c" },
  edit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  shortcuts: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#f5d7c6", paddingTop: 16 },
  shortcut: { flex: 1, minHeight: 50, alignItems: "center", gap: 8 },
  shortcutLabel: { color: "#714b36", fontWeight: "600", fontSize: 12 },
  section: { color: "#67636e", fontSize: 12, fontWeight: "700", marginTop: 8, marginLeft: 6 },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 52 },
  form: { paddingTop: 10, paddingBottom: 18, gap: 12 },
  success: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#eaf6ef", padding: 14, borderRadius: 12 },
  footer: { alignItems: "center", gap: 10, padding: 20 }, footerText: { fontSize: 11, color: colors.muted },
});
