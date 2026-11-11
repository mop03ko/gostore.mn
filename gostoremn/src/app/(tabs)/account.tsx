import { usePalette, type Palette } from "@/lib/palette";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, BrandLogo } from "@/components/shop-ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DiscoveryShelf } from "@/components/discovery";
import type { IconName } from "@/components/shop-ui";
import { MenuRow } from "@/components/account-ui";
import { AnalyticsSettings } from "@/components/analytics-settings";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Page, Card, Copy, Field, Button, Busy, ErrorBox } from "@/components/ui";
function Account() {
  const colors = usePalette(), inset = useSafeAreaInsets();
  const styles = createStyles(colors);
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
  const protectedRoute = (path: "/orders" | "/addresses" | "/notifications" | "/self-cargo") =>
    customer ? router.push(path) : router.push({ pathname: "/login", params: { next: path } });
  return <Page>
    <View style={{ height: inset.top }} />
    <ErrorBox message={bootError} retry={() => void refresh().catch(() => {})} />
    <View testID="account-hero" style={styles.hero}>
      <View pointerEvents="none" style={{ position: "absolute", width: 170, height: 170, borderRadius: 85, right: -45, top: -65, backgroundColor: "#f16522" }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "#ffffffcc", fontWeight: "700", letterSpacing: 2 }}>МИНИЙ GOSTORE</Text>
        <View style={{ flexDirection: "row" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Мэдэгдэл" onPress={() => protectedRoute("/notifications")} style={styles.edit}><Icon name="bell" color="white" /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Тусламж" onPress={() => router.push("/help")} style={styles.edit}><Icon name="help" color="white" /></Pressable>
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.avatar}><Text style={styles.initial}>{customer ? (customer.name.trim()[0] || "G").toUpperCase() : "Go"}</Text></View>
        <View style={{ flex: 1, gap: 6 }}><Text style={styles.name}>{customer?.name || "Тавтай морил!"}</Text><Text style={styles.email}>{customer ? customer.login_phone || customer.email : "Таны сонголт. Таны дэлгүүр."}</Text></View>
      </View>
      {!customer && <Button title="Нэвтрэх / Бүртгүүлэх" onPress={login} />}
    </View>
    <View style={[styles.shortcuts, { backgroundColor: colors.surface, borderRadius: 18, padding: 16 }]}>
      {([{ icon: "cart", title: "Сагс · " + cart.length, action: () => router.navigate("/cart") },
        { icon: "pin", title: "Миний хаяг", action: () => protectedRoute("/addresses") },
        { icon: "bell", title: "Мэдэгдэл", action: () => protectedRoute("/notifications") },
        { icon: "help", title: "Тусламж", action: () => router.push("/help") }] as { icon: IconName; title: string; action: () => void }[]).map(a =>
        <Pressable key={a.title} accessibilityRole="button" onPress={a.action} style={styles.shortcut}><Icon name={a.icon} color={colors.navy} size={26} /><Text style={styles.shortcutLabel}>{a.title}</Text></Pressable>)}
    </View>
    <Card style={{ borderWidth: 0, padding: 16 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Бүх захиалга харах" onPress={() => protectedRoute("/orders")} style={{ flexDirection: "row", alignItems: "center", minHeight: 44, justifyContent: "space-between" }}><Text style={{ color: colors.navy, fontWeight: "800", fontSize: 20 }}>Миний захиалгууд</Text><Icon name="chevron" color={colors.muted} /></Pressable>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {([{ key: "unpaid", icon: "wallet", title: "Төлбөр хүлээж буй" }, { key: "active", icon: "truck", title: "Явцад байгаа" }, { key: "completed", icon: "check", title: "Дууссан" }, { key: "cancelled", icon: "box", title: "Цуцлагдсан" }] as const).map(f =>
          <Pressable key={f.key} accessibilityRole="button" accessibilityLabel={f.title + " захиалга"} onPress={() => router.push({ pathname: "/orders", params: { filter: f.key } })} style={styles.shortcut}><Icon name={f.icon} size={28} color={colors.navy} /><Text style={[styles.shortcutLabel, { textAlign: "center" }]}>{f.title}</Text></Pressable>)}
      </View>
    </Card>
    <Text style={styles.section}>Захиалга ба хүргэлт</Text>
    <Card style={{ gap: 0, paddingVertical: 4 }}>
      <MenuRow icon="truck" title="Өөрөө захиалах · Эрээн карго" subtitle="Агуулахын хаяг авах, ачаагаа бүртгэх" onPress={() => protectedRoute("/self-cargo")} />
      <View style={styles.divider} />
      <MenuRow icon="box" title="Миний захиалгууд" subtitle="Төлбөр, тээврийн явцаа хянах" onPress={() => protectedRoute("/orders")} />
      <View style={styles.divider} />
      <MenuRow icon="pin" title="Хүргэлтийн хаяг" subtitle="Хүлээн авагч, хадгалсан хаягууд" onPress={() => protectedRoute("/addresses")} />
      <View style={styles.divider} />
      <MenuRow icon="bell" title="Захиалгын мэдэгдэл" subtitle="Захиалгын шинэ мэдээллүүд" onPress={() => protectedRoute("/notifications")} />
    </Card>
    <ErrorBox message={error} />
    {!!message && <View accessibilityLiveRegion="polite" style={styles.success}><Icon name="check" color={colors.success} size={18} /><Text style={{ color: colors.success, flex: 1 }}>{message}</Text></View>}
    {customer && <>
      <Text style={styles.section}>Бүртгэлийн тохиргоо</Text>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <MenuRow icon="user" title="Хувийн мэдээлэл" subtitle="Нэр, утасны дугаараа шинэчлэх" expanded={panel === "profile"} onPress={() => toggle("profile")} />
        {panel === "profile" && <View style={styles.form}>
          <Field label="Нэр" value={name ?? customer.name} onChangeText={setName} autoComplete="name" />
          <Field label="Утас" value={phone ?? customer.phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" editable={!customer.pin_enabled} />
          <Button title={busy ? "Хадгалж байна…" : "Өөрчлөлт хадгалах"} disabled={busy || !(name ?? customer.name).trim()}
            onPress={() => void save("customer-profile", { name: (name ?? customer.name).trim(), phone: phone ?? customer.phone })} />
        </View>}
        <View style={styles.divider} />
        <MenuRow icon="shield" title={customer.pin_enabled ? "Нэвтрэх утсаа солих" : "Утас, PIN холбох"} subtitle="SMS-ээр дугаараа баталгаажуулах" onPress={() => router.push({pathname:"/login",params:{mode:"link",next:"/account",phone:customer.phone}})} />
        {customer.pin_enabled && <>
          <MenuRow icon="shield" title="PIN код солих" expanded={panel === "password"} onPress={() => toggle("password")} />
          {panel === "password" && <View style={styles.form}>
            <Field label="Одоогийн PIN" value={old} onChangeText={v=>setOld(v.replace(/[^0-9]/g,"").slice(0,4))} secureTextEntry keyboardType="number-pad" maxLength={4}/>
            <Field label="Шинэ PIN" value={password} onChangeText={v=>setPassword(v.replace(/[^0-9]/g,"").slice(0,4))} secureTextEntry keyboardType="number-pad" maxLength={4}/>
            <Field label="PIN давтах" value={confirm} onChangeText={v=>setConfirm(v.replace(/[^0-9]/g,"").slice(0,4))} secureTextEntry keyboardType="number-pad" maxLength={4}/>
            <Button title="PIN шинэчлэх" disabled={busy || old.length!==4 || password.length!==4 || password!==confirm} onPress={()=>void save("customer-pin-change",{current_pin:old,pin:password,pin_confirm:confirm})}/>
            <Button title="PIN мартсан — SMS-ээр сэргээх" secondary onPress={()=>router.push({pathname:"/login",params:{mode:"reset",phone:customer.login_phone,next:"/account"}})}/>
          </View>}
        </>}
        {!customer.pin_enabled && <><MenuRow icon="shield" title="Нууц үг ба аюулгүй байдал" subtitle="Нэвтрэх нууц үгээ солих" expanded={panel === "password"} onPress={() => toggle("password")} />
        {panel === "password" && <View style={styles.form}>
          <Field label="Одоогийн нууц үг" value={old} onChangeText={setOld} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          <Field label="Шинэ нууц үг" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          <Copy>10-аас доошгүй тэмдэгт ашиглаарай.</Copy>
          <Field label="Шинэ нууц үг давтах" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          {!!confirm && password !== confirm && <Text style={{ color: colors.danger, fontSize: 12 }}>Нууц үгүүд таарахгүй байна.</Text>}
          <Button title={busy ? "Шинэчилж байна…" : "Нууц үг шинэчлэх"} disabled={busy || !old || password.length < 10 || password !== confirm}
            onPress={() => void save("customer-password", { current_password: old, password, password_confirm: confirm })} />
        </View>}</>}
      </Card>
    </>}
    <Text style={styles.section}>Тусламж ба үйлчилгээ</Text>
    <AnalyticsSettings />
    <Card style={{ gap: 0, paddingVertical: 4 }}>
      <MenuRow icon="help" title="Тусламж, үйлчилгээний нөхцөл" subtitle="Хүргэлт, төлбөр, нууцлалын мэдээлэл" onPress={() => router.push("/help")} />
      {customer && <><View style={styles.divider} /><MenuRow icon="close" title="Бүртгэл устгах" danger onPress={() => router.push("/delete-account")} /></>}
    </Card>
    {customer && <Button title={busy ? "Түр хүлээнэ үү…" : "Бүртгэлээс гарах"} secondary disabled={busy} onPress={signOut} />}
    <DiscoveryShelf query="__all__" />
    <View style={styles.footer}><BrandLogo width={120} /><Text style={styles.footerText}>Таны сонголт. Таны дэлгүүр.</Text></View>
  </Page>;
}
export default function AccountRoute() { const { customer } = useStore(); return <Account key={customer?.id || "guest"} />; }
const createStyles = (colors: Palette) => StyleSheet.create({
  hero: { backgroundColor: "#262261", borderRadius: 24, padding: 18, gap: 18, overflow: "hidden" },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 25, fontWeight: "800", color: "#f16522" },
  name: { fontSize: 20, fontWeight: "700", color: "white" }, email: { fontSize: 12, color: "#ffffffcc" },
  edit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  shortcuts: { flexDirection: "row" },
  shortcut: { flex: 1, minHeight: 50, alignItems: "center", gap: 8 },
  shortcutLabel: { color: colors.ink, fontWeight: "600", fontSize: 12 },
  section: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 8, marginLeft: 6 },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 52 },
  form: { paddingTop: 10, paddingBottom: 18, gap: 12 },
  success: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.successSurface, padding: 14, borderRadius: 12 },
  footer: { alignItems: "center", gap: 10, padding: 20 }, footerText: { fontSize: 11, color: colors.muted },
});
