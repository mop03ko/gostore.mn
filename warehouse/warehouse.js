'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={new:'Шинэ хүсэлт',reviewing:'Шалгаж байна',quoted:'Үнийн саналтай',confirmed:'Баталгаажсан',shipping:'Эрээн рүү хүргэлтэд',erenhot:'Эрээн агуулахад',erenhot_dispatched:'Замын-Үүд рүү илгээсэн',zamyn_uud:'Замын-Үүдэд ирсэн',ulaanbaatar:'Улаанбаатарт хүлээн авсан',completed:'Дууссан',cancelled:'Цуцалсан'};
const actions={erenhot:'Эрээнд ирснийг бүртгэх',erenhot_dispatched:'Замын-Үүд рүү илгээснийг бүртгэх',ulaanbaatar:'Улаанбаатарт хүлээн авсныг баталгаажуулах'};
const confirmations={erenhot:'Илгээмжийн код, барааны хувилбар, тоо ширхэгийг тулгаж шалгасны дараа ирснийг бүртгэнэ.',erenhot_dispatched:'Ачааг Замын-Үүд рүү тээвэрт шилжүүлсэн бол илгээснийг бүртгэнэ.',ulaanbaatar:'Замын-Үүдээс ирсэн илгээмжийн код, барааны хувилбар, тоо ширхэгийг тулгаж шалгаад Улаанбаатар агуулахад хүлээн авсныг баталгаажуулна.'};
let csrf='',orders=[],offset=0,query='',status='all',requestSequence=0,toastTimer,warehouseLocation=null;
function applyLocation(location){
  if(location===warehouseLocation)return;
  warehouseLocation=location;const ub=location==='ulaanbaatar',city=ub?'Улаанбаатар':'Эрээн';
  $('#warehouse-title').textContent=city+' агуулах';$('#warehouse-city').textContent=city;document.title='GOStore · '+city+' агуулах';
  $('#waiting-hint').textContent=ub?'Замын-Үүдээс ирэх ачаа':'Баталгаажсан, хүргэлтэд';
  $('#received-label').textContent=city+' агуулахад';$('#received-hint').textContent=ub?'Хүлээн авсан, баталгаажсан':'Илгээхэд бэлдэх';
  $('#third-label').textContent=ub?'Дууссан захиалга':'Замын-Үүд рүү илгээсэн';$('#third-hint').textContent=ub?'Хэрэглэгчид хүлээлгэн өгсөн':'Замд яваа ачаа';
  $('#received-count').closest('button').dataset.status=ub?'ulaanbaatar':'erenhot';$('#dispatched-count').closest('button').dataset.status=ub?'completed':'erenhot_dispatched';
  const filters=ub?['all','waiting','ulaanbaatar','completed','cancelled']:['all','waiting','erenhot','erenhot_dispatched','zamyn_uud','ulaanbaatar','completed','cancelled'];
  if(!filters.includes(status))status='all';
  $('#status-filter').innerHTML=filters.map(key=>`<option value="${key}">${esc(key==='all'?'Бүх төлөв':key==='waiting'?'Ирэхийг хүлээж буй':labels[key])}</option>`).join('');$('#status-filter').value=status;
}
const date=v=>new Date(v).toLocaleString('mn-MN');
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function loginScreen(){orders=[];$('#orders').replaceChildren();$('#editor').close();$('#app').hidden=true;$('#login-screen').hidden=false;}
async function api(action,body){
  const r=await fetch('../api/index.php?action='+action,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},body:body?JSON.stringify(body):undefined});
  let d;try{d=await r.json();}catch{throw Error('Сервертэй холбогдсонгүй. Дахин оролдоно уу.');}
  if(d.csrf)csrf=d.csrf;
  if(!r.ok){if(r.status===401&&action!=='warehouse-login')loginScreen();throw Error(d.error||'Холболтын алдаа.');}return d;
}
function render(){
  $('#orders').innerHTML=orders.length?orders.map(o=>`<article class="order-card"><div><span class="order-code">${esc(o.id)}</span><h3>${esc(o.customer)}</h3><p>${esc(o.title)}</p><small>${date(o.created)} · ${o.items.reduce((n,i)=>n+(Number(i.qty)||0),0)} ширхэг</small></div><div class="order-actions"><span class="tag ${['erenhot','ulaanbaatar'].includes(o.status)?'green':o.status==='erenhot_dispatched'?'yellow':''}">${esc(labels[o.status]||o.status)}</span><button class="quiet" data-order="${esc(o.id)}">Бараа шалгах →</button></div></article>`).join(''):'<div class="empty"><h3>Тохирох захиалга алга</h3><p>Код, нэр эсвэл төлөвийн шүүлтүүрээ өөрчилж үзээрэй.</p></div>';
  document.querySelectorAll('[data-status]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.status===status)));
}
async function refresh(){
  const sequence=++requestSequence;$('#list-error').textContent='';$('#refresh').disabled=true;
  try{
    const d=await api('warehouse-orders&'+new URLSearchParams({q:query,status,offset:String(offset)}));
    if(sequence!==requestSequence)return;
    applyLocation(d.location);orders=d.orders;$('#manager-email').textContent=d.email;$('#waiting-count').textContent=d.counts.waiting;$('#received-count').textContent=d.counts.received;$('#dispatched-count').textContent=d.location==='ulaanbaatar'?d.counts.completed:d.counts.dispatched;
    $('#result-count').textContent=`${d.total} захиалга`;$('#previous').hidden=offset===0;$('#next').hidden=!d.more;$('#page-label').textContent=d.total?`${offset+1}–${offset+orders.length} / ${d.total}`:'';
    $('#login-screen').hidden=true;$('#app').hidden=false;render();
  }catch(e){$('#list-error').textContent=e.message;throw e;}finally{if(sequence===requestSequence)$('#refresh').disabled=false;}
}
function openOrder(id){
  const o=orders.find(x=>x.id===id);if(!o)return;
  $('#editor-title').textContent=o.id;
  $('#editor-body').innerHTML=`<span class="tag">${esc(labels[o.status]||o.status)}</span><div class="details"><div><small>Хүлээн авагч</small>${esc(o.customer)}</div><div><small>Захиалсан</small>${date(o.created)}</div></div><h3>Барааны мэдээлэл</h3><ul class="warehouse-items">${o.items.map(i=>`<li><strong>${esc(i.name)}</strong><span>${esc(i.variant)} · ${i.qty} ширхэг</span></li>`).join('')}</ul>${o.warehouse?`<div class="receipt-info"><strong>${warehouseLocation==='ulaanbaatar'?'Эрээн дэх анхны илгээмжийн шошго':'Илгээмжийн шошго'}</strong><p>${esc(o.warehouse.recipient)}</p><p>${esc(o.warehouse.address)}</p></div>`:''}${o.history.length?`<h3>Хүргэлтийн түүх</h3><ol class="warehouse-history">${o.history.map(h=>`<li>${esc(labels[h.status]||h.status)} · ${date(h.at)}</li>`).join('')}</ol>`:''}${o.next_status?`<form id="status-form" data-id="${esc(o.id)}" data-expected="${esc(o.status)}" data-next="${esc(o.next_status)}" class="warehouse-confirm"><p>${esc(confirmations[o.next_status])}</p><p id="form-error" class="error" role="alert"></p><button class="primary" type="submit">${esc(actions[o.next_status])}</button></form>`:'<p class="note">Энэ төлөвт агуулахын нэмэлт үйлдэл хийхгүй.</p>'}`;
  $('#editor').showModal();
}
$('#close-editor').addEventListener('click',()=>$('#editor').close());
$('#search-form').addEventListener('submit',e=>{e.preventDefault();query=$('#search').value.trim();status=$('#status-filter').value;offset=0;refresh().catch(e=>toast(e.message));});
$('#status-filter').addEventListener('change',()=>$('#search-form').requestSubmit());
$('#refresh').addEventListener('click',()=>refresh().catch(e=>toast(e.message)));
$('#previous').addEventListener('click',()=>{offset=Math.max(0,offset-50);refresh().catch(e=>toast(e.message));});
$('#next').addEventListener('click',()=>{offset+=50;refresh().catch(e=>toast(e.message));});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.order)openOrder(b.dataset.order);if(b.dataset.status){$('#status-filter').value=b.dataset.status;$('#search-form').requestSubmit();}});
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;$('#login-error').textContent='';
  try{await api('warehouse-session');const result=await api('warehouse-login',Object.fromEntries(new FormData(f)));f.elements.password.value='';offset=0;query='';status='all';$('#search').value='';warehouseLocation=null;applyLocation(result.location);await refresh();}catch(e){$('#login-error').textContent=e.message;}finally{b.disabled=false;}
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='status-form')return;e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;$('#form-error').textContent='';
  try{await api('warehouse-order-update',{id:f.dataset.id,status:f.dataset.next,expected_status:f.dataset.expected});$('#editor').close();toast('Агуулахын төлөв хадгалагдлаа');await refresh();}catch(e){const error=$('#form-error');if(error)error.textContent=e.message;toast(e.message);}finally{b.disabled=false;}
});
$('#logout').addEventListener('click',async()=>{try{await api('warehouse-logout',{});++requestSequence;loginScreen();await api('warehouse-session');}catch(e){toast(e.message);}});
const requestedLocation=new URLSearchParams(location.search).get('location');
if(['erenhot','ulaanbaatar'].includes(requestedLocation))$('#login-location').value=requestedLocation;
(async()=>{try{const s=await api('warehouse-session');if(s.authenticated)await refresh();}catch(e){$('#login-error').textContent=e.message;}})();
