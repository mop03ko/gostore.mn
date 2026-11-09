'use strict';
// Admin UX layer, loaded after admin.js (replaces some of its render functions; uses its globals
// $, esc, money, api, data, page, query, statusFilter, statuses, titles, render, refresh, modal,
// editOrder, editProduct, editCustomer, toast):
// - semantic status colours; a task-focused dashboard; order tabs with counts, filters, paging and
//   bulk status change; an order drawer with a sticky summary and section links;
// - grouped menu badges, Ctrl+K search, a phone tab bar and in-app confirmation dialogs.

// Status colours by meaning: new (orange), waiting (amber), paid (green), moving (blue), ready (green), done/cancelled (grey).
const STATUS_TONE={new:'st-new',reviewing:'st-new',quoted:'st-wait',confirmed:'st-paid',shipping:'st-move',erenhot:'st-move',erenhot_ready:'st-move',erenhot_dispatched:'st-move',zamyn_uud:'st-move',ulaanbaatar:'st-move',ulaanbaatar_unsorted:'st-move',ready_pickup:'st-ready',ready_delivery:'st-ready',out_for_delivery:'st-ready',completed:'st-done',cancelled:'st-off'};
function tag(status){return `<span class="tag status-tag ${STATUS_TONE[status]||''}">${esc(statuses[status]||status)}</span>`;}

const UX_DAY=86400e3;
const uxDay=t=>new Date(t+8*3600e3).toISOString().slice(0,10);
const uxDayStart=d=>Date.parse(d+'T00:00:00+08:00');
const uxWaiting=o=>!['completed','cancelled'].includes(o.status);
function uxAge(o){
  if(!uxWaiting(o))return '';const h=Math.max(0,(Date.now()-Date.parse(o.created))/3600e3);
  const text=h<1?'1 цагаас бага':h<24?Math.floor(h)+' цаг':Math.floor(h/24)+' өдөр';
  return `<small class="order-age${['new','reviewing'].includes(o.status)&&h>=24?' late':''}" title="Захиалснаас хойш">${text}</small>`;
}

// Order views. A tab is a saved view over the same list; counts follow the other filters.
const ORDER_TABS=[
  ['all','Бүгд',()=>true],
  ['new','Шинэ',o=>['new','reviewing'].includes(o.status)],
  ['quoted','Үнийн санал',o=>o.status==='quoted'],
  ['unpaid','Төлбөр хүлээж',o=>!o.paid&&!o.demo&&o.amount>0&&!['cancelled','completed'].includes(o.status)],
  ['paid','Баталгаажсан',o=>['confirmed','shipping'].includes(o.status)],
  ['transit','Эрээн, замд',o=>['erenhot','erenhot_ready','erenhot_dispatched','zamyn_uud'].includes(o.status)],
  ['ub','Улаанбаатарт',o=>['ulaanbaatar','ulaanbaatar_unsorted','ready_pickup','ready_delivery','out_for_delivery'].includes(o.status)],
  ['done','Дууссан',o=>o.status==='completed'],
  ['cancelled','Цуцалсан',o=>o.status==='cancelled'],
  ['review','TaoWorld шалгах',o=>['review','preflight_review'].includes(o.purchase?.state)],
];
const ORDER_PAGE_SIZE=25;
let orderTab='all',payFilter='all',dateFilter='all',orderSort='new',orderPage=1;
const pickedOrders=new Set();
const uxTabFn=id=>(ORDER_TABS.find(t=>t[0]===id)||ORDER_TABS[0])[2];

