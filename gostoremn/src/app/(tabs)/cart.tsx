import { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useStore } from "@/lib/store";
import type { CartLine } from "@/lib/types";
import {
  Page,
  Card,
  Title,
  Copy,
  Button,
  Row,
  ErrorBox,
  colors,
  money,
} from "@/components/ui";
export default function Cart() {
  const { cart, saveCart, shipping, cartReady, customer } = useStore();
  const [error, setError] = useState("");
  const save = (next: CartLine[]) =>
    void saveCart(next).catch((e) => setError(e.message));
  const goods = cart.reduce((s, i) => s + i.cny * i.qty, 0),
    rate = shipping?.cny_rate || 0;
  return (
    <Page>
      <ErrorBox message={error} />
      {cart.length ? (
        cart.map((i) => (
          <Card key={i.id + i.sku}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Image
                source={i.image}
                style={{ width: 72, height: 72, borderRadius: 10 }}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{ color: colors.ink, fontWeight: "600" }}
                  onPress={() =>
                    router.push({
                      pathname: "/product/[id]",
                      params: { id: i.id },
                    })
                  }
                >
                  {i.name}
                </Text>
                <Copy>{i.variant}</Copy>
                <Copy>
                  ¥{i.cny} × {i.qty}
                </Copy>
              </View>
            </View>
            <View
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <Button
                title="−"
                secondary
                disabled={i.qty - i.step < i.min_qty}
                onPress={() =>
                  save(
                    cart.map((v) =>
                      v === i ? { ...v, qty: v.qty - v.step } : v,
                    ),
                  )
                }
              />
              <Text>{i.qty}</Text>
              <Button
                title="+"
                secondary
                disabled={i.qty + i.step > Math.min(i.stock || 0, 9999)}
                onPress={() =>
                  save(
                    cart.map((v) =>
                      v === i ? { ...v, qty: v.qty + v.step } : v,
                    ),
                  )
                }
              />
              <Button
                title="Хасах"
                secondary
                onPress={() => save(cart.filter((v) => v !== i))}
              />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Title>Сагс тань хоосон байна</Title>
          <Copy>Барааны өнгө, хэмжээ болон тоогоо сонгоод нэмээрэй.</Copy>
          <Button title="Бараа үзэх" onPress={() => router.push("/")} />
        </Card>
      )}
      {cart.length > 0 && (
        <Card>
          <Title>Урьдчилсан тооцоо</Title>
          <Row
            label="Бараа"
            value={
              rate
                ? money(Math.ceil((Math.round(goods * 100) / 100) * rate))
                : "Ханш шалгаж байна"
            }
          />
          <Copy>
            Хятад доторх хүргэлт, үйлчилгээний хураамж болон нийт төлбөрийг
            дараагийн алхамд сервер шалгана. Олон улсын карго, сонгосон бол УБ
            хүргэлтийг дараа тооцно.
          </Copy>
          <Button
            title={customer ? "Тооцоо шалгах" : "Нэвтэрч үргэлжлүүлэх"}
            disabled={!cartReady}
            onPress={() =>
              router.push(
                customer
                  ? "/checkout"
                  : { pathname: "/login", params: { next: "checkout" } },
              )
            }
          />
        </Card>
      )}
    </Page>
  );
}
