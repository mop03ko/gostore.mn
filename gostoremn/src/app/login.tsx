import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { validCart } from "@/lib/cart";
import type { Customer } from "@/lib/types";
import {
  Page,
  Card,
  Title,
  Copy,
  Field,
  Button,
  ErrorBox,
} from "@/components/ui";
export default function Login() {
  const { next } = useLocalSearchParams<{ next?: string }>(),
    { refresh } = useStore();
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ customer: Customer }>(
        register ? "customer-register" : "customer-login",
        {
          email: email.trim(),
          password,
          ...(register
            ? { name: name.trim(), phone, password_confirm: confirm }
            : {}),
        },
      );
      const key = "gostore-cart-" + r.customer.id,
        guest = validCart(
          JSON.parse(
            (await AsyncStorage.getItem("gostore-cart-guest")) || "[]",
          ),
        ),
        own = validCart(JSON.parse((await AsyncStorage.getItem(key)) || "[]"));
      // Keep the account's existing quantities; append only different guest selections.
      await AsyncStorage.setItem(
        key,
        JSON.stringify(
          [
            ...own,
            ...guest.filter(
              (g) => !own.some((i) => i.id === g.id && i.sku === g.sku),
            ),
          ].slice(0, 30),
        ),
      );
      await AsyncStorage.removeItem("gostore-cart-guest");
      await refresh();
      setPassword("");
      setConfirm("");
      const destination = next === "checkout" || next === "/checkout" ? "/checkout"
        : next === "/orders" ? "/orders" : next === "/addresses" ? "/addresses"
        : next === "/notifications" ? "/notifications" : "/account";
      router.replace(destination);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Title>{register ? "GOStore бүртгэл үүсгэх" : "Тавтай морил"}</Title>
      <Copy>
        Сайтынхаа бүртгэлээр нэвтэрч, захиалга болон хаягуудаа ашиглаарай.
      </Copy>
      <ErrorBox message={error} />
      <Card>
        {register && (
          <>
            <Field
              label="Нэр"
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
            <Field
              label="Утас"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </>
        )}
        <Field
          label="Имэйл"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Нууц үг"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={register ? "new-password" : "current-password"}
        />
        {register && (
          <Field
            label="Нууц үг давтах"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
          />
        )}
        <Button
          title={
            busy
              ? "Түр хүлээнэ үү…"
              : register
                ? "Зөвшөөрч бүртгүүлэх"
                : "Нэвтрэх"
          }
          disabled={
            busy ||
            !email ||
            !password ||
            (register &&
              (!name || password !== confirm || password.length < 10))
          }
          onPress={() => void submit()}
        />
      </Card>
      {register && (
        <Copy>
          Бүртгүүлэхдээ үйлчилгээний нөхцөл, нууцлалын бодлогыг зөвшөөрнө. Нууц
          үг 10-аас доошгүй тэмдэгттэй байна.
        </Copy>
      )}
      <Button
        title={register ? "Бүртгэлтэй бол нэвтрэх" : "Шинэ бүртгэл үүсгэх"}
        secondary
        disabled={busy}
        onPress={() => {
          setRegister(!register);
          setError("");
        }}
      />
      <Button
        title="Тусламж, үйлчилгээний нөхцөл"
        secondary
        onPress={() => router.push("/help")}
      />
    </Page>
  );
}
