'use strict';
function cargoDate(value,dateOnly=false){
  const when=new Date(value);if(!Number.isFinite(when.getTime()))return '—';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(when).map(p=>[p.type,p.value]));
  return parts.year+'.'+parts.month+'.'+parts.day+(dateOnly?'':' · '+parts.hour+':'+parts.minute);
}
function cargoPhotosHtml(photos=[]){
  if(!photos.length)return '';
  const warehouses=Object.fromEntries(photos.map(p=>[p.location,p.warehouse_name||({erenhot:'Эрээн агуулах',ulaanbaatar:'Улаанбаатар агуулах'}[p.location])||'Агуулах']));
  return '<section class="cargo-photo-section"><h3>Агуулахад бүртгэсэн зураг</h3><p>Зураг дээр дарж томруулж харна уу.</p>'+Object.entries(warehouses).map(([location,label])=>{
    const rows=photos.filter(p=>p.location===location);if(!rows.length)return '';
    return `<section data-photo-warehouse="${esc(location)}"><h4>${esc(label)}</h4><div class="cargo-photos">${rows.map(p=>`<figure><button type="button" data-cargo-photo-toggle aria-expanded="false" aria-label="${esc(label)}ын зургийг томруулах"><img data-cargo-photo="${esc(p.id)}" alt="${esc(label)}ад бүртгэсэн бараа" loading="lazy"></button><figcaption><time datetime="${esc(p.at)}">${esc(cargoDate(p.at))}</time></figcaption></figure>`).join('')}</div></section>`;
  }).join('')+'</section>';
}
function cargoPickupWarehouse(o){const w=o.pickup_warehouse;if(!w?.address)return '';return `<section class="info-box"><h3>${esc(w.name)}</h3><p style="white-space:pre-line">${esc(w.address)}</p><p>Утас: ${esc(w.phone)}${w.contact_phone?' · '+esc(w.contact_phone):''}</p>${w.hours?`<p>Ажиллах цаг: ${esc(w.hours)}</p>`:''}</section>`;}
let cargoRequest=0;
const cargoPageId=location.pathname.match(/^\/account\/orders\/(GS-[a-z0-9-]{3,45})\/?$/i)?.[1].toUpperCase();
const cargoOrderHref=id=>'/account/orders/'+encodeURIComponent(id);
const cargoPage=cargoPageId?document.createElement('section'):null;
function renderCargoPage(body){
  cargoPage.innerHTML=`<nav class="pd-breadcrumb" aria-label="Байршил"><a href="/">Нүүр</a><span>/</span><a href="/account/orders">Миний ачаа</a><span>/</span><span>${esc(cargoPageId)}</span></nav><h1 class="store-title">Ачааны дэлгэрэнгүй</h1>${body}`;
}
function cargoSignInHtml(){
  const next=encodeURIComponent(cargoOrderHref(cargoPageId));
  return `<div class="account-empty"><h2>Нэвтэрч орно уу</h2><a class="button blue" href="/login?next=${next}">Нэвтрэх</a></div>`;
}
if(cargoPage){
  cargoPage.id='cargo-page';cargoPage.className='container store-page';
  document.querySelector('#main').prepend(cargoPage);
  document.title='Ачааны дэлгэрэнгүй · gostore.mn';
  renderCargoPage('<p class="account-loading" role="status">Ачаалж байна…</p>');
}
const cargoNext=o=>o.cancel_reason==='payment_timeout'?'Төлбөрийн хугацаа дууссан тул автоматаар цуцлагдсан. Сагсаа дахин захиална уу.':o.payment_due&&o.status==='quoted'&&!o.paid?'Төлөх хугацаа: '+cargoDate(o.payment_due)+' хүртэл. Төлбөр орсны дараа нийлүүлэгчээс захиална.':o.status==='cancelled'?'Захиалга цуцлагдсан. Асуух зүйл байвал GOStore-той холбогдоно уу.':o.cargo?.issue_count?'Агуулах зөрчлийг шалгаж байна.':o.cargo?.billing?.due&&o.cargo?.billing?.finalized?'Үлдэгдэл төлбөрөө төлөөд авах кодоо харна уу.':o.status==='ready_pickup'?'Авах кодоо агуулахын ажилтанд үзүүлнэ үү.':o.status==='out_for_delivery'?'Бараагаа авах үедээ хүргэгчид авах кодоо хэлнэ үү.':o.status==='erenhot_ready'?'Барааг багцалж дууссан. Агуулахаас илгээхийг хүлээж байна.':o.status==='erenhot_dispatched'?(o.warehouse_names?.erenhot||'Эрээн агуулах')+'-аас гарсан. Замын-Үүдээр дамжин '+(o.warehouse_names?.ulaanbaatar||'Улаанбаатар агуулах')+' руу хүргэгдэнэ.':o.status==='quoted'?'Үнийн саналаа шалгаж төлбөрөө төлнө үү.':o.status==='completed'?'Барааг хүлээлгэн өгсөн.':'Дараагийн төлөв шинэчлэгдэхэд сайтын мэдэгдэлд харагдана.';
const cargoGroup=o=>o.status==='cancelled'?'cancelled':o.status==='quoted'&&!o.paid?'payment':o.status==='completed'?'done':o.cargo?.billing?.finalized&&o.cargo.billing.due>0?'payment':['ready_pickup','ready_delivery','out_for_delivery'].includes(o.status)?'ready':'transit';


