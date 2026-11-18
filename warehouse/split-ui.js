'use strict';
// Split first, then photograph/measure each portion. The commercial order is never duplicated.
function warehouseSplitHtml(o){
 const related=o.shipment_parts||[],canSplit=o.can_split&&(o.split_mode!=='parcels'||o.parcels?.total>1);
 const partCodes=p=>(p.numbers||[]).map(n=>`<small class="split-waybill">${lt('Хүргэлтийн код','运单号')}: ${esc(n)}</small>`).join('');
 const reference=o.reference_items?.length?`<details><summary>${lt('Үндсэн захиалгын бараа · лавлах','原订单商品 · 仅供核对')}</summary><p>${lt('Эдгээр нь нийт захиалгын бараа; хайрцаг тус бүрийн барааны тоо биш.','以下为原订单商品，并非当前包裹内的商品数量。')}</p><ul>${o.reference_items.map(i=>`<li>${esc(i.original_name||i.name)} · ${esc(i.original_variant||i.variant)} × ${i.qty}</li>`).join('')}</ul></details>`:'';
 return `<section class="shipment-split-panel">${reference}${related.length?`<h3>${lt('Нэг захиалгын хэсгүүд','同一订单的分件')}</h3><p>${lt('Барааны төлбөр үндсэн захиалгад, тээврийн төлбөр хэсэг бүрд тусдаа тооцогдоно.','货款保留在原订单，各分件单独计算运费。')}</p><div class="shipment-part-list">${related.map(p=>`<button type="button" class="quiet" data-order="${esc(p.id)}"><strong>${esc(p.id)}${p.remainder?' · '+lt('Үлдсэн хэсэг','剩余部分'):''}</strong><span>${p.quantity} ${p.unit==='parcel'?lt('хайрцаг','包裹'):lt('ширхэг','件')} · ${esc(statusText(p.status,o))}</span>${partCodes(p)}</button>`).join('')}</div>`:''}${related.length?`<div class="split-label-preview">${code39(o.id)}<button type="button" class="quiet" data-print-split>${lt("GS QR / barcode", "GS 二维码标签打印")}</button></div>`:""}${canSplit?`<button type="button" class="primary" data-split-open="${esc(o.id)}">${lt('Ирсэн хэсгийг салгаж илгээх','拆分已到货部分')}</button><p class="muted">${lt('Хайрцгаар эсвэл барааны тоогоор хувааж, хэсэг бүрийг тусад нь хэмжиж илгээнэ.','按快递包裹或商品数量拆分，各部分重新拍照、称重后分别发货。')}</p>`:''}</section>`;
}
function warehouseSplitForm(o,number=null){
 const mode=number?'parcels':(o.split_mode||'parcels'),p=o.parcels||{list:[]};
 if(number&&(!o.can_split||o.split_mode==='items'||p.list.length<2||!p.list.some(x=>x.no===number&&x.arrived_at)))return;
 modal(lt('Захиалгыг хэсэгчлэн илгээх','拆分订单发货'),`<form data-split-form data-id="${esc(o.id)}" data-version="${o.logistics.version}" data-status="${esc(o.status)}" data-token="${token()}" class="warehouse-confirm split-form">
 <p><strong>${esc(o.id)}</strong> · ${esc(o.customer)}</p>
 <label>${lt('Салгах арга','拆分方式')}<select name="mode" ${o.split_mode||number?'disabled':''}><option value="parcels" ${mode==='parcels'?'selected':''}>${lt('Tracking дугаартай хайрцгаар','按快递运单 / 包裹')}</option><option value="items" ${mode==='items'?'selected':''}>${lt('Барааны тоо ширхэгээр','按商品数量')}</option></select></label>
 <div data-split-parcels><p>${number?lt('Энэ кодтой илгээмжийг дангаар нь салгана. Бусад илгээмж үндсэн захиалгад үлдэнэ.','仅拆出此运单包裹，其余包裹保留在原订单。'):lt('Түрүүлж илгээх, ирсэн хайрцгуудыг сонгоно уу.','选择已到件、准备先发出的包裹。')}</p>${p.list.length?p.list.map(x=>`<label class="check"><input type="checkbox" name="number" value="${esc(x.no)}" ${number===x.no?'checked':''} ${!x.arrived_at||number?'disabled':''}><span><strong>${esc(x.no)}</strong><br>${esc(x.company)} · ${x.arrived_at?lt('Ирсэн','已到'):lt('Ирээгүй','未到')}</span></label>`).join(''):`<p class="note">${lt('Эхлээд tracking дугаар болон ирсэн бүртгэлээ оруулна уу.','请先登记运单及到件信息。')}</p>`}</div>
 <div data-split-items><p>${lt('Бодитоор ирсэн бараанаас энэ хэсэгт оруулах тоог оруулна уу. Нэг хайрцгийг задлан хуваасан бол шинэ GS кодыг нааж тулгана.','填写本次拆出的实际到货数量。同一快递箱内商品拆开后，请贴上新的 GS 编码核对。')}</p>${o.items.map((i,n)=>`<label>${esc(i.original_name||i.name)} · ${esc(i.original_variant||i.variant)}<small>${lt('Үлдэгдэл','可拆数量')}: ${Number(i.qty)}</small><input name="qty-${n}" type="number" min="0" max="${Number(i.qty)}" step="1" inputmode="numeric" value="0" data-split-qty data-total="${Number(i.qty)}" required></label>`).join('')}</div>
 <output data-split-preview aria-live="polite"></output>
 <label>${lt('Салгах тайлбар','拆分说明')}<textarea name="reason" maxlength="500" rows="2" required></textarea></label>
 <p class="note">${lt('Барааны төлбөр давхар үүсэхгүй. Өмнөх хэмжилтийг хүчингүй болгож, хоёр хэсэгт шинэ зураг, жин, тээврийн баталгаажуулалт шаардана.','不会重复收取货款。原称重及运费确认将失效；拆出的部分与剩余部分都须重新拍照、称重并确认运费。')}</p>
 <label class="check"><input name="checked" type="checkbox" required><span>${lt('Салгах бараа, үлдэгдэл болон шинэ GS шошго хэрэгтэйг шалгасан','已核对拆分商品、剩余部分及新 GS 标签要求')}</span></label>
 ${errorBox()}<button type="submit" class="primary">${lt('Салгаж бүртгэх','确认拆分')}</button><button type="button" class="quiet" data-split-cancel>${lt('Болих','取消')}</button></form>`);
 warehouseSplitPreview();
}
function warehouseSplitPreview(){
 const f=document.querySelector('[data-split-form]');if(!f)return;
 const parcels=f.elements.mode.value==='parcels';
 f.querySelector('[data-split-parcels]').hidden=!parcels;f.querySelector('[data-split-items]').hidden=parcels;
 f.querySelectorAll('[data-split-qty]').forEach(i=>i.disabled=parcels);
 const qty=[...f.querySelectorAll('[data-split-qty]')],selected=parcels?f.querySelectorAll('input[name="number"]:checked').length:qty.reduce((s,i)=>s+Number(i.value),0);
 const total=parcels?f.querySelectorAll('input[name="number"]').length:qty.reduce((s,i)=>s+Number(i.dataset.total),0);
 const unit=parcels?lt('хайрцаг','包裹'):lt('ширхэг','件');
 f.querySelector('[data-split-preview]').textContent=`${lt('Шинэ хэсэг','新分件')}: ${selected} ${unit} · ${lt('Үлдэх','剩余')}: ${total-selected} ${unit}`;
 f.querySelector('button[type="submit"]').disabled=!(selected>0&&selected<total);
}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-print-split]')&&activeLogisticsOrder){
  const o=activeLogisticsOrder;$('#print-area').dataset.format='label';
  $('#print-area').innerHTML=`<article class="shipping-label"><div class="label-brand">GOStore <span>分件 / Захиалгын хэсэг</span></div><div class="label-route">${esc(o.shipment_parent||o.id)}</div><div class="label-main">${batchQr(o.id,true)}</div><div class="label-code">${esc(o.id)}</div>${code39(o.id)}<div class="label-footer">${esc(o.customer)} · ${o.items.reduce((s,i)=>s+Number(i.qty),0)} ${o.shipment_unit==='parcel'?'包裹 / хайрцаг':'件 / ширхэг'}</div></article>`;window.print();
 }
 const b=e.target.closest('[data-split-open]');if(b&&activeLogisticsOrder?.id===b.dataset.splitOpen)warehouseSplitForm(activeLogisticsOrder);
 const parcel=e.target.closest('[data-split-parcel]');if(parcel&&activeLogisticsOrder?.id===parcel.dataset.id)warehouseSplitForm(activeLogisticsOrder,parcel.dataset.splitParcel);
 if(e.target.closest('[data-split-cancel]')&&activeLogisticsOrder)showOrder(activeLogisticsOrder);
});
document.addEventListener('input',e=>{if(e.target.closest('[data-split-form]'))warehouseSplitPreview();});
document.addEventListener('change',e=>{if(e.target.closest('[data-split-form]'))warehouseSplitPreview();});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!f.matches('[data-split-form]'))return;e.preventDefault();if(f.dataset.busy)return;f.dataset.busy='1';
 const button=f.querySelector('button[type="submit"]');button.disabled=true;f.querySelector('.error').textContent='';
 try{
  const mode=f.elements.mode.value;
  const d=await api('warehouse-order-split',{id:f.dataset.id,mode,expected_status:f.dataset.status,expected_version:Number(f.dataset.version),token:f.dataset.token,
   reason:f.elements.reason.value.trim(),checked:f.elements.checked.checked,numbers:mode==='parcels'?[...f.querySelectorAll('input[name="number"]:checked')].map(i=>i.value):[],
   quantities:mode==='items'?[...f.querySelectorAll('[data-split-qty]')].map(i=>Number(i.value)):[]});
  showOrder(d.part);toast(lt('Хэсэг үүслээ. Шинэ кодоор зураг, жингээ бүртгэнэ үү.','分件已创建。请按新编码拍照并称重。'));refresh().catch(()=>{});
 }catch(error){f.querySelector('.error').textContent=error.message;toast(error.message);}finally{delete f.dataset.busy;button.disabled=false;}
});
