'use strict';
// Freight summary (Erenhot → Ulaanbaatar). Erenhot enters weight and size in the one-step receipt form below.
function warehouseCargoHtml(o){
 const q=o.logistics?.transport,r=o.cargo_rates,zh=locale==='zh';
 if(!q)return '';
 const amount=v=>Number(v).toLocaleString('en-US');
 return `<section class="warehouse-cargo"><h3>${lt('Эрээн → Улаанбаатар · Тээврийн үнэ','二连 → 乌兰巴托 · 运费')}</h3><div class="cargo-approval ${q.confirmed_at?'is-approved':''}"><span>${q.confirmed_at?lt('Баталгаажсан','已确认'):lt('Батлахыг хүлээж байна','待确认')}</span><strong>${amount(q.amount_mnt)} ₮</strong><p>${esc(GOStoreCargo.description(q,zh))}</p>${q.dimensions?.length_cm?`<p>${q.dimensions.length_cm} × ${q.dimensions.width_cm} × ${q.dimensions.height_cm} cm</p>`:''}<small>${lt('Тоо ширхэг','商品数量')}: ${q.pieces} · ${esc(date(q.confirmed_at||q.calculated_at))}</small></div>${r&&q.method==='auto'?`<p class="cargo-tariff">${esc(GOStoreCargo.tariff(r,zh))} · 1 CNY = ${amount(r.cny_rate)} ₮</p>`:''}</section>`;
}
// Erenhot can (re)receive while the order waits for it or sits in Erenhot outside a batch.
const warehouseCanReceive=o=>cityRole()==='erenhot'&&!o.read_only&&(['confirmed','shipping'].includes(o.status)||(o.status==='erenhot'&&!o.batch_id));
function warehouseParcelsHtml(o){
 const p=o.parcels;if(!p)return '';
 if(!p.total)return `<p class="muted parcel-none">${lt('Tracking дугаар мэдэгдээгүй тул илгээмжээр тулгахгүй. Бүх барааг тулгаад хүлээн авна.','暂无运单号，无法按包裹核对。请核对全部商品后收货。')}</p>`;
 const open=warehouseCanReceive(o)&&['confirmed','shipping','erenhot'].includes(o.status);
 const split=open&&o.can_split&&o.split_mode!=='items'&&p.total>1;
 return `<div class="parcel-check"><strong>${lt('Илгээмж','包裹')} ${p.arrived} / ${p.total} ${lt('ирсэн','已到')}</strong>${split?`<p class="parcel-split-hint">${lt('Ирсэн кодыг дангаар салгаж, зураг, жинг нь бүртгээд тусдаа багцалж болно. Ирээгүй илгээмж үлдэнэ.','已到运单可单独拆分，拍照称重后独立打包；未到包裹留在原订单。')}</p>`:''}<ul>${p.list.map(x=>`<li class="${x.arrived_at?'arrived':''}"><span><b>${esc(x.no)}</b>${x.company?' · '+esc(x.company):''}</span><span>${x.arrived_at?'✓ '+lt('Ирсэн','已到')+' · '+esc(date(x.arrived_at)):lt('Ирээгүй','未到')}</span>${x.arrived_at&&split?`<button type="button" class="quiet parcel-split-button" data-split-parcel="${esc(x.no)}" data-id="${esc(o.id)}">${lt('Дангаар салгах','单独拆分')}</button>`:''}${x.arrived_at&&open&&p.can_undo?`<button type="button" class="quiet" data-parcel-undo="${esc(x.no)}" data-id="${esc(o.id)}">${lt('Ирсэн бүртгэлийг буцаах','撤销到件')}</button>`:''}${!x.arrived_at&&open?`<button type="button" class="quiet" data-parcel-arrive="${esc(x.no)}" data-id="${esc(o.id)}">${lt('Ирснийг бүртгэх','登记到件')}</button>`:''}</li>`).join('')}</ul>${p.total===1&&o.split_mode==='parcels'?`<p class="parcel-split-hint">${lt('Үлдсэн ганц илгээмжийг энэ GS кодоор хүлээн авч, тусад нь багцална.','剩余这一个包裹使用当前 GS 编码收货、称重并独立打包，无需再次拆分。')}</p>`:''}<small>${lt('Илгээмжийн баркодыг уншуулахад ирснийг автоматаар бүртгэнэ.','扫描快递运单条码会自动登记到件。')}</small></div>`;
}
// One step: receipt photo, weight, size and piece count, then receive and approve the freight together.
function warehouseReceiveHtml(o){
 const l=o.logistics||{},m=l.measurement,p=o.parcels||{missing:[]},again=o.status==='erenhot';
 const hasPhoto=(l.photos||[]).some(x=>x.location===city),expected=o.expected_pieces??o.items.reduce((s,i)=>s+Number(i.qty),0);
 const field=(label,name,value,min,step='any',max='1000')=>`<label>${label}<input name="${name}" type="number" inputmode="decimal" value="${esc(value??'')}" min="${min}" max="${max}" step="${step}" required></label>`;
 const direct=m&&m.volume_m3&&!m.length_cm;
 return `<form data-receive-form data-id="${esc(o.id)}" data-version="${l.version||0}" data-expected="${esc(o.status)}" data-expected-pieces="${expected}" data-missing="${p.missing.length}" data-has-photo="${hasPhoto?'1':''}" class="warehouse-confirm receive-form">
<h3>${again?lt('Хэмжилт засах, тээвэр батлах','重新测量并确认运费'):lt('Хүлээн авах · нэг алхам','收货登记 · 一步完成')}</h3>
<p class="muted">${again?lt('Шинэ хэмжилтээр тээврийн үнийг дахин батална.','按新的测量重新确认运费。'):lt('Зураг, жин, хэмжээ оруулаад нэг товчоор хүлээн авч тээврийн үнийг батална. Илгээхдээ «Скан хийж илгээх»-ээр tracking уншуулна.','拍照并填写重量和尺寸，一键完成收货和运费确认。出库时用“扫码出库”扫描运单即可。')}</p>
<label>${hasPhoto?lt('Нэмэлт зураг · заавал биш','补充照片 · 可选'):lt('Хүлээн авах зураг · камер эсвэл зургийн сан','收货照片 · 拍照或从相册选择')}<input type="file" name="image" accept="image/jpeg,image/png,image/webp"></label>
${hasPhoto?`<p class="muted">${lt('Энэ агуулахын зураг бүртгэгдсэн.','已保存本仓库收货照片。')}</p>`:''}<img class="warehouse-photo-preview" alt="${lt('Сонгосон зураг','照片预览')}" hidden>
<label>${lt('Тээврийн үнэ тооцох арга','运费计费方式')}<select name="cargo_method" required><option value="">${lt('Аргаа сонгоно уу','请选择计费方式')}</option><option value="weight" ${l.transport?.method==='weight'?'selected':''}>${lt('Жингээр · kg','按重量 · kg')}</option><option value="volume" ${l.transport?.method==='volume'?'selected':''}>${lt('Эзэлхүүнээр · m³','按体积 · m³')}</option></select></label>
<p class="muted">${lt('Сонгосон аргаар л тээврийн үнэ бодогдоно. Бодит бүртгэлд жин, эзэлхүүнийг хоёуланг оруулна.','仅按所选方式计算运费。重量和体积均须记录，以便核对。')}</p>
${field(lt('Нийт жин · kg','总重量 · kg'),'weight_kg',m?.weight_kg,0.001,'any','10000')}
<label>${lt('Эзлэхүүн оруулах хэлбэр','体积录入方式')}<select name="volume_input"><option value="dimensions">${lt('Урт × өргөн × өндөр','长 × 宽 × 高')}</option><option value="direct" ${direct?'selected':''}>${lt('м³ шууд оруулах','直接输入 m³')}</option></select></label>
<div class="form-grid" data-cargo-dimensions>${field(lt('Урт · cm','长 · cm'),'length_cm',m?.length_cm,0.1)}${field(lt('Өргөн · cm','宽 · cm'),'width_cm',m?.width_cm,0.1)}${field(lt('Өндөр · cm','高 · cm'),'height_cm',m?.height_cm,0.1)}</div>
<div data-cargo-direct hidden>${field('m³','volume_m3',m?.volume_m3,0.000000001)}</div>
${field(lt('Нийт барааны тоо','商品总数量'),'pieces',m?.pieces??expected,1,'1','1000000')}
<output data-cargo-preview aria-live="polite"></output>
<label class="check" data-partial-row hidden><input type="checkbox" name="partial"><span>${lt('Дутуу ирсэн / тоо зөрсөн · зөрчил автоматаар нээгдэж, тээврийн үнийг дараа нь батална','部分到货 / 数量不符 · 自动登记异常，运费稍后确认')}</span></label>
<label class="check"><input type="checkbox" name="checked" required><span>${lt('Бараа, хувилбар, тоо ширхэг, жин, хэмжээг тулгаж шалгасан','我已核对商品、规格、数量、重量和尺寸')}</span></label>
${errorBox()}<button class="primary">${again?lt('Тээвэр батлах','确认运费'):lt('Хүлээн авч, тээвэр батлах','确认收货并确认运费')}</button></form>`;
}
// Uploads a resized receipt photo for this warehouse; returns the order's new logistics version.
async function warehouseReceiptUpload(id,version,file){
 const fd=new FormData();fd.set('id',id);fd.set('expected_version',String(version));fd.set('image',await receiptPhotoFile(file));
 const r=await fetch('../api/index.php?action=warehouse-photo-upload&lang='+locale,{method:'POST',headers:{'X-CSRF-Token':csrf},body:fd}),d=await r.json();
 if(!r.ok)throw Error(d.error||t('error'));return d.order.logistics.version;
}
function warehouseCargoPreview(){
 const f=document.querySelector('[data-receive-form]');if(!f)return;const direct=f.elements.volume_input.value==='direct';
 for(const [selector,show] of [['[data-cargo-dimensions]',!direct],['[data-cargo-direct]',direct]]){const el=f.querySelector(selector);el.hidden=!show;el.querySelectorAll('input').forEach(i=>i.disabled=!show);}
 const volume=direct?Number(f.elements.volume_m3.value):Number((['length_cm','width_cm','height_cm'].reduce((n,k)=>n*Number(f.elements[k].value),1)/1000000).toFixed(9));
 const q=GOStoreCargo.calculate(f.elements.weight_kg.value,volume,activeLogisticsOrder?.cargo_rates,f.elements.cargo_method.value);
 f.querySelector('[data-cargo-preview]').textContent=q?`${GOStoreCargo.description(q,locale==='zh')} · ${lt('Тооцоолсон тээвэр','预计运费')}: ${q.amount_mnt.toLocaleString('en-US')} ₮`:lt('Нийт жин болон эзлэхүүнээ оруулна уу.','请输入总重量和总体积。');
 // A missing parcel or a different piece count needs the explicit partial receipt.
 const short=Number(f.dataset.missing)>0||Number(f.elements.pieces.value)!==Number(f.dataset.expectedPieces);
 const row=f.querySelector('[data-partial-row]');row.hidden=!short;row.querySelector('input').required=short;
}
document.addEventListener('input',e=>{if(e.target.closest('[data-receive-form]'))warehouseCargoPreview();});
document.addEventListener('change',e=>{if(e.target.closest('[data-receive-form]'))warehouseCargoPreview();});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!f.matches('[data-receive-form]'))return;e.preventDefault();
 const button=f.querySelector('button.primary');button.disabled=true;f.querySelector('.error').textContent='';
 try{
  const file=f.elements.image.files[0];
  if(!file&&!f.dataset.hasPhoto)throw Error(lt('Хүлээн авах зургаа авна уу.','请先拍摄收货照片。'));
  // The photo is saved even if the receipt below fails, so a retry does not ask for it again.
  if(file){f.dataset.version=String(await warehouseReceiptUpload(f.dataset.id,f.dataset.version,file));f.dataset.hasPhoto='1';f.elements.image.value='';}
  const v=k=>Number(f.elements[k].value),direct=f.elements.volume_input.value==='direct';
  const body={id:f.dataset.id,cargo_method:f.elements.cargo_method.value,expected_status:f.dataset.expected,expected_version:Number(f.dataset.version),weight_kg:v('weight_kg'),volume_input:direct?'direct':'dimensions',pieces:v('pieces'),checked:f.elements.checked.checked,partial:!f.querySelector('[data-partial-row]').hidden&&f.elements.partial.checked,...(direct?{volume_m3:v('volume_m3')}:{length_cm:v('length_cm'),width_cm:v('width_cm'),height_cm:v('height_cm')})};
  const d=await api('warehouse-receive',body);
  showOrder(d.order);
  toast(d.order.logistics?.transport?.confirmed_at?lt('Хүлээн авч, тээвэр батлагдлаа','已收货，运费已确认'):t('saved'));
  await refresh();
 }catch(error){f.querySelector('.error').textContent=error.message;toast(error.message);}finally{button.disabled=false;}
});
// Records one courier parcel as arrived (button in the order, or a scanned waybill).
async function warehouseParcelArrive(id,number){
 const d=await api('warehouse-parcel-arrive',{id,number});const p=d.order.parcels;
 toast(lt('Илгээмж ирсэн','已登记到件')+(p?.total?` · ${p.arrived}/${p.total}`:''));
 showOrder(d.order);refresh().catch(()=>{});return d.order;
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-parcel-arrive]');if(!b)return;b.disabled=true;try{await warehouseParcelArrive(b.dataset.id,b.dataset.parcelArrive);}catch(error){toast(error.message);}finally{b.disabled=false;}});