function ordersBase(){
  const q=query.toLowerCase().trim(),qDigits=q.replace(/\D/g,'');
  const since=dateFilter==='all'?0:dateFilter==='today'?uxDayStart(uxDay(Date.now())):Date.now()-Number(dateFilter)*UX_DAY;
  return data.orders.filter(o=>(page!=='links'||['link','supplier','checkout'].includes(o.type))&&(statusFilter==='all'||o.status===statusFilter)
    &&(payFilter==='all'||(payFilter==='paid')===!!o.paid)&&(!since||Date.parse(o.created)>=since)
    &&(!q||(o.id+' '+o.title+' '+o.customer+' '+o.phone).toLowerCase().includes(q)||(qDigits.length>=4&&String(o.phone||'').replace(/\D/g,'').includes(qDigits))));
}
function orderTable(rows,opts={}){
  if(!rows.length)return opts.emptyHtml||`<div class="empty"><h3>Захиалга хараахан алга</h3>Дэлгүүрээс илгээсэн хүсэлтүүд энд харагдана.</div>`;
  return `<div class="table-wrap orders-table-wrap"><table class="orders-table${opts.select?' selectable':''}" aria-label="Захиалгын жагсаалт"><colgroup><col class="order-col-main"><col class="order-col-customer"><col class="order-col-amount"><col class="order-col-status"><col class="order-col-action"></colgroup><thead><tr><th scope="col">Захиалга</th><th scope="col">Хэрэглэгч</th><th scope="col">Дүн</th><th scope="col">Төлөв</th><th scope="col"><span class="admin-sr-only">Үйлдэл</span></th></tr></thead><tbody>${rows.map(o=>`<tr data-row-order="${esc(o.id)}" class="${pickedOrders.has(o.id)?'is-picked':''}"><td class="order-main"><div class="order-heading">${opts.select?`<input type="checkbox" class="order-pick" data-pick="${esc(o.id)}" ${pickedOrders.has(o.id)?'checked':''} aria-label="${esc(o.id)} сонгох">`:''}<strong class="order-code">${esc(o.id)}</strong><time class="order-date" datetime="${esc(o.created)}">${esc(new Date(o.created).toLocaleDateString('sv-SE',{timeZone:'Asia/Ulaanbaatar'}))}</time></div><span class="order-title" title="${esc(o.title)}">${esc(o.title)}</span></td><td class="order-customer" data-label="Хэрэглэгч"><span>${esc(o.customer)}</span><small>${esc(o.phone)}</small></td><td class="order-amount" data-label="Дүн"><strong>${o.amount?money(o.amount):'Үнэ хүлээгдэж байна'}</strong><small class="order-payment ${o.paid?'is-paid':''}">${o.paid?'Төлөгдсөн':'Төлбөр хүлээгдэж байна'}${o.demo?' · Жишээ':''}</small></td><td class="order-status" data-label="Төлөв"><button class="order-track-trigger" type="button" data-admin-track="${esc(o.id)}" aria-label="${esc(o.id)} ачааны явц харах">${tag(o.status)}<span aria-hidden="true">↗</span></button>${uxAge(o)}</td><td class="order-action"><button class="quiet" data-order="${esc(o.id)}" aria-label="${esc(o.id)} захиалгын дэлгэрэнгүй">Харах →</button></td></tr>`).join('')}</tbody></table></div>`;
}
function ordersList(){
  const base=ordersBase(),tabs=ORDER_TABS.map(([id,label,fn])=>({id,label,count:base.filter(fn).length})).filter(t=>t.id!=='review'||t.count||orderTab==='review');
  if(!tabs.some(t=>t.id===orderTab))orderTab='all';
  let rows=base.filter(uxTabFn(orderTab));
  if(orderSort==='old')rows=[...rows].reverse();else if(orderSort==='amount')rows=[...rows].sort((a,b)=>(b.amount||0)-(a.amount||0));
  const pages=Math.max(1,Math.ceil(rows.length/ORDER_PAGE_SIZE));orderPage=Math.min(orderPage,pages);
  const shown=rows.slice((orderPage-1)*ORDER_PAGE_SIZE,orderPage*ORDER_PAGE_SIZE);
  for(const id of [...pickedOrders])if(!data.orders.some(o=>o.id===id))pickedOrders.delete(id);
  const opt=(id,value,list,label)=>`<select id="${id}" aria-label="${label}">${list.map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${t}</option>`).join('')}</select>`;
  const filtered=query||statusFilter!=='all'||payFilter!=='all'||dateFilter!=='all';
  const empty=`<div class="empty"><h3>${filtered?'Тохирох захиалга алга':'Энэ хэсэгт захиалга алга'}</h3>${filtered?'<p>Хайлт эсвэл шүүлтүүрээ өөрчилнө үү.</p><button type="button" class="quiet" data-orders-reset>Шүүлтүүр цэвэрлэх</button>':'Шинэ захиалга ирэхэд энд харагдана.'}</div>`;
  const allPicked=shown.length&&shown.every(o=>pickedOrders.has(o.id));
  const bulkStatuses=Object.entries(statuses).filter(([k])=>!['erenhot_ready','ulaanbaatar_unsorted','ready_pickup','ready_delivery','out_for_delivery'].includes(k));
  return `<div class="orders-tabs" role="tablist" aria-label="Захиалгын төлөв">${tabs.map(t=>`<button type="button" role="tab" class="otab${t.id===orderTab?' on':''}" aria-selected="${t.id===orderTab}" data-otab="${t.id}">${esc(t.label)}<b>${t.count}</b></button>`).join('')}</div>`+
    `<div class="toolbar orders-toolbar"><input id="list-search" type="search" aria-label="Захиалга хайх" placeholder="Нэр, утас, захиалгын дугаар…" value="${esc(query)}">`+
    `<select id="status-filter" aria-label="Нарийвчилсан төлөв"><option value="all">Бүх төлөв</option>${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${statusFilter===k?'selected':''}>${v}</option>`).join('')}</select>`+
    opt('pay-filter',payFilter,[['all','Төлбөр: бүгд'],['paid','Төлөгдсөн'],['unpaid','Төлөгдөөгүй']],'Төлбөрөөр шүүх')+
    opt('date-filter',dateFilter,[['all','Хугацаа: бүгд'],['today','Өнөөдөр'],['7','Сүүлийн 7 хоног'],['30','Сүүлийн 30 хоног']],'Хугацаагаар шүүх')+
    opt('sort-filter',orderSort,[['new','Шинэ нь эхэндээ'],['old','Хуучин нь эхэндээ'],['amount','Дүнгээр']],'Эрэмбэ')+
    `<button class="quiet" data-refresh>↻ Шинэчлэх</button></div>`+
    (pickedOrders.size?`<div class="bulk-bar" role="region" aria-label="Сонгосон захиалга"><strong>${pickedOrders.size} захиалга сонгосон</strong><select id="bulk-status" aria-label="Шинэ төлөв">${bulkStatuses.map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button type="button" class="primary" data-bulk-apply>Төлөв солих</button><button type="button" class="quiet" data-bulk-clear>Болих</button></div>`:'')+
    `<section class="panel orders-panel"><div class="panel-heading"><div class="orders-heading">${uxCan('operator')&&shown.length?`<input type="checkbox" class="order-pick-all" data-pick-all ${allPicked?'checked':''} aria-label="Энэ хуудсын бүх захиалгыг сонгох">`:''}<h3>${page==='links'?'Хятад захиалгууд':'Захиалгууд'}</h3></div><span class="muted">${rows.length} захиалга</span></div>${orderTable(shown,{select:uxCan('operator'),emptyHtml:empty})}`+
    (pages>1?`<div class="orders-pager"><span>${(orderPage-1)*ORDER_PAGE_SIZE+1}–${Math.min(orderPage*ORDER_PAGE_SIZE,rows.length)} / ${rows.length}</span><span><button type="button" class="quiet" data-opage="${orderPage-1}" ${orderPage<=1?'disabled':''}>← Өмнөх</button><button type="button" class="quiet" data-opage="${orderPage+1}" ${orderPage>=pages?'disabled':''}>Дараах →</button></span></div>`:'')+`</section>`;
}
const uxCan=r=>({viewer:1,operator:2,owner:3})[data.admin?.role||'owner']>=({viewer:1,operator:2,owner:3})[r];

