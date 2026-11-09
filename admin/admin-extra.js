'use strict';
// Admin additions, loaded before admin.js and using its globals ($, esc, api, data, page, render,
// refresh, modal, editOrder, toast, money, csrf) at call time: reports and CSV exports, TaoWorld usage,
// purchase threshold and bills, site controls, staff accounts and audit log, two-step sign-in,
// TaoWorld after-sales in the order view, dashboard alerts and role-aware navigation.
window.ADMIN_EXTRA_TITLES={reports:'Тайлан',taoworld:'TaoWorld лимит',site:'Сайтын тохиргоо',admins:'Админ ба аудит'};
window.AdminExtra=(()=>{
  const RANK={viewer:1,operator:2,owner:3};
  const role=()=>data.admin?.role||'owner';
  const can=r=>RANK[role()]>=RANK[r];
  const ubToday=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
  const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400e3).toISOString().slice(0,10);
  const num=v=>new Intl.NumberFormat('en-US').format(v||0);
  const cny=v=>v==null?'—':new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v)+' ¥';
  const when=v=>v?new Date(v).toLocaleString('mn-MN',{timeZone:'Asia/Ulaanbaatar'}):'—';
  // Grey placeholder rows hold the space while data loads, so nothing jumps when it arrives.
  const loading='<div class="skeleton-rows xpad" role="status" aria-label="Ачаалж байна"><span></span><span></span><span></span></div>';
  const failed=e=>`<p class="error xpad" role="alert">${esc(e.message)}</p>`;
  let reportRange={from:shift(ubToday(),-29),to:ubToday()},searchDays=30,auditState={page:1,q:''},billRange={from:ubToday().slice(0,8)+'01',to:ubToday()},siteData=null;

  // Hover/focus tooltip for chart marks (data-tip).
  const tip=document.createElement('div');tip.className='xtip';tip.hidden=true;tip.setAttribute('role','tooltip');
  const showTip=(el,x,y)=>{if(!tip.isConnected)document.body.append(tip);tip.textContent=el.dataset.tip;tip.hidden=false;const w=tip.offsetWidth;tip.style.left=Math.max(8,Math.min(innerWidth-w-8,x-w/2))+'px';tip.style.top=Math.max(8,y-tip.offsetHeight-12)+'px';};
  addEventListener('pointerover',e=>{const el=e.target.closest('[data-tip]');if(el)showTip(el,e.clientX,e.clientY);});
  addEventListener('pointermove',e=>{const el=e.target.closest('[data-tip]');if(el&&!tip.hidden)showTip(el,e.clientX,e.clientY);});
  addEventListener('pointerout',e=>{if(e.target.closest('[data-tip]'))tip.hidden=true;});
  addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');if(!el){tip.hidden=true;return;}const r=el.getBoundingClientRect();showTip(el,r.left+r.width/2,r.top);});

  // Bar chart: one bar per day; segments stack in fixed category order. A data table goes with it.
  function bars(rows,{series,label,limit,format=num,caption}){
    const totals=rows.map(r=>series.reduce((s,k)=>s+(r.values[k.key]||0),0));
    const top=Math.max(1,limit||0,...totals);
    const html=rows.map((r,i)=>{const tipText=r.label+': '+series.filter(k=>r.values[k.key]).map(k=>(series.length>1?k.name+' ':'')+format(r.values[k.key])).join(', ')+(series.length>1?' · нийт '+format(totals[i]):'')+(r.extra?' · '+r.extra:'');
      return `<div class="xbar" tabindex="0" data-tip="${esc(totals[i]||r.extra?tipText:r.label+': 0')}" aria-label="${esc(totals[i]||r.extra?tipText:r.label+': 0')}">${series.map(k=>r.values[k.key]?`<span class="xseg" style="height:${(r.values[k.key]/top*100).toFixed(2)}%;background:${k.color}"></span>`:'').join('')}</div>`;}).join('');
    const legend=series.length>1?`<div class="xlegend">${series.map(k=>`<span><i style="background:${k.color}"></i>${esc(k.name)}</span>`).join('')}${limit?'<span><i class="xlimit-key"></i>Өдрийн лимит</span>':''}</div>`:'';
    const table=`<details class="data-table"><summary>Хүснэгтээр харах</summary><div class="table-wrap"><table><thead><tr><th>Өдөр</th>${series.map(k=>`<th>${esc(k.name)}</th>`).join('')}${series.length>1?'<th>Нийт</th>':''}</tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${esc(r.label)}</td>${series.map(k=>`<td>${format(r.values[k.key]||0)}</td>`).join('')}${series.length>1?`<td>${format(totals[i])}</td>`:''}</tr>`).join('')}</tbody></table></div></details>`;
    return `<div class="xchart"><div class="xbars" role="img" aria-label="${esc(label)}">${limit?`<span class="xlimit" style="bottom:${(limit/top*100).toFixed(2)}%" aria-hidden="true"></span>`:''}${html}</div><div class="xaxis"><span>${esc(rows[0]?.label||'')}</span><span>${esc(caption||'')}</span><span>${esc(rows.at(-1)?.label||'')}</span></div></div>${legend}${table}`;
  }
  const progress=(value,max,label)=>{const pct=Math.min(100,max?value*100/max:0);return `<div class="xprogress ${pct>=100?'bad':pct>=80?'warn':''}" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${pct.toFixed(1)}%"></span></div>`;};
  const stat=(title,value,note='')=>`<div class="stat"><span>${esc(title)}</span><strong>${value}</strong><small>${note}</small></div>`;

  // Reports: sales, gross margin, exports and search insights.
  const exportLink=(kind,label)=>`<a class="quiet" href="../api/index.php?action=admin-export&amp;kind=${kind}&amp;from=${reportRange.from}&amp;to=${reportRange.to}" download>⬇ ${esc(label)}</a>`;
  const reportsHtml=()=>`<form id="report-range" class="toolbar report-toolbar"><label>Эхлэх огноо<input type="date" name="from" value="${reportRange.from}" required></label><label>Дуусах огноо<input type="date" name="to" value="${reportRange.to}" required></label><button class="primary" type="submit">Тайлан харах</button></form><div id="report-body">${loading}</div>${can('operator')?`<section class="panel"><div class="panel-heading"><div><h3>Excel (CSV) файлаар татах</h3><p class="muted">Сонгосон хугацааны мэдээлэл. Excel-д шууд нээгдэнэ.</p></div></div><div class="export-links">${exportLink('orders','Захиалга, ашиг')}${exportLink('payments','Төлбөр ба буцаалт')}${can('owner')?exportLink('customers','Хэрэглэгчид'):''}</div></section>`:''}<section class="panel" id="search-insights">${loading}</section>`;
  async function loadReports(){
    const body=$('#report-body');
    try{
      const r=await api(`admin-report&from=${reportRange.from}&to=${reportRange.to}`);if(!body.isConnected)return;const t=r.totals,p=r.profit;
      // Ranges over about two months are shown per month so each bar stays readable.
      const monthly=r.days.length>62,buckets=new Map();
      for(const d of r.days){const k=monthly?d.day.slice(0,7):d.day;const b=buckets.get(k)||{label:k,values:{revenue:0},orders:0};b.values.revenue+=d.revenue;b.orders+=d.orders;buckets.set(k,b);}
      const series=[...buckets.values()].map(b=>({...b,extra:b.orders?b.orders+' захиалга':''}));
      body.innerHTML=`<div class="stats six">${stat('Захиалга',num(t.orders),`${num(t.cancelled)} цуцлагдсан`)}${stat('Төлбөр орсон',num(t.paid_orders),'захиалга')}${stat('Орлого (цэвэр)',money(t.revenue),`${money(t.refunded)} буцаасан`)}${stat('Дундаж захиалга',money(t.aov),'төлбөр орсон захиалгаар')}${stat('Нийт ашиг',p.orders?money(p.margin):'—',p.orders?`${p.margin_pct}% · ${num(p.orders)} захиалга`:'TaoWorld-д төлсөн захиалга алга')}${stat('Нийлүүлэгчийн зардал',p.orders?money(p.cost):'—','бараа + Хятад доторх хүргэлт')}</div>`+
        `<section class="panel"><div class="panel-heading"><div><h3>${monthly?'Сар бүрийн':'Өдөр тутмын'} орлого</h3><p class="muted">Төлбөр орсон захиалгын цэвэр орлого (₮), Улаанбаатарын цагаар</p></div></div>${bars(series,{series:[{key:'revenue',name:'Орлого',color:'#2a78d6'}],label:(monthly?'Сар бүрийн':'Өдөр тутмын')+' орлого',format:money,caption:'Орлого ₮'})}</section>`+
        `<section class="panel"><div class="panel-heading"><h3>Төлвөөр</h3></div><div class="status-chips">${Object.entries(r.statuses).map(([s,n])=>`<span>${tag(s)} <strong>${num(n)}</strong></span>`).join('')||'<span class="muted">Захиалга алга</span>'}</div>${t.demo_excluded?`<p class="muted xpad xbottom">${num(t.demo_excluded)} жишээ захиалгыг тооцоонд оруулаагүй.</p>`:''}</section>`+
        `<section class="panel"><div class="panel-heading"><div><h3>Захиалга бүрийн ашиг</h3><p class="muted">Нийт ашиг = төлсөн дүн − TaoWorld-д төлсөн (захиалгын ханшаар). Карго, үйл ажиллагааны зардал ороогүй.${p.unknown_cost?` ${num(p.unknown_cost)} захиалгын зардал тодорхойгүй.`:''}</p></div></div>${r.orders.length?`<div class="table-wrap"><table><thead><tr><th>Захиалга</th><th>Өдөр</th><th>Төлөв</th><th>Орлого</th><th>Зардал</th><th>Ашиг</th></tr></thead><tbody>${r.orders.slice(0,50).map(o=>`<tr><td><button type="button" class="link-button" data-open-order="${esc(o.id)}">${esc(o.id)}</button></td><td>${esc(o.day)}</td><td>${tag(o.status)}</td><td>${money(o.revenue)}</td><td>${o.cost==null?'<span class="muted">—</span>':money(o.cost)+` <small class="muted">(${cny(o.cost_cny)})</small>`}</td><td>${o.margin==null?'<span class="muted">—</span>':money(o.margin)}</td></tr>`).join('')}</tbody></table></div>${t.paid_orders>50?`<p class="muted xpad xbottom">Сүүлийн 50 захиалгыг харуулав. Бүгдийг «Захиалга, ашиг» CSV файлаар татна.</p>`:''}`:'<p class="empty">Энэ хугацаанд төлбөр орсон захиалга алга.</p>'}</section>`;
    }catch(e){if(body.isConnected)body.innerHTML=failed(e);}
    loadSearch();
  }
  async function loadSearch(){
    const box=$('#search-insights');if(!box)return;
    try{
      const s=await api('admin-search-insights&days='+searchDays);if(!box.isConnected)return;
      const list=(rows,empty,zero)=>rows.length?`<div class="table-wrap"><table><thead><tr><th>Хайлт</th><th>Тоо</th><th>Үр дүнгүй</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.q)}</td><td>${num(r.hits)}</td><td>${zero&&r.zero?`<strong>${num(r.zero)}</strong>`:num(r.zero)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="empty">${empty}</p>`;
      box.innerHTML=`<div class="panel-heading"><div><h3>Хайлтын тойм</h3><p class="muted">${num(s.searches)} хайлт · ${num(s.terms)} өөр үг · ${num(s.zero)} үр дүнгүй. Ангиллын хуудсын үзэлт ч орно.</p></div><select id="search-days" aria-label="Хугацаа">${[7,30,90].map(d=>`<option value="${d}" ${d===searchDays?'selected':''}>Сүүлийн ${d} хоног</option>`).join('')}</select></div><div class="two-col even"><div><h4 class="xpad">Хамгийн их хайсан</h4>${list(s.top,'Хайлт бүртгэгдээгүй байна.')}</div><div><h4 class="xpad">Үр дүнгүй хайлт</h4><p class="muted xpad">Эдгээр үгэнд монгол нэр, синоним эсвэл ангилал нэмэхийг бодоорой.</p>${list(s.zero_results,'Үр дүнгүй хайлт алга.',true)}</div></div>`;
    }catch(e){if(box.isConnected)box.innerHTML=failed(e);}
  }

  // TaoWorld usage, trial, purchase threshold and bills.
  const KINDS=[{key:'search',name:'Хайлт',color:'#2a78d6'},{key:'detail',name:'Барааны дэлгэрэнгүй',color:'#eb6834'},{key:'image',name:'Зургаар хайлт',color:'#1baf7a'},{key:'other',name:'Бусад',color:'#eda100'}];
  const KIND_NAMES={search:'Хайлт',detail:'Барааны дэлгэрэнгүй',image:'Зургаар хайлт',official:'Албан ёсны дэлгүүр',brand:'Брэнд',home:'Нүүр хуудас',shipping:'Хятад доторх хүргэлт',recommend:'Санал болгох',checkout:'Захиалга шалгах',ot:'OT Commerce',other:'Бусад'};
  const taoworldHtml=()=>`<div id="tw-usage">${loading}</div><section class="panel" id="tw-bills"><div class="panel-heading"><div><h3>Нийлүүлэгчийн нэхэмжлэл тулгах</h3><p class="muted">TaoWorld-ийн төлбөр, буцаалтын нэхэмжлэлийг GOStore-ийн захиалгатай тулгана (62 хоног хүртэл).</p></div></div>${can('operator')?`<form id="bill-range" class="toolbar report-toolbar xpad"><label>Эхлэх огноо<input type="date" name="from" value="${billRange.from}" required></label><label>Дуусах огноо<input type="date" name="to" value="${billRange.to}" required></label><button class="primary" type="submit">Тулгах</button></form>`:'<p class="muted xpad">Оператор эсвэл эзэмшигч тулгана.</p>'}<div id="bill-result"></div></section>`;
  async function loadTaoworld(){
    const box=$('#tw-usage');
    try{
      const u=await api('admin-api-usage');if(!box.isConnected)return;const b=u.status,th=u.threshold,tr=u.trial,today=u.days.at(-1)||{};
      const rows=u.days.map(d=>{const v={};for(const [k,n] of Object.entries(d.kinds)){const key=['search','detail','image'].includes(k)?k:'other';v[key]=(v[key]||0)+n;}return {label:d.day,values:v,extra:d.rejected?d.rejected+' татгалзсан':''};});
      const kindTotals={};for(const d of u.days)for(const [k,n] of Object.entries(d.kinds))kindTotals[k]=(kindTotals[k]||0)+n;
      const s=u.settings,owner=can('owner');
      box.innerHTML=`<div class="stats six">${stat('Өнөөдөр (UTC)',`${num(b.used)} / ${num(b.limit)}`,`${num(b.remaining)} үлдсэн`)}${stat('Татгалзсан хүсэлт',num(today.rejected||0),'өнөөдөр лимитээс болж')}${stat('Арын ажил',`${num(b.background_used)} / ${num(b.background_limit)}`,'урьдчилсан ачаалал')}${stat('Захиалгад нөөцөлсөн',num(b.checkout_reserve),'хайлтад ашиглахгүй')}${stat('Худалдан авалт',cny(th.counted_cny),`${th.percent}% · босго 10,000 ¥`)}${stat('Туршилт',tr.ends?(tr.days_left<0?'Дууссан':tr.days_left+' хоног'):'—',tr.ends?'дуусах: '+tr.ends:'эхэлсэн огноог оруулна уу')}</div>`+
        `<section class="panel"><div class="panel-heading"><div><h3>Өнөөдрийн хэрэглээ</h3><p class="muted">${num(b.used)} / ${num(b.limit)} дуудлага. Хайлтад ${num(b.browse_limit)} хүртэл, үлдсэнийг захиалга шалгахад нөөцөлнө.</p></div></div><div class="xpad">${progress(b.used,b.browse_limit,'Өнөөдрийн лимитийн хэрэглээ')}</div></section>`+
        `<section class="panel"><div class="panel-heading"><div><h3>Сүүлийн 30 хоногийн API дуудлага</h3><p class="muted">TaoWorld-ийн өдөр UTC-аар солигдоно (Улаанбаатарын 08:00). Тасархай шугам нь өнөөдрийн өдрийн лимит.</p></div></div>${bars(rows,{series:KINDS,label:'Сүүлийн 30 хоногийн API дуудлага, төрлөөр',limit:b.limit,caption:'Дуудлага'})}<div class="table-wrap"><table><thead><tr><th>Төрөл (30 хоног)</th><th>Дуудлага</th></tr></thead><tbody>${Object.entries(kindTotals).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<tr><td>${esc(KIND_NAMES[k]||k)}</td><td>${num(n)}</td></tr>`).join('')||'<tr><td class="muted">Бүртгэл алга</td><td></td></tr>'}</tbody></table></div></section>`+
        `<div class="two-col even"><section class="panel integration-card"><h2>10,000 юанийн босго</h2><p>TaoWorld нийт худалдан авалт 10,000 юаньд хүрэх хүртэл зөвхөн тусгай барааны хүрээг харуулж, 30 хоногийн туршилтын дараа өдрийн дуудлагыг хязгаарладаг.</p>${progress(th.counted_cny,th.cny,'Худалдан авалтын босго')}<p><strong>${cny(th.counted_cny)}</strong> / 10,000 ¥ · GOStore-оор ${cny(u.purchases.total_cny)} (${num(u.purchases.orders)} захиалга) · гаднаас ${cny(s.external_cny)}<br>Сүүлийн 30 хоногт: ${cny(u.purchases.last30_cny)}</p>${th.reached?`<p class="muted">Босгод хүрсэн. TaoWorld-ийн жишээгээр өдөрт ойролцоогоор ${num(th.estimated_daily_calls)} дуудлага (сүүлийн 30 хоногийн дунджаар). Бодит хэмжээг account manager-аас лавлана уу.</p>`:''}</section>`+
        `<section class="panel integration-card"><h2>TaoWorld-ийн мэдээлэл</h2>${owner?`<form id="quota-form"><div class="form-grid"><label>Туршилт эхэлсэн огноо<input type="date" name="trial_started" value="${esc(s.trial_started)}"></label><label>Гаднаас худалдан авсан (¥)<input type="number" name="external_cny" min="0" step="0.01" value="${esc(s.external_cny)}"></label><label>TaoWorld-ийн өдрийн лимит<input type="number" name="known_daily_quota" min="0" step="1" value="${esc(s.known_daily_quota||'')}"></label><label class="full">Тэмдэглэл<input name="note" maxlength="300" value="${esc(s.note)}"></label></div><p class="muted">TaoWorld сайтаар шууд хийсэн худалдан авалтыг «гаднаас» гэж нэмнэ. Манай өдрийн лимит (Ханш ба карго) TaoWorld-ийн лимитээс их байж болохгүй.</p><p class="error" role="alert"></p><button class="primary" type="submit">Хадгалах</button></form>`:`<p>Туршилт: ${esc(tr.started||'тодорхойгүй')} → ${esc(tr.ends||'—')}<br>Гаднаас: ${cny(s.external_cny)}<br>TaoWorld-ийн лимит: ${s.known_daily_quota?num(s.known_daily_quota):'тодорхойгүй'}</p>`}${b.limit>(s.known_daily_quota||Infinity)?`<p class="error">Манай өдрийн лимит (${num(b.limit)}) TaoWorld-ийн лимитээс (${num(s.known_daily_quota)}) их байна.</p>`:''}</section></div>`;
    }catch(e){if(box.isConnected)box.innerHTML=failed(e);}
  }
  function billsHtml(r){
    const rows=r.orders.map(o=>`<tr><td><button type="button" class="link-button" data-open-order="${esc(o.id)}">${esc(o.id)}</button></td><td>${cny(o.paid_cny)}</td><td>${cny(o.refund_cny)}</td><td>${cny(o.expected_cny)}</td><td>${o.customer_paid==null?'—':money(o.customer_paid)}</td><td>${o.flag?`<span class="tag yellow">⚠ ${esc(o.flag)}</span>`:'<span class="tag green">✓ Таарсан</span>'}</td></tr>`).join('');
    return `<div class="stats six xpad">${stat('Төлсөн',cny(r.paid_cny),'TaoWorld нэхэмжлэлээр')}${stat('Буцаагдсан',cny(r.refunded_cny),'')}${stat('Анхаарах',num(r.flags),'зөрүү, дутуу')}</div>`+
      (rows?`<div class="table-wrap"><table><thead><tr><th>Захиалга</th><th>Төлсөн</th><th>Буцаасан</th><th>Хүлээгдэж буй</th><th>Хэрэглэгч төлсөн</th><th>Тулгалт</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="empty">Энэ хугацаанд GOStore-той холбоотой нэхэмжлэл алга.</p>')+
      (r.missing.length?`<div class="note xmargin"><strong>Нэхэмжлэлд олдоогүй ${num(r.missing.length)} захиалга:</strong> ${r.missing.map(m=>`${esc(m.id)} (${cny(m.expected_cny)})`).join(', ')}</div>`:'')+
      (r.unlinked.length?`<details class="data-table"><summary>GOStore-оос гадуурх ${num(r.unlinked.length)} худалдан авалт (TaoWorld сайтаар)</summary><div class="table-wrap"><table><thead><tr><th>Бараа</th><th>Төлсөн</th><th>Огноо</th></tr></thead><tbody>${r.unlinked.map(u=>`<tr><td>${esc(u.title||u.outer)}</td><td>${cny(u.paid_cny)}</td><td>${when(u.paid_at)}</td></tr>`).join('')}</tbody></table></div></details>`:'');
  }

  // Site controls.
  const siteHtml=()=>`<div id="site-body">${loading}</div>`;
  function storeRow(s,logos){return `<tr data-store-row><td><input name="id" value="${esc(s.id)}" inputmode="numeric" aria-label="Дэлгүүрийн дугаар" required></td><td><input name="name" value="${esc(s.name)}" aria-label="Дэлгүүрийн нэр (хятадаар)" required></td><td><input name="display_name" value="${esc(s.display_name)}" aria-label="Харагдах нэр" required></td><td><select name="logo" aria-label="Лого"><option value="">Логогүй</option>${logos.map(l=>`<option value="${esc(l)}" ${l===s.logo?'selected':''}>${esc(l.split('/').pop().replace('.svg',''))}</option>`).join('')}</select></td><td><input name="source_url" value="${esc(s.source_url)}" type="url" aria-label="Эх сурвалж" required></td><td><input name="verification" value="${esc(s.verification)}" aria-label="Хэрхэн шалгасан" required></td><td class="nowrap">${can('operator')?'<button type="button" class="quiet" data-store-test>Турших</button> <button type="button" class="quiet" data-store-remove aria-label="Хасах">✕</button>':''}<div class="store-test muted" aria-live="polite"></div></td></tr>`;}
  async function loadSite(){
    const box=$('#site-body');
    try{
      const c=siteData=await api('catalog-controls');if(!box.isConnected)return;const k=c.controls,camp=c.campaign,edit=can('operator');const dis=edit?'':'disabled';
      box.innerHTML=`<form id="site-controls-form"><section class="panel integration-card"><h2>Бараа, дэлгүүр нуух</h2><p class="muted">Нуусан бараа, дэлгүүр вэб, апп, сагс, захиалгад харагдахгүй. Мөр бүрт нэгийг бичнэ.</p><div class="form-grid"><label>Барааны дугаар (tb-…)<textarea name="blocked_items" rows="6" ${dis} placeholder="tb-123456789">${esc(k.blocked_items.map(i=>'tb-'+i).join('\n'))}</textarea></label><label>Дэлгүүрийн нэр (яг таг)<textarea name="blocked_shops" rows="6" ${dis} placeholder="某某旗舰店">${esc(k.blocked_shops.join('\n'))}</textarea></label></div></section>`+
        `<section class="panel integration-card"><h2>Нүүр хуудасны барааны түлхүүр үг</h2><p class="muted">Нүүр хуудсанд ямар төрлийн бараа гарахыг хятад түлхүүр үгээр сонгоно (6-аас доошгүй). Хоосон бол үндсэн ${c.default_home_keywords?num(c.default_home_keywords.length)+' ':''}үгийн жагсаалт ашиглагдана.</p><label>Түлхүүр үгс (мөр бүрт нэг)<textarea name="home_keywords" rows="7" ${dis} placeholder="${esc((c.default_home_keywords||[]).slice(0,8).join('\n'))}">${esc(k.home_keywords.join('\n'))}</textarea></label></section>`+
        `<section class="panel integration-card"><h2>11.11 хямдрал</h2><p class="muted">Одоо: <strong>${camp.active?'Идэвхтэй':'Идэвхгүй'}</strong>. Автомат горимд 11-р сарын 1–11-нд харагдана.</p><div class="form-grid"><label>Горим<select name="campaign_mode" ${dis}><option value="auto" ${camp.mode==='auto'?'selected':''}>Автомат (11.1–11.11)</option><option value="on" ${camp.mode==='on'?'selected':''}>Сунгах (огноо хүртэл)</option><option value="off" ${camp.mode==='off'?'selected':''}>Унтраах</option></select></label><label>Дуусах огноо (сунгах үед)<input type="date" name="campaign_until" value="${esc(camp.until||'')}" ${dis}></label></div><p class="muted">Апп-ын 11.11 хэсэг одоохондоо огноогоор ажиллана.</p></section>`+
        (edit?'<p class="error" role="alert"></p><div class="form-actions"><button class="primary" type="submit">Тохиргоо хадгалах</button></div>':'')+`</form>`+
        `<section class="panel" id="site-stores"><div class="panel-heading"><div><h3>Албан ёсны дэлгүүрүүд</h3><p class="muted">${c.stores_custom?'Таны засварласан жагсаалт.':'Үндсэн жагсаалт.'} Дэлгүүрийн дугаар (shop ID), хятад нэрийг яг тааруулна. «Турших» нь TaoWorld-оос 1 удаа хайна.</p></div>${edit?'<button type="button" class="quiet" data-store-add>＋ Дэлгүүр нэмэх</button>':''}</div><div class="table-wrap"><table class="site-store-table"><thead><tr><th>Shop ID</th><th>Нэр (хятадаар)</th><th>Харагдах нэр</th><th>Лого</th><th>Эх сурвалж</th><th>Хэрхэн шалгасан</th><th></th></tr></thead><tbody>${c.stores.map(s=>storeRow(s,c.logos)).join('')}</tbody></table></div>${edit?`<p class="error xpad" role="alert" id="stores-error"></p><div class="form-actions xpad">${c.stores_custom?'<button type="button" class="quiet" data-store-reset>Үндсэн жагсаалт руу буцаах</button>':''}<button type="button" class="primary" data-store-save>Дэлгүүрүүдийг хадгалах</button></div>`:''}</section>`;
    }catch(e){if(box.isConnected)box.innerHTML=failed(e);}
  }

  // Staff accounts and audit log (owner).
  const ACTIONS={'login':'Нэвтэрсэн','login-failed':'Нэвтрэх оролдлого амжилтгүй','logout':'Гарсан','order-update':'Захиалга засварласан','order-refund':'Хэрэглэгчид буцаалт бүртгэсэн','product-save':'Бараа хадгалсан','product-delete':'Бараа устгасан','shipping-save':'Ханш, лимит өөрчилсөн','admin-user-save':'Админ данс өөрчилсөн','admin-totp-enable':'2 алхмын баталгаажуулалт асаасан','admin-totp-disable':'2 алхмын баталгаажуулалт унтраасан','admin-password-change':'Нууц үг сольсон','admin-export':'Файл татсан','admin-message-send':'Мэдэгдэл илгээсэн','catalog-controls-save':'Сайтын тохиргоо өөрчилсөн','catalog-stores-save':'Дэлгүүрийн жагсаалт өөрчилсөн','taoworld-cancel':'TaoWorld захиалга цуцлах хүсэлт','taoworld-refund-submit':'Нийлүүлэгчээс буцаалт хүссэн','taoworld-pay':'Нийлүүлэгчид төлсөн','taoworld-settings':'TaoWorld тохиргоо','admin-quota-save':'TaoWorld мэдээлэл'};
  const adminsHtml=()=>`<section class="panel" id="admin-users">${loading}</section><section class="panel" id="admin-audit"><div class="panel-heading"><div><h3>Аудит лог</h3><p class="muted">Хэн, хэзээ, юу өөрчилснийг харуулна. Нууц үг, код хадгалагдахгүй.</p></div><form id="audit-search" class="audit-search"><input type="search" name="q" value="${esc(auditState.q)}" placeholder="Хүн, үйлдэл, захиалга…" aria-label="Аудит лог хайх" maxlength="80"></form></div><div id="audit-body">${loading}</div></section>`;
  async function loadAdmins(){
    const box=$('#admin-users');
    try{
      const r=await api('admin-users');if(!box.isConnected)return;AdminExtra.users=r;
      box.innerHTML=`<div class="panel-heading"><div><h3>Админ данс</h3><p class="muted">Эзэмшигч: бүх эрх. Оператор: захиалга, бараа, хэрэглэгч, TaoWorld. Зөвхөн харах: өөрчлөлт хийхгүй.</p></div><button type="button" class="primary" data-admin-new>＋ Админ нэмэх</button></div><div class="table-wrap"><table><thead><tr><th>Нэр</th><th>Имэйл</th><th>Эрх</th><th>Төлөв</th><th>2 алхам</th><th>Сүүлд нэвтэрсэн</th><th></th></tr></thead><tbody>${r.users.map(u=>`<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.email)}</td><td>${esc(r.roles[u.role]||u.role)}</td><td>${u.active?'<span class="tag green">Идэвхтэй</span>':'<span class="tag gray">Хаалттай</span>'}</td><td>${u.totp?'✓ Асаалттай':'<span class="muted">Үгүй</span>'}</td><td>${u.builtin?'<span class="muted">Үндсэн эзэмшигч</span>':when(u.last_login)}</td><td>${u.builtin?'':`<button type="button" class="quiet" data-admin-edit="${esc(u.id)}">Засах</button>`}</td></tr>`).join('')}</tbody></table></div>`;
    }catch(e){if(box.isConnected)box.innerHTML=failed(e);}
    loadAudit();
  }
  async function loadAudit(){
    const box=$('#audit-body');if(!box)return;
    try{
      const r=await api(`admin-audit&page=${auditState.page}&q=${encodeURIComponent(auditState.q)}`);if(!box.isConnected)return;
      box.innerHTML=r.rows.length?`<div class="table-wrap"><table class="audit-table"><thead><tr><th>Хэзээ</th><th>Хэн</th><th>Үйлдэл</th><th>Хаана</th><th>Дэлгэрэнгүй</th><th>IP</th></tr></thead><tbody>${r.rows.map(a=>`<tr><td>${when(a.at)}</td><td>${esc(a.actor)}<br><small class="muted">${esc(a.role)}</small></td><td>${esc(ACTIONS[a.action]||a.action)}</td><td>${esc(a.target)}</td><td class="audit-detail">${esc(a.detail)}</td><td><small>${esc(a.ip)}</small></td></tr>`).join('')}</tbody></table></div><div class="form-actions xpad"><span class="muted">${num(r.total)} бичлэг · ${r.page}/${r.pages}</span><button type="button" class="quiet" data-audit-page="${r.page-1}" ${r.page<=1?'disabled':''}>← Өмнөх</button><button type="button" class="quiet" data-audit-page="${r.page+1}" ${r.page>=r.pages?'disabled':''}>Дараах →</button></div>`:'<p class="empty">Бичлэг алга.</p>';
    }catch(e){if(box.isConnected)box.innerHTML=failed(e);}
  }
  function adminForm(u){
    const roles=AdminExtra.users?.roles||{owner:'Эзэмшигч',operator:'Оператор',viewer:'Зөвхөн харах'};
    modal(u?'Админ засах':'Админ нэмэх',`<form id="admin-user-form"><input type="hidden" name="id" value="${esc(u?.id||'')}"><div class="form-grid"><label>Нэр<input name="name" required maxlength="80" value="${esc(u?.name||'')}"></label><label>Имэйл<input name="email" type="email" required maxlength="120" value="${esc(u?.email||'')}" autocomplete="off"></label><label>Эрх<select name="role">${Object.entries(roles).map(([k,v])=>`<option value="${k}" ${(u?.role||'operator')===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label class="check"><input type="checkbox" name="active" ${!u||u.active?'checked':''}> Идэвхтэй</label><label>${u?'Шинэ нууц үг (солих бол)':'Нууц үг'}<input name="password" type="password" minlength="12" maxlength="72" autocomplete="new-password" ${u?'':'required'}></label><label>Нууц үгээ давтах<input name="password_confirm" type="password" minlength="12" maxlength="72" autocomplete="new-password" ${u?'':'required'}></label>${u?.totp?'<label class="check full"><input type="checkbox" name="reset_totp"> 2 алхмын баталгаажуулалтыг шинэчлэх (утсаа алдсан үед)</label>':''}</div><p class="muted">Эрх, төлөв эсвэл нууц үг өөрчлөхөд тухайн админы нэвтрэлт хаагдана.</p><p class="error" role="alert"></p><div class="form-actions"><button class="primary" type="submit">Хадгалах</button></div></form>`);
  }

  // Two-step sign-in for the signed-in account (security page).
  function totpPanel(){
    const on=data.admin?.totp;
    return `<section class="panel integration-card" id="totp-panel"><h2>Хоёр алхмын баталгаажуулалт</h2><p>Нэвтрэх бүрт Google Authenticator, Microsoft Authenticator зэрэг аппын 6 оронтой кодыг нэмж асууна.</p>${on?`<p><span class="tag green">✓ Асаалттай</span></p><form id="totp-disable-form"><div class="form-grid"><label>Нууц үг<input name="password" type="password" autocomplete="current-password" required maxlength="1000"></label><label>Апп дээрх код<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" required maxlength="7"></label></div><p class="error" role="alert"></p><button class="quiet" type="submit">Унтраах</button></form>`:`<div id="totp-setup"><button type="button" class="primary" data-totp-start>Асаах</button></div>`}</section>`;
  }

  // TaoWorld after-sales inside the order view.
  const CHILD={BULIDING:'Үүсгэж байна',WAIT_BUYER_P:'Төлбөр хүлээж байна',WAIT_SELLER_SEND_GOODS:'Төлсөн, илгээгээгүй',WAIT_BUYER_CONFIRM_GOODS:'Илгээсэн',TRADE_CLOSED:'Хаагдсан'};
  function orderPanel(o){
    const p=o.purchase;if(p?.provider!=='taoworld'||!p.submitted_at||!(p.provider_order_ids||[]).length)return '';
    const kids=p.children||[],op=can('operator');
    const cancellable=op&&kids.length&&kids.every(c=>['BULIDING','WAIT_BUYER_P','WAIT_SELLER_SEND_GOODS'].includes(c.status))&&!p.cancel;
    const refunds=p.refunds||[];
    const refundRows=refunds.map(r=>`<li class="refund-item"><strong>${esc(r.status_text||'')}</strong> · ${cny((r.fee_fen??r.requested_fee_fen??0)/100)} · ${esc(r.reason||'')}${r.refund_id?` · №${esc(r.refund_id)}`:''}<br><small class="muted">Дэд захиалга ${esc(r.child||'')} · ${when(r.checked_at)}</small>${r.seller_refuse?`<br><span class="error">Худалдагч: ${esc(r.seller_refuse)}</span>`:''}${r.return_address?`<br><small>Буцаах хаяг: ${esc(r.return_address)}</small>`:''}${r.seller_note?`<br><small>Худалдагчийн тайлбар: ${esc(r.seller_note)}</small>`:''}${r.return_tracking?`<br><small>Буцаасан илгээмж: ${esc(r.return_company||'')} ${esc(r.return_tracking)}</small>`:''}${op&&r.refund_id?`<div class="row-actions"><button type="button" class="quiet" data-as="messages" data-refund="${esc(r.refund_id)}">Мессеж</button>${r.status===20?`<button type="button" class="quiet" data-as="return" data-refund="${esc(r.refund_id)}">Буцаасан илгээмж бүртгэх</button>`:''}${[10,20,-10].includes(r.status)?`<button type="button" class="quiet" data-as="refund-cancel" data-refund="${esc(r.refund_id)}">Буцаалт цуцлах</button>`:''}</div>`:''}</li>`).join('');
    const kidRows=kids.map(c=>{const open=refunds.some(r=>r.child===c.sub_purchase_order_id&&[10,20,30,-1].includes(r.status));const paid=['WAIT_SELLER_SEND_GOODS','WAIT_BUYER_CONFIRM_GOODS','TRADE_CLOSED'].includes(c.status);
      return `<li>Дэд захиалга <strong>${esc(c.sub_purchase_order_id)}</strong> · ${esc(CHILD[c.status]||c.status)} · ${num(c.quantity)} ширхэг${c.taobao_order_id?` · Taobao ${esc(c.taobao_order_id)}`:''}${op&&paid&&!open?` <button type="button" class="quiet" data-as="refund-start" data-child="${esc(c.sub_purchase_order_id)}" data-paid="${c.status==='WAIT_SELLER_SEND_GOODS'?1:2}">Буцаалт хүсэх</button>`:''}</li>`;}).join('');
    return `<section class="panel aftersale" data-aftersale="${esc(o.id)}"><h3>TaoWorld · цуцлах, буцаалт, хүргэлт</h3>${p.cancel?`<p class="note">Цуцлах хүсэлт: ${when(p.cancel.requested_at)}${p.cancel.reason?' · '+esc(p.cancel.reason):''}. Төлөвийг TaoWorld-оос дахин шалгана; автомат төлбөр зогссон.</p>`:''}<ul class="aftersale-kids">${kidRows}</ul><div class="row-actions"><button type="button" class="quiet" data-as="logistics">Хятад доторх хүргэлтийн явц</button>${cancellable?'<button type="button" class="quiet" data-as="cancel">TaoWorld захиалга цуцлах</button>':''}${op&&refunds.length?'<button type="button" class="quiet" data-as="refund-refresh">Буцаалтын төлөв шалгах</button>':''}</div>${refunds.length?`<h4>Нийлүүлэгчээс хүссэн буцаалт</h4><ul class="refund-list">${refundRows}</ul>`:''}<div class="aftersale-out" aria-live="polite"></div></section>`;
  }
  async function reopen(id){await refresh();editOrder(id);}
  async function afterSale(b){
    const box=b.closest('[data-aftersale]'),id=box.dataset.aftersale,out=box.querySelector('.aftersale-out'),act=b.dataset.as;
    if(act==='logistics'){out.innerHTML=loading;const r=await api('taoworld-logistics',{id});out.innerHTML=(r.children||[]).map(c=>`<h4>Дэд захиалга ${esc(c.id)} · ${esc(CHILD[c.status]||c.status)}</h4>${(c.parcels||[]).length?c.parcels.map(p=>`<p><strong>${esc(p.mail_no)}</strong> · ${esc(p.logistics_desc||p.logistics_status||'')}${(p.partners||[]).map(x=>' · '+esc(x.company)).join('')}</p><ol class="timeline">${(p.traces||[]).map(t=>`<li><strong>${esc(t.standerd_desc||t.status_desc||t.action)}</strong><br><small class="muted">${esc(t.time)} · ${esc([t.province,t.city,t.facility_name].filter(Boolean).join(' '))}</small></li>`).join('')||'<li class="muted">Явцын мэдээлэл алга</li>'}</ol>`).join(''):`<p class="muted">${c.numbers?.length?'Илгээмж: '+c.numbers.map(n=>esc(n.no)).join(', ')+'. Явцыг удахгүй уншина.':'Илгээмжийн дугаар хараахан алга.'}</p>`}`).join('')||'<p class="muted">Мэдээлэл алга.</p>';return;}
    if(act==='cancel'){const reason=await uiConfirm({title:'TaoWorld захиалгыг цуцлах уу?',text:id+' · Автомат төлбөр зогсож, цуцлах хүсэлт TaoWorld-д очно. Илгээгдсэн барааг цуцлахгүй, буцаалт хүснэ.',confirmLabel:'Цуцлах',danger:true,input:{label:'Шалтгаан (TaoWorld-д илгээнэ)',value:'Хэрэглэгч захиалгаа цуцалсан',max:100}});if(!reason)return;await api('taoworld-cancel',{id,reason:reason.slice(0,100)});toast('Цуцлах хүсэлт илгээлээ. Төлөвийг TaoWorld-оос шалгана.');return reopen(id);}
    if(act==='refund-refresh'){await api('taoworld-refund-refresh',{id});toast('Буцаалтын төлөв шинэчлэгдлээ');return reopen(id);}
    if(act==='refund-cancel'){if(!await uiConfirm({title:'Буцаалтын хүсэлтийг цуцлах уу?',text:'Худалдагчаас мөнгө буцаах хүсэлт хаагдана.',confirmLabel:'Буцаалт цуцлах',danger:true}))return;await api('taoworld-refund-cancel',{id,refund_id:b.dataset.refund});toast('Буцаалт цуцлагдлаа');return reopen(id);}
    if(act==='refund-start'){
      out.innerHTML=`<form class="refund-form" data-child="${esc(b.dataset.child)}"><h4>Буцаалт хүсэх · ${esc(b.dataset.child)}</h4><div class="form-grid"><label>Төрөл<select name="refund_type"><option value="1">Зөвхөн мөнгө буцаах</option><option value="2">Бараа буцааж, мөнгө авах</option></select></label><label>Барааны төлөв<select name="goods_status">${[[1,'Илгээгээгүй'],[2,'Илгээсэн'],[3,'Бараа ирээгүй'],[4,'Бараа хүлээн авсан']].map(([v,t])=>`<option value="${v}" ${String(v)===b.dataset.paid?'selected':''}>${t}</option>`).join('')}</select></label></div><div class="refund-template"></div><button type="button" class="quiet" data-as="refund-render">Нөхцөл ачаалах</button><p class="error" role="alert"></p></form>`;return;}
    if(act==='refund-render'){
      const f=b.closest('form'),fd=new FormData(f);const r=await api('taoworld-refund-render',{id,child:f.dataset.child,refund_type:Number(fd.get('refund_type')),goods_status:Number(fd.get('goods_status'))});const t=r.template;
      f.querySelector('.refund-template').innerHTML=`<div class="form-grid"><label>Шалтгаан<select name="reason_id" required>${t.reasons.map(x=>`<option value="${x.id}">${esc(x.text)}</option>`).join('')}</select></label><label>Буцаах дүн (¥, ${cny(t.fee.min/100)} – ${cny(t.fee.max/100)})<input name="refund_fee" type="number" step="0.01" min="${t.fee.min/100}" max="${t.fee.max/100}" value="${(t.fee.default||t.fee.max)/100}" ${t.fee.editable?'':'readonly'} required></label><label class="full">Тайлбар (худалдагчид)<input name="description" maxlength="200"></label></div>${t.fee.tips?`<p class="muted">${esc(t.fee.tips)}</p>`:''}<button type="button" class="primary" data-as="refund-submit">Худалдагчид илгээх</button>`;
      b.remove();return;}
    if(act==='refund-submit'){
      const f=b.closest('form'),fd=new FormData(f);if(!await uiConfirm({title:'Буцаалтын хүсэлт илгээх үү?',text:'Хүсэлт Taobao-ийн худалдагчид шууд очно. Шийдвэрийг «Буцаалтын төлөв шалгах» товчоор харна.',confirmLabel:'Худалдагчид илгээх'}))return;
      await api('taoworld-refund-submit',{id,child:f.dataset.child,refund_type:Number(fd.get('refund_type')),goods_status:Number(fd.get('goods_status')),reason_id:Number(fd.get('reason_id')),refund_fee:Math.round(Number(fd.get('refund_fee'))*100),description:String(fd.get('description')||'')});
      toast('Буцаалтын хүсэлт илгээгдлээ');return reopen(id);}
    if(act==='messages'){out.innerHTML=loading;const r=await api('taoworld-refund-messages',{id,refund_id:b.dataset.refund});out.innerHTML=messagesHtml(r,b.dataset.refund);return;}
    if(act==='message-send'){const f=b.closest('form');const text=f.message.value.trim();if(!text)return;const r=await api('taoworld-refund-message',{id,refund_id:f.dataset.refund,message:text});out.innerHTML=messagesHtml(r,f.dataset.refund);toast('Мессеж илгээгдлээ');return;}
    if(act==='return'){out.innerHTML=loading;const r=await api('taoworld-return-render',{id,refund_id:b.dataset.refund});out.innerHTML=`<form class="return-form" data-refund="${esc(b.dataset.refund)}"><h4>Буцаасан илгээмж</h4>${r.address?`<p>Хаяг: <strong>${esc(r.address)}</strong></p>`:''}${r.seller_note?`<p class="muted">${esc(r.seller_note)}</p>`:''}<div class="form-grid"><label>Тээврийн компани<select name="company" required>${r.companies.map(c=>`<option value="${esc(c.code)}">${esc(c.name)}</option>`).join('')}</select></label><label>Илгээмжийн дугаар<input name="tracking" required maxlength="40" pattern="[A-Za-z0-9-]{6,40}"></label><label>Утас<input name="phone" required maxlength="16" value="${esc(data.warehouse_profiles?.erenhot?.phone||'')}"></label><label>Тайлбар<input name="description" maxlength="200"></label></div><button type="button" class="primary" data-as="return-submit">Бүртгэх</button></form>`;return;}
    if(act==='return-submit'){const f=b.closest('form');if(!f.reportValidity())return;await api('taoworld-return-submit',{id,refund_id:f.dataset.refund,company:f.company.value,tracking:f.tracking.value.trim(),phone:f.phone.value.trim(),description:f.description.value.trim()});toast('Буцаасан илгээмж бүртгэгдлээ');return reopen(id);}
  }
  const messagesHtml=(r,refund)=>`<h4>Худалдагчтай харилцсан</h4><ul class="refund-messages">${r.messages.map(m=>`<li><strong>${esc(m.who||'—')}</strong> <small class="muted">${esc(m.time)}</small><br>${esc(m.text)}</li>`).join('')||'<li class="muted">Мессеж алга</li>'}</ul><form data-refund="${esc(refund)}"><label>Мессеж<textarea name="message" rows="2" maxlength="500"></textarea></label><button type="button" class="quiet" data-as="message-send">Илгээх</button></form>`;

  // Dashboard alerts.
  async function loadAlerts(){
    try{const r=await api('admin-alerts');if(page!=='overview'||!r.alerts.length)return;
      const box=document.createElement('section');box.className='alerts';box.setAttribute('aria-label','Анхааруулга');
      box.innerHTML=r.alerts.map(a=>`<div class="alert ${a.level}" role="${a.level==='error'?'alert':'status'}"><span>${a.level==='error'?'⛔':a.level==='warning'?'⚠':'ℹ'} ${esc(a.text)}</span>${a.page&&titles[a.page]?`<button type="button" class="quiet" data-page="${esc(a.page)}">${esc(titles[a.page])} →</button>`:''}</div>`).join('');
      $('#content').prepend(box);}catch{/* Alerts are optional. */}
  }

  // Navigation by role, header identity, page hooks.
  const HIDDEN={operator:['admins'],viewer:['admins','customers','messages']};
  function afterRender(p){
    const hidden=HIDDEN[role()]||[];
    document.querySelectorAll('nav [data-page]').forEach(b=>{b.hidden=hidden.includes(b.dataset.page);});
    document.querySelectorAll('#mobile-admin-page option').forEach(o=>{if(hidden.includes(o.value))o.remove();});
    if(data.admin){const strong=document.querySelector('.account strong');if(strong)strong.textContent=data.admin.name;$('#admin-email').textContent=data.admin.email+' · '+data.admin.role_label;document.querySelector('.account .avatar').textContent=(data.admin.name||'G').slice(0,1).toUpperCase();}
    if(hidden.includes(p)){page='overview';render();return;}
    if(p==='overview')loadAlerts();
    if(p==='security'){if(data.admin&&!data.admin.builtin){const h=document.querySelector('#content h2');if(h)h.textContent='Нууц үг солих';}$('#content').insertAdjacentHTML('beforeend',totpPanel());}
    pages[p]?.load?.();
  }
  const pages={reports:{html:reportsHtml,load:loadReports},taoworld:{html:taoworldHtml,load:loadTaoworld},site:{html:siteHtml,load:loadSite},admins:{html:adminsHtml,load:loadAdmins}};

  // Events.
  addEventListener('submit',async e=>{
    const f=e.target,fid=f.getAttribute('id');
    if(fid==='login-form'){e.preventDefault();e.stopImmediatePropagation();return login(f);}
    const handled=['report-range','bill-range','quota-form','site-controls-form','admin-user-form','totp-disable-form','audit-search','totp-enable-form'];if(!handled.includes(fid))return;
    e.preventDefault();e.stopImmediatePropagation();const err=f.querySelector('.error');if(err)err.textContent='';const button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;
    try{
      const fd=new FormData(f);
      if(fid==='report-range'){reportRange={from:fd.get('from'),to:fd.get('to')};render();}
      else if(fid==='bill-range'){billRange={from:fd.get('from'),to:fd.get('to')};const out=$('#bill-result');out.innerHTML=loading;try{out.innerHTML=billsHtml(await api('taoworld-bills',billRange));}catch(x){out.innerHTML=failed(x);}}
      else if(fid==='quota-form'){await api('admin-quota-save',{trial_started:String(fd.get('trial_started')||''),external_cny:Number(fd.get('external_cny')||0),known_daily_quota:Number(fd.get('known_daily_quota')||0),note:String(fd.get('note')||'')});toast('Хадгалагдлаа');loadTaoworld();}
      else if(fid==='site-controls-form'){await api('catalog-controls-save',{blocked_items:String(fd.get('blocked_items')||''),blocked_shops:String(fd.get('blocked_shops')||''),home_keywords:String(fd.get('home_keywords')||''),campaign:{mode:fd.get('campaign_mode'),until:String(fd.get('campaign_until')||'')}});toast('Сайтын тохиргоо хадгалагдлаа');loadSite();}
      else if(fid==='admin-user-form'){const b=Object.fromEntries(fd);b.active=fd.has('active');b.reset_totp=fd.has('reset_totp');if(!b.password){delete b.password;delete b.password_confirm;}await api('admin-user-save',b);$('#editor').close();toast('Админ хадгалагдлаа');loadAdmins();}
      else if(fid==='totp-disable-form'){const r=await api('admin-totp-disable',{password:fd.get('password'),code:String(fd.get('code')||'')});data.admin=r.admin;toast('Хоёр алхмын баталгаажуулалт унтарлаа');render();}
      else if(fid==='totp-enable-form'){const r=await api('admin-totp-enable',{code:String(fd.get('code')||'')});data.admin=r.admin;toast('Хоёр алхмын баталгаажуулалт асав');render();}
      else if(fid==='audit-search'){auditState={page:1,q:String(fd.get('q')||'').trim()};loadAudit();}
    }catch(x){if(err)err.textContent=x.message;else toast(x.message);}finally{if(button)button.disabled=false;}
  },true);
  addEventListener('change',e=>{if(e.target.id==='search-days'){searchDays=Number(e.target.value);loadSearch();}});
  addEventListener('click',async e=>{
    const b=e.target.closest('[data-as],[data-open-order],[data-admin-new],[data-admin-edit],[data-audit-page],[data-totp-start],[data-store-add],[data-store-remove],[data-store-test],[data-store-save],[data-store-reset]');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(b.dataset.openOrder){editOrder(b.dataset.openOrder);return;}
    if(b.hasAttribute('data-admin-new')){adminForm(null);return;}
    if(b.dataset.adminEdit){adminForm(AdminExtra.users?.users.find(u=>u.id===b.dataset.adminEdit));return;}
    if(b.dataset.auditPage){auditState.page=Number(b.dataset.auditPage);loadAudit();return;}
    if(b.hasAttribute('data-store-add')){document.querySelector('.site-store-table tbody').insertAdjacentHTML('beforeend',storeRow({id:'',name:'',display_name:'',logo:'',source_url:'https://',verification:''},siteData?.logos||[]));return;}
    if(b.hasAttribute('data-store-remove')){b.closest('tr').remove();return;}
    b.disabled=true;
    try{
      if(b.dataset.as)await afterSale(b);
      else if(b.hasAttribute('data-totp-start')){const r=await api('admin-totp-setup',{});let qr='';try{const q=qrcode(0,'M');q.addData(r.uri);q.make();qr=q.createSvgTag({cellSize:4,margin:4,scalable:true});}catch{/* The secret below still works. */}
        $('#totp-setup').innerHTML=`<ol><li>Утсандаа Google Authenticator (эсвэл ижил апп) нээж, энэ QR кодыг уншуулна.</li><li>Уншуулж чадахгүй бол түлхүүрийг гараар оруулна: <code class="totp-secret">${esc(r.secret.replace(/(.{4})/g,'$1 ').trim())}</code></li><li>Апп дээр гарсан 6 оронтой кодыг доор оруулна.</li></ol><div class="totp-qr" aria-hidden="true">${qr}</div><form id="totp-enable-form"><label>Апп дээрх код<input name="code" inputmode="numeric" autocomplete="one-time-code" required pattern="[0-9 ]{6,7}" maxlength="7"></label><p class="error" role="alert"></p><button class="primary" type="submit">Баталгаажуулж асаах</button></form>`;}
      else if(b.hasAttribute('data-store-test')){const tr=b.closest('tr'),out=tr.querySelector('.store-test');out.textContent='Шалгаж байна…';const r=await api('catalog-store-test',{id:tr.querySelector('[name=id]').value.trim(),name:tr.querySelector('[name=name]').value.trim()});
        out.textContent=r.rows?`${r.rows} бараа ирсэн, нэр таарсан ${r.matching}.${r.shop_names.length?' Нэр: '+r.shop_names.join(', '):''}`:'TaoWorld-оос бараа ирсэнгүй (хоосон).';}
      else if(b.hasAttribute('data-store-save')){const stores=[...document.querySelectorAll('[data-store-row]')].map(tr=>Object.fromEntries([...tr.querySelectorAll('input,select')].map(i=>[i.name,i.value.trim()])));await api('catalog-stores-save',{stores});toast('Дэлгүүрийн жагсаалт хадгалагдлаа');loadSite();}
      else if(b.hasAttribute('data-store-reset')){if(!await uiConfirm({title:'Үндсэн жагсаалт руу буцаах уу?',text:'Таны засварласан дэлгүүрийн жагсаалт устаж, үндсэн 12 дэлгүүр сэргэнэ.',confirmLabel:'Буцаах',danger:true}))return;await api('catalog-stores-save',{reset:true});toast('Үндсэн жагсаалт сэргээгдлээ');loadSite();}
    }catch(x){const box=b.closest('[data-aftersale]')?.querySelector('.aftersale-out');if(b.hasAttribute('data-store-save')){$('#stores-error').textContent=x.message;}else if(box){box.insertAdjacentHTML('afterbegin',`<p class="error" role="alert">${esc(x.message)}</p>`);}else toast(x.message);}
    finally{b.disabled=false;}
  },true);

  // Sign-in with an optional authenticator code step.
  async function login(f){
    const button=f.querySelector('button[type="submit"]'),err=$('#login-error');button.disabled=true;err.textContent='';
    try{
      await api('session');const body=Object.fromEntries(new FormData(f));
      const r=await fetch('../api/index.php?action=login',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body),credentials:'same-origin'});
      let d={};try{d=await r.json();}catch{throw Error('PHP серверээр ажиллуулна уу.');}
      if(d.csrf)csrf=d.csrf;
      if(d.totp_required){
        let field=f.querySelector('[name=code]');
        if(!field){f.querySelector('[name=password]').closest('label').insertAdjacentHTML('afterend','<label class="totp-step">Баталгаажуулах апп дээрх код<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required></label>');field=f.querySelector('[name=code]');}
        if(body.code)err.textContent=d.error;field.value='';field.focus();return;
      }
      if(!r.ok)throw Error(d.error||'Нэвтэрч чадсангүй.');
      f.password.value='';f.querySelector('.totp-step')?.remove();await refresh();
    }catch(x){err.textContent=x.message;}finally{button.disabled=false;}
  }
  return {pages,afterRender,orderPanel,users:null};
})();
