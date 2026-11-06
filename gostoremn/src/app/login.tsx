import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { completeSignIn } from "@/lib/sign-in";
import type { Customer } from "@/lib/types";
import { PhoneVerification, type PhoneSession } from "@/components/phone-verification";
import { Page, Card, Title, Copy, Field, Button, ErrorBox } from "@/components/ui";
type Mode="login"|"register"|"reset"|"link";
export default function Login(){
  const {next,mode:requested,phone:initialPhone}=useLocalSearchParams<{next?:string;mode?:string;phone?:string}>();const {refresh}=useStore();
  const [mode,setMode]=useState<Mode>(requested==="link"?"link":requested==="reset"?"reset":"login");
  const [step,setStep]=useState<"form"|"sms"|"pin">("form");const [phone,setPhone]=useState(initialPhone||"");
  const [pin,setPin]=useState(""),[confirm,setConfirm]=useState(""),[name,setName]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");const [session,setSession]=useState<PhoneSession|null>(null);
  const verified=useCallback(()=>setStep("pin"),[]);
  const digits=(value:string)=>value.replace(/[^0-9]/g,"").slice(0,4);
  function switchMode(value:Mode){setMode(value);setStep("form");setSession(null);setPin("");setConfirm("");setError("");}
  async function submit(){
    setBusy(true);setError("");
    try{
      if(mode!=="login"&&step==="form"){
        const r=await api<PhoneSession>("phone-verification-start",{phone,purpose:mode});
        if(!r.challenge||!Number.isFinite(r.remainingSeconds)||r.remainingSeconds<=0)throw Error("SMS баталгаажуулалт эхэлсэнгүй.");
        setSession({...r,deadline:Date.now()+Math.min(300,r.remainingSeconds)*1000});setStep("sms");return;
      }
      if(mode!=="login"&&(!session||Date.now()>=session.deadline))throw Error("Хугацаа дууслаа. SMS-ээр дахин баталгаажуулна уу.");
      const result=await api<{customer:Customer}>(mode==="login"?"customer-pin-login":"customer-pin-setup",mode==="login"?{phone,pin}:{phone:session!.phone,pin,pin_confirm:confirm,name:name.trim(),purpose:mode,challenge:session!.challenge});
      setPin("");setConfirm("");await completeSignIn(result.customer,refresh,next);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const title=step==="sms"?"Утсаа баталгаажуулах":step==="pin"?"4 оронтой PIN үүсгэх":mode==="register"?"Утсаар бүртгүүлэх":mode==="reset"?"PIN сэргээх":mode==="link"?"Утас, PIN холбох":"Тавтай морил";
  return <Page><Title>{title}</Title><ErrorBox message={error}/>
    {step==="sms"&&session?<PhoneVerification session={session} onVerified={verified} onCancel={()=>switchMode(mode)}/>:<Card>
      {step==="form"?<>
        {mode==="register"&&<Field label="Таны нэр" value={name} onChangeText={setName} autoComplete="name" maxLength={100}/>}
        <Field label="Утасны дугаар" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={20}/>
      </>:<Copy>{session?.phone} дугаар баталгаажлаа. Нэвтрэхдээ ашиглах PIN-ээ оруулна уу.</Copy>}
      {(mode==="login"||step==="pin")&&<Field label="4 оронтой PIN" value={pin} onChangeText={v=>setPin(digits(v))} secureTextEntry keyboardType="number-pad" maxLength={4} autoComplete="off"/>}
      {step==="pin"&&<Field label="PIN давтах" value={confirm} onChangeText={v=>setConfirm(digits(v))} secureTextEntry keyboardType="number-pad" maxLength={4} autoComplete="off"/>}
      {mode!=="login"&&step==="form"&&<Copy>Утасны дугаарыг verify.mn-д дамжуулж баталгаажуулна. Та 144773 дугаарт SMS илгээнэ. Операторын SMS төлбөр үйлчилж болно.</Copy>}
      <Button title={busy?"Түр хүлээнэ үү…":mode==="login"?"PIN-ээр нэвтрэх":step==="pin"?"PIN хадгалж нэвтрэх":"SMS-ээр баталгаажуулах"} disabled={busy||!phone||(mode==="register"&&!name.trim())||((mode==="login"||step==="pin")&&pin.length!==4)||(step==="pin"&&pin!==confirm)} onPress={()=>void submit()}/>
      {step==="pin"&&<Button title="SMS баталгаажуулалтыг дахин эхлүүлэх" secondary disabled={busy} onPress={()=>switchMode(mode)}/>}
    </Card>}
    {step==="form"&&mode==="login"&&<><Button title="Шинээр утсаар бүртгүүлэх" secondary disabled={busy} onPress={()=>switchMode("register")}/><Button title="PIN мартсан" secondary disabled={busy} onPress={()=>switchMode("reset")}/><Button title="Өмнөх имэйлээр нэвтрэх" secondary disabled={busy} onPress={()=>router.push({pathname:"/email-login",params:{next:next||"/account"}})}/></>}
    {step==="form"&&mode==="register"&&<Copy>Өмнө нь имэйлээр бүртгэлтэй бол тэр бүртгэлээрээ нэвтэрч, профайлаасаа утсаа холбоорой. Шинэ бүртгэлд хуучин захиалга автоматаар шилжихгүй. Үргэлжлүүлэхдээ үйлчилгээний нөхцөл, нууцлалын бодлогыг зөвшөөрнө.</Copy>}
    {step==="form"&&mode!=="login"&&<Button title="Утас + PIN-ээр нэвтрэх" secondary disabled={busy} onPress={()=>switchMode("login")}/>}
    <Button title="Тусламж, үйлчилгээний нөхцөл" secondary onPress={()=>router.push("/help")}/>
  </Page>;
}