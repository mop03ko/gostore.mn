import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Linking} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
type Request={resolve:()=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};
export function useStaffPush(variant:string, authenticated:boolean, inject:(js:string)=>void, openOrders:()=>void){
 const [status,setStatus]=useState('Мэдэгдэл идэвхжээгүй');
 const [busy,setBusy]=useState(false);
 const live=useRef(authenticated),token=useRef(''),serial=useRef(0),requests=useRef(new Map<string,Request>()),pendingOpen=useRef(false),running=useRef(false);
 const injectRef=useRef(inject),openRef=useRef(openOrders),epoch=useRef(0);
 live.current=authenticated;injectRef.current=inject;openRef.current=openOrders;
 const preference='staff-push-'+variant;
 const request=useCallback((action:string,value:string)=>new Promise<void>((resolve,reject)=>{
  if(!live.current){reject(Error('Эхлээд нэвтэрнэ үү.'));return;}
  const id=String(++serial.current)+'-'+Date.now();
  const timer=setTimeout(()=>{requests.current.delete(id);reject(Error('Холболт удаж байна. Дахин оролдоно уу.'));},18000);
  requests.current.set(id,{resolve,reject,timer});
  injectRef.current('window.gostoreStaffPush?.('+JSON.stringify({id,variant,action,token:value})+');true;');
 }),[variant]);
 const message=useCallback((data:any)=>{
  if(data.type!=='push-result')return false;
  const r=requests.current.get(data.id);if(r){clearTimeout(r.timer);requests.current.delete(data.id);data.ok===true?r.resolve():r.reject(Error(String(data.error||'Холболт амжилтгүй')));}
  return true;
 },[]);
 const enable=useCallback(async(manual=true)=>{
  if(running.current||!live.current)return;
  running.current=true;setBusy(true);const generation=epoch.current;
  try{
   if(!Device.isDevice)throw Error('Push мэдэгдлийг бодит iPhone дээр идэвхжүүлнэ.');
   let permission=await Notifications.getPermissionsAsync();
   if(manual&&!permission.granted)permission=await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowSound:true,allowBadge:true}});
   if(!permission.granted){setStatus('iPhone тохиргоонд мэдэгдлийг зөвшөөрнө үү');return;}
   const projectId=Constants.expoConfig?.extra?.eas?.projectId;
   if(!projectId)throw Error('Push төслийн тохиргоо байхгүй.');
   const result=await Notifications.getExpoPushTokenAsync({projectId});
   if(!live.current||generation!==epoch.current)return;
   await request('register',result.data);
   if(!live.current||generation!==epoch.current)return;
   token.current=result.data;await SecureStore.setItemAsync(preference,'on');
   setStatus(permission.ios?.allowsSound===false?'Push идэвхтэй • iPhone дээр дуу унтарсан':'Дуутай push идэвхтэй');
  }catch(e){setStatus('Push холбогдсонгүй • дахин оролдоно уу');if(manual)Alert.alert('Мэдэгдэл',e instanceof Error?e.message:'Холболт амжилтгүй.');}
  finally{running.current=false;setBusy(false);}
 },[preference,request]);
 useEffect(()=>{
  epoch.current++;
  if(!authenticated){token.current='';setStatus('Мэдэгдэл авахын тулд нэвтэрнэ үү');return;}
  let cancelled=false;
  void SecureStore.getItemAsync(preference).then(value=>{
   if(cancelled)return;
   if(value==='on')void enable(false);
   else if(value===null){
    void SecureStore.setItemAsync(preference,'asked');
    Alert.alert('Ажлын мэдэгдэл','Апп хаалттай, дэлгэц түгжээтэй үед захиалгын шинэчлэлтийг дуутай авах уу?',[{text:'Дараа',style:'cancel'},{text:'Идэвхжүүлэх',onPress:()=>void enable()}]);
   }
  }).catch(()=>{});
  if(pendingOpen.current){pendingOpen.current=false;openRef.current();}
  return()=>{cancelled=true;};
 },[authenticated,enable,preference]);
 useEffect(()=>{
  const tapped=(response:Notifications.NotificationResponse|null)=>{
   const d=response?.notification.request.content.data;
   if(d?.variant!==variant||d?.screen!=='orders')return;
   if(live.current)openRef.current();else pendingOpen.current=true;
   void Notifications.clearLastNotificationResponseAsync();
  };
  void Notifications.getLastNotificationResponseAsync().then(tapped);
  const response=Notifications.addNotificationResponseReceivedListener(tapped);
  const active=AppState.addEventListener('change',state=>{if(state==='active'&&live.current)void SecureStore.getItemAsync(preference).then(v=>{if(v==='on')void enable(false);});});
  const rotate=Notifications.addPushTokenListener(()=>{if(live.current)void SecureStore.getItemAsync(preference).then(v=>{if(v==='on')void enable(false);});});
  return()=>{response.remove();active.remove();rotate.remove();for(const r of requests.current.values()){clearTimeout(r.timer);r.reject(Error('Аппын холболт хаагдлаа'));}requests.current.clear();};
 },[variant,preference,enable]);
 async function disable(){
  if(running.current)return;setBusy(true);
  try{if(token.current)await request('unregister',token.current);await SecureStore.setItemAsync(preference,'off');token.current='';setStatus('Мэдэгдэл унтраалттай');}
  catch{Alert.alert('Мэдэгдэл','Унтраах хүсэлт амжилтгүй. Дахин оролдоно уу.');}finally{setBusy(false);}
 }
 async function test(){
  if(!token.current){Alert.alert('Мэдэгдэл','Эхлээд мэдэгдлээ идэвхжүүлнэ үү.');return;}
  try{await request('test',token.current);Alert.alert('Туршилт товлогдлоо','Одоо аппыг хааж, дэлгэцээ түгжинэ үү. Ойролцоогоор 1–2 минутын дотор мэдэгдэл ирнэ.');}
  catch(e){Alert.alert('Туршилт',e instanceof Error?e.message:'Дахин оролдоно уу.');}
 }
 function show(){
  if(!live.current){Alert.alert('Мэдэгдэл','Эхлээд нэвтэрнэ үү.');return;}
  if(busy)return;
  Alert.alert('Ажлын мэдэгдэл',status+'\nДуу гарахын тулд iPhone-ийн Sounds болон Lock Screen зөвшөөрөл асаалттай, Silent Mode болон Focus унтраалттай байна.',[
   {text:'Идэвхжүүлэх / Шалгах',onPress:()=>void enable()},
   {text:'Дэлгэц түгжиж турших',onPress:()=>void test()},
   {text:'iPhone тохиргоо',onPress:()=>void Linking.openSettings()},
   {text:'Push унтраах',style:'destructive',onPress:()=>void disable()},
   {text:'Хаах',style:'cancel'},
  ]);
 }
 return {message,show,status,busy};
}
