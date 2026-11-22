import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { CargoAddressCard } from "@/components/cargo-address-card";
import { CargoCalculator } from "@/components/cargo-calculator";
import { Icon } from "@/components/shop-ui";
import { Busy, Button, Card, Copy, ErrorBox, Page, Title } from "@/components/ui";
import { WarehouseContact } from "@/components/warehouse-contact";
import { useWarehousePreference } from "@/components/warehouse-preference";
import { useSelfCargo } from "@/lib/self-cargo";
import { usePalette } from "@/lib/palette";
import { useStore } from "@/lib/store";

export default function CargoTab() {
  const { customer, ready, shipping, error, refresh } = useStore();
  const c = usePalette();
  const { selected, loaded, open } = useWarehousePreference();
  return <Page>
    <View style={{ padding: 16, borderRadius: 20, gap: 9, backgroundColor: c.accentSurface }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="truck" color={c.accentText} size={31} />
        <Text accessibilityRole="header" style={{ color: c.navy, fontSize: 25, fontWeight: "800", flexShrink: 1 }}>GOStore Карго</Text>
      </View>
      <Text style={{ color: c.ink, fontSize: 14, lineHeight: 21 }}>Хятад дотор хүргэлттэй дурын онлайн дэлгүүрээс Эрээн агуулахын хаягаар захиалаарай. Бид таны сонгосон салбарт хүргэнэ.</Text>
      <Text style={{ color: c.accentText, fontSize: 13, fontWeight: "700" }}>Taobao · 1688 · Pinduoduo · JD.com</Text>
    </View>
    {!ready ? <Busy /> : !shipping ? <ErrorBox message={error} retry={() => void refresh().catch(() => {})} /> : customer
      ? <CustomerCargoAddress key={customer.id} />
      : <Card style={{ borderRadius: 20 }}>
        <Title>Эрээн агуулахын хаяг</Title>
        <Copy>Нэвтэрснээр өөрийн карго ID, хүлээн авагч, утас, хаягаа хуулж болно.</Copy>
        <Button title="Нэвтрэх / Бүртгүүлэх" onPress={() => router.push({ pathname: "/login", params: { next: "/cargo" } })} />
      </Card>}
    {!!shipping && <Pressable accessibilityRole="button" accessibilityLabel={"Авах салбар: " + (selected?.name ?? "Сонгоогүй") + ". Сонгох"} disabled={!loaded}
      onPress={open} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 9, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, padding: 12, opacity: pressed ? 0.75 : 1 })}>
      <Icon name="pin" size={20} color={c.accentText} />
      <View style={{ flex: 1 }}><Text style={{ color: c.muted, fontSize: 12 }}>Авах салбар</Text><Text style={{ color: c.navy, fontSize: 14, fontWeight: "700" }}>{selected?.name ?? "Салбараа сонгох"}</Text></View>
      <Icon name="chevron" size={16} color={c.muted} />
    </Pressable>}
    {!!customer && <View style={{ flexDirection: "row", gap: 8 }}>
      {([{ view: "register", label: "Ачаа бүртгэх" }, { view: "shipments", label: "Миний ачаа" }] as const).map(action =>
        <View key={action.view} style={{ flex: 1, minWidth: 0 }}>
          <Button title={action.label} secondary={action.view === "shipments"} onPress={() => router.push({ pathname: "/self-cargo", params: { view: action.view } })} />
        </View>)}
    </View>}
    <CargoCalculator shipping={shipping} />
    <Card style={{ borderRadius: 20, gap: 8 }}>
      <Title>Хэрхэн захиалах вэ?</Title>
      <Copy>1. Эрээн агуулахын хаяг, утас, хүлээн авагчийг дэлгүүрийн хүргэлтийн хэсэгт оруулна. Хаяг, нэр дэх ID-г хэвээр үлдээгээрэй.</Copy>
      <Copy>2. Бараа болон Хятад доторх хүргэлтийн төлбөрийг дэлгүүртээ төлнө.</Copy>
      <Copy>3. GOStore-д ачаагаа бүртгээд худалдагчийн өгсөн хүргэлтийн дугаар (运单号)-ыг нэмнэ. Явц, тээврийн төлбөрөө «Миний ачаа»-аас харна.</Copy>
    </Card>
    <WarehouseContact />
  </Page>;
}

function CustomerCargoAddress() {
  const { data, error, refresh } = useSelfCargo();
  if (data) return <CargoAddressCard address={data.delivery} />;
  return <Card style={{ borderRadius: 20 }}>
    <Title>Эрээн агуулахын хаяг</Title>
    {error ? <ErrorBox message={error} retry={() => void refresh()} /> : <Busy />}
  </Card>;
}
