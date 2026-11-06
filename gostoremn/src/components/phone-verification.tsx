import { useEffect, useState } from "react";
import { AppState, Platform, Text } from "react-native";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import { api, ApiError } from "@/lib/api";
import { Card, Copy, Button, ErrorBox } from "@/components/ui";
import { usePalette } from "@/lib/palette";
export type PhoneSession={challenge:string;phone:string;text:string;smsUri:string;displayInstruction:string;remainingSeconds:number;deadline:number};
export function PhoneVerification({session,onVerified,onCancel}:{session:PhoneSession;onVerified:()=>void;onCancel:()=>void}) {
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