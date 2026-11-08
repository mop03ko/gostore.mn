'use strict';
// Ulaanbaatar warehouse (owner request 2026-11-09): one-step sorting, counter handover of several orders,
// courier runs and waiting tags. Ulaanbaatar screens are Mongolian.
const ubMoney=v=>Number(v||0).toLocaleString('en-US')+'₮';
const ubReasonText=o=>({not_sorted:'Ангилаагүй',delivery:'Хүргэлтээр авна',out_for_delivery:'Хүргэлтэд гарсан',issue:'Нээлттэй зөрчилтэй',no_bill:'Тооцоо батлагдаагүй',unpaid:'Үлдэгдэл '+ubMoney(o.due)+' төлөөгүй',refund:'Буцаалт '+ubMoney(o.refund_due)+' хүлээгдэж байна',unavailable:'Хүлээлгэн өгөх боломжгүй'})[o.reason]||'';
const ubStatuses=['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'];
function ubCardTags(o){
  if(cityRole()!=='ulaanbaatar')return '';const f=o.flags||{},shelf=o.logistics?.shelf;
  return `${shelf?`<small class="ub-shelf">Тавиур ${esc(shelf)}</small>`:''}${f.unpaid?`<span class="warehouse-alert-tag">Төлбөр хүлээж буй · ${ubMoney(f.unpaid)}</span>`:''}${f.stale?`<span class="warehouse-alert-tag">${f.stale} хоног авалгүй</span>`:''}`;
}

