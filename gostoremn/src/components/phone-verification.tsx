import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Card, Copy, Button, ErrorBox, Field } from "@/components/ui";
export type PhoneSession={challenge:string;phone:string;displayInstruction:string;remainingSeconds:number;deadline:number;delivery:"otp";deliveryUncertain?:boolean};
export function PhoneVerification({session,onVerified,onCancel}:{session:PhoneSession;onVerified:()=>void;onCancel:()=>void}){
  const [code,setCode]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[remaining,setRemaining]=useState(session.remainingSeconds),[locked,setLocked]=useState(false);
  useEffect(()=>{const timer=setInterval(()=>setRemaining(Math.max(0,Math.ceil((session.deadline-Date.now())/1000))),1000);return()=>clearInterval(timer);},[session.deadline]);
  async function confirm(){
    if(busy||locked||remaining<=0)return;setBusy(true);setError("");
    try{const r=await api<{sessionStatus:string}>("phone-verification-status",{challenge:session.challenge,code});
      if(r.sessionStatus==="VERIFIED"&&Date.now()<session.deadline){onVerified();return;}
      if(r.sessionStatus==="EXPIRED"){setLocked(true);setError("Кодын хугацаа дууссан. Дахин код авна уу.");}
    }catch(e){setError((e as Error).message);if(e instanceof ApiError&&[401,403,404,429].includes(e.status))setLocked(true);}
    finally{setBusy(false);}
  }
  return <Card><Copy>{session.displayInstruction}</Copy><Copy>Утас: {session.phone}</Copy>
    <Field label="6 оронтой SMS код" value={code} onChangeText={v=>setCode(v.replace(/[^0-9]/g,"").slice(0,6))} keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" textContentType="oneTimeCode" editable={!busy&&!locked&&remaining>0}/>
    <Copy>{remaining>0?`Кодын хүчинтэй хугацаа: ${remaining} сек`:"Кодын хугацаа дууссан"}</Copy>
    {session.deliveryUncertain&&<Copy>Илгээлтийн хариуг хүлээж байна. Код ирвэл оруулна уу.</Copy>}
    <Copy>Утасны дугаарыг SendSMS.mn-д дамжуулна. Кодоо бусдад бүү дамжуулаарай.</Copy>
    <ErrorBox message={error}/><Button title="Код баталгаажуулах" disabled={busy||locked||remaining<=0||code.length!==6} onPress={()=>void confirm()}/>
    <Button title={locked||remaining<=0?"Дахин эхлүүлэх":"Болих"} secondary disabled={busy} onPress={onCancel}/>
  </Card>;
}
