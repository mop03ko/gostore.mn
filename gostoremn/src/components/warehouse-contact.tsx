import { useState } from "react";
import { Image } from "expo-image";
import { openURL } from "expo-linking";
import { Card, Title, Copy, Button, ErrorBox } from "@/components/ui";

export function WarehouseContact() {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  return <Card>
    <Title>Эрээн агуулахтай холбогдох</Title>
    <Button title={open ? "Orgil · WeChat QR хураах" : "Orgil · WeChat QR харах"} secondary onPress={() => setOpen(!open)} />
    {open && <>
      <Copy>QR зургийг хадгалаад WeChat-аар уншуулж холбогдоорой. Холбогдохдоо ачааны GS кодоо бичнэ үү.</Copy>
      <Image source={require("../../assets/images/erenhot-wechat-orgil.jpg")} contentFit="contain" accessibilityLabel="Orgil-ийн WeChat холбоо барих QR код" style={{ width: "100%", maxWidth: 360, aspectRatio: 820 / 1219, alignSelf: "center", backgroundColor: "white" }} />
      <Button title="QR зургийг браузерт нээх" onPress={() => { setError(""); void openURL("https://gostore.mn/assets/erenhot-wechat-orgil.jpg").catch(() => setError("Зураг нээгдсэнгүй. gostore.mn/self-cargo.html хуудаснаас нээнэ үү.")); }} />
      <Copy>Браузерт зургийг удаан дарж утсандаа хадгалах боломжтой.</Copy>
      <ErrorBox message={error} />
    </>}
  </Card>;
}
