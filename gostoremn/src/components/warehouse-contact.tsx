import { useState } from "react";
import { Platform, View } from "react-native";
import { Image } from "expo-image";
import { openURL } from "expo-linking";
import { Card, Title, Copy, Button, ErrorBox } from "@/components/ui";

const qrImageUrl = "https://gostore.mn/assets/erenhot-wechat-orgil.jpg";

export function WarehouseContact() {
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState("");

  async function openWeChat() {
    setError("");
    // Browsers can't report whether a handler was installed for a custom scheme.
    if (Platform.OS === "web") setShowQr(true);
    try {
      await openURL("weixin://scanqrcode");
    } catch {
      setShowQr(true);
      setError("WeChat нээгдсэнгүй. Апп суулгасан эсэхээ шалгаад QR кодоор холбогдоорой.");
    }
  }

  return <Card>
    <Title>Эрээн агуулахтай холбогдох</Title>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Button title="WeChat нээх" onPress={() => void openWeChat()} />
      </View>
      <View style={{ flex: 1 }}>
        <Button title={showQr ? "QR хураах" : "QR код харах"} secondary onPress={() => { setShowQr(!showQr); setError(""); }} />
      </View>
    </View>
    <ErrorBox message={error} />
    {showQr && <>
      <Copy>Orgil-той холбогдохын тулд QR зургаа хадгалаад WeChat-ын «Scan» цэснээс цомгийн зургаа сонгоорой. Ачааны талаар асуухдаа GS кодоо бичнэ үү.</Copy>
      <Image source={require("../../assets/images/erenhot-wechat-orgil.jpg")} contentFit="contain"
        accessibilityLabel="Orgil-ийн WeChat холбоо барих QR код"
        style={{ width: "100%", maxWidth: 360, aspectRatio: 820 / 1219, alignSelf: "center", backgroundColor: "white" }} />
      <Button title="QR зургийг браузерт нээх" secondary onPress={() => {
        setError("");
        void openURL(qrImageUrl).catch(() => setError("Зураг нээгдсэнгүй. Дээрх QR кодын дэлгэцийн зургийг аваарай."));
      }} />
      <Copy>Браузерт зургийг удаан дарж утсандаа хадгална.</Copy>
    </>}
  </Card>;
}