async function viewServerOrder(id,requestInvoice=false,action=null){
  const onPage=cargoPageId===id;
  if(!requestInvoice&&!action&&!onPage){location.assign(cargoOrderHref(id));return;}
  if(!customerAccount.user){
    if(onPage)renderCargoPage(cargoSignInHtml());else accountForm();
    return;
  }
  const request=++cargoRequest,r=savedRequests().find(x=>x.id===id)||{id,token:''};
  try{
    const {order:o}=await shopApi(action||(requestInvoice?'invoice':'order-get'),r);if(request!==cargoRequest)return;
    const c=o.cargo||{},bill=c.billing||{finalized:false,total:o.amount,paid:o.paid?o.amount:0,due:o.paid?0:o.amount,breakdown:o.quote?.breakdown||{}},m=c.measurement;
    const activeInitial=o.invoice?.state==='ready'&&!o.paid&&o.status==='quoted'&&(!o.payment_due||Date.parse(o.payment_due)>Date.now());
    const activeFreight=c.freight_invoice?.state==='ready'&&bill.finalized&&bill.due>0;
    if((requestInvoice||action==='payment-check'||action==='freight-invoice')&&(activeInitial||activeFreight)){
      const freight=activeFreight&&(!activeInitial||action==='freight-invoice');
      const panel=freight?qpayPanel(c.freight_invoice,o.id,bill.due,true):qpayPanel(o.invoice,o.id,o.amount);
      openModal('Төлбөр төлөх',panel+(!freight&&o.payment_due?'<p class="info-box" data-payment-countdown></p>':'')+`<div class="form-actions"><button class="button blue" data-payment-check="${esc(o.id)}">Төлбөр шалгах</button><button class="button outline" data-server-order="${esc(o.id)}">Захиалга харах</button></div>`);
      watchOrderPayment(o);
      watchCargoPayment(r,o,request);
      return;
    }
    if(!onPage){location.assign(cargoOrderHref(id));return;}
    if((requestInvoice||action)&&document.querySelector('#modal[open] [data-payment-check]'))closeModal();
    const labels={goods_mnt:'Бараа',domestic_mnt:'Хятад доторх хүргэлт',service_mnt:'Үйлчилгээ',cargo_mnt:'Карго',delivery_mnt:'УБ хүргэлт'};
    const history=[{status:'new',at:o.created},...(o.history||[])];
    renderCargoPage(`<div class="cargo-detail"><div class="cargo-detail-code"><strong>${esc(o.id)}</strong><button class="text-button" data-copy-cargo="${esc(o.id)}">Код хуулах</button></div><span class="cargo-status">${esc(orderStatusLabel(o))}</span><h3>${esc(o.title)}</h3><p class="cargo-next-step">${esc(cargoNext(o))}</p>${OrderTracking.html(o,{history:false})}${o.supplier?.image?`<img class="cargo-product" src="${esc(o.supplier.image)}" alt="${esc(o.title)}" referrerpolicy="no-referrer">`:''}${(o.type==='checkout'||o.shipment_parent)&&o.items?.length?`<ul class="cargo-items">${o.items.map(i=>`<li>${esc(i.name)} · ${esc(i.variant)} × ${i.qty}</li>`).join('')}</ul>`:`<p>${esc(o.supplier?.variant||o.variant||'')} ${o.supplier?.qty?'× '+o.supplier.qty:''}</p>`}${c.issue_count?'<div class="info-box">Агуулахад зөрчил бүртгэгдсэн. Шалгалт дуусмагц явц шинэчлэгдэнэ.</div>':''}${cargoPickupWarehouse(o)}${!o.fulfillment&&o.fulfillment_request?.method==='delivery'?`<div class="info-box"><strong>Хүргэлтээр авна</strong><p>${esc(o.delivery_address||'')}</p><p>УБ хүргэлтийн төлбөрийг эцсийн тооцоонд нэмнэ.</p></div>`:''}${c.pickup_code?`<section class="pickup-pass"><h3>${(o.remaining_status||o.status)==='ready_pickup'?'Агуулахаас авах код':'Хүргэлт хүлээн авах код'}</h3><strong>${esc(c.pickup_code)}</strong>${code39(c.pickup_code)}<p>Бараагаа авах үедээ ажилтанд үзүүлнэ үү. Нэг удаа ашиглана.</p></section>`:''}<details ${["ready_pickup","out_for_delivery","completed"].includes(o.status)?"":"open"}><summary>Явцын түүх</summary><ol class="cargo-timeline">${history.map(h=>`<li><strong>${esc(orderStatusLabel(o,h.status))}</strong><small>${cargoDate(h.at)}</small></li>`).join('')}</ol></details>${cargoPhotosHtml(c.photos)}${o.type==='checkout'&&o.quote?`<details class="order-calculation" ${bill.finalized?'':'open'}><summary>${esc(commerceUI.calculationTitle)}</summary>${commerceUI.calculationHtml(o.quote,o.items||[],commerceUI.calculationTitle,'Захиалгын эхний төлбөр')}</details>`:''}<section class="cargo-bill">${bill.finalized&&o.quote?`<p>Урьдчилсан тооцоо: ${money(o.quote.total)} · Зөрүү: ${money(bill.total-o.quote.total)}</p>`:''}<h3>${bill.finalized?'Эцсийн тооцоо':o.type==='checkout'?'Урьдчилан төлөх дүн':'Урьдчилсан үнийн санал'}</h3>${Object.entries(labels).filter(([k])=>k in bill.breakdown).map(([k,v])=>`<div><span>${v}</span><strong>${k==='cargo_mnt'&&!bill.finalized&&o.quote?.cargo_later?'Салбарт ирэхэд бодит жингээр':k==='domestic_mnt'&&!bill.finalized&&o.quote?.domestic_later?'Салбарт ирэхэд бодит дүнгээр':money(bill.breakdown[k])}</strong></div>`).join('')}<div><span>Нийт</span><strong>${money(bill.total)}</strong></div><div><span>Төлсөн</span><strong>${money(bill.paid)}</strong></div><div class="cargo-total"><span>Үлдэгдэл</span><strong>${money(bill.due)}</strong></div>${bill.refund_due?`<p class="form-error">Илүү төлөлт ${money(bill.refund_due)}. Админ буцаалтыг тулгаж шалгана.</p>`:''}</section>${m?`<section><h3>Агуулахын хэмжилт</h3><p>${m.weight_kg} кг · ${m.length_cm?`${m.length_cm} × ${m.width_cm} × ${m.height_cm} см · `:''}${m.volume_m3} м³ · ${m.pieces} ширхэг</p></section>`:''}${o.fulfillment?`<p>Хүлээн авах: ${o.fulfillment.method==='pickup'?'Агуулахаас авах':'Хүргэлтээр авах'}</p>`:''}${o.payment_due&&o.invoice&&!o.paid&&o.status==='quoted'?'<p class="info-box" data-payment-countdown></p>':''}${!o.paid&&o.status==='quoted'&&(!o.payment_due||Date.parse(o.payment_due)>Date.now())?qpayPanel(o.invoice,o.id,o.amount):''}${bill.due>0?qpayPanel(c.freight_invoice,o.id,bill.due,true):''}<div class="form-actions"><button class="button outline" data-server-order="${esc(o.id)}">Төлөв шинэчлэх</button>${qpayEnabled&&!o.demo&&o.status==='quoted'&&!o.paid&&(!o.payment_due||Date.parse(o.payment_due)>Date.now())?`<button class="button blue" data-invoice="${esc(o.id)}">Эхний төлбөр · QPay</button>`:''}${qpayEnabled&&!o.demo&&bill.finalized&&bill.due>0?`<button class="button blue" data-freight-invoice="${esc(o.id)}">Үлдэгдэл төлөх · QPay</button>`:''}${qpayEnabled&&(o.invoice||c.freight_invoice)?`<button class="button outline" data-payment-check="${esc(o.id)}">Төлбөр шалгах</button>`:''}</div><a class="text-button" href="/account/orders">← Миний ачаа</a></div>`);
    cargoPage.querySelectorAll('[data-cargo-photo]').forEach(async img=>{try{const res=await fetch('/api/index.php?action=order-photo',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':shopCsrf},body:JSON.stringify({...r,photo:img.dataset.cargoPhoto})});if(!res.ok)throw Error();const blob=await res.blob();if(!img.isConnected)return;const url=URL.createObjectURL(blob);img.onload=()=>URL.revokeObjectURL(url);img.onerror=()=>URL.revokeObjectURL(url);img.src=url;}catch{img.alt='Зураг ачаалсангүй. Төлөв шинэчилж дахин оролдоно уу.';}});
    watchOrderPayment(o,cargoPage);
    watchCargoPayment(r,o,request,cargoPage.querySelector('.cargo-detail'));
  }catch(e){
    if(request!==cargoRequest)return;
    if(onPage&&!requestInvoice&&!action){
      renderCargoPage(`<p class="form-error" role="alert">${esc(e.message)}</p><div class="form-actions"><button class="button outline" data-server-order="${esc(id)}">Дахин оролдох</button><a class="button outline" href="/account/orders">Миний ачаа</a></div>`);
    }else toast(e.message);
  }
}
// While an unpaid QPay invoice is open, follow the server-side callback so the customer
// does not need to press "Төлбөр шалгах" after returning from the bank app.
let cargoPaymentWatch=null;
const cargoDue=o=>!o.paid&&o.status==='quoted'&&o.invoice?.state==='ready'?'initial':o.cargo?.freight_invoice&&o.cargo?.billing?.due>0?'freight':null;
function stopCargoPaymentWatch(){cargoPaymentWatch?.();cargoPaymentWatch=null;}
function watchCargoPayment(r,o,request,detail=null){
  stopCargoPaymentWatch();const kind=cargoDue(o);if(!kind)return;
  const modal=document.querySelector('#modal'),started=Date.now();let ticks=0,busy=false;
  const active=()=>detail?detail.isConnected:modal.open;
  const check=async full=>{
    if(request!==cargoRequest||!active()||Date.now()-started>15*60*1000){stopCargoPaymentWatch();return;}
    if(busy)return;busy=true;
    // order-get reads the stored order; payment-check also asks QPay in case its callback was missed.
    try{const {order:next}=await shopApi(full?'payment-check':'order-get',r);if(request===cargoRequest&&active()&&!cargoDue(next)){stopCargoPaymentWatch();if(cargoPaymentSettled(next,kind)){if(detail){await viewServerOrder(next.id);if(cargoRequest===request+1&&cargoPage.querySelector('.cargo-detail'))cargoPaymentSuccess(next,kind);}else cargoPaymentSuccess(next,kind);}else void viewServerOrder(next.id);}}catch{}finally{busy=false;}
  };
  const timer=setInterval(()=>check(++ticks%8===0),4000);
  const returned=()=>{if(document.visibilityState==='visible')check(true);};
  document.addEventListener('visibilitychange',returned);if(!detail)modal.addEventListener('close',stopCargoPaymentWatch,{once:true});
  cargoPaymentWatch=()=>{clearInterval(timer);document.removeEventListener('visibilitychange',returned);modal.removeEventListener('close',stopCargoPaymentWatch);};
}
const cargoPaymentSettled=(o,kind)=>kind==='initial'?o.paid===true:!!o.cargo?.billing?.finalized&&o.cargo.billing.due===0;
function cargoPaymentSuccess(o,kind){
  if(!cargoPaymentSettled(o,kind))return;
  const paid=o.cargo?.billing?.paid??o.amount;
  if(kind==='initial')window.gtag?.('event','purchase',{transaction_id:o.id,value:o.amount,currency:'MNT'});
  const next=kind==='freight'?['Сонгосон салбар барааг хүлээлгэн өгөхөд бэлдэнэ.','Авах код «Миний захиалга» хэсэгт гарна.']:['GOStore бараагаа Taobao-оос худалдан авна.','Эрээн агуулахад ирэхэд зурагтай мэдэгдэл ирнэ.','Сонгосон салбарт ирэхэд каргог бодит жингээр тооцож, авах код гарна.'];
  openModal('Төлбөр амжилттай',`<div class="payment-success" role="status"><span class="payment-success-icon" aria-hidden="true">✓</span><h3>${kind==='freight'?'Үлдэгдэл төлбөр баталгаажлаа':'Таны захиалга баталгаажлаа'}</h3><p>Захиалгын код <strong>${esc(o.id)}</strong> · Төлсөн ${money(paid)}</p><ol class="payment-next">${next.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><div class="form-actions"><button class="button blue" data-server-order="${esc(o.id)}">Захиалгын явц харах</button><button class="button outline" data-payment-done>Дэлгүүр үргэлжлүүлэх</button></div></div>`);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-payment-done]'))document.querySelector('#close-modal').click();});
async function refreshCargoNotifications(){if(!window.customerAccount?.user){document.querySelectorAll('[data-notification-count]').forEach(n=>n.textContent='');return null;}const userId=customerAccount.user.id,d=await shopApi('customer-notifications');if(customerAccount.user?.id!==userId)return null;const unread=(d.unread||0)+(d.messages_unread||0);document.querySelectorAll('[data-notification-count]').forEach(n=>n.textContent=unread?String(unread):'');return d;}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');
  if(b?.dataset.copyCargo){
    try{await navigator.clipboard.writeText(b.dataset.copyCargo);toast('Захиалгын кодыг хууллаа');}
    catch{toast('Кодыг сонгож гараар хуулна уу: '+b.dataset.copyCargo);}
  }
  if(b?.dataset.freightInvoice||b?.dataset.paymentCheck){
    b.disabled=true;
    try{await viewServerOrder(b.dataset.freightInvoice||b.dataset.paymentCheck,false,b.dataset.freightInvoice?'freight-invoice':'payment-check');}
    finally{b.disabled=false;}
  }
});
setInterval(()=>{if(!document.hidden&&window.customerAccount?.user)refreshCargoNotifications().catch(()=>{});},60000);
setTimeout(()=>refreshCargoNotifications().catch(()=>{}),2000);

let cargoPageReady=false;
const cargoSetUser=customerAccount.setUser;
customerAccount.setUser=user=>{
  const changed=customerAccount.user?.id!==user?.id;
  if(changed){++cargoRequest;stopCargoPaymentWatch();}
  cargoSetUser(user);
  if(!user)document.querySelectorAll('[data-notification-count]').forEach(n=>n.textContent='');
  else refreshCargoNotifications().catch(()=>{});
  if(changed&&cargoPageReady){
    closeModal();
    renderCargoPage('<p class="account-loading" role="status">Ачаалж байна…</p>');
    void viewServerOrder(cargoPageId);
  }
};
if(cargoPage)window.catalogReady.then(async()=>{
  try{await customerAccount.refresh();}catch{}
  cargoPageReady=true;
  void viewServerOrder(cargoPageId);
});

document.addEventListener('click',e=>{const b=e.target.closest('[data-cargo-photo-toggle]');if(!b)return;const expanded=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(expanded));b.setAttribute('aria-label',expanded?'Зургийг хураах':'Зургийг томруулах');b.closest('figure').classList.toggle('expanded',expanded);});
