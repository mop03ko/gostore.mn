'use strict';
(()=>{
 const app=document.getElementById('app');if(!app)return;
 const text=(mn,zh)=>cityRole()==='erenhot'?zh:mn;
 const panel=document.createElement('section');panel.className='warehouse-notifications';panel.hidden=true;
 panel.innerHTML='<div class="warehouse-notifications-heading"><button type="button" class="quiet" data-notices-toggle aria-expanded="false"></button><button type="button" class="quiet" data-push-enable></button><button type="button" class="quiet" data-push-test hidden></button></div><p data-push-status role="status"></p><div data-notices-list hidden></div>';
 document.querySelector('.warehouse-main').prepend(panel);
 const toggle=panel.querySelector('[data-notices-toggle]'),enable=panel.querySelector('[data-push-enable]'),status=panel.querySelector('[data-push-status]'),list=panel.querySelector('[data-notices-list]');
 let data=null,busy=false,activeLocation='',generation=0,registration=null,lastSeen=0;
 const testButton=panel.querySelector('[data-push-test]');testButton.onclick=()=>{if(native())location.href='gostore-warehouse://push/test';};
 const native=()=>window.gostoreWarehouseNativePush===true;
 const supported=()=>('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window)&&!/GOStoreWarehouse|; wv\)/i.test(navigator.userAgent);
 function labels(){toggle.textContent=text('Мэдэгдэл','通知')+' · '+(data?.unread||0);enable.textContent=text('Push мэдэгдэл идэвхжүүлэх','开启推送通知');
  status.textContent=(native()||supported())?text('Энэ төхөөрөмжид шинэ захиалгын push мэдэгдэл авахыг зөвшөөрнө үү.','允许此设备接收新订单推送通知。'):text('Энэ апп/браузер push дэмжихгүй байна. Chrome эсвэл Edge браузераар агуулахын панелд нэвтэрч идэвхжүүлнэ үү.','当前应用/浏览器不支持推送。请在 Chrome 或 Edge 浏览器打开仓库页面后启用。');enable.hidden=!(native()||supported());
 }
 async function workerMessage(type,device){registration??=await navigator.serviceWorker.register('/warehouse/push-sw.js',{scope:'/warehouse/'});await navigator.serviceWorker.ready;
  return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('Push worker timeout')),5000);channel.port1.onmessage=()=>{clearTimeout(timer);resolve();};(registration.active||registration.waiting||registration.installing).postMessage({type,device},[channel.port2]);});
 }
 function render(){if(!data)return;toggle.textContent=text('Мэдэгдэл','通知')+' · '+data.unread;
  list.innerHTML=data.notifications.length?`<button class="quiet" type="button" data-notices-read>${text('Бүгдийг уншсанд тооцох','全部标为已读')}</button>`+data.notifications.map(n=>`<button class="warehouse-notice ${n.read_at?'':'unread'}" type="button" data-notice-order="${esc(n.order_id)}"><strong>${esc(n.order_id)}</strong><span>${text('Шинэ захиалга баталгаажлаа','新订单已确认')}</span><small>${esc(date(n.created))}</small></button>`).join(''):`<p>${text('Шинэ мэдэгдэл алга.','暂无新通知。')}</p>`;
 }
 async function poll(){if(busy||app.hidden)return;busy=true;const version=generation;try{const next=await api('warehouse-notifications');if(version!==generation||app.hidden)return;data=next;render();const newest=next.notifications[0]?.id||0;if(lastSeen&&newest>lastSeen){toast(text('Шинэ захиалга баталгаажлаа','新订单已确认'));}lastSeen=newest;
  }catch{}finally{busy=false;}}
 async function start(){if(app.hidden){if(activeLocation){if(native())location.href='gostore-warehouse://push/clear';activeLocation='';generation++;data=null;lastSeen=0;panel.hidden=true;list.replaceChildren();if(!native()&&'serviceWorker' in navigator)workerMessage('warehouse-push-clear').catch(()=>{});}return;}
  if(activeLocation===city)return;activeLocation=city;generation++;data=null;lastSeen=0;panel.hidden=false;labels();if(native())location.href='gostore-warehouse://push/status';await poll();
  if(supported())try{registration=await navigator.serviceWorker.register('/warehouse/push-sw.js',{scope:'/warehouse/'});const subscription=await registration.pushManager.getSubscription();if(subscription){status.textContent=text('Энэ төхөөрөмжийн push-ийг одоогийн агуулахтай холбоход доорх товчийг дарна уу.','点击按钮将此设备推送绑定到当前仓库。');}}catch{}
  const order=new URLSearchParams(location.search).get('order');if(order&&/^[A-Z0-9-]{3,50}$/.test(order))try{await logisticsOpenOrder(order);}catch(e){toast(e.message);}
 }
 toggle.onclick=()=>{list.hidden=!list.hidden;toggle.setAttribute('aria-expanded',String(!list.hidden));if(!list.hidden)poll();};
 list.onclick=async e=>{const order=e.target.closest('[data-notice-order]');try{if(order)await logisticsOpenOrder(order.dataset.noticeOrder);if(e.target.closest('[data-notices-read]')){await api('warehouse-notifications-read',{through_id:data.notifications[0]?.id||0});await poll();}}catch(e){toast(e.message);}};
 enable.onclick=async()=>{if(native()){location.href='gostore-warehouse://push/enable';return;}enable.disabled=true;const version=generation;try{
   const permission=await Notification.requestPermission();if(permission!=='granted')throw Error(text('Браузерын тохиргооноос мэдэгдлийн зөвшөөрөл өгнө үү.','请在浏览器设置中允许通知。'));
   const config=await api('warehouse-push-config');registration??=await navigator.serviceWorker.register('/warehouse/push-sw.js',{scope:'/warehouse/'});await navigator.serviceWorker.ready;
   const raw=atob(config.public_key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-config.public_key.length%4)%4)),key=Uint8Array.from(raw,c=>c.charCodeAt(0));
   let subscription=await registration.pushManager.getSubscription();if(subscription){await subscription.unsubscribe();subscription=null;}
   subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   if(version!==generation||app.hidden){await subscription.unsubscribe();return;}
   const device=await api('warehouse-push-subscribe',{endpoint:subscription.endpoint,public_key:config.public_key});await workerMessage('warehouse-push-config',device);
   status.textContent=text('Push мэдэгдэл идэвхтэй. Энэ төхөөрөмж агуулахын шинэ захиалгын мэдэгдэл авна.','推送已开启，此设备将接收本仓库的新订单通知。');enable.textContent=text('Дахин холбох','重新绑定');
  }catch(e){status.textContent=e.message;}finally{enable.disabled=false;}};
 window.addEventListener('warehouse-native-ready',()=>{labels();if(window.warehouseAuthState===false)location.href='gostore-warehouse://push/clear';else location.href='gostore-warehouse://push/status';});
 window.addEventListener('warehouse-auth',()=>{if(native()&&window.warehouseAuthState===false)location.href='gostore-warehouse://push/clear';});
 window.addEventListener('warehouse-native-push',event=>{
  const messages={
   'test-sent':['Туршилтын мэдэгдэл илгээгдлээ. Утасны мэдэгдлээ шалгана уу.','测试推送已发送，请查看手机通知。'],
   enabled:['Push мэдэгдэл идэвхтэй.','推送已开启。'],off:['Push мэдэгдлийг энэ төхөөрөмжид идэвхжүүлнэ үү.','请在此设备开启推送通知。'],
   connecting:['Push холбож байна…','正在连接推送…'],permission:['Android тохиргооноос аппын мэдэгдлийг зөвшөөрнө үү.','请在 Android 设置中允许应用通知。'],
   'play-services':['Энэ төхөөрөмжид Google Play services шаардлагатай. Браузерын push ашиглаж болно.','此设备需要 Google Play 服务。也可以使用浏览器推送。'],
   login:['Менежерийн эрхээр дахин нэвтэрнэ үү.','请重新登录仓库账号。'],server:['Серверийн push тохиргоо бэлэн болоогүй.','服务器推送尚未配置。'],network:['Push холбогдсонгүй. Сүлжээгээ шалгаад дахин оролдоно уу.','推送连接失败，请检查网络后重试。']
  };const m=messages[event.detail];if(!native()||!m)return;status.textContent=text(...m);testButton.hidden=!['enabled','test-sent'].includes(event.detail);testButton.textContent=text('Push турших','测试推送');enable.disabled=event.detail==='connecting';enable.textContent=event.detail==='enabled'?text('Дахин холбох','重新绑定'):text('Push мэдэгдэл идэвхжүүлэх','开启推送通知');
 });
 new MutationObserver(start).observe(app,{attributes:true,attributeFilter:['hidden']});setInterval(()=>{if(!document.hidden)poll();},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){start();poll();}});start();
})();
