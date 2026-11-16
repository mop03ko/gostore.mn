import { useEffect, useState } from "react";
import { AppState, Platform, Text } from "react-native";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import { api, ApiError } from "@/lib/api";
import { Card, Copy, Button, ErrorBox, Field } from "@/components/ui";
import { usePalette } from "@/lib/palette";
export type PhoneSession={challenge:string;phone:string;text:string;smsUri:string;displayInstruction:string;remainingSeconds:number;deadline:number;delivery?:"otp";deliveryUncertain?:boolean};
export function PhoneVerification({session,onVerified,onCancel}:{session:PhoneSession;onVerified:()=>void;onCancel:()=>void}) {
  return session.delivery==="otp"?<OtpVerification session={session} onVerified={onVerified} onCancel={onCancel}/>:<MoVerification session={session} onVerified={onVerified} onCancel={onCancel}/>;
}
function OtpVerification({session,onVerified,onCancel}:{session:PhoneSession;onVerified:()=>void;onCancel:()=>void}){
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
    {session.deliveryUncertain&&<Copy>Илгээлтийн хариу хүлээгдэж байна. Код ирвэл оруулна уу.</Copy>}
    <Copy>Утасны дугаарыг SendSMS.mn-д дамжуулна. Кодоо бусдад бүү дамжуулаарай.</Copy>
    <ErrorBox message={error}/><Button title="Код баталгаажуулах" disabled={busy||locked||remaining<=0||code.length!==6} onPress={()=>void confirm()}/>
    <Button title={locked||remaining<=0?"Дахин эхлүүлэх":"Болих"} secondary disabled={busy} onPress={onCancel}/>
  </Card>;
}
function MoVerification({session,onVerified,onCancel}:{session:PhoneSession;onVerified:()=>void;onCancel:()=>void}) {
  const colors=usePalette();const [remaining,setRemaining]=useState(session.remainingSeconds);
  const [error,setError]=useState("");const [terminal,setTerminal]=useState(false);
  useEffect(()=>{
    let stopped=false,inFlight=false;let timer:ReturnType<typeof setTimeout>;
    function expire(){setRemaining(0);setTerminal(true);setError("Хугацаа дууслаа. Дахин SMS баталгаажуулалт эхлүүлнэ үү.");stopped=true;clearTimeout(timer);}
    async function poll(){
      if(stopped||inFlight)return;if(Date.now()>=session.deadline){expire();return;}inFlight=true;
      try{
        const r=await api<{sessionStatus:string}>("phone-verification-status",{challenge:session.challenge});
        if(stopped)return;if(Date.now()>=session.deadline||r.sessionStatus==="EXPIRED"){expire();return;}
        if(r.sessionStatus==="VERIFIED"){stopped=true;onVerified();return;}
        if(r.sessionStatus!=="PENDING")throw new Error("Баталгаажуулалтын хариу буруу байна.");setError("");
      }catch(e){if(!stopped){setError((e as Error).message);if(e instanceof ApiError&&[401,403,404].includes(e.status)){stopped=true;setTerminal(true);}}}
      finally{inFlight=false;if(!stopped)timer=setTimeout(()=>void poll(),3000);}
    }
    timer=setTimeout(()=>void poll(),3000);
    const clock=setInterval(()=>{if(!stopped){if(Date.now()>=session.deadline)expire();else setRemaining(Math.ceil((session.deadline-Date.now())/1000));}},1000);
    const listener=AppState.addEventListener("change",state=>{if(state==="active"&&!stopped){clearTimeout(timer);void poll();}});
    return()=>{stopped=true;clearTimeout(timer);clearInterval(clock);listener.remove();};
  },[session,onVerified]);
  async function openSms(){
    try{
      if(Platform.OS==="web") {if(!/^sms:144773\?body=/.test(session.smsUri))throw Error("SMS холбоос буруу.");await Linking.openURL(session.smsUri);}
      else {if(!await SMS.isAvailableAsync())throw Error("Энэ төхөөрөмжөөс SMS илгээх боломжгүй. Доорх текстийг утаснаасаа илгээнэ үү.");await SMS.sendSMSAsync("144773",session.text);}
      // Neither the composer result nor the carrier reply establishes ownership.
    }catch(e){setError((e as Error).message);}
  }
  return <Card>
    <Copy>{session.displayInstruction}</Copy><Copy>Утас: {session.phone}</Copy>
    <Copy>Илгээх дугаар: 144773</Copy><Text selectable style={{color:colors.ink,fontSize:18,fontWeight:"700"}}>{session.text}</Text>
    <Copy>Энэ дугаарын SIM-ээс SMS-ээ илгээж, апп руу буцна уу. Хоёр SIM-тэй бол зөв дугаараа сонгоорой.</Copy>
    <Button title="SMS нээж илгээх" disabled={terminal} onPress={()=>void openSms()} />
    <Copy>{remaining>0?`Баталгаажуулалт хүлээж байна · ${remaining} сек`:"Хугацаа дууссан"}</Copy>
    <ErrorBox message={error}/><Button title={terminal?"Дахин эхлүүлэх":"Болих"} secondary onPress={onCancel}/>
  </Card>;
}