// Dashboard: today against yesterday and the week, the work waiting, the last seven days.
function overview(){
  const real=data.orders.filter(o=>!o.demo),today=uxDay(Date.now()),yesterday=uxDay(Date.now()-UX_DAY);
  const madeOn=d=>real.filter(o=>uxDay(Date.parse(o.created))===d).length;
  const paidOn=d=>real.filter(o=>o.paid&&uxDay(Date.parse(o.paid_at||o.created))===d).reduce((s,o)=>s+(o.amount||0),0);
  const week=[...Array(7)].map((_,i)=>uxDay(Date.now()-(6-i)*UX_DAY)),revenue=week.map(paidOn),avg=Math.round(revenue.slice(0,6).reduce((a,b)=>a+b,0)/6);
  const diff=(now,then,unit='')=>now===then?'<small class="flat">өчигдөртэй адил</small>':`<small class="${now>then?'up':'down'}">${now>then?'▲':'▼'} ${Math.abs(now-then).toLocaleString('en-US')}${unit} өчигдрөөс</small>`;
  const count=id=>real.filter(uxTabFn(id)).length,oldest=real.filter(uxTabFn('new')).reduce((m,o)=>Math.min(m,Date.parse(o.created)),Infinity);
  const ready=real.filter(o=>['ready_pickup','ready_delivery'].includes(o.status)).length;
  const tasks=[['new',count('new'),'Шинэ захиалга хариу хүлээж байна',Number.isFinite(oldest)?'Хамгийн удаан нь '+uxAge({created:new Date(oldest).toISOString(),status:'new'}).replace(/<[^>]+>/g,''):'Хүлээгдэж буй захиалга алга','or'],
    ['review',count('review'),'TaoWorld захиалга шалгах','Үнэ, төлөв зөрсөн','a'],['unpaid',count('unpaid'),'Төлбөр хүлээж буй','Үнийн санал илгээсэн, төлөгдөөгүй','bl'],['ub',ready,'Улаанбаатарт олгоход бэлэн','Агуулахаас авах эсвэл хүргэх','g']];
  const top=Math.max(1,...revenue),low=data.products.filter(p=>p.active&&p.type==='local'&&!p.demo&&p.stock<5);
  return `<div class="stats ux-kpis"><div class="stat"><span>Өнөөдрийн захиалга</span><strong>${madeOn(today)}</strong>${diff(madeOn(today),madeOn(yesterday))}</div>`+
    `<div class="stat"><span>Өнөөдрийн орлого</span><strong>${money(paidOn(today))}</strong><small class="${paidOn(today)>=avg?'up':'down'}">7 хоногийн дундаж ${money(avg)}</small></div>`+
    `<div class="stat"><span>Төлбөр хүлээж буй</span><strong>${count('unpaid')}</strong><small class="flat">захиалга</small></div>`+
    `<div class="stat"><span>TaoWorld API өнөөдөр</span><strong id="kpi-api">—</strong><small class="flat" id="kpi-api-note">ачаалж байна</small></div></div>`+
    `<div class="two-col ux-dash"><section class="panel"><div class="panel-heading"><h3>Хийх ажил</h3><button class="quiet" data-page="orders">Бүх захиалга →</button></div><div class="tasks">${tasks.map(([tab,n,title,note,tone])=>`<button type="button" class="task-row" data-task-tab="${tab}" ${n?'':'data-zero'}><b class="task-n ${tone}">${n}</b><span><strong>${title}</strong><small>${esc(note)}</small></span><span aria-hidden="true">→</span></button>`).join('')}</div></section>`+
    `<section class="panel"><div class="panel-heading"><h3>7 хоногийн орлого</h3><button class="quiet" data-page="reports">Тайлан →</button></div><div class="xchart"><div class="xbars" role="img" aria-label="Сүүлийн 7 хоногийн төлбөр орсон орлого">${week.map((d,i)=>`<div class="xbar" tabindex="0" data-tip="${d}: ${money(revenue[i])}">${revenue[i]?`<span class="xseg" style="height:${(revenue[i]/top*100).toFixed(1)}%;background:${d===today?'#f16522':'#2a78d6'}"></span>`:''}</div>`).join('')}</div><div class="xaxis"><span>${week[0].slice(5)}</span><span>Өнөөдөр улбар шараар</span><span>${today.slice(5)}</span></div></div></section></div>`+
    `<section class="panel"><div class="panel-heading"><div><h3>Сүүлийн захиалгууд</h3><p>Шинээр ирсэн захиалгуудаа шалгаарай</p></div><button class="quiet" data-page="orders">Бүгдийг харах →</button></div>${orderTable(real.slice(0,6))}</section>`+
    (low.length?`<section class="panel"><div class="panel-heading"><h3>Үлдэгдлийн анхааруулга</h3><span class="tag st-wait">${low.length}</span></div>${low.map(p=>`<div class="connection"><div><h3>${esc(p.name)}</h3><p>${p.stock} ширхэг үлдсэн</p></div><button class="quiet" data-product="${esc(p.id)}">Засах</button></div>`).join('')}</section>`:'');
}
async function uxApiKpi(){
  const box=$('#kpi-api');if(!box)return;
  try{const u=await api('admin-api-usage');const b=u.status;if(!$('#kpi-api'))return;$('#kpi-api').textContent=b.used.toLocaleString('en-US')+' / '+b.limit.toLocaleString('en-US');
    const pct=Math.round(b.used*100/Math.max(1,b.limit));$('#kpi-api-note').textContent=pct+'% · Улаанбаатарын 08:00-д шинэчлэгдэнэ';$('#kpi-api-note').className=pct>=80?'down':'flat';}
  catch{if($('#kpi-api-note'))$('#kpi-api-note').textContent='Мэдээлэл авах боломжгүй';}
}