document.addEventListener('click',e=>{
 const cancel=e.target.closest('[data-parcel-undo-cancel]');if(cancel){if(activeLogisticsOrder)showOrder(activeLogisticsOrder);return;}
 const b=e.target.closest('[data-parcel-undo]');if(!b||activeLogisticsOrder?.id!==b.dataset.id)return;
 const o=activeLogisticsOrder;
 modal(lt('Ирсэн бүртгэлийг буцаах','撤销到件'),`<form data-parcel-undo-form data-id="${esc(o.id)}" data-number="${esc(b.dataset.parcelUndo)}" data-version="${o.logistics.version}" class="warehouse-confirm">
 <p><strong>${esc(o.id)} · ${esc(b.dataset.parcelUndo)}</strong></p>
 <p>${lt('Энэ илгээмжийг «Ирээгүй» болгоно. Өмнөх бүртгэл түүхэнд хадгалагдана.','该包裹将恢复为“未到”。原到件记录保留在操作日志中。')}</p>
 ${o.status==='erenhot'?`<p class="note">${lt('Дутуу илгээмжийн зөрчил нээгдэж, тээврийн үнийг дахин батлах шаардлагатай болно.','将登记缺件异常并取消运费确认。包裹到齐后请重新核对并确认运费。')}</p>`:''}
 <label>${lt('Буцаах шалтгаан','撤销原因')}<textarea name="reason" maxlength="500" rows="3" required></textarea></label>
 ${errorBox()}<button type="submit" class="primary">${lt('Буцаахыг батлах','确认撤销到件')}</button><button type="button" class="quiet" data-parcel-undo-cancel>${lt('Болих','取消')}</button></form>`);
});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!f.matches('[data-parcel-undo-form]'))return;e.preventDefault();
 const button=f.querySelector('button.primary');if(button.disabled)return;button.disabled=true;f.querySelector('.error').textContent='';
 try{
  const reason=f.elements.reason.value.trim();if(!reason)throw Error(lt('Буцаах шалтгаанаа оруулна уу.','请填写撤销原因。'));
  const d=await api('warehouse-parcel-undo',{id:f.dataset.id,number:f.dataset.number,expected_version:Number(f.dataset.version),reason,checked:true});
  showOrder(d.order);toast(lt('Илгээмжийн ирсэн бүртгэлийг буцаалаа','已撤销到件登记'));refresh().catch(()=>{});
 }catch(error){f.querySelector('.error').textContent=error.message;}finally{button.disabled=false;}
});
document.addEventListener('change',e=>{const input=e.target,f=input.closest('[data-receive-form]');if(!f||input.type!=='file')return;const file=input.files[0];if(!file)return;const preview=f.querySelector('.warehouse-photo-preview'),url=URL.createObjectURL(file);preview.onload=preview.onerror=()=>URL.revokeObjectURL(url);preview.src=url;preview.hidden=false;});
