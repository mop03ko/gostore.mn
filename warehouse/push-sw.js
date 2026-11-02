'use strict';
// No fetch handler: warehouse pages, credentials and order responses are never cached.
function settings(value){return new Promise((resolve,reject)=>{
  const open=indexedDB.open('gostore-warehouse-push',1);open.onupgradeneeded=()=>open.result.createObjectStore('settings');open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{const db=open.result,tx=db.transaction('settings',value===undefined?'readonly':'readwrite'),store=tx.objectStore('settings');let result;
    const request=value===undefined?store.get('device'):value===null?store.delete('device'):store.put(value,'device');request.onsuccess=()=>result=request.result;
    tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};
  };
});}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  if(!event.source?.url)return;const source=new URL(event.source.url);if(source.origin!==self.location.origin||!source.pathname.startsWith('/warehouse/'))return;
  const data=event.data;if(data?.type==='warehouse-push-config'&&/^[a-f0-9]{64}$/.test(data.device?.token||''))event.waitUntil(settings(data.device).then(()=>event.ports[0]?.postMessage({ok:true})));
  if(data?.type==='warehouse-push-clear')event.waitUntil((async()=>{const device=await settings(),subscription=await self.registration.pushManager?.getSubscription();await settings(null);if(device)try{await fetch('/api/index.php?action=warehouse-push-revoke',{method:'POST',headers:{'X-GOStore-Push-Token':device.token},credentials:'omit',cache:'no-store'});}catch{}if(subscription)await subscription.unsubscribe();for(const n of await self.registration.getNotifications())n.close();event.ports[0]?.postMessage({ok:true});})());
});
self.addEventListener('push',event=>event.waitUntil((async()=>{
  const device=await settings();if(!device)return;
  const zh=device.language==='zh';let title=zh?'GOStore · 仓库通知':'GOStore · Агуулахын мэдэгдэл',body=zh?'请打开仓库查看新订单。':'Агуулахын шинэ захиалгаа шалгана уу。',url='/warehouse/?location='+encodeURIComponent(device.location),tag='warehouse-orders-'+device.location;
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{const r=await fetch('/api/index.php?action=warehouse-push-delivery',{headers:{'X-GOStore-Push-Token':device.token},credentials:'omit',cache:'no-store',signal:controller.signal});
      if(r.status===401){if((await settings())?.token===device.token)await settings(null);return;}if(!r.ok)throw Error('Unavailable');const data=await r.json(),latest=data.notifications?.[0];
      if(latest){title=zh?'GOStore · 新订单已确认':'GOStore · Шинэ захиалга баталгаажлаа';body=latest.order_id+(zh?' · 请查看仓库订单':' · Агуулахын захиалгыг нээж үзнэ үү');url+='&order='+encodeURIComponent(latest.order_id);tag+='-'+latest.id;}
    }finally{clearTimeout(timer);}
  }catch{}
  if((await settings())?.token!==device.token)return;
  await self.registration.showNotification(title,{body,tag,renotify:false,icon:'/assets/favicon.svg',data:{url}});
})()));
self.addEventListener('notificationclick',event=>{
  event.notification.close();event.waitUntil((async()=>{
    const url=new URL(event.notification.data?.url||'/warehouse/',self.location.origin);if(url.origin!==self.location.origin||url.pathname!=='/warehouse/')return;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(c=>new URL(c.url).pathname.startsWith('/warehouse/'));
    if(existing){await existing.navigate(url.href);return existing.focus();}return self.clients.openWindow(url.href);
  })());
});