// Order drawer: a sticky summary with the next actions and links to each section.
const baseModal=modal;
modal=function(title,html){baseModal(title,html);$('#editor-summary')?.remove();};
const baseEditOrder=editOrder;
editOrder=function(id){
  baseEditOrder(id);const o=data.orders.find(x=>x.id===id);if(!o||!$('#editor').open)return;
  const body=$('#editor-body'),sections=[['.order-tracking','Явц'],['.details','Мэдээлэл'],['#order-form','Төлөв, дүн'],['#quote-form','Үнийн санал'],['.order-warehouse-assignment','Агуулах'],['#tw-purchase,.purchase-panel','TaoWorld'],['.aftersale','Буцаалт']].filter(([s])=>body.querySelector(s));
  const head=document.createElement('div');head.id='editor-summary';
  head.innerHTML=`<div class="sum-line">${tag(o.status)}<span class="sum-amount">${o.amount?money(o.amount):'Үнэ хүлээгдэж байна'}</span><span class="tag ${o.paid?'st-paid':'st-wait'}">${o.paid?'Төлөгдсөн':'Төлбөр хүлээгдэж байна'}</span><span class="muted">${esc(new Date(o.created).toLocaleString('mn-MN',{timeZone:'Asia/Ulaanbaatar'}))}</span>${uxAge(o)}</div>`+
    `<div class="sum-actions">${o.phone?`<button type="button" class="quiet" data-copy-phone="${esc(o.phone)}">☎ ${esc(o.phone)} хуулах</button>`:''}<button type="button" class="quiet" data-admin-track="${esc(o.id)}">Ачааны явц</button>${uxCan('operator')?'<button type="button" class="primary" data-save-order>Хадгалах</button>':''}</div>`+
    `<nav class="sum-links" aria-label="Захиалгын хэсгүүд">${sections.map(([s,l])=>`<button type="button" data-jump="${esc(s)}">${l}</button>`).join('')}</nav>`;
  $('.dialog-header').append(head);
};

