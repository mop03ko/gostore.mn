import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { completeSignIn } from "@/lib/sign-in";
import type { Customer } from "@/lib/types";
import { Page,Card,Title,Copy,Field,Button,ErrorBox } from "@/components/ui";
export default function EmailLogin(){
  const {next}=useLocalSearchParams<{next?:string}>(),{refresh}=useStore();
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(){setBusy(true);setError("");try{const r=await api<{customer:Customer}>("customer-login",{email:email.trim(),password});setPassword("");await completeSignIn(r.customer,refresh,next);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Page><Title>Өмнөх бүртгэлээр нэвтрэх</Title><Copy>Нэвтэрсний дараа профайлын «Утас, PIN холбох» хэсэгт дугаараа баталгаажуулна. Таны захиалгууд хэвээр хадгалагдана.</Copy><ErrorBox message={error}/><Card>
    <Field label="Имэйл" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email"/>
    <Field label="Нууц үг" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password"/>
    <Button title={busy?"Түр хүлээнэ үү…":"Нэвтрэх"} disabled={busy||!email||!password} onPress={()=>void submit()}/>
  </Card><Button title="Утас + PIN-ээр нэвтрэх" secondary onPress={()=>router.replace({pathname:"/login",params:{next:next||"/account"}})}/></Page>;
}