// One step: receipt photo, shelf, pickup/delivery and contact; the bill is shown before it is confirmed.
function ubSortHtml(o){
  const l=o.logistics||{},hasPhoto=(l.photos||[]).some(p=>p.location===city),method=o.fulfillment?.method||o.requested_method||'pickup',locked=!!o.freight_locked,again=['ready_pickup','ready_delivery'].includes(o.status);
  return `<form data-ub-sort data-id="${esc(o.id)}" data-version="${l.version||0}" data-expected="${esc(o.status)}" data-has-photo="${hasPhoto?'1':''}" class="warehouse-confirm receive-form">
<h3>${again?'Ангилалт засах':'Ангилах · нэг алхам'}</h3><p class="muted">Зураг, тавиур, авах хэлбэрийг оруулаад нэг товчоор ангилж, эцсийн тооцоог батална. Хэрэглэгчид үлдэгдэл төлбөр, авах кодны мэдэгдэл нэг удаа очно.</p>
<label>${hasPhoto?'Нэмэлт зураг · заавал биш':'Хүлээн авах зураг · камер эсвэл зургийн сан'}<input type="file" name="image" accept="image/jpeg,image/png,image/webp"></label><img class="warehouse-photo-preview" alt="Сонгосон зураг" hidden>
<div class="form-grid"><label>Тавиурын байрлал<input name="shelf" maxlength="50" required placeholder="A-03-02" autocomplete="off" value="${esc(l.shelf||'')}"></label><label>Авах хэлбэр<select name="method" ${locked?'disabled':''}><option value="pickup" ${method!=='delivery'?'selected':''}>Агуулахаас авах</option><option value="delivery" ${method==='delivery'?'selected':''}>Хүргэлтээр</option></select></label>
<label>Холбогдох утас<input name="contact_phone" type="tel" maxlength="30" required value="${esc(o.contact?.phone||'')}"></label></div>
${locked?'<p class="muted">Тээврийн төлбөрийн нэхэмжлэл үүссэн тул авах хэлбэр, тооцоо өөрчлөгдөхгүй.</p>':''}
<label data-ub-address>Хүргэлтийн хаяг<textarea name="address" maxlength="500">${esc(o.contact?.address||'')}</textarea></label>
<label data-ub-delivery>УБ хүргэлтийн төлбөр · ₮<input name="delivery_mnt" type="number" min="0" max="10000000" step="1" value="${Number(o.settlement?.breakdown?.delivery_mnt||0)}"></label>
${!o.settlement&&o.quote?.domestic_later?'<label>Хятад доторх хүргэлт · ₮ (бодит дүн)<input name="domestic_mnt" type="number" min="0" max="100000000" step="1" required value="0"></label>':''}
<output data-ub-bill aria-live="polite"></output>
<label class="check"><input type="checkbox" name="checked" required><span>Бараа, хувилбар, тоо ширхэгийг тулгаж шалгасан</span></label>
${errorBox()}<button class="primary">${again?'Хадгалах':'Ангилж, тооцоо батлах'}</button></form>`;
}
function ubSortPreview(){
  const f=document.querySelector('[data-ub-sort]');if(!f)return;const o=activeLogisticsOrder?.id===f.dataset.id?activeLogisticsOrder:null;
  const delivery=f.elements.method.value==='delivery';f.querySelector('[data-ub-address]').hidden=!delivery;f.querySelector('[data-ub-delivery]').hidden=!delivery;f.elements.address.required=delivery;
  const out=f.querySelector('[data-ub-bill]'),b=o?.billing||{};if(!o)return;
  if(o.freight_locked){out.textContent=`Тооцоо: нийт ${ubMoney(b.total)} · төлсөн ${ubMoney(b.paid)} · үлдэгдэл ${ubMoney(b.due)}`;return;}
  const base=o.settlement?.breakdown||o.quote?.breakdown;if(!base){out.textContent='Тооцооны задаргаа алга: ангилсны дараа «Эцсийн тооцоо» хэсгээс батална.';return;}
  const t=o.logistics?.transport,m=o.logistics?.measurement;
  const cargo=t?Math.ceil(t.amount_mnt):(m&&o.cargo_rates?Math.ceil(GOStoreCargo.calculate(m.weight_kg,m.volume_m3,o.cargo_rates)?.amount_mnt??NaN):NaN);
  if(!Number.isFinite(cargo)){out.textContent='Каргоны дүн тооцоолох хэмжилт дутуу байна.';return;}
  const domestic=f.elements.domestic_mnt?Number(f.elements.domestic_mnt.value)||0:Number(base.domestic_mnt)||0,fee=delivery?Number(f.elements.delivery_mnt.value)||0:0;
  const total=(Number(base.goods_mnt)||0)+domestic+(Number(base.service_mnt)||0)+fee+cargo,due=total-(b.paid||0);
  out.textContent=`Нийт ${ubMoney(total)} (бараа ${ubMoney(base.goods_mnt)} · Хятад хүргэлт ${ubMoney(domestic)} · үйлчилгээ ${ubMoney(base.service_mnt)} · карго ${ubMoney(cargo)}${delivery?' · УБ хүргэлт '+ubMoney(fee):''}) · төлсөн ${ubMoney(b.paid)} · ${due>=0?'үлдэгдэл '+ubMoney(due):'буцаах '+ubMoney(-due)}`;
}
window.ubSortPreview=ubSortPreview;
document.addEventListener('input',e=>{if(e.target.closest('[data-ub-sort]'))ubSortPreview();});
document.addEventListener('change',e=>{
  const f=e.target.closest('[data-ub-sort]');if(!f)return;ubSortPreview();
  if(e.target.type==='file'&&e.target.files[0]){const preview=f.querySelector('.warehouse-photo-preview'),url=URL.createObjectURL(e.target.files[0]);preview.onload=preview.onerror=()=>URL.revokeObjectURL(url);preview.src=url;preview.hidden=false;}
});
document.addEventListener('submit',async e=>{
  const f=e.target;if(!f.matches('[data-ub-sort]'))return;e.preventDefault();const button=f.querySelector('button.primary');button.disabled=true;f.querySelector('.error').textContent='';
  try{
    const file=f.elements.image.files[0];
    if(!file&&!f.dataset.hasPhoto)throw Error('Хүлээн авах зургаа оруулна уу.');
    if(file){f.dataset.version=String(await warehouseReceiptUpload(f.dataset.id,f.dataset.version,file));f.dataset.hasPhoto='1';f.elements.image.value='';}
    const method=f.elements.method.value,num=n=>Number(f.elements[n].value);
    const d=await api('warehouse-sort',{id:f.dataset.id,expected_status:f.dataset.expected,expected_version:Number(f.dataset.version),shelf:f.elements.shelf.value.trim(),method,contact_phone:f.elements.contact_phone.value.trim(),address:method==='delivery'?f.elements.address.value.trim():'',delivery_mnt:method==='delivery'?num('delivery_mnt'):0,...(f.elements.domestic_mnt?{domestic_mnt:num('domestic_mnt')}:{}),checked:f.elements.checked.checked});
    await logisticsOpenOrder(d.order.id);const b=d.order.billing||{};
    toast(`Ангиллаа · тавиур ${d.order.logistics?.shelf||''}${b.due>0?' · үлдэгдэл '+ubMoney(b.due):''}`);refresh().catch(()=>{});
  }catch(error){f.querySelector('.error').textContent=error.message;toast(error.message);}finally{button.disabled=false;}
});