// Menu badges, phone tab bar state, dashboard figures.
const baseRender=render;
render=function(){
  baseRender();
  const review=data.orders.filter(uxTabFn('review')).length,badge=$('#review-count');if(badge){badge.textContent=review;badge.hidden=!review;}
  document.querySelectorAll('.tabbar [data-page]').forEach(b=>{const on=b.dataset.page===page||(b.dataset.page==='orders'&&page==='links');b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false');});
  const tabNew=$('#tab-new-count');if(tabNew){const n=data.orders.filter(o=>o.status==='new').length;tabNew.textContent=n;tabNew.hidden=!n;}
  if(page==='overview')uxApiKpi();
};

// In-app confirmation (browser confirm/prompt are blocked in some views and look foreign).
window.uiConfirm=({title,text='',confirmLabel='Тийм',danger=false,input=null})=>new Promise(resolve=>{
  let d=$('#ui-confirm');if(!d){d=document.createElement('dialog');d.id='ui-confirm';d.className='ui-confirm';document.body.append(d);}
  d.innerHTML=`<form method="dialog"><h2>${esc(title)}</h2>${text?`<p>${esc(text)}</p>`:''}${input?`<label>${esc(input.label)}<input name="value" value="${esc(input.value||'')}" maxlength="${input.max||200}" required></label>`:''}<div class="form-actions"><button value="cancel" class="quiet" formnovalidate>Болих</button><button value="ok" class="primary${danger?' danger-fill':''}">${esc(confirmLabel)}</button></div></form>`;
  // admin.js cancels every form submit on the document, so this form closes its own dialog first.
  d.querySelector('form').addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();const v=d.querySelector('[name=value]');
    if(e.submitter?.value!=='cancel'&&v&&!v.value.trim()){v.reportValidity();return;}d.close(e.submitter?.value==='cancel'?'cancel':'ok');});
  d.onclose=()=>{const ok=d.returnValue==='ok';resolve(ok?(input?d.querySelector('[name=value]').value.trim()||false:true):false);};
  d.returnValue='';d.showModal();(d.querySelector('[name=value]')||d.querySelector('[value=ok]')).focus();
});

