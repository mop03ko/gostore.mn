'use strict';
window.FinanceReports=(()=>{
  const value=v=>v==null?'—':money(v);
  const yuan=v=>v==null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(v)+' ¥';
  const card=(label,v,note,kind='')=>`<article class="finance-card ${kind}"><span>${esc(label)}</span><strong>${value(v)}</strong><small>${esc(note)}</small></article>`;
  function renderReport(r){
    const f=r.finance;if(!f)return '';
    const missing=(key,note)=>f.missing[key]?`${f.missing[key]} захиалгын мэдээлэл дутуу`:note;
    const owner=data.admin?.role==='owner';
    return `<section class="finance-summary" aria-label="Санхүүгийн тайлан"><div class="finance-heading"><div><h2>Орлого, зардал, ашиг</h2><p>Захиалга үүссэн огноогоор шүүсэн тайлан. Сонгосон захиалгын дараа төлсөн төлбөр, зардал мөн багтана.</p></div>${owner?'<div class="finance-batch-tools"><button type="button" class="quiet" data-finance-batch="">Багцын тээврийн зардал</button><button type="button" class="quiet" data-finance-edit="">Захиалгын дүн</button></div>':''}</div>
      <div class="finance-grid">
        ${card('Нийт орж ирсэн төлбөр',f.gross,'Борлуулалт + үлдэгдэл + нэмэлт карго','accent')}
        ${card('Борлуулалтын орлого',f.initial,'Хэрэглэгчийн төлсөн эхний нэхэмжлэл')}
        ${card('Каргоны төлсөн төлбөр',f.cargo,missing('cargo','Тулгасан төлбөр + гадуур төлсөн нэмэлт карго'))}
        ${card('Буцаалтын дараах нийт орлого',f.net,`Буцаасан төлбөр: ${money(f.refund)}`)}
        ${card('Нийлүүлэгчийн бодит зардал',f.actual_cost,missing('actual_cost',`${yuan(f.supplier_cny)} · бодит ханшаар, буцаалт хассан`))}
        ${card('Тээврийн бодит зардал',f.transport_cost,missing('transport_cost','Карго, дотоод хүргэлтэд бодитоор төлсөн'))}
        ${card('Юанын ханшийн зөрүү',f.fx,missing('fx','Захиалгын ханш − бодит ханш · + ашиг / − алдагдал'))}
        ${card('Бусад зардал',f.other_cost,missing('other_cost','Шимтгэл, татвар, үйл ажиллагаанд хуваарилсан зардал'))}
        ${card('Цэвэр ашиг (бүртгэсэн)',f.profit,missing('profit','Цэвэр орлого − нийлүүлэгч − тээвэр − бусад зардал'),f.profit==null?'pending':f.profit<0?'loss':'profit')}
      </div>
      <div class="finance-explanation"><strong>${f.complete_orders} / ${f.row_count} бүртгэлийн зардал бүрэн тулгагдсан</strong><p>Ханшийн зөрүү цэвэр ашигт аль хэдийн шингэсэн; дахин нэмэхгүй. Хоосон дүн нь 0 биш. Каргоны үлдэгдэл нэхэмжлэлд үйлчилгээ, хүргэлтийн төлбөр орж болдог тул бүтнээр нь карго гэж тооцохгүй.</p><p>Системд төлөгдсөн үлдэгдэл: <b>${money(f.balance)}</b> · Нөхөж бүртгэсэн карго: <b>${money(f.extra_cargo)}</b> · ${f.paid_orders} төлбөртэй захиалга, ${f.shipment_parts} салгасан хэсэг.</p></div>
      <section class="panel"><div class="panel-heading"><div><h3>Захиалгын санхүүгийн задаргаа</h3><p class="muted">Зардал байхгүй бол 0, тодорхойгүй бол хоосон үлдээнэ. Бүртгэл нь хэрэглэгчийн нэхэмжлэл, төлбөрийн төлөвийг өөрчлөхгүй.</p></div></div><div class="table-wrap"><table class="finance-table"><thead><tr><th>Захиалга</th><th>Орлого, буцаалт хассан</th><th>Нийлүүлэгч</th><th>Тээвэр</th><th>Ханшийн зөрүү</th><th>Цэвэр ашиг</th><th>Тулгалт</th></tr></thead><tbody>${f.rows.map(o=>`<tr><td><button type="button" class="link-button" data-open-order="${esc(o.id)}">${esc(o.id)}</button><small>${esc(o.day)}${o.part?' · салгасан хэсэг':''}</small></td><td>${value(o.net)}</td><td>${value(o.actual_cost)}<small>${yuan(o.supplier_cny)}</small></td><td>${value(o.transport_cost)}${o.transport_batch?`<small>${esc(o.transport_batch)}</small>`:""}</td><td>${value(o.fx)}</td><td>${value(o.profit)}</td><td>${owner?`<button class="quiet" type="button" data-finance-edit="${esc(o.id)}">${o.missing.length?'Дүн оруулах':'Засах'}</button>`:''}<small>${esc(o.missing.join(', ')||'Тулгагдсан')}</small></td></tr>`).join('')||'<tr><td colspan="7">Төлбөр, зардлын бүртгэл алга.</td></tr>'}</tbody></table></div>${f.row_count>100?'<p class="xpad muted">Сүүлийн 100 бүртгэл. Бүрэн задаргааг санхүүгийн CSV файлаар татна.</p>':''}</section>
    </section>`;
  }
  let batchCurrent=null;
  async function openBatch(id){
    if(!id){modal('Тээвэрлэгчид төлсөн багцын зардал','<form id="finance-batch-find"><label>Илгээсэн багцын код<input name="id" placeholder="GB-…" required maxlength="50"></label><p class="error" role="alert"></p><button class="primary">Нээх</button></form>');return;}
    const b=await api('admin-finance-batch&id='+encodeURIComponent(id));batchCurrent=b;const e=b.entry;
    modal('Багцын зардал · '+b.id,`<form id="finance-batch-form"><p class="muted">GOStore-оос тээвэрлэгчид төлсөн зардал. Хэрэглэгчийн каргоны төлбөр биш. Зөвхөн илгээсэн багцыг хадгална.</p><div class="finance-form-grid"><label>Багцад төлсөн нийт дүн (₮)<input name="amount_mnt" type="number" min="0" max="100000000" step="1" required value="${e.amount_mnt??''}"></label><label>Төлсөн огноо<input name="paid_date" type="date" required value="${esc(e.paid_date)}"></label></div><label>Гүйлгээний лавлагаа / тээвэрлэгч<textarea name="note" maxlength="500" required>${esc(e.note)}</textarea></label><p class="muted">Юаниар төлсөн бол бодитоор зарцуулсан төгрөгийн дүнг оруулна. Хуваарилалтыг гараар оруулах эсвэл хэмжилтээр санал болгуулж шалгана.</p><div class="finance-batch-tools"><button type="button" class="quiet" data-finance-distribute="weight_kg">Жингээр хуваарилах</button><button type="button" class="quiet" data-finance-distribute="volume_m3">Эзлэхүүнээр хуваарилах</button></div><div class="table-wrap"><table><thead><tr><th>Захиалга</th><th>Жин / эзлэхүүн</th><th>Ногдох зардал (₮)</th></tr></thead><tbody>${b.members.map(m=>`<tr><td>${esc(m.id)}${m.manual_cost>0?'<small class="error">Тусдаа зардлыг эхлээд арилгана уу.</small>':''}</td><td>${esc(m.weight_kg??'—')} кг / ${esc(m.volume_m3??'—')} м³</td><td><input aria-label="${esc(m.id)} зардал" data-finance-allocation="${esc(m.id)}" type="number" min="0" max="100000000" step="1" required value="${e.allocations[m.id]??''}"></td></tr>`).join('')}</tbody></table></div><p id="finance-batch-sum" role="status"></p><label class="finance-check"><input name="confirmed" type="checkbox" required>Төлсөн дүн болон захиалгуудад хуваарилсан зардлыг тулгаж шалгасан.</label><p class="muted">Дахин хадгалах нь өмнөх багцын нийлбэрийг солино. Захиалга тус бүр дээр энэ зардлыг дахин оруулахгүй.</p><p class="error" role="alert"></p><button class="primary" type="submit">Багцын зардлыг хадгалах</button></form>`);batchSum();
  }
  function batchSum(){const f=$('#finance-batch-form');if(!f)return;const total=[...f.querySelectorAll('[data-finance-allocation]')].reduce((s,i)=>s+Number(i.value||0),0);$('#finance-batch-sum').textContent='Хуваарилсан: '+money(total)+' · Зөрүү: '+money(Number(f.elements.amount_mnt.value||0)-total);}
  addEventListener('input',e=>{if(e.target.closest('#finance-batch-form')&&e.target.name!=='confirmed'){batchSum();$('#finance-batch-form [name=confirmed]').checked=false;}});
  addEventListener('click',async e=>{
    const open=e.target.closest('[data-finance-batch]');if(open){open.disabled=true;try{await openBatch(open.dataset.financeBatch);}catch(x){toast(x.message);}finally{open.disabled=false;}return;}
    const distribute=e.target.closest('[data-finance-distribute]');if(!distribute)return;const f=$('#finance-batch-form'),err=f.querySelector('p.error'),total=Number(f.elements.amount_mnt.value),key=distribute.dataset.financeDistribute;err.textContent='';
    if(f.elements.amount_mnt.value===''||!Number.isInteger(total)||total<0||total>100000000){err.textContent='Багцын нийт дүнг оруулна уу.';return;}
    if(!batchCurrent.members.length||batchCurrent.members.some(m=>!Number.isFinite(Number(m[key]))||Number(m[key])<=0)){err.textContent='Бүх захиалгын хэмжилт бүрэн биш. Гараар хуваарилна уу.';return;}
    const sum=batchCurrent.members.reduce((s,m)=>s+Number(m[key]),0),parts=batchCurrent.members.map((m,i)=>{const exact=total*Number(m[key])/sum;return {i,amount:Math.floor(exact),fraction:exact-Math.floor(exact)};});let rest=total-parts.reduce((s,p)=>s+p.amount,0);const sorted=[...parts].sort((a,b)=>b.fraction-a.fraction||a.i-b.i);for(let i=0;i<rest;i++)sorted[i%sorted.length].amount++;
    f.querySelectorAll('[data-finance-allocation]').forEach((input,i)=>input.value=parts[i].amount);f.elements.confirmed.checked=false;batchSum();
  });
  addEventListener('submit',async e=>{const f=e.target;if(!['finance-batch-find','finance-batch-form'].includes(f.getAttribute('id')))return;e.preventDefault();e.stopImmediatePropagation();const button=f.querySelector('button[type=submit]')||f.querySelector('button'),err=f.querySelector('p.error');button.disabled=true;err.textContent='';
    try{const fd=new FormData(f);if(f.getAttribute('id')==='finance-batch-find'){await openBatch(String(fd.get('id')).trim());return;}
      const allocations={};for(const i of f.querySelectorAll('[data-finance-allocation]'))allocations[i.dataset.financeAllocation]=Number(i.value);
      await api('admin-finance-batch-save',{id:batchCurrent.id,version:batchCurrent.entry.version,batch_version:batchCurrent.batch_version,amount_mnt:Number(fd.get('amount_mnt')),paid_date:fd.get('paid_date'),note:fd.get('note'),confirmed:fd.has('confirmed'),allocations});$('#editor').close();toast('Багцын зардал хадгалагдлаа');render();
    }catch(x){err.textContent=x.message;}finally{button.disabled=false;}
  },true);

  function fxReferenceFields(entry) {
    const banks = [['KhanBank','ХААН Банк'],['XacBank','ХасБанк']];
    return `<fieldset class="finance-fx-reference">
      <legend>Банкны лавлах ханш</legend>
      <div class="finance-form-grid">
        <label>Юань авсан огноо<input name="fx_purchase_date" type="date" value="${esc(entry.fx_purchase_date||'')}"></label>
        <label>Банк<select name="fx_bank"><option value="">Сонгох</option>${banks.map(([code,label])=>`<option value="${code}" ${entry.fx_bank===code?'selected':''}>${label}</option>`).join('')}</select></label>
      </div>
      <button type="button" class="quiet" data-finance-fx-lookup>Лавлах ханш харах</button>
      <p class="muted" data-finance-fx-result role="status"></p>
      <p class="muted">Цэвэр ашгийг тооцохдоо гүйлгээний баримтад бичсэн бодит ханшийг доор оруулна.</p>
    </fieldset>`;
  }
  function clearFxResult(event) {
    if (['fx_bank','fx_purchase_date'].includes(event.target.name)) {
      const result = event.target.form?.querySelector('[data-finance-fx-result]');
      if (result) result.textContent = '';
    }
  }
  addEventListener('change',clearFxResult);
  addEventListener('input',clearFxResult);
  addEventListener('click',async event=>{
    const button = event.target.closest('[data-finance-fx-lookup]');
    if (!button) return;
    const form = button.form;
    const result = form.querySelector('[data-finance-fx-result]');
    const {fx_bank,fx_purchase_date} = form.elements;
    const bank = fx_bank.value, date = fx_purchase_date.value;
    if (!bank || !date) {
      result.textContent = 'Юань авсан огноо, банкаа сонгоно уу.';
      return;
    }
    const current = ()=>fx_bank.value===bank && fx_purchase_date.value===date && form.isConnected;
    button.disabled = true;
    result.textContent = 'Банкны ханш авч байна…';
    try {
      const data = await api('admin-finance-fx-reference&'+new URLSearchParams({bank,date}));
      if (current()) {
        const label = `${data.bank} · ${data.date}`;
        const amount = Number(data.rate).toLocaleString('en-US',{maximumFractionDigits:4});
        result.textContent = data.rate==null
          ? `${label} · Бэлэн бус зарах ханш олдсонгүй.`
          : `${label} · Бэлэн бус зарах ханш ${amount} ₮ / ¥`;
      }
    } catch (error) {
      if (current()) result.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  async function open(id){
    if(!id){modal('Санхүүгийн дүн оруулах','<form id="finance-find"><label>Захиалгын код<input name="id" placeholder="GS-…" required maxlength="50"></label><p class="error" role="alert"></p><button class="primary">Нээх</button></form>');return;}
    const o=await api('admin-finance-entry&id='+encodeURIComponent(id)),e=o.entry;
    const input=(key,label,step='1')=>`<label>${label}<input type="number" name="${key}" min="${key==='actual_cny_rate'?'0.01':'0'}" max="${key==='actual_cny_rate'?'100000':key==='supplier_refund_cny'?'1000000':'100000000'}" step="${step}" value="${e[key]??''}" placeholder="Тодорхойгүй"></label>`;
    modal('Санхүү · '+o.id,`<form id="finance-form" data-id="${esc(o.id)}" data-version="${e.version}"><p class="muted">Системийн үлдэгдэл төлбөр: ${money(o.balance)}. Доорх нэмэлт карго нь үүнд ороогүй төлбөрийн нийт дүн байна.</p>${fxReferenceFields(e)}<div class="finance-form-grid">${input('actual_cny_rate','Юань авсан бодит ханш (₮ / ¥)','0.0001')}${input('supplier_refund_cny','Нийлүүлэгчээс буцааж авсан (¥)','0.01')}${o.transport_batch?`<div><p>Багцаас ногдсон зардал: <strong>${money(o.transport_cost)}</strong></p><button type="button" class="quiet" data-finance-batch="${esc(o.transport_batch)}">${esc(o.transport_batch)} · засах</button><input type="hidden" name="transport_cost_mnt" value="${e.transport_cost_mnt??''}"></div>`:input('transport_cost_mnt','Тусдаа тээврийн зардал (багцгүй үед, ₮)')}${input('other_cost_mnt','Бусад зардал (₮)')}${input('extra_cargo_mnt','Системд ороогүй карго төлбөрийн нийлбэр (₮)')}<label>Нэмэлт карго төлсөн огноо<input type="date" name="payment_date" value="${esc(e.payment_date)}"></label></div><label>Тайлбар / гүйлгээний лавлагаа<textarea name="note" maxlength="500">${esc(e.note)}</textarea></label><label class="finance-check"><input type="checkbox" name="complete" ${e.complete?'checked':''}>Бүх зардал, нийлүүлэгчийн буцаалтыг тулгасан. Бусад зардалд шаардлагатай шимтгэл, татварыг оруулсан.</label><p class="muted">Нэмэлт каргоны талбар өмнөх нийлбэрийг солино. Системийн төлбөрийг давхар бүү оруулаарай. Энэ нь зөвхөн санхүүгийн тайланд хадгалагдана.</p><p class="error" role="alert"></p><button class="primary" type="submit">Хадгалах</button></form>`);
  }
  addEventListener('click',async e=>{const b=e.target.closest('[data-finance-edit]');if(!b)return;b.disabled=true;try{await open(b.dataset.financeEdit);}catch(x){toast(x.message);}finally{b.disabled=false;}});
  addEventListener('submit',async e=>{
    const f=e.target;if(!['finance-find','finance-form'].includes(f.getAttribute('id')))return;e.preventDefault();e.stopImmediatePropagation();const b=f.querySelector('button[type=submit]')||f.querySelector('button'),err=f.querySelector('.error');b.disabled=true;err.textContent='';
    try{const fd=new FormData(f);if(f.getAttribute('id')==='finance-find'){await open(String(fd.get('id')).trim());return;}
      const body={id:f.dataset.id,version:Number(f.dataset.version),complete:fd.has('complete'),note:fd.get('note'),payment_date:fd.get('payment_date'),fx_bank:fd.get('fx_bank'),fx_purchase_date:fd.get('fx_purchase_date')};
      for(const k of ['actual_cny_rate','supplier_refund_cny','transport_cost_mnt','other_cost_mnt','extra_cargo_mnt'])body[k]=fd.get(k)===''?null:Number(fd.get(k));
      await api('admin-finance-save',body);$('#editor').close();toast('Санхүүгийн дүн хадгалагдлаа');render();
    }catch(x){err.textContent=x.message;}finally{b.disabled=false;}
  },true);
  return {render:renderReport};
})();
