'use strict';
(()=>{
 const app=document.getElementById('app');if(!app)return;
 const text=(mn,zh)=>cityRole()==='erenhot'?zh:mn;
 const panel=document.createElement('section');panel.className='warehouse-notifications';panel.hidden=true;
 panel.innerHTML='<div class="warehouse-notifications-heading"><button type="button" class="quiet" data-notices-toggle aria-expanded="false"></button><button type="button" class="quiet" data-push-enable></button></div><p data-push-status role="status"></p><div data-notices-list hidden></div>';
 document.querySelector('.warehouse-main').prepend(panel);
 const toggle=panel.querySelector('[data-notices-toggle]'),enable=panel.querySelector('[data-push-enable]'),status=panel.querySelector('[data-push-status]'),list=panel.querySelector('[data-notices-list]');
 let data=null,busy=false,activeLocation='',generation=0,registration=null,lastSeen=0;
 const supported=()=>('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window)&&!/GOStoreWarehouse|; wv\)/i.test(navigator.userAgent);
 function labels(){toggle.textContent=text('Мэдэгдэл','通知')+' · '+(data?.unread||0);enable.textContent=text('Push мэдэгдэл идэвхжүүлэх','开启推送通知');
  status.textContent=supported()?text('Энэ төхөөрөмжид шинэ захиалгын push мэдэгдэл авахыг зөвшөөрнө үү.','允许此设备接收新订单推送通知。'):text('Энэ апп/браузер push дэмжихгүй байна. Chrome эсвэл Edge браузераар агуулахын панелд нэвтэрч идэвхжүүлнэ үү.','当前应用/浏览器不支持推送。请在 Chrome 或 Edge 浏览器打开仓库页面后启用。');enable.hidden=!supported();
 }
 async function workerMessage(type,device){registration??=await navigator.serviceWorker.register('/warehouse/push-sw.js',{scope:'/warehouse/'});await navigator.serviceWorker.ready;
  return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('Push worker timeout')),5000);channel.port1.onmessage=()=>{clearTimeout(timer);resolve();};(registration.active||registration.waiting||registration.installing).postMessage({type,device},[channel.port2]);});
 }
 function render(){if(!data)return;toggle.textContent=text('Мэдэгдэл','通知')+' · '+data.unread;
  list.innerHTML=data.notifications.length?`<button class="quiet" type="button" data-notices-read>${text('Бүгдийг уншсанд тооцох','全部标为已读')}</button>`+data.notifications.map(n=>`<button class="warehouse-notice ${n.read_at?'':'unread'}" type="button" data-notice-order="${esc(n.order_id)}"><strong>${esc(n.order_id)}</strong><span>${text('Шинэ захиалга баталгаажлаа','新订单已确认')}</span><small>${esc(date(n.created))}</small></button>`).join(''):`<p>${text('Шинэ мэдэгдэл алга.','暂无新通知。')}</p>`;
 }
 async function poll(){if(busy||app.hidden)return;busy=true;const version=generation;try{const next=await api('warehouse-notifications');if(version!==generation||app.hidden)return;data=next;render();const newest=next.notifications[0]?.id||0;if(lastSeen&&newest>lastSeen){toast(text('Шинэ захиалга баталгаажлаа','新订单已确认'));}lastSeen=newest;
  }catch{}finally{busy=false;}}
 async function start(){if(app.hidden){if(activeLocation){activeLocation='';generation++;data=null;lastSeen=0;panel.hidden=true;list.replaceChildren();if('serviceWorker' in navigator)workerMessage('warehouse-push-clear').catch(()=>{});}return;}
  if(activeLocation===city)return;activeLocation=city;generation++;data=null;lastSeen=0;panel.hidden=false;labels();await poll();
  if(supported())try{registration=await navigator.serviceWorker.register('/warehouse/push-sw.js',{scope:'/warehouse/'});const subscription=await registration.pushManager.getSubscription();if(subscription){status.textContent=text('Энэ төхөөрөмжийн push-ийг одоогийн агуулахтай холбоход доорх товчийг дарна уу.','点击按钮将此设备推送绑定到当前仓库。');}}catch{}
  const order=new URLSearchParams(location.search).get('order');if(order&&/^[A-Z0-9-]{3,50}$/.test(order))try{await logisticsOpenOrder(order);}catch(e){toast(e.message);}
 }
 toggle.onclick=()=>{list.hidden=!list.hidden;toggle.setAttribute('aria-expanded',String(!list.hidden));if(!list.hidden)poll();};
 list.onclick=async e=>{const order=e.target.closest('[data-notice-order]');try{if(order)await logisticsOpenOrder(order.dataset.noticeOrder);if(e.target.closest('[data-notices-read]')){await api('warehouse-notifications-read',{through_id:data.notifications[0]?.id||0});await poll();}}catch(e){toast(e.message);}};
 enable.onclick=async()=>{enable.disabled=true;const version=generation;try{
   const permission=await Notification.requestPermission();if(permission!=='granted')throw Error(text('Браузерын тохиргооноос мэдэгдлийн зөвшөөрөл өгнө үү.','请在浏览器设置中允许通知。'));
   const config=await api('warehouse-push-config');registration??=await navigator.serviceWorker.register('/warehouse/push-sw.js',{scope:'/warehouse/'});await navigator.serviceWorker.ready;
   const raw=atob(config.public_key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-config.public_key.length%4)%4)),key=Uint8Array.from(raw,c=>c.charCodeAt(0));
   let subscription=await registration.pushManager.getSubscription();if(subscription){await subscription.unsubscribe();subscription=null;}
   subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   if(version!==generation||app.hidden){await subscription.unsubscribe();return;}
   const device=await api('warehouse-push-subscribe',{endpoint:subscription.endpoint,public_key:config.public_key});await workerMessage('warehouse-push-config',device);
   status.textContent=text('Push мэдэгдэл идэвхтэй. Энэ төхөөрөмж агуулахын шинэ захиалгын мэдэгдэл авна.','推送已开启，此设备将接收本仓库的新订单通知。');enable.textContent=text('Дахин холбох','重新绑定');
  }catch(e){status.textContent=e.message;}finally{enable.disabled=false;}};
 new MutationObserver(start).observe(app,{attributes:true,attributeFilter:['hidden']});setInterval(()=>{if(!document.hidden)poll();},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){start();poll();}});start();
})();
