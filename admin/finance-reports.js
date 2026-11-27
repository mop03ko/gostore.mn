'use strict';
window.FinanceReports=(()=>{
  const value=v=>v==null?'—':money(v);
  const yuan=v=>v==null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(v)+' ¥';
  const card=(label,v,note,kind='')=>`<article class="finance-card ${kind}"><span>${esc(label)}</span><strong>${value(v)}</strong><small>${esc(note)}</small></article>`;
  function renderReport(r){
    const f=r.finance;if(!f)return '';
    const missing=(key,note)=>f.missing[key]?`${f.missing[key]} захиалгын мэдээлэл дутуу`:note;
    const owner=data.admin?.role==='owner';
    return `<section class="finance-summary" aria-label="Санхүүгийн тайлан"><div class="finance-heading"><div><h2>Орлого, зардал, ашиг</h2><p>Захиалга үүссэн огноогоор шүүсэн тайлан. Сонгосон захиалгын дараа төлсөн төлбөр, зардал мөн багтана.</p></div>${owner?'<button type="button" class="quiet" data-finance-edit="">Дүн нөхөж оруулах</button>':''}</div>
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
      <section class="panel"><div class="panel-heading"><div><h3>Захиалгын санхүүгийн задаргаа</h3><p class="muted">Зардал байхгүй бол 0, тодорхойгүй бол хоосон үлдээнэ. Бүртгэл нь хэрэглэгчийн нэхэмжлэл, төлбөрийн төлөвийг өөрчлөхгүй.</p></div></div><div class="table-wrap"><table class="finance-table"><thead><tr><th>Захиалга</th><th>Орлого, буцаалт хассан</th><th>Нийлүүлэгч</th><th>Тээвэр</th><th>Ханшийн зөрүү</th><th>Цэвэр ашиг</th><th>Тулгалт</th></tr></thead><tbody>${f.rows.map(o=>`<tr><td><button type="button" class="link-button" data-open-order="${esc(o.id)}">${esc(o.id)}</button><small>${esc(o.day)}${o.part?' · салгасан хэсэг':''}</small></td><td>${value(o.net)}</td><td>${value(o.actual_cost)}<small>${yuan(o.supplier_cny)}</small></td><td>${value(o.transport_cost)}</td><td>${value(o.fx)}</td><td>${value(o.profit)}</td><td>${owner?`<button class="quiet" type="button" data-finance-edit="${esc(o.id)}">${o.missing.length?'Дүн оруулах':'Засах'}</button>`:''}<small>${esc(o.missing.join(', ')||'Тулгагдсан')}</small></td></tr>`).join('')||'<tr><td colspan="7">Төлбөр, зардлын бүртгэл алга.</td></tr>'}</tbody></table></div>${f.row_count>100?'<p class="xpad muted">Сүүлийн 100 бүртгэл. Бүрэн задаргааг санхүүгийн CSV файлаар татна.</p>':''}</section>
    </section>`;
  }
  async function open(id){
    if(!id){modal('Санхүүгийн дүн оруулах','<form id="finance-find"><label>Захиалгын код<input name="id" placeholder="GS-…" required maxlength="50"></label><p class="error" role="alert"></p><button class="primary">Нээх</button></form>');return;}
    const o=await api('admin-finance-entry&id='+encodeURIComponent(id)),e=o.entry;
    const input=(key,label,step='1')=>`<label>${label}<input type="number" name="${key}" min="${key==='actual_cny_rate'?'0.01':'0'}" max="${key==='actual_cny_rate'?'100000':key==='supplier_refund_cny'?'1000000':'100000000'}" step="${step}" value="${e[key]??''}" placeholder="Тодорхойгүй"></label>`;
    modal('Санхүү · '+o.id,`<form id="finance-form" data-id="${esc(o.id)}" data-version="${e.version}"><p class="muted">Системийн үлдэгдэл төлбөр: ${money(o.balance)}. Доорх нэмэлт карго нь үүнд ороогүй төлбөрийн нийт дүн байна.</p><div class="finance-form-grid">${input('actual_cny_rate','Юань авсан бодит ханш (₮ / ¥)','0.0001')}${input('supplier_refund_cny','Нийлүүлэгчээс буцааж авсан (¥)','0.01')}${input('transport_cost_mnt','Бодит тээврийн зардал (₮)')}${input('other_cost_mnt','Бусад зардал (₮)')}${input('extra_cargo_mnt','Системд ороогүй карго төлбөрийн нийлбэр (₮)')}<label>Нэмэлт карго төлсөн огноо<input type="date" name="payment_date" value="${esc(e.payment_date)}"></label></div><label>Тайлбар / гүйлгээний лавлагаа<textarea name="note" maxlength="500">${esc(e.note)}</textarea></label><label class="finance-check"><input type="checkbox" name="complete" ${e.complete?'checked':''}>Бүх зардал, нийлүүлэгчийн буцаалтыг тулгасан. Бусад зардалд шаардлагатай шимтгэл, татварыг оруулсан.</label><p class="muted">Нэмэлт каргоны талбар өмнөх нийлбэрийг солино. Системийн төлбөрийг давхар бүү оруулаарай. Энэ нь зөвхөн санхүүгийн тайланд хадгалагдана.</p><p class="error" role="alert"></p><button class="primary">Хадгалах</button></form>`);
  }
  addEventListener('click',async e=>{const b=e.target.closest('[data-finance-edit]');if(!b)return;b.disabled=true;try{await open(b.dataset.financeEdit);}catch(x){toast(x.message);}finally{b.disabled=false;}});
  addEventListener('submit',async e=>{
    const f=e.target;if(!['finance-find','finance-form'].includes(f.id))return;e.preventDefault();e.stopImmediatePropagation();const b=f.querySelector('button'),err=f.querySelector('.error');b.disabled=true;err.textContent='';
    try{const fd=new FormData(f);if(f.id==='finance-find'){await open(String(fd.get('id')).trim());return;}
      const body={id:f.dataset.id,version:Number(f.dataset.version),complete:fd.has('complete'),note:fd.get('note'),payment_date:fd.get('payment_date')};
      for(const k of ['actual_cny_rate','supplier_refund_cny','transport_cost_mnt','other_cost_mnt','extra_cargo_mnt'])body[k]=fd.get(k)===''?null:Number(fd.get(k));
      await api('admin-finance-save',body);$('#editor').close();toast('Санхүүгийн дүн хадгалагдлаа');render();
    }catch(x){err.textContent=x.message;}finally{b.disabled=false;}
  },true);
  return {render:renderReport};
})();
