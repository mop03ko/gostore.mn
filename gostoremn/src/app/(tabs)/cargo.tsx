import { useRef, useState } from "react";
import { Image } from "expo-image";
import { openURL } from "expo-linking";
import { router } from "expo-router";
import { Pressable, Text, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CargoAddressCard } from "@/components/cargo-address-card";
import { CargoCalculator } from "@/components/cargo-calculator";
import { BrandLogo, Icon } from "@/components/shop-ui";
import { Busy, Button, Card, Copy, ErrorBox, Page, Title } from "@/components/ui";
import { WarehouseContact } from "@/components/warehouse-contact";
import { useWarehousePreference } from "@/components/warehouse-preference";
import { useSelfCargo } from "@/lib/self-cargo";
import { usePalette } from "@/lib/palette";
import { useStore } from "@/lib/store";

const shops = [
  { name: "Taobao", mark: "淘", url: "https://m.taobao.com/" },
  { name: "1688", mark: "1688", url: "https://www.1688.com/" },
  { name: "Pinduoduo", mark: "拼", url: "https://mobile.yangkeduo.com/" },
  { name: "JD.com", mark: "京东", url: "https://m.jd.com/" },
  { name: "Tmall", mark: "天猫", url: "https://www.tmall.com/" },
];
const guide = [
  { title: "Эрээн хаягаа хуулна", text: "Хүлээн авагч, утас, хаягийг дэлгүүрийн хүргэлтийн хэсэгт оруулна. Нэр, хаяг дахь карго ID-г хэвээр үлдээгээрэй." },
  { title: "Дэлгүүртээ захиална", text: "Барааны үнэ болон Хятад доторх хүргэлтийн төлбөрийг өөрийн сонгосон дэлгүүрт төлнө." },
  { title: "GOStore-д ачаагаа бүртгэнэ", text: "Худалдагчийн хүргэлтийн дугаар (运单号)-ыг нэмээд «Миний ачаа»-аас явц, тээврийн төлбөрөө харна." },
];

