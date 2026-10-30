import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  ErrorBox,
} from "@/components/ui";
export default function DeleteAccount() {
  const { customer, refresh } = useStore(),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    if (!customer) return;
    setBusy(true);
    try {
      await api("customer-delete", { password, confirmation });
      await AsyncStorage.multiRemove([
        "gostore-cart-" + customer.id,
        "gostore-pending-" + customer.id,
      ]);
      await refresh();
      setPassword("");
      router.replace("/account");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Title>Бүртгэл устгах</Title>
      <ErrorBox message={error} />
      <Card>
        <Copy>
          Таны нэвтрэх эрх, профайлын нэр, имэйл, утас, хаягийн дэвтэр,
          хадгалсан сагс устна. Бүх төхөөрөмжийн нэвтрэх эрх хүчингүй болно. Энэ
          үйлдлийг буцаах боломжгүй.
        </Copy>
        <Copy>
          Захиалга автоматаар цуцлагдахгүй. Хүргэлт гүйцэтгэх, төлбөр, буцаалт
          тооцох захиалгын баримт болон тухайн захиалгын хүлээн авагчийн
          мэдээлэл үлдэнэ. Идэвхтэй захиалгатай бол устгахаас өмнө захиалгын
          дугаараа хадгалж, shop@gostore.mn хаягаар холбогдоно уу.
        </Copy>
        <Copy>
          Дахин бүртгүүлбэл өмнөх захиалгууд шинэ бүртгэлд автоматаар
          холбогдохгүй.
        </Copy>
        <Field
          label="Одоогийн нууц үг"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Field
          label="Батлахын тулд DELETE гэж бичнэ үү"
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
        />
        <Button
          title="Бүртгэлээ бүрмөсөн устгах"
          disabled={busy || !customer || !password || confirmation !== "DELETE"}
          onPress={() => void remove()}
        />
      </Card>
    </Page>
  );
}
