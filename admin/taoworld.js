const twLabels={queued:'Дараалалд',preflight_review:'Тооцоо шалгах',submitting:'Илгээж байна',reconciling:'TaoWorld-той тулгаж байна',awaiting_payment:'Нийлүүлэгчийн төлбөр хүлээж байна',paying:'Нийлүүлэгчийн төлбөрийг шалгаж байна',supplier_paid:'Нийлүүлэгчид төлсөн',shipped:'Хятадаас илгээсэн',review:'Админ шалгах',closed:'Нийлүүлэгчийн захиалга хаагдсан'};
const twYuan=n=>(Number(n||0)/100).toFixed(2)+' ¥';
const twInsightLabels={availability:'Нийлүүлэх боломж',alternatives:'Ижил бараа',detail:'Барааны мэдээлэл',delivery:'Хүргэлтийн лавлагаа',properties:'Тээврийн шинж',rebate:'SKU-ийн урамшууллын хувь',keywords:'Үгийн шалгалт',freight:'Жингээр тооцох',distribution:'Түгээлтийн каталог',accounts:'Дэд данс'};
const twInsightButton=(mode,needsMapping=false)=>`<button type="button" class="quiet" data-tw-insight="${mode}" ${needsMapping?'data-tw-mapped':''}>${twInsightLabels[mode]}</button>`;
function twInsightsSettings(connected){
  if(!connected||data.admin?.role!=='owner')return '';
  return `<details data-tw-insights><summary>Түгээлтийн каталог ба данс</summary><div class="form-actions">${twInsightButton('distribution')}${twInsightButton('accounts')}</div><div data-tw-insight-result aria-live="polite"></div></details>`;
}
function twInsightsOrder(order){
  if(data.admin?.role!=='owner')return '';
  const items=(order.items||[]).map((item,i)=>({item,i})).filter(({item,i})=>i<200&&/^tb-\d{5,20}$/.test(item.id||''));
  if(!items.length)return '';
  const mapped=order.purchase?.provider==='taoworld'?order.purchase?.quote?.lines||[]:[];
  return `<details data-tw-insights data-order="${esc(order.id)}"><summary>TaoWorld барааны лавлагаа</summary>
    <div class="form-grid"><label>Захиалгын бараа<select data-tw-line>${items.map(({item,i})=>`<option value="${i}" data-mapped="${mapped.some(row=>row.source_id===item.id&&String(row.source_sku)===String(item.sku))?1:0}">${esc(item.name||item.id)} · ${esc(item.variant||item.sku||'')}</option>`).join('')}</select></label>
    <label>Шалгах үгс<input type="text" data-tw-words maxlength="240" placeholder="Таслалаар тусгаарлана"></label></div>
    <div class="form-actions">${twInsightButton('availability')}${twInsightButton('alternatives')}${twInsightButton('delivery')}${twInsightButton('detail',true)}${twInsightButton('properties',true)}${twInsightButton('rebate',true)}${twInsightButton('keywords',true)}</div>
    <details><summary>Жингээр тээврийн лавлагаа авах</summary><div class="form-grid">
      <label>Эхний 1 кг (₮)<input data-tw-first type="number" min="0" max="1000000" step="1" required></label>
      <label>Нэмэлт 1 кг (₮)<input data-tw-extra type="number" min="0" max="1000000" step="1" required></label>
    </div><div class="form-actions">${twInsightButton('freight',true)}</div></details>
    <div data-tw-insight-result aria-live="polite"></div></details>`;
}
function twInsightResult(mode,r){
  switch(mode){
    case 'accounts':return `<p>TaoWorld-д бүртгэлтэй дэд данс <strong>${esc(r.total)}</strong></p>`;
    case 'distribution':
      return `<h4>Сүүлийн 30 хоногт шинэчлэгдсэн түгээлтийн бараа</h4>
        ${r.products.length?`<ul>${r.products.map(p=>`<li>${esc(p.title||p.mp_id)} · ${esc(p.mp_id)} · ${esc(p.status)}</li>`).join('')}</ul>`:'<p>Энэ хугацаанд түгээлтийн бараа олдсонгүй.</p>'}
        ${r.total==null?'':`<p>Нийт ${esc(r.total)} бараа</p>`}
        ${r.page>1?`<button type="button" class="quiet" data-tw-insight="distribution" data-page="${r.page-1}">Өмнөх</button>`:''}
        ${r.more?`<button type="button" class="quiet" data-tw-insight="distribution" data-page="${r.page+1}">Дараах</button>`:''}`;
    case 'availability':
      return `<p>${r.available===true?'Бараа TaoWorld-ийн нийлүүлэлтийн санд олдлоо.':r.available===false?'Бараа TaoWorld-ийн нийлүүлэлтийн санд олдсонгүй.':'Энэ бараанд тодорхой хариу ирсэнгүй.'}</p>
        ${r.reasons.length?`<ul>${r.reasons.map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul>`:''}`;
    case 'alternatives':
      return r.alternatives.length?`<ul>${r.alternatives.map(p=>`<li>${esc(p.title)} · ${esc(p.shop)} · ${esc(p.id)}</li>`).join('')}</ul>`:'<p>Ижил бараа таарсангүй.</p>';
    case 'delivery':
      return `<p>Эх барааны дотоод хүргэлт <strong>${twYuan(r.source_fee_fen)}</strong></p>
        ${r.distribution_fee_fen!=null?`<p>Түгээлтийн барааны дотоод хүргэлт <strong>${twYuan(r.distribution_fee_fen)}</strong></p>`:r.distribution_unavailable?'<p>Түгээлтийн үнийг түр уншиж чадсангүй.</p>':''}
        <p class="muted">Нэг барааны лавлах үнэ. Сагсны эцсийн хүргэлтийг захиалгын тооцоогоор шалгана.</p>`;
    case 'detail':{
      const p=r.product;
      return p?`<p><strong>${esc(p.title||p.mp_id)}</strong> · ${esc(p.shop)} · ${esc(p.status)}</p><p>Нийлүүлэгчийн ID ${esc(p.mp_id)} · Хувилбар ${esc(p.sku_count)} · Үлдэгдэл ${esc(p.stock??'тодорхойгүй')}</p>`:'<p>Түгээлтийн мэдээлэл ирсэнгүй.</p>';
    }
    case 'rebate':return r.rebate?.rate?`<p>TaoWorld-ийн буцаан олгох хувь <strong>${esc(r.rebate.rate)}</strong></p>`:'<p>Энэ SKU-ийн хувь ирсэнгүй.</p>';
    case 'keywords':return `<p>TaoWorld-ийн шалгалтаар тохирсон үг ${esc(r.matches)}.</p>`;
    case 'properties':
      return r.properties===null?'<p>TaoWorld-д энэ барааны тээврийн шинжийн мэдээлэл алга.</p>':
        r.properties.length?`<ul>${r.properties.map(property=>`<li>${esc(property)}</li>`).join('')}</ul>`:'<p>TaoWorld энэ бараанд тусгай тээврийн шинж тэмдэглээгүй байна.</p>';
    case 'freight':return `<p>Оруулсан тарифаарх лавлах дүн <strong>${esc(new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(Number(r.amount_mnt)))} ₮</strong></p>`;
  }
}
function twInsightControls(panel){
  const mapped=panel.querySelector('[data-tw-line]')?.selectedOptions[0]?.dataset.mapped==='1';
  panel.querySelectorAll('[data-tw-mapped]').forEach(button=>{button.disabled=!mapped;button.title=mapped?'':'Хадгалсан TaoWorld SKU шаардлагатай';});
}
addEventListener('toggle',e=>{
  if(e.target.matches?.('[data-tw-insights]')&&e.target.open)twInsightControls(e.target);
},true);
addEventListener('change',e=>{
  if(!e.target.matches?.('[data-tw-line]'))return;
  const panel=e.target.closest('[data-tw-insights]');
  twInsightControls(panel);
  panel.querySelector('[data-tw-insight-result]').textContent='';
},true);
addEventListener('click',async e=>{
  const button=e.target.closest('[data-tw-insight]');
  if(!button)return;
  const panel=button.closest('[data-tw-insights]'),out=panel.querySelector('[data-tw-insight-result]');
  if(panel.dataset.busy)return;
  const mode=button.dataset.twInsight,body={mode};
  if(mode==='distribution')body.page=Number(button.dataset.page||1);
  const line=panel.querySelector('[data-tw-line]');
  if(line){body.id=panel.dataset.order;body.line=Number(line.value);}
  if(mode==='keywords'){
    body.words=panel.querySelector('[data-tw-words]').value.trim();
    if(!body.words){out.textContent='Шалгах үгээ оруулна уу.';return;}
  }
  if(mode==='freight'){
    const first=panel.querySelector('[data-tw-first]'),extra=panel.querySelector('[data-tw-extra]');
    if(!first.reportValidity()||!extra.reportValidity())return;
    body.first_mnt=Number(first.value);
    body.extra_mnt=Number(extra.value);
  }
  panel.dataset.busy='1';button.disabled=true;
  if(line)line.disabled=true;
  out.textContent='TaoWorld-оос уншиж байна…';
  try{const r=await api('taoworld-insights',body);if(panel.isConnected)out.innerHTML=twInsightResult(mode,r);}
  catch(error){if(panel.isConnected)out.textContent=error.message;}
  finally{delete panel.dataset.busy;button.disabled=false;if(line)line.disabled=false;twInsightControls(panel);}
},true);
function twSettingsPanel(){const t=data.taoworld||{},auth=t.auth||{},worker=t.worker||{};return `<section class="panel integration-card" id="taoworld-direct"><h2>TaoWorld · шууд холболт</h2><p>Данс: <strong>${auth.connected?'Холбогдсон':'Холбох шаардлагатай'}</strong> · <a href="/api/taoworld/connect.php">Дансны холболт</a></p><p>Төлбөр баталгаажсан шинэ захиалгыг Эрээн хаягаар худалдан авна. Үнэ зөвшөөрсөн төсвөөс их эсвэл SKU таарахгүй бол админ шалгана.</p><form id="tw-settings-form"><label>Худалдан авах суваг<select name="channel"><option value="PANAMA_DG" ${t.channel!=='PANAMA'?'selected':''}>Хэрэглэгчийн өмнөөс худалдан авах</option><option value="PANAMA" ${t.channel==='PANAMA'?'selected':''}>Дамжуулан борлуулах</option></select></label><label class="check"><input type="checkbox" name="enabled" ${t.enabled?'checked':''}>Шинээр төлөгдсөн захиалгыг автоматаар үүсгэх</label><label class="check"><input type="checkbox" name="auto_pay" ${t.auto_pay?'checked':''}>Төсөвт багтсан нийлүүлэгчийн төлбөрийг автоматаар төлөх</label><p class="muted">Өмнө төлөгдсөн захиалгуудыг автоматаар нөхөж худалдаж авахгүй. Автомат горимыг унтраасан ч илгээсэн захиалгын төлөвийг үргэлжлүүлэн шалгана.</p><button class="primary">TaoWorld тохиргоо хадгалах</button></form><p>Арын боловсруулалт: ${worker.last_run?esc(adminTime(worker.last_run)):'Хуваарьт ажиллагаа хараахан батлагдаагүй'}</p>${twInsightsSettings(auth.connected)}</section>`;}
function twPurchasePanel(o){const p=o.purchase||{},pending=!!p.submitted_at,active=o.paid&&['confirmed','shipping'].includes(o.status),button=(action,label,primary=false)=>`<button type="button" class="${primary?'primary':'quiet'}" data-tw-action="${action}" data-id="${esc(o.id)}">${label}</button>`;return `<section class="panel purchase-panel" id="tw-purchase"><h3>TaoWorld → Эрээн</h3><p><strong>${esc(twLabels[p.state]||'Худалдан авалт эхлээгүй')}</strong></p>${p.outer_purchase_id?`<p>Гадаад захиалгын дугаар: <span style="overflow-wrap:anywhere">${esc(p.outer_purchase_id)}</span></p>`:''}${p.budget_fen?`<p>Зөвшөөрсөн төсөв: <strong>${twYuan(p.budget_fen)}</strong>${p.quote?` · TaoWorld тооцоо: <strong>${twYuan(p.quote.total_fen)}</strong> (дотоод хүргэлт ${twYuan(p.quote.shipping_fen)})`:''}</p>`:''}${p.error?`<p class="error">${esc(p.error)}</p>`:''}${p.pay_submitted_at?'<p class="muted">Төлбөрийн хүсэлт илгээгдсэн. Тодорхойгүй хариутай үед дахин төлөхгүй, төлөвийг шалгана.</p>':''}${p.provider_order_ids?.length?`<p>TaoWorld захиалга: ${p.provider_order_ids.map(esc).join(', ')}</p>`:''}${p.children?.length?`<ul>${p.children.map(c=>`<li>${esc(c.sub_purchase_order_id)} · ${esc(c.status)}${c.taobao_order_id?' · Taobao '+esc(c.taobao_order_id):''}${c.parcels?.map(n=>`<br>${esc(n.company)}: ${esc(n.no)}`).join('')||''}</li>`).join('')}</ul>`:''}<div class="form-actions">${active&&!pending?button('preview','TaoWorld тооцоо харах'):''}${active&&!p.provider?button('queue','Худалдан авалтын дараалалд оруулах',true):''}${active&&p.provider&&!pending?button('budget','Зөвшөөрөх төсөв өөрчлөх')+button('run','Тооцоог шалгаж захиалах',true):''}${pending?button('run','Захиалга / хүргэлт шалгах'):''}${active&&p.state==='awaiting_payment'&&!p.pay_submitted_at?button('pay','Нийлүүлэгчид төлөх',true):''}</div><pre id="tw-quote" hidden style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>${!active&&!pending?'<p>Төлбөр төлөгдсөн, идэвхтэй захиалгад худалдан авалт хийнэ.</p>':''}${twInsightsOrder(o)}</section>`;}
addEventListener('submit',async e=>{if(e.target.id!=='tw-settings-form')return;e.preventDefault();e.stopImmediatePropagation();const form=e.target,b=form.querySelector('button'),values=new FormData(form),body={enabled:values.has('enabled'),auto_pay:values.has('auto_pay'),channel:values.get('channel')};if(body.enabled&&!confirm('Шинээр төлөгдсөн захиалгуудыг TaoWorld-д бодитоор захиална.'+(body.auto_pay?' Нийлүүлэгчийн төлбөрийг мөн автоматаар төлнө.':'')+' Идэвхжүүлэх үү?'))return;b.disabled=true;try{data.taoworld=(await api('taoworld-settings',body)).taoworld;render();toast('TaoWorld тохиргоо хадгалагдлаа');}catch(err){toast(err.message);}finally{b.disabled=false;}},true);
addEventListener('click',async e=>{const b=e.target.closest('[data-tw-action]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const id=b.dataset.id,action=b.dataset.twAction,body={id};
 if(['queue','run','pay'].includes(action)){const o=data.orders.find(x=>x.id===id),creates=action==='queue'||(action==='run'&&!o?.purchase?.submitted_at);if((creates||action==='pay')&&!confirm(action==='pay'?id+' захиалгын нийлүүлэгчийн төлбөр '+twYuan(o?.purchase?.supplier_total_fen)+'-ийг төлөх үү?':id+' захиалгыг зөвшөөрсөн төсөвт багтвал TaoWorld-д бодитоор захиалах уу?'))return;}
 if(action==='budget'){const o=data.orders.find(x=>x.id===id),v=prompt('Бараа + Хятад доторх хүргэлтэд зөвшөөрөх нийт дүн (юань)',(Number(o?.purchase?.budget_fen||0)/100).toFixed(2));if(v===null)return;if(!/^\d+(\.\d{1,2})?$/.test(v)){toast('Үнийн дүнг зөв оруулна уу.');return;}body.budget_fen=Math.round(Number(v)*100);if(!confirm(twYuan(body.budget_fen)+' хүртэлх худалдан авалтыг зөвшөөрөх үү?'))return;}
 b.disabled=true;try{const r=await api('taoworld-'+action,body);if(action==='preview'){const q=r.quote,node=document.getElementById('tw-quote');node.textContent='Нийт: '+twYuan(q.total_fen)+'\nХятад доторх хүргэлт: '+twYuan(q.shipping_fen)+'\n'+q.lines.map(l=>l.title+' × '+l.quantity+' · SKU '+l.source_sku).join('\n');node.hidden=false;}else{data.orders=data.orders.map(o=>o.id===id?r.order:o);editOrder(id);toast(twLabels[r.order.purchase?.state]||'Шинэчлэгдлээ');}}catch(err){toast(err.message);}finally{b.disabled=false;}},true);
