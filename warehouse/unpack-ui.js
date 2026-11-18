'use strict';
function warehouseUnpackHtml(b){
 if(b.status==='cancelled'&&b.history?.some(h=>h.event==='unpack'))return `<p class="note">${lt('Багцыг бүрэн задалсан. Хуучин GB шошгыг ашиглахгүй; дахин багцлахдаа шинэ шошго хэвлэнэ.','运输包裹已全部拆开，请作废旧 GB 标签；重新装包后打印新标签。')}</p>`;
 if(!b.can_unpack||cityRole()!=='erenhot')return '';
 return `<details class="method-change" data-unpack-panel><summary>${lt('Багц задлах / бараа гаргах','拆包 / 移出订单')}</summary><form data-unpack-form data-id="${esc(b.id)}" data-version="${b.version}" class="warehouse-confirm">
 <p>${lt('Гаргах захиалгуудаа сонгоно уу. Бүгдийг сонговол багцыг бүрэн задална.','选择要移出的订单；全部选择即可拆开整个运输包裹。')}</p>
 <button type="button" class="quiet" data-unpack-all>${lt('Бүгдийг сонгох','全选订单')}</button>
 ${b.orders.map(o=>`<label class="check"><input type="checkbox" name="order_id" value="${esc(o.id)}"><span><strong>${esc(o.id)}</strong> · ${esc(o.customer)}<br>${esc(o.title)}</span></label>`).join('')}
 <p class="note">${lt('Бараа «Эрээн агуулахад ирсэн» төлөвт буцна. Үлдсэн багцыг дахин тулгаж, шошгоо шинэчлэн хэвлэнэ. Барааны төлбөр, зураг, хэмжилт хадгалагдана.','移出的订单恢复为“二连已收货”，可重新拆分或装包。剩余运输包裹须重新扫码核对并打印标签；货款、照片及测量记录保留。')}</p>
 <label>${lt('Задлах шалтгаан','拆包原因')}<textarea name="reason" rows="2" maxlength="500" required></textarea></label>
 <label class="check"><input type="checkbox" name="checked" required><span>${lt('Багц агуулахаас гараагүй, сонгосон барааг бодитоор гаргасныг баталж байна','确认运输包裹尚未出库，且已实际取出所选订单货物')}</span></label>
 ${errorBox()}<button type="submit" class="primary">${lt('Сонгосныг багцаас гаргах','确认拆包并移出')}</button></form></details>`;
}
document.addEventListener('click',e=>{
 const one=e.target.closest('[data-unpack-order]'),all=e.target.closest('[data-unpack-all]');if(!one&&!all)return;
 const panel=document.querySelector('[data-unpack-panel]');if(!panel)return;panel.open=true;
 panel.querySelectorAll('[name=order_id]').forEach(i=>i.checked=!!all||i.value===one.dataset.unpackOrder);
 if(one)panel.scrollIntoView({block:'start',behavior:'smooth'});
});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!f.matches('[data-unpack-form]'))return;e.preventDefault();if(f.dataset.busy)return;
 const ids=[...f.querySelectorAll('[name=order_id]:checked')].map(i=>i.value),error=f.querySelector('.error');
 if(!ids.length){error.textContent=lt('Гаргах захиалгаа сонгоно уу.','请选择要移出的订单。');return;}
 f.dataset.busy='1';const button=f.querySelector('[type=submit]');button.disabled=true;error.textContent='';
 try{const d=await api('warehouse-batch-unpack',{id:f.dataset.id,expected_version:Number(f.dataset.version),order_ids:ids,reason:f.elements.reason.value.trim(),checked:f.elements.checked.checked});
 showBatch(d.batch);toast(lt('Барааг багцаас гаргалаа. Дахин багцлах боломжтой.','已移出订单，可以重新拆分或装包。'));await refresh();
 }catch(err){error.textContent=err.message;}finally{delete f.dataset.busy;button.disabled=false;}
});
Object.assign(warehouseText.zh.events,{unpack:'拆包移出订单',unpack_details:'拆包记录'});
Object.assign(warehouseText.mn.events,{unpack:'Багцаас бараа гаргасан',unpack_details:'Задалсан бүртгэл'});
