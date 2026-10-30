import { useState } from "react";
import { Linking } from "react-native";
import { useStore } from "@/lib/store";
import { Page, Card, Title, Copy, Button, ErrorBox } from "@/components/ui";
export default function Help() {
  const { shipping } = useStore(),
    [error, setError] = useState("");
  const open = (url: string) => {
    void Linking.openURL(url).catch(() =>
      setError("Холбоос нээгдсэнгүй. Дахин оролдоно уу."),
    );
  };
  return (
    <Page>
      <ErrorBox message={error} />
      <Title>GOStore · Тусламж</Title>
      <Card>
        <Title>Хэрхэн захиалах вэ?</Title>
        <Copy>
          1. Бараа, хувилбар, тоогоо сонгож сагсанд нэмнэ.{"\n"}2. Нэвтэрч
          хүлээн авагч, хүргэлтийн хэлбэрээ сонгоно.{"\n"}3. Үнэ, Хятад хүргэлт,
          үйлчилгээний тооцоог шалгаад захиалга үүсгэнэ.{"\n"}4. QPay-ээр төлж,
          «Төлбөр шалгах» товч дарна.{"\n"}5. Захиалгаа аппын «Захиалга» хэсгээс
          хянана.
        </Copy>
      </Card>
      <Card>
        <Title>Хүргэлтийн тооцоо</Title>
        <Copy>
          Эхний төлбөрт бараа, Хятад доторх хүргэлт, үйлчилгээний төлбөр орно.
          Каргоны жин, эзэлхүүнийг агуулахад хэмжсэний дараа эцсийн тооцоо
          гарна. Улаанбаатарт хүргүүлэх бол хүргэлтийн төлбөр нэмэгдэнэ.
        </Copy>
      </Card>
      <Card>
        <Title>Холбоо барих</Title>
        <Copy>
          {shipping?.pickup?.name}
          {"\n"}
          {shipping?.pickup?.address}
          {"\n"}
          {shipping?.pickup?.hours}
        </Copy>
        {!!shipping?.pickup?.phone && (
          <Button
            title={shipping.pickup.phone}
            secondary
            onPress={() =>
              open("tel:" + shipping.pickup!.phone.replace(/[^+\d]/g, ""))
            }
          />
        )}
        <Button
          title="shop@gostore.mn"
          secondary
          onPress={() => open("mailto:shop@gostore.mn")}
        />
      </Card>
      <Card>
        <Title>Мэдээлэл ба нууцлал</Title>
        <Copy>
          Бүртгэл, хаяг, захиалгын мэдээллийг GOStore серверт боловсруулна.
          Нэвтрэх түлхүүрийг төхөөрөмжийн хамгаалагдсан санд хадгална. Зурагт
          хайлт хийхэд зөвхөн таны сонгосон зургийг илгээнэ. Камерын зөвшөөрлийг
          зураг авах үед асууна.
        </Copy>
        <Copy>
          Бүртгэлээ «Миний бүртгэл → Бүртгэл устгах» хэсгээс устгах боломжтой.
          Захиалга, төлбөрийн баримтад хадгалах шаардлагатай мэдээллийн талаар
          устгах дэлгэцэд тайлбарлана.
        </Copy>
        <Button
          title="Үйлчилгээний нөхцөл, тусламж"
          secondary
          onPress={() => open("https://gostore.mn/help")}
        />
        <Button
          title="Нууцлалын бодлого"
          secondary
          onPress={() => open("https://gostore.mn/mobile-privacy.html")}
        />
      </Card>
    </Page>
  );
}