export default function CargoTab() {
  const { customer, ready, shipping, error, refresh } = useStore();
  const c = usePalette();
  const { selected, loaded, open } = useWarehousePreference();
  const page = useRef<ScrollViewInstance>(null);
  const guideOffset = useRef(0), calculatorOffset = useRef(0);
  const [shopError, setShopError] = useState("");
  const jumpTo = (y: number) => page.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });

  async function openShop(shop: (typeof shops)[number]) {
    setShopError("");
    try { await openURL(shop.url); }
    catch { setShopError(shop.name + " нээгдсэнгүй. Дахин оролдоно уу."); }
  }

  return <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
    <Page scrollRef={page}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 52 }}>
        <BrandLogo width={105} />
        {!!shipping && <Pressable accessibilityRole="button" accessibilityLabel={"Авах салбар: " + (selected?.name ?? "Сонгоогүй") + ". Сонгох"}
          disabled={!loaded} onPress={open} style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44, maxWidth: "60%",
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: c.surface,
            borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.7 : 1,
          })}>
          <Icon name="pin" size={16} color={c.accentText} />
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <Text style={{ color: c.muted, fontSize: 11 }}>Авах салбар</Text>
            <Text numberOfLines={2} style={{ color: c.navy, fontSize: 12, fontWeight: "700" }}>
              {selected?.city || selected?.name || "Салбараа сонгох"}
            </Text>
          </View>
          <Icon name="chevron" size={13} color={c.muted} />
        </Pressable>}
      </View>

      <View style={{ backgroundColor: "#262261", borderRadius: 19, padding: 12, gap: 10, flexDirection: "row" }}>
        <View style={{ flex: 1, padding: 3, justifyContent: "center", gap: 7 }}>
          <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 23, lineHeight: 27, fontWeight: "800" }}>
            Өөрөө захиал.{"\n"}Бид хүргэе.
          </Text>
          <Text style={{ color: "#e9e4ff", fontSize: 13, lineHeight: 18 }}>
            Хятадын дэлгүүрээс Эрээн хаягаар захиалж, сонгосон салбараасаа аваарай.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => jumpTo(guideOffset.current)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start", opacity: pressed ? 0.65 : 1 })}>
            <Text style={{ color: "#ffba92", fontWeight: "800", fontSize: 14 }}>Хэрхэн эхлэх вэ?</Text>
            <Icon name="chevron" size={15} color="#ffba92" />
          </Pressable>
        </View>
        <Image source={require("../../../assets/images/cargo-packages.webp")} contentFit="cover" contentPosition={{ left: "50%", top: "34%" }}
          accessible={false} style={{ width: "32%", maxWidth: 210, borderRadius: 13, alignSelf: "stretch" }} />
      </View>

      {!ready ? <Busy /> : !shipping ? <ErrorBox message={error} retry={() => void refresh().catch(() => {})} /> : customer
        ? <CustomerCargoAddress key={customer.id} />
        : <Card style={{ borderRadius: 18 }}>
          <Title>Эрээн агуулахын хаяг</Title>
          <Copy>Нэвтэрснээр өөрийн карго ID, хүлээн авагч, утас, хаягаа хуулж болно.</Copy>
          <Button title="Нэвтрэх / Бүртгүүлэх" onPress={() => router.push({ pathname: "/login", params: { next: "/cargo" } })} />
        </Card>}

      {!!customer && <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="Ачаа бүртгэх" onPress={() => router.push({ pathname: "/self-cargo", params: { view: "register" } })} /></View>
        <View style={{ flex: 1 }}><Button title="Миний ачаа" secondary onPress={() => router.push({ pathname: "/self-cargo", params: { view: "shipments" } })} /></View>
      </View>}

      <Card style={{ borderRadius: 17, padding: 12, gap: 8 }}>
        <Title>Хятадын онлайн дэлгүүрүүд</Title>
        <View style={{ flexDirection: "row", gap: 3 }}>
          {shops.map((shop, i) => <Pressable key={shop.name} accessibilityRole="button" accessibilityLabel={shop.name + " нээх"}
            onPress={() => void openShop(shop)} style={({ pressed }) => ({
              flex: 1, minWidth: 0, alignItems: "center", gap: 5, paddingVertical: 4, opacity: pressed ? 0.68 : 1,
            })}>
            <View style={{
              height: 43, width: "88%", maxWidth: 63, borderRadius: 12, alignItems: "center", justifyContent: "center",
              backgroundColor: i % 2 === 0 ? c.accentSurface : c.subtle,
            }}>
              <Text style={{ color: i % 2 === 0 ? c.accentText : c.navy, fontSize: 17, fontWeight: "800" }}>{shop.mark}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.ink, fontSize: 10, fontWeight: "600", textAlign: "center", width: "100%" }}>{shop.name}</Text>
          </Pressable>)}
        </View>
        <ErrorBox message={shopError} />
      </Card>

      <Pressable accessibilityRole="button" onPress={() => jumpTo(calculatorOffset.current)}
        style={({ pressed }) => ({
          flexDirection: "row", gap: 10, alignItems: "center", minHeight: 64, padding: 12, borderRadius: 16,
          backgroundColor: c.accentSurface, opacity: pressed ? 0.7 : 1,
        })}>
        <Icon name="calculator" size={26} color={c.accentText} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", color: c.navy, fontSize: 15 }}>Тээврийн үнэ тооцох</Text>
          <Text style={{ color: c.accentText, fontSize: 12, marginTop: 2 }}>Жин, хэмжээгээр урьдчилсан дүн харна</Text>
        </View>
        <Icon name="chevron" size={16} color={c.accentText} />
      </Pressable>

      <View onLayout={event => { guideOffset.current = event.nativeEvent.layout.y; }}>
        <Card style={{ borderRadius: 18, gap: 10 }}>
          <Title>Захиалах заавар</Title>
          {guide.map((step, index) => <View key={step.title} style={{ flexDirection: "row", alignItems: "flex-start", paddingTop: 8, borderTopWidth: 1, borderColor: c.line, gap: 10 }}>
            <Text style={{ backgroundColor: c.accentSurface, color: c.accentText, minWidth: 25, lineHeight: 25, borderRadius: 6, overflow: "hidden", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{index + 1}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: c.navy, fontWeight: "700", fontSize: 14 }}>{step.title}</Text>
              <Copy>{step.text}</Copy>
            </View>
          </View>)}
        </Card>
      </View>
      <View onLayout={event => { calculatorOffset.current = event.nativeEvent.layout.y; }}>
        <CargoCalculator shipping={shipping} />
      </View>
      <WarehouseContact />
    </Page>
  </SafeAreaView>;
}

function CustomerCargoAddress() {
  const { data, error, refresh } = useSelfCargo();
  if (data) return <CargoAddressCard address={data.delivery} />;
  return <Card style={{ borderRadius: 18 }}>
    <Title>Эрээн агуулахын хаяг</Title>
    {error ? <ErrorBox message={error} retry={() => void refresh()} /> : <Busy />}
  </Card>;
}
