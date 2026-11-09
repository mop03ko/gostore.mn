'use strict';
// Scan-to-dispatch (Erenhot manager feedback 2026-11-09): scan courier waybills or GS labels with a scanner
// gun or the phone camera. "确认打包" creates the GB batch; its screen then prints the label and dispatches.
// The list is kept on this device until packing succeeds, so closing the window loses nothing.
let outbound=null;
const outboundKey=()=>'gostore-outbound-'+city;
function outboundLoad(){
 try{const s=JSON.parse(localStorage.getItem(outboundKey())||'null');if(s&&/^[a-f0-9]{64}$/.test(s.token)&&Array.isArray(s.items))return s;}catch{}
 return {token:token(),items:[]};
}
function outboundSave(){try{localStorage.setItem(outboundKey(),JSON.stringify(outbound));}catch{}}
const outboundReasons=()=>({not_received:lt('Хүлээн аваагүй','尚未收货'),freight:lt('Тээврийн үнэ батлаагүй','运费未确认'),issue:lt('Нээлттэй зөрчилтэй','有未处理异常'),packed:lt('Аль хэдийн багцалсан','备货中或已发货'),unavailable:lt('Илгээх боломжгүй','不可出库')});
const outboundMissing=i=>i.whole?[]:i.parcels.filter(n=>!i.scanned.includes(n));
function outboundHtml(){
 const items=outbound.items,pieces=items.reduce((n,i)=>n+i.pieces,0),incomplete=items.filter(i=>outboundMissing(i).length);
 return `<p class="note">${lt('Илгээмжийн tracking баркодыг (эсвэл GS шошгыг) уншуулна. Дууссаны дараа «Багцлах» дарахад GB дугаар үүснэ.','用扫码枪或手机扫描快递运单号（或订单 GS 标签）。扫完后点击“确认打包”，系统生成 GB 包裹单号。')}</p>
<form data-outbound-scan class="outbound-scan"><label>${lt('Tracking / GS код','运单号 / GS 编号')}<input name="code" autocomplete="off" autocapitalize="characters" maxlength="50" required placeholder="SF1234567890"></label><button class="primary">${lt('Нэмэх','添加')}</button></form>
<button type="button" class="quiet" data-outbound-camera>${lt('Утсаар уншуулах','手机扫码')}</button>
<p class="outbound-summary" role="status"><strong>${items.length}</strong> ${t('orderCount')} · <strong>${pieces}</strong> ${t('pieces')}${items[0]?` · ${lt('Хүлээн авах','收货仓库')}: ${esc(items[0].destination_name)}`:''}</p>
${items.length?`<ul class="outbound-list">${items.map(i=>{const missing=outboundMissing(i);return `<li class="${missing.length?'incomplete':''}"><div><strong>${esc(i.id)}</strong> · ${esc(i.customer)} · ${i.pieces} ${t('pieces')}<small>${i.whole?lt('GS шошгоор','按 GS 标签'):`${lt('Илгээмж','包裹')} ${i.parcels.length-missing.length}/${i.parcels.length}`}${missing.length?' · '+lt('Дутуу','还差')+': '+esc(missing.join(', ')):''}</small>${i.problem?`<small class="outbound-problem">${esc(i.problem)}</small>`:''}</div><button type="button" class="quiet" data-outbound-remove="${esc(i.id)}">${t('remove')}</button></li>`;}).join('')}</ul>`:`<p class="empty">${lt('Одоогоор уншуулсан илгээмж алга.','尚未扫描包裹。')}</p>`}
${incomplete.length?`<p class="inbound-warning" role="alert">${lt('Зарим захиалгын илгээмж дутуу уншигдсан. Бүгдийг уншуулах эсвэл захиалгыг хасна уу.','部分订单的包裹未扫齐，请补扫或移除该订单。')}</p>`:''}
${errorBox()}<div class="outbound-actions"><button type="button" class="primary" data-outbound-pack ${!items.length||incomplete.length?'disabled':''}>${lt('Багцлах · GB дугаар үүсгэх','确认打包 · 生成 GB 单号')}</button>${items.length?`<button type="button" class="quiet" data-outbound-clear>${lt('Цэвэрлэх','清空')}</button>`:''}</div>`;
}
function outboundRender(){
 currentBatch=null;modal(lt('Скан хийж илгээх','扫码出库'),outboundHtml());$('#editor').dataset.outbound='1';
 // Ready for the scanner gun; phones (coarse pointer) keep the keyboard closed until the box is tapped.
 if(!$('#qr-scanner').open&&matchMedia('(pointer:fine)').matches)document.querySelector('[data-outbound-scan] input')?.focus();
}
function outboundOpen(){outbound=outboundLoad();outboundRender();}
window.warehouseOutboundActive=()=>$('#editor').open&&$('#editor').dataset.outbound==='1';
window.warehouseScanTargets=window.warehouseScanTargets||[];
window.warehouseScanTargets.push(()=>warehouseOutboundActive()?warehouseOutboundAdd:null);
// Adds every ready order behind a scanned code; returns a short summary for the camera view.
async function warehouseOutboundAdd(raw){
 const code=String(raw||'').trim().toUpperCase();if(!code)return '';
 if(outbound.items.some(i=>i.codes.includes(code))){const repeat=lt('Аль хэдийн уншуулсан','已扫描过')+' · '+code;toast(repeat);return repeat;}
 const d=await api('warehouse-outbound-lookup&'+new URLSearchParams({code}));const problems=[];let added=0;
 for(const o of d.orders){
  if(o.reason){problems.push(o.id+': '+outboundReasons()[o.reason]);continue;}
  let item=outbound.items.find(i=>i.id===o.id);
  if(!item&&outbound.items.length&&outbound.items[0].destination!==o.destination){problems.push(o.id+': '+lt('Өөр хүлээн авах агуулах, тусад нь багцална','收货仓库不同，请分开装包'));continue;}
  if(!item){item={id:o.id,customer:o.customer,pieces:o.pieces,parcels:o.parcels,scanned:[],whole:false,destination:o.destination,destination_name:o.destination_name,codes:[]};outbound.items.push(item);}
  item.problem='';if(o.number){if(!item.scanned.includes(o.number))item.scanned.push(o.number);}else item.whole=true;
  if(!item.codes.includes(d.code))item.codes.push(d.code);added++;
 }
 outboundSave();outboundRender();
 const message=problems.length?problems.join(' · '):added?lt('Нэмсэн','已添加')+' · '+d.code:'';
 if(problems.length)document.querySelector('#editor-body .error').textContent=message;
 if(message)toast(message);return message;
}
document.addEventListener('submit',async e=>{
 const f=e.target;if(!f.matches('[data-outbound-scan]'))return;e.preventDefault();const input=f.elements.code,button=f.querySelector('button');button.disabled=true;
 try{await warehouseOutboundAdd(input.value);}catch(error){toast(error.message);const box=document.querySelector('#editor-body .error');if(box)box.textContent=error.message;}
 finally{button.disabled=false;const next=document.querySelector('[data-outbound-scan] input');if(next){next.value='';next.focus();}}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-outbound-open]'))outboundOpen();});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-outbound-remove],[data-outbound-clear],[data-outbound-pack],[data-outbound-camera]');if(!b||!outbound)return;
 if(b.dataset.outboundRemove){outbound.items=outbound.items.filter(i=>i.id!==b.dataset.outboundRemove);outboundSave();outboundRender();return;}
 if(b.hasAttribute('data-outbound-clear')){outbound={token:token(),items:[]};outboundSave();outboundRender();return;}
 if(b.hasAttribute('data-outbound-camera')){$('#qr-open').click();return;}
 b.disabled=true;
 try{
  const d=await api('warehouse-outbound-pack',{token:outbound.token,order_ids:outbound.items.map(i=>i.id),codes:[...new Set(outbound.items.flatMap(i=>i.codes))]});
  try{localStorage.removeItem(outboundKey());}catch{}outbound=null;
  toast(lt('Багц үүслээ','已生成包裹')+' · '+d.batch.id);showBatch(d.batch);refresh().catch(()=>{});
 }catch(error){
  // Name the orders that are no longer ready (e.g. packed from another phone) so they can be removed.
  if(outbound){
   await Promise.all(outbound.items.map(async i=>{try{const o=(await api('warehouse-outbound-lookup&'+new URLSearchParams({code:i.id}))).orders[0];i.problem=o?.reason?outboundReasons()[o.reason]:'';}catch{}}));
   outboundSave();outboundRender();
  }
  const box=document.querySelector('#editor-body .error');if(box)box.textContent=error.message;toast(error.message);
 }
});
