'use strict';
// Search suggestions (owner request 2026-11-10): four or more characters in the search or scan box (e.g. a
// waybill's last four digits) list matching orders and batches at once; tap, or use the arrows and Enter.
const suggestTimers=new Map();let suggestSeq=0;
const suggestQuery=input=>input.value.trim().toUpperCase().replace(/\s+/g,'');
function suggestBox(input){
  let box=input.parentElement.querySelector('.suggest-list');
  if(!box){box=document.createElement('div');box.className='suggest-list';box.id=input.id+'-suggest';box.setAttribute('role','listbox');box.hidden=true;input.parentElement.append(box);
    input.setAttribute('role','combobox');input.setAttribute('aria-controls',box.id);input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');}
  return box;
}
function suggestClose(input){const box=input?.parentElement.querySelector('.suggest-list');if(box){box.hidden=true;box.replaceChildren();}input?.setAttribute('aria-expanded','false');input?.removeAttribute('aria-activedescendant');}
function suggestMark(value,q){const i=value.lastIndexOf(q);return i<0?esc(value):esc(value.slice(0,i))+'<mark>'+esc(value.slice(i,i+q.length))+'</mark>'+esc(value.slice(i+q.length));}
const suggestField=f=>({waybill:lt('Tracking','运单'),phone:lt('Утас','电话')})[f]||'';
async function suggestLoad(input){
  const q=suggestQuery(input);if(q.length<4||!/^[A-Z0-9-]+$/.test(q)){suggestClose(input);return;}
  const seq=++suggestSeq,d=await api('warehouse-suggest&'+new URLSearchParams({q}));
  if(seq!==suggestSeq||suggestQuery(input)!==q||document.activeElement!==input)return;
  const box=suggestBox(input);
  box.innerHTML=d.items.length?d.items.map((s,i)=>`<button type="button" role="option" id="${box.id}-${i}" aria-selected="false" data-suggest-type="${s.type}" data-suggest-id="${esc(s.id)}"><strong>${suggestMark(s.id,q)}</strong>${s.customer?' · '+esc(s.customer):''}<small>${['waybill','phone'].includes(s.field)?esc(suggestField(s.field))+' '+suggestMark(s.match,q)+' · ':''}${esc(s.type==='batch'?batchText(s.status)+' · '+s.orders+' '+t('orderCount'):statusText(s.status))}</small></button>`).join('')
    :`<p class="suggest-empty">${lt('Тохирох код алга','没有匹配的编号')}</p>`;
  box.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
}
document.addEventListener('input',e=>{
  const input=e.target;if(!input.matches?.('#search,#scan-code'))return;
  clearTimeout(suggestTimers.get(input));suggestTimers.set(input,setTimeout(()=>suggestLoad(input).catch(()=>suggestClose(input)),200));
});
document.addEventListener('keydown',e=>{
  const input=e.target;if(!input.matches?.('#search,#scan-code'))return;
  const box=input.parentElement.querySelector('.suggest-list');if(!box||box.hidden)return;
  const options=[...box.querySelectorAll('[role=option]')],current=options.findIndex(o=>o.id===input.getAttribute('aria-activedescendant'));
  if(e.key==='Escape'){e.preventDefault();suggestClose(input);return;}
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&options.length){
    e.preventDefault();const next=e.key==='ArrowDown'?(current+1)%options.length:(current<=0?options.length-1:current-1);
    options.forEach((o,i)=>o.setAttribute('aria-selected',String(i===next)));input.setAttribute('aria-activedescendant',options[next].id);options[next].scrollIntoView({block:'nearest'});return;
  }
  // Enter on a highlighted suggestion opens it; otherwise the form submits as before.
  if(e.key==='Enter'&&current>=0){e.preventDefault();options[current].click();}
});
// Submitting (or a scanner gun's Enter) closes the list and drops late answers.
document.addEventListener('submit',e=>{const input=e.target.querySelector?.('#search,#scan-code');if(input){++suggestSeq;clearTimeout(suggestTimers.get(input));suggestClose(input);}},true);
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-suggest-id]');
  document.querySelectorAll('.suggest-list:not([hidden])').forEach(box=>{if(!box.parentElement.contains(e.target)||b)suggestClose(box.parentElement.querySelector('input'));});
  if(!b)return;
  try{if(b.dataset.suggestType==='batch')await openBatch(b.dataset.suggestId);else await logisticsOpenOrder(b.dataset.suggestId);}catch(error){toast(error.message);}
});