// Ctrl+K: orders, customers, products, pages and Taobao items in one place.
let paletteItems=[],paletteIndex=0,paletteSeq=0;
function paletteOpen(){
  let d=$('#cmdk');
  if(!d){d=document.createElement('dialog');d.id='cmdk';d.className='cmdk';d.setAttribute('aria-label','Хайх');d.innerHTML='<div class="cmdk-field"><span aria-hidden="true">⌕</span><input id="cmdk-input" type="search" placeholder="Захиалга, утас, хэрэглэгч, бараа, хуудас…" autocomplete="off" aria-controls="cmdk-results" aria-autocomplete="list"></div><div id="cmdk-results" role="listbox" aria-label="Илэрц"></div><p class="cmdk-hint">↑ ↓ сонгох · Enter нээх · Esc хаах</p>';document.body.append(d);
    d.addEventListener('click',e=>{if(e.target===d)d.close();const item=e.target.closest('[data-cmdk]');if(item)paletteRun(Number(item.dataset.cmdk));});
    $('#cmdk-input').addEventListener('input',e=>paletteSearch(e.target.value));
    $('#cmdk-input').addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();paletteIndex=(paletteIndex+(e.key==='ArrowDown'?1:-1)+paletteItems.length)%Math.max(1,paletteItems.length);paletteDraw();}if(e.key==='Enter'){e.preventDefault();paletteRun(paletteIndex);}});}
  $('#cmdk-input').value='';d.showModal();$('#cmdk-input').focus();paletteSearch('');
}
function paletteSearch(raw){
  const q=raw.trim().toLowerCase(),digits=q.replace(/\D/g,''),seq=++paletteSeq,items=[];
  const hidden=new Set([...document.querySelectorAll('nav [data-page]')].filter(b=>b.hidden).map(b=>b.dataset.page));
  for(const [key,title] of Object.entries(titles))if(!hidden.has(key)&&(!q||title.toLowerCase().includes(q)))items.push({group:'Хуудас',label:title,run:()=>{page=key;query='';render();}});
  if(q){
    const tb=raw.match(/(?:^tb-|[?&]id=|^)(\d{6,20})\b/);if(tb&&(/^tb-/.test(raw.trim())||/taobao|tmall|tb\.cn/.test(raw)||/^\d{9,20}$/.test(raw.trim())))items.unshift({group:'Taobao бараа',label:'tb-'+tb[1]+' дэлгүүрт нээх',run:()=>window.open('/v/tb-'+tb[1],'_blank','noopener')});
    for(const o of data.orders.filter(o=>(o.id+' '+o.customer+' '+o.title).toLowerCase().includes(q)||(digits.length>=4&&String(o.phone||'').replace(/\D/g,'').includes(digits))).slice(0,8))
      items.push({group:'Захиалга',label:o.id+' · '+o.customer,sub:(statuses[o.status]||o.status)+' · '+(o.amount?money(o.amount):'үнэгүй'),run:()=>editOrder(o.id)});
    for(const p of data.products.filter(p=>(p.name+' '+p.id).toLowerCase().includes(q)).slice(0,4))items.push({group:'Бараа',label:p.name,sub:money(p.price),run:()=>editProduct(p.id)});
  }
  paletteItems=items.slice(0,24);paletteIndex=0;paletteDraw();
  if(q.length>=2&&uxCan('operator'))api('admin-customers&q='+encodeURIComponent(q)).then(r=>{if(seq!==paletteSeq)return;const extra=(r.customers||[]).slice(0,5).map(c=>({group:'Хэрэглэгч',label:c.name||c.phone||c.email,sub:[c.phone,c.email].filter(Boolean).join(' · ')+' · '+c.orders+' захиалга',run:()=>editCustomer(c.id)}));if(extra.length){paletteItems=[...paletteItems,...extra].slice(0,28);paletteDraw();}}).catch(()=>{});
}
function paletteDraw(){
  const box=$('#cmdk-results');if(!box)return;let last='';
  box.innerHTML=paletteItems.length?paletteItems.map((it,i)=>{const g=it.group!==last?`<div class="cmdk-group" role="presentation">${esc(it.group)}</div>`:'';last=it.group;return g+`<button type="button" role="option" id="cmdk-${i}" class="cmdk-item${i===paletteIndex?' on':''}" aria-selected="${i===paletteIndex}" data-cmdk="${i}"><span>${esc(it.label)}</span>${it.sub?`<small>${esc(it.sub)}</small>`:''}</button>`;}).join(''):'<p class="cmdk-empty">Илэрц алга. GS-дугаар, утасны дугаар эсвэл нэрээр хайна уу.</p>';
  $('#cmdk-input').setAttribute('aria-activedescendant',paletteItems.length?'cmdk-'+paletteIndex:'');
  box.querySelector('.on')?.scrollIntoView({block:'nearest'});
}
function paletteRun(i){const it=paletteItems[i];if(!it)return;$('#cmdk').close();it.run();}