// Counter handover: find by phone, pickup code (customer's barcode) or order code; several orders at once.
let ubHandover=null;
const ubHandoverReady=()=>ubHandover.orders.filter(o=>!o.reason&&/^\d{8}$/.test(ubHandover.codes[o.id]||''));
function ubHandoverHtml(){
  const h=ubHandover,ready=h.orders.filter(o=>!o.reason),count=ubHandoverReady().length;
  return `<p class="note">Утасны дугаар, авах код (хэрэглэгчийн утсан дээрх баркод) эсвэл захиалгын кодоор хайна. Авах кодыг уншуулахад тухайн захиалга баталгаажна.</p>
<form data-ub-find class="outbound-scan"><label>Утас / авах код / GS код<input name="q" autocomplete="off" maxlength="50" required placeholder="99112233"></label><button class="primary">Хайх</button></form>
<button type="button" class="quiet" data-scan-camera>Утсаар уншуулах</button>
${h.orders.length?`<ul class="outbound-list ub-handover-list">${h.orders.map(o=>{const code=h.codes[o.id]||'';return `<li class="${o.reason?'incomplete':''}"><div><strong class="ub-shelf-big">${esc(o.shelf||'—')}</strong> <strong>${esc(o.id)}</strong> · ${esc(o.customer)} · ${o.pieces} ширхэг<small>${esc(o.phone)} · ${o.reason?esc(ubReasonText(o)):/^\d{8}$/.test(code)?'Авах код ✓':'Авах кодоо оруулна уу'}</small></div>${o.reason?'':`<label class="ub-code">Авах код<input data-ub-code="${esc(o.id)}" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" autocomplete="off" value="${esc(code)}"></label>`}</li>`;}).join('')}</ul>`:'<p class="empty">Хайлтын үр дүн энд гарна.</p>'}
${ready.length?`<label>Хүлээн авсан хүний нэр<input data-ub-received maxlength="100" value="${esc(h.receivedBy||'')}" autocomplete="off"></label>`:''}
${errorBox()}<div class="outbound-actions"><button type="button" class="primary" data-ub-handover ${count?'':'disabled'}>Хүлээлгэн өгөх (${count})</button>${h.orders.length?'<button type="button" class="quiet" data-ub-clear>Цэвэрлэх</button>':''}</div>`;
}
function ubHandoverRender(){currentBatch=null;modal('Хүлээлгэн өгөх',ubHandoverHtml());$('#editor').dataset.handover='1';if(!$('#qr-scanner').open&&matchMedia('(pointer:fine)').matches)document.querySelector('[data-ub-find] input')?.focus();}
async function ubHandoverOpen(query){ubHandover={orders:[],codes:{},receivedBy:''};ubHandoverRender();if(query)await ubHandoverAdd(query).catch(e=>{const box=document.querySelector('#editor-body .error');if(box)box.textContent=e.message;});}
// Adds a lookup to the list; returns a short summary for the camera view.
async function ubHandoverAdd(raw){
  const q=String(raw||'').trim();if(!q)return '';
  const d=await api('warehouse-handover-lookup&'+new URLSearchParams({q})),digits=q.replace(/\D/g,'');
  for(const o of d.orders){const i=ubHandover.orders.findIndex(x=>x.id===o.id);if(i>=0)ubHandover.orders[i]=o;else ubHandover.orders.push(o);if(o.verified)ubHandover.codes[o.id]=digits;}
  ubHandoverRender();const verified=d.orders.filter(o=>o.verified).map(o=>o.id);
  const message=verified.length?'Авах код ✓ '+verified.join(', '):d.orders.length+' захиалга олдлоо';toast(message);return message;
}
function ubHandoverButton(){const b=document.querySelector('[data-ub-handover]');if(b){const n=ubHandoverReady().length;b.disabled=!n;b.textContent=`Хүлээлгэн өгөх (${n})`;}}
document.addEventListener('input',e=>{
  if(!ubHandover)return;
  if(e.target.dataset.ubCode){
    const id=e.target.dataset.ubCode,code=e.target.value.replace(/\D/g,'').slice(0,8),o=ubHandover.orders.find(x=>x.id===id);ubHandover.codes[id]=code;ubHandoverButton();
    const note=e.target.closest('li')?.querySelector('small');if(note&&o)note.textContent=o.phone+' · '+(code.length===8?'Авах код ✓':'Авах кодоо оруулна уу');
  }
  if(e.target.hasAttribute('data-ub-received'))ubHandover.receivedBy=e.target.value;
});
document.addEventListener('submit',async e=>{
  const f=e.target;if(!f.matches('[data-ub-find]'))return;e.preventDefault();const button=f.querySelector('button');button.disabled=true;
  try{await ubHandoverAdd(f.elements.q.value);}catch(error){toast(error.message);const box=document.querySelector('#editor-body .error');if(box)box.textContent=error.message;}
  finally{button.disabled=false;const next=document.querySelector('[data-ub-find] input');if(next){next.value='';next.focus();}}
});

// Courier runs: pick the ready delivery orders, choose a recent courier, dispatch and print the list.
let ubDelivery=null;
function ubDeliveryHtml(){
  const d=ubDelivery;
  if(d.done)return `<p class="note">${d.done.length} захиалга ${esc(d.name)}-д хүлээлгэн өглөө. Хүргэлтийн жагсаалтаа хэвлээд хүргэгчид өгнө үү. Хүлээн авагч авах кодоо хэлэхэд захиалгыг дуусгана.</p><ul class="outbound-list">${d.done.map(o=>`<li><div><strong>${esc(o.id)}</strong> · ${esc(o.customer)}<small>${esc(o.phone)} · ${esc(o.address)}</small></div></li>`).join('')}</ul><div class="outbound-actions"><button type="button" class="primary" data-ub-print-run>Жагсаалт хэвлэх · A4</button></div>`;
  const count=d.orders.filter(o=>d.selected.has(o.id)).length;
  return `<p class="note">Төлбөр нь бүрэн, зөрчилгүй захиалгыг сонгоод хүргэгчид онооно. Хүргэгч бүрийн нэр, утсыг дараагийн удаа сонгох боломжтой.</p>
${d.orders.length?`<ul class="outbound-list">${d.orders.map(o=>`<li class="${o.ready?'':'incomplete'}"><label class="check"><input type="checkbox" data-ub-pick="${esc(o.id)}" ${d.selected.has(o.id)?'checked':''} ${o.ready?'':'disabled'}><span><strong>${esc(o.id)}</strong> · ${esc(o.customer)} · Тавиур ${esc(o.shelf||'—')}<small>${esc(o.phone)} · ${esc(o.address)}${o.ready?'':' · '+esc(ubReasonText(o))}</small></span></label></li>`).join('')}</ul>`:'<p class="empty">Хүргэлтэд бэлэн захиалга алга.</p>'}
${d.couriers.length?`<label>Өмнөх хүргэгч<select data-ub-courier><option value="">— Шинэ хүргэгч —</option>${d.couriers.map((c,i)=>`<option value="${i}" ${c.name===d.name&&c.phone===d.phone?'selected':''}>${esc(c.name)} · ${esc(c.phone)}</option>`).join('')}</select></label>`:''}
<div class="form-grid"><label>Хүргэгчийн нэр<input data-ub-courier-name maxlength="100" value="${esc(d.name)}" autocomplete="off"></label><label>Хүргэгчийн утас<input data-ub-courier-phone type="tel" maxlength="30" value="${esc(d.phone)}" autocomplete="off"></label></div>
${errorBox()}<div class="outbound-actions"><button type="button" class="primary" data-ub-dispatch ${count?'':'disabled'}>Хүргэлтэд гаргах (${count})</button></div>`;
}
function ubDeliveryRender(){currentBatch=null;modal('Хүргэлтэд гаргах',ubDeliveryHtml());}
async function ubDeliveryOpen(preselect){
  const d=await api('warehouse-delivery-list');
  ubDelivery={orders:d.orders,couriers:d.couriers,selected:new Set(d.orders.filter(o=>o.ready&&(!preselect||o.id===preselect)).map(o=>o.id)),name:d.couriers[0]?.name||'',phone:d.couriers[0]?.phone||'',done:null};
  ubDeliveryRender();
}
function ubPrintRun(){
  const d=ubDelivery;if(!d?.done)return;$('#print-area').dataset.format='manifest';
  $('#print-area').innerHTML=`<h2>GOStore · Хүргэлтийн жагсаалт</h2><p>${esc(t(city))} · ${date(new Date().toISOString())}</p><p>Хүргэгч: ${esc(d.name)} · ${esc(d.phone)} · ${d.done.length} захиалга</p><table><thead><tr><th>#</th><th>Захиалга</th><th>Тавиур</th><th>Хүлээн авагч</th><th>Утас</th><th>Хаяг</th><th>Ширхэг</th><th>Гарын үсэг</th></tr></thead><tbody>${d.done.map((o,i)=>`<tr><td>${i+1}</td><td>${esc(o.id)}</td><td>${esc(o.shelf||'')}</td><td>${esc(o.customer)}</td><td>${esc(o.phone)}</td><td>${esc(o.address)}</td><td>${o.pieces}</td><td></td></tr>`).join('')}</tbody></table>`;
  window.print();
}
document.addEventListener('change',e=>{
  if(!ubDelivery)return;
  if(e.target.dataset.ubPick){if(e.target.checked)ubDelivery.selected.add(e.target.dataset.ubPick);else ubDelivery.selected.delete(e.target.dataset.ubPick);const n=ubDelivery.orders.filter(o=>ubDelivery.selected.has(o.id)).length,b=document.querySelector('[data-ub-dispatch]');b.disabled=!n;b.textContent=`Хүргэлтэд гаргах (${n})`;}
  if(e.target.hasAttribute('data-ub-courier')){const c=ubDelivery.couriers[Number(e.target.value)];ubDelivery.name=c?.name||'';ubDelivery.phone=c?.phone||'';document.querySelector('[data-ub-courier-name]').value=ubDelivery.name;document.querySelector('[data-ub-courier-phone]').value=ubDelivery.phone;}
});
document.addEventListener('input',e=>{if(!ubDelivery)return;if(e.target.hasAttribute('data-ub-courier-name'))ubDelivery.name=e.target.value;if(e.target.hasAttribute('data-ub-courier-phone'))ubDelivery.phone=e.target.value;});

// Batch check-in by camera: each scanned label is checked against the open batch; the camera stays open.
async function ubBatchScan(code){
  const f=document.querySelector('#editor-body [data-batch-scan]');if(!f)return '';
  const d=await api('warehouse-batch-scan',{id:f.dataset.id,expected_version:Number(f.dataset.version),order_id:code});showBatch(d.batch);
  return `${lt('Тулгасан','已核对')} ${(d.batch.scanned||[]).length} / ${d.batch.order_count} · ${code}`;
}
window.warehouseScanTargets=window.warehouseScanTargets||[];
window.warehouseScanTargets.push(()=>$('#editor').open&&$('#editor').dataset.handover==='1'?ubHandoverAdd:null);
window.warehouseScanTargets.push(()=>$('#editor').open&&document.querySelector('#editor-body [data-batch-scan]')?ubBatchScan:null);

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-ub-handover],[data-ub-clear],[data-ub-dispatch],[data-ub-print-run],[data-ub-handover-open],[data-ub-delivery-open],[data-scan-camera]');if(!b)return;
  const box=()=>document.querySelector('#editor-body .error');
  try{
    if(b.hasAttribute('data-scan-camera')){$('#qr-open').click();return;}
    if(b.hasAttribute('data-ub-handover-open')){await ubHandoverOpen(b.dataset.ubHandoverOpen);return;}
    if(b.hasAttribute('data-ub-delivery-open')){await ubDeliveryOpen(b.dataset.ubDeliveryOpen);return;}
    if(b.hasAttribute('data-ub-print-run')){ubPrintRun();return;}
    if(b.hasAttribute('data-ub-clear')){ubHandover={orders:[],codes:{},receivedBy:''};ubHandoverRender();return;}
    b.disabled=true;
    if(b.hasAttribute('data-ub-handover')){
      const by=(ubHandover.receivedBy||'').trim();if(!by){document.querySelector('[data-ub-received]')?.focus();throw Error('Хүлээн авсан хүний нэрийг бичнэ үү.');}
      const items=ubHandoverReady().map(o=>({id:o.id,code:ubHandover.codes[o.id]}));
      const d=await api('warehouse-handover',{items,received_by:by});
      ubHandover={orders:[],codes:{},receivedBy:''};ubHandoverRender();toast(d.orders.length+' захиалга хүлээлгэн өглөө');refresh().catch(()=>{});return;
    }
    if(b.hasAttribute('data-ub-dispatch')){
      const ids=ubDelivery.orders.filter(o=>ubDelivery.selected.has(o.id)).map(o=>o.id);
      await api('warehouse-delivery-dispatch',{ids,courier_name:ubDelivery.name.trim(),courier_phone:ubDelivery.phone.trim()});
      ubDelivery.done=ubDelivery.orders.filter(o=>ids.includes(o.id));ubDeliveryRender();toast(ids.length+' захиалга хүргэлтэд гарлаа');refresh().catch(()=>{});
    }
  }catch(error){toast(error.message);if(box())box().textContent=error.message;b.disabled=false;}
});
