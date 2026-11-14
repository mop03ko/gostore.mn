'use strict';
// Shared web preference. Only the warehouse ID is persisted; GPS stays in memory.
(()=>{
 const key='gostore-pickup-warehouse-v1',sessionKey='gostore-warehouse-reminded-v1';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let shipping=null,user=null,dialog=null,generation=0;
 const read=()=>{try{const p=JSON.parse(localStorage.getItem(key));return p?.version===1&&typeof p.location==='string'?p.location:null;}catch{return null;}};
 const locations=()=>shipping?.pickup_locations??(shipping?.pickup?[{...shipping.pickup,location:'ulaanbaatar',city:'Улаанбаатар'}]:[]);
 const selected=()=>locations().find(p=>p.location===read())||null;
 const currentUser=()=>window.customerAccount?window.customerAccount.user:user;
 function save(id){if(!locations().some(p=>p.location===id))throw Error('Энэ агуулахыг сонгох боломжгүй байна.');localStorage.setItem(key,JSON.stringify({version:1,location:id}));renderSummary();dispatchEvent(new Event('gostore-warehouse-changed'));}
 const api=async action=>{const r=await fetch('/api/index.php?action='+action,{credentials:'same-origin',cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Мэдээлэл авч чадсангүй.');return data;};
 const ready=window.catalogReady?Promise.resolve(window.catalogReady).then(()=>{shipping=window.storeServer?.shipping;user=currentUser();}):api('catalog').then(r=>{shipping=r.shipping;user=r.customer;}).catch(()=>{});
 const home=()=>/^\/(?:index\.html)?$/.test(location.pathname)&&!location.search&&!document.documentElement.matches('.listing-view,.product-view,.account-view,.auth-view-open');
 function renderSummary(){
  let host=document.getElementById('warehouse-choice-summary');
  if(!host){const entry=document.getElementById('self-cargo-entry');if(!entry)return;host=document.createElement('section');host.id='warehouse-choice-summary';host.className='container wp-summary';entry.after(host);}
  const p=selected();host.innerHTML='<div><span class="wp-eyebrow">ТАНЫ АВАХ АГУУЛАХ</span><strong>'+esc(p?.name||'Агуулахаа сонгоорой')+'</strong>'+(p?'<small>'+esc(p.address)+'</small>':'')+'</div><div class="wp-actions"><button type="button" data-warehouse-open>'+(p?'Агуулах солих':'Агуулах сонгох')+'</button>'+(currentUser()?'<button type="button" data-erenhot-open>Эрээн агуулахын хаяг харах</button>':'')+'</div>';
 }
 function createDialog(title){
  const d=document.createElement('dialog');d.className='wp-dialog';d.setAttribute('aria-labelledby','wp-title');
  d.innerHTML='<div class="wp-scroll"><h2 id="wp-title">'+esc(title)+'</h2><div data-wp-content></div></div><div class="wp-footer"></div>';
  d.addEventListener('close',()=>{generation++;d.remove();if(dialog===d)dialog=null;});document.body.append(d);dialog=d;return d;
 }
 // Reference city centres, not warehouse GPS pins. Same thresholds as the Expo app.
 function recommend(list,pos){
  const {latitude:a,longitude:b,accuracy}=pos.coords,now=Date.now();
  if(![a,b,pos.timestamp,accuracy].every(Number.isFinite)||Math.abs(a)>90||Math.abs(b)>180||accuracy<0||accuracy>10000||now-pos.timestamp>120000||pos.timestamp>now+10000)return null;
  const cities={'Улаанбаатар':[47+55/60+16.9/3600,106+54/60+19.87/3600],'Замын-Үүд':[43+43/60+5/3600,111+54/60+22/3600],'Сайншанд':[44+53/60+30/3600,110+8/60+12/3600]},rad=Math.PI/180;
  const ranked=list.flatMap(p=>{const point=cities[p.city];if(!point)return[];const[c,d]=point,h=Math.sin((c-a)*rad/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;return[{p,km:12742*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))))}];}).sort((a,b)=>a.km-b.km);
  return !ranked.length||ranked[0].km>150||(ranked[1]&&ranked[1].km-ranked[0].km<=10+2*accuracy/1000)?null:ranked[0].p;
 }
 async function open(){
  await ready;if(document.querySelector('dialog[open]'))return;
  const d=createDialog('Авах агуулахаа сонгоорой'),p=selected(),options=locations();
  d.querySelector('[data-wp-content]').innerHTML='<p>Хүлээн авах боломжтой агуулахуудаас сонгоорой. Дараа нь сольж болно.</p><button type="button" data-wp-locate>Ойр агуулах санал болгох</button><small>Байршлыг хадгалахгүй. Зөвшөөрөл өгөхгүйгээр гараар сонгож болно.</small><p data-wp-status role="status" aria-live="polite"></p><fieldset class="wp-options"><legend class="wp-sr-only">Авах агуулах</legend>'+options.map(x=>'<label class="wp-option"><input type="radio" name="warehouse" value="'+esc(x.location)+'" '+(x.location===p?.location?'checked':'')+'><span><strong>'+esc(x.city||x.name)+'</strong><em data-wp-recommend="'+esc(x.location)+'" hidden>Байршлаар санал болгож байна</em><span>'+esc(x.address)+'</span><small>'+esc(x.phone)+'</small></span></label>').join('')+'</fieldset>'+(options.length?'':'<p>Агуулахын мэдээлэл ирээгүй байна. Түр хаагаад дахин оролдоорой.</p>');
  d.querySelector('.wp-footer').innerHTML='<button type="button" class="wp-primary" data-wp-save '+(!p?'disabled':'')+'>Сонголтоо хадгалах</button><button type="button" data-wp-close>'+(p?'Өмнөх сонголтоор үргэлжлүүлэх':'Дараа сонгох')+'</button><small>Зөвхөн шинэ захиалгын авах газрыг сонгоно.</small>';
  const status=d.querySelector('[data-wp-status]'),locate=d.querySelector('[data-wp-locate]');
  d.addEventListener('change',()=>{generation++;locate.disabled=false;status.textContent='';d.querySelector('[data-wp-save]').disabled=!d.querySelector('input:checked');});
  locate.onclick=()=>{
   if(!navigator.geolocation){status.textContent='Энэ хөтөч байршил унших боломжгүй. Гараар сонгоорой.';return;}
   const request=++generation;locate.disabled=true;status.textContent='Байршил тодорхойлж байна…';d.querySelectorAll('[data-wp-recommend]').forEach(e=>e.hidden=true);
   let timer;const finish=(pos,error)=>{if(request!==generation||!d.open)return;clearTimeout(timer);generation++;locate.disabled=false;const rec=pos&&recommend(options,pos);if(rec){d.querySelector('[data-wp-recommend="'+CSS.escape(rec.location)+'"]').hidden=false;status.textContent='Хотын байршлаар ойролцоолсон санал. Авах газраа өөрөө сонгож батална.';}else status.textContent=error||'Ойр хотын агуулахыг найдвартай санал болгож чадсангүй. Гараар сонгоорой.';};
   timer=setTimeout(()=>finish(null,'Байршил тодорхойлох хугацаа дууслаа. Гараар сонгоорой.'),20000);
   navigator.geolocation.getCurrentPosition(pos=>finish(pos),e=>finish(null,e.code===1?'Байршлын зөвшөөрөл өгөөгүй байна. Гараар сонгох эсвэл хөтөчийн тохиргооноос зөвшөөрнө үү.':'Байршлыг авч чадсангүй. Гараар сонгоорой.'),{enableHighAccuracy:false,timeout:20000,maximumAge:60000});
   d.addEventListener('close',()=>clearTimeout(timer),{once:true});
  };
  d.querySelector('[data-wp-save]').onclick=()=>{try{save(d.querySelector('input:checked')?.value);d.close();}catch{status.textContent='Сонголтыг хадгалж чадсангүй. Хөтөчийн хадгалалтыг зөвшөөрөөд дахин оролдоорой.';}};
  d.querySelector('[data-wp-close]').onclick=()=>d.close();
  d.showModal();await new Promise(resolve=>d.addEventListener('close',resolve,{once:true}));
 }
 async function erenhot(){
  if(document.querySelector('dialog[open]'))return;
  const d=createDialog('Эрээн агуулахын хаяг'),body=d.querySelector('[data-wp-content]');body.innerHTML='<p role="status">Ачаалж байна…</p>';d.querySelector('.wp-footer').innerHTML='<a href="/self-cargo.html#sc-address">Өөрөө захиалах, ачаа бүртгэх →</a><button type="button" data-wp-close>Хаах</button>';d.querySelector('[data-wp-close]').onclick=()=>d.close();d.showModal();
  const request=++generation;
  try{
   const me=await api('customer-me');if(!me.customer)throw Error('Нэвтэрч орсны дараа агуулахын хаягаа харна уу.');
   const owner=me.customer.id,r=await api('customer-self-cargo');if(!d.open||generation!==request||(window.customerAccount&&currentUser()?.id!==owner))return;
   const address=r.delivery;if(!address)throw Error('Агуулахын хаяг одоогоор боломжгүй байна.');
   body.innerHTML='<p>Худалдагчид өгөх хаяг. Хүлээн авагч, хаяг дахь өөрийн карго ID-г хэвээр үлдээгээрэй.</p><dl>'+[['cargo_id','Таны карго ID'],['recipient','Хүлээн авагч · 收货人'],['phone','Утас · 手机号码'],['address','Хаяг · 详细地址']].map(([k,label])=>'<dt>'+label+'</dt><dd>'+esc(address[k])+'</dd>').join('')+'</dl><button type="button" data-wp-copy>Хаягийг бүхэлд нь хуулах</button><p role="status" data-wp-copy-status></p>';
   body.querySelector('[data-wp-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(address.label);if(d.open)body.querySelector('[data-wp-copy-status]').textContent='Хууллаа ✓';}catch{if(d.open)body.querySelector('[data-wp-copy-status]').textContent='Текстийг сонгож хуулна уу.';}};
  }catch(e){if(d.open&&generation===request)body.innerHTML='<p role="alert">'+esc(e.message)+'</p><a href="/login?next=%2Fself-cargo.html">Нэвтрэх →</a>';}
 }
 const startup=(async()=>{await ready;renderSummary();let seen=false;try{seen=sessionStorage.getItem(sessionKey)==='1';}catch{}if(!home()||seen||!locations().length)return;try{sessionStorage.setItem(sessionKey,'1');}catch{}await open();})();
 window.warehousePreference={ready,startup,selected,locations,save,open,recommend};
 document.addEventListener('click',e=>{if(e.target.closest('[data-warehouse-open]'))void open();if(e.target.closest('[data-erenhot-open]'))void erenhot();});
 addEventListener('gostore-customer-changed',()=>{if(dialog)dialog.close();renderSummary();});
 addEventListener('storage',e=>{if(e.key===key)renderSummary();if(e.key==='gostore-account-changed-v1'&&dialog)dialog.close();});
})();