// Events.
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!$('#app').hidden){e.preventDefault();paletteOpen();}});
addEventListener('click',async e=>{
  const b=e.target.closest('[data-otab],[data-opage],[data-orders-reset],[data-bulk-apply],[data-bulk-clear],[data-task-tab],[data-save-order],[data-jump],[data-copy-phone],[data-cmdk-open],[data-menu-open]');
  if(!b){
    // A click anywhere on an order row opens it (checkbox, links and buttons keep their own action).
    const row=e.target.closest('tr[data-row-order]');if(row&&!e.target.closest('button,a,input,label,select'))editOrder(row.dataset.rowOrder);
    return;
  }
  e.stopImmediatePropagation();
  if(b.dataset.otab){orderTab=b.dataset.otab;orderPage=1;render();$(`[data-otab="${orderTab}"]`)?.focus();return;}
  if(b.dataset.opage){orderPage=Number(b.dataset.opage);render();$('.orders-panel')?.scrollIntoView({block:'start'});return;}
  if(b.hasAttribute('data-orders-reset')){query='';statusFilter='all';payFilter='all';dateFilter='all';orderTab='all';orderPage=1;render();return;}
  if(b.hasAttribute('data-bulk-clear')){pickedOrders.clear();render();return;}
  if(b.dataset.taskTab){orderTab=b.dataset.taskTab;orderPage=1;page='orders';query='';statusFilter='all';render();return;}
  if(b.hasAttribute('data-cmdk-open')){paletteOpen();return;}
  if(b.hasAttribute('data-menu-open')){const s=$('#mobile-admin-page');try{s.showPicker();}catch{s.focus();s.click();}return;}
  if(b.hasAttribute('data-save-order')){$('#order-form')?.requestSubmit();return;}
  if(b.dataset.jump){$('#editor-body').querySelector(b.dataset.jump)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return;}
  if(b.dataset.copyPhone){try{await navigator.clipboard.writeText(b.dataset.copyPhone);toast('Утасны дугаар хуулагдлаа');}catch{toast(b.dataset.copyPhone);}return;}
  if(b.hasAttribute('data-bulk-apply')){
    const status=$('#bulk-status').value,ids=[...pickedOrders];
    if(!await uiConfirm({title:`${ids.length} захиалгын төлөвийг өөрчлөх үү?`,text:`Шинэ төлөв: ${statuses[status]}. Үнэ, тэмдэглэл өөрчлөгдөхгүй. Агуулахын багцтай захиалгын явцыг агуулахаас удирдана.`,confirmLabel:'Төлөв солих'}))return;
    b.disabled=true;let ok=0;const failed=[];
    for(const id of ids){const o=data.orders.find(x=>x.id===id);if(!o)continue;if(o.status===status){ok++;continue;}
      try{await api('order-update',{id,status,amount:o.amount,internal_note:o.internal_note||''});ok++;}catch(err){failed.push(id+': '+err.message);}}
    pickedOrders.clear();await refresh();
    toast(failed.length?`${ok} захиалга шинэчлэгдлээ, ${failed.length} нь өөрчлөгдсөнгүй (${failed[0]}${failed.length>1?' …':''})`:`${ok} захиалгын төлөв шинэчлэгдлээ`);
  }
},true);
addEventListener('change',e=>{
  const t=e.target;
  if(t.matches('[data-pick]')){t.checked?pickedOrders.add(t.dataset.pick):pickedOrders.delete(t.dataset.pick);render();return;}
  if(t.matches('[data-pick-all]')){const ids=[...document.querySelectorAll('[data-pick]')].map(x=>x.dataset.pick);ids.forEach(id=>t.checked?pickedOrders.add(id):pickedOrders.delete(id));render();return;}
  if(t.id==='pay-filter'){payFilter=t.value;orderPage=1;render();}
  if(t.id==='date-filter'){dateFilter=t.value;orderPage=1;render();}
  if(t.id==='sort-filter'){orderSort=t.value;orderPage=1;render();}
  if(t.id==='status-filter'||t.id==='mobile-admin-page')orderPage=1;
});
addEventListener('input',e=>{if(e.target.id==='list-search')orderPage=1;},true);
