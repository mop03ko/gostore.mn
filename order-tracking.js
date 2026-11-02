'use strict';
// Shared read-only view of recorded order movement. No purchase or shipment mutation.
window.OrderTracking=(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stages={new:0,reviewing:0,quoted:0,confirmed:0,shipping:0,erenhot:1,erenhot_ready:1,erenhot_dispatched:2,zamyn_uud:2,ulaanbaatar_unsorted:3,ulaanbaatar:3,ready_pickup:3,ready_delivery:3,out_for_delivery:3,completed:4};
  function date(value,lang='mn'){
    const d=new Date(value);if(!value||!Number.isFinite(d.getTime()))return lang==='zh'?'未记录时间':'Хугацаа бүртгэгдээгүй';
    return d.toLocaleString('sv-SE',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
  function state(o,options={}){
    const zh=options.lang==='zh',t=(mn,cn)=>zh?cn:mn,names={...options.names,...o.warehouse_names};
    const er=names.erenhot&&!(zh&&names.erenhot==='Эрээн агуулах')?names.erenhot:t('Эрээн агуулах','二连仓库');
    const ub=names.ulaanbaatar&&!(zh&&names.ulaanbaatar==='Улаанбаатар агуулах')?names.ulaanbaatar:t('Улаанбаатар агуулах','乌兰巴托仓库');
    const labels={new:t('Захиалга бүртгэгдсэн','订单已登记'),reviewing:t('Захиалга шалгаж байна','订单审核中'),quoted:t('Төлбөр / үнийн санал','待付款 / 报价'),confirmed:t('Худалдан авалт, нийлүүлэгчийн бэлтгэл','采购 / 供应商备货'),shipping:t('Нийлүүлэгчээс Эрээн рүү явж байна','供应商发货，运往二连'),erenhot:er+t(' · бараа ирсэн',' · 已签收'),erenhot_ready:t(ub+' руу гарахад бэлэн','已打包，待发往'+ub),erenhot_dispatched:t('Замын-Үүд рүү явж байна','已出库，运往扎门乌德'),zamyn_uud:t('Замын-Үүдэд ирсэн','已到扎门乌德'),ulaanbaatar_unsorted:ub+t(' · ангилж байна',' · 分拣中'),ulaanbaatar:ub+t(' · хүлээн авсан',' · 已收货'),ready_pickup:t('Агуулахаас авахад бэлэн','可到仓自提'),ready_delivery:t('Хүргэлтээр гаргахад бэлэн','待配送'),out_for_delivery:t('Хэрэглэгч рүү хүргэлтэд гарсан','正在配送给客户'),completed:t('Хэрэглэгчид хүлээлгэн өгсөн','已交付客户'),cancelled:t('Захиалга цуцлагдсан','订单已取消')};
    const locations={new:t('Байршил хараахан бүртгэгдээгүй','尚未登记货物位置'),reviewing:t('Байршил хараахан бүртгэгдээгүй','尚未登记货物位置'),quoted:t('Эрээнд ирсэн бүртгэл алга','尚未登记到达二连'),confirmed:t('Нийлүүлэгчийн илгээлтийг хүлээж байна','等待供应商发货'),shipping:t('Нийлүүлэгч','供应商')+' → '+er,erenhot:er,erenhot_ready:er,erenhot_dispatched:er+' → '+t('Замын-Үүд','扎门乌德'),zamyn_uud:t('Замын-Үүд','扎门乌德'),ulaanbaatar_unsorted:ub,ulaanbaatar:ub,ready_pickup:ub,ready_delivery:ub,out_for_delivery:t('Хэрэглэгч рүү хүргэлтэд','客户配送途中'),completed:t('Хэрэглэгчид хүлээлгэн өгсөн','已交付客户'),cancelled:t('Цуцлагдсан · хөдөлгөөн үргэлжлэхгүй','已取消 · 不再推进运输')};
    const next={new:t('Захиалгыг шалгаж батална.','等待审核确认订单。'),reviewing:t('Захиалгыг шалгаж батална.','等待审核确认订单。'),quoted:t('Төлбөр баталгаажсаны дараа худалдан авалт үргэлжилнэ.','付款确认后继续采购。'),confirmed:t('Нийлүүлэгчийн илгээлтийн мэдээллийг хүлээнэ.','等待供应商发货信息。'),shipping:t(er+' хүлээн авснаа бүртгэнэ.','等待'+er+'登记收货。'),erenhot:t('Барааг шалгаж, тээврийн багцад оруулна.','验货后加入运输包裹。'),erenhot_ready:t('Менежер агуулахаас илгээснийг батална.','等待仓库经理确认出库发货。'),erenhot_dispatched:t('Замын-Үүдээр дамжин '+ub+' руу хүргэнэ.','经扎门乌德运往'+ub+'。'),zamyn_uud:t(ub+' хүлээн авснаа бүртгэнэ.','等待'+ub+'登记收货。'),ulaanbaatar_unsorted:t('Багцыг задалж, захиалга тус бүрээр ангилна.','拆包并按订单分拣。'),ulaanbaatar:t('Авах эсвэл хүргүүлэхэд бэлтгэнэ.','准备自提或配送。'),ready_pickup:t('Захиалагч агуулахаас авна.','等待客户到仓自提。'),ready_delivery:t('Хүргэлтэд гаргасныг бүртгэнэ.','等待登记配送出库。'),out_for_delivery:t('Хүлээлгэн өгснийг батална.','等待确认交付客户。'),completed:t('Захиалгын хүргэлт дууссан.','订单交付已完成。'),cancelled:t('Дэлгэрэнгүйг GOStore-оос тодруулна уу.','如需详情，请联系 GOStore。')};
    const events=(o.history||[]).filter(h=>h&&labels[h.status]&&h.at&&Number.isFinite(Date.parse(h.at)));
    let at=[...events].reverse().find(h=>h.status===o.status)?.at||null,location=locations[o.status]||t('Байршил баталгаажаагүй','位置尚未确认'),label=labels[o.status]||t('Төлөв тодорхойгүй','状态未知'),nextStep=next[o.status]||t('Шинэ бүртгэлийг хүлээнэ.','等待更新记录。'),supplier=false;
    // Supplier dispatch must never overwrite a later, warehouse-confirmed movement.
    if(['confirmed','shipping'].includes(o.status)&&o.inbound?.status==='TaoWorld: shipped'){
      location=locations.shipping;label=labels.shipping;nextStep=next.shipping;at=o.inbound.checked_at||at;supplier=true;
    }
    return {stage:stages[o.status]??null,location,label,next:nextStep,at,supplier,events,labels,steps:[t('Захиалсан','订单'),er,t('Замд','运输中'),ub,t('Хүлээн авсан','已交付')],t};
  }
  function progress(o,options={}){
    const s=state(o,options);if(s.stage===null)return '';
    const recorded=new Set(s.events.map(h=>stages[h.status]));
    return `<ol class="cargo-progress tracking-progress" aria-label="${s.t('Ачааны явц','物流进度')}">${s.steps.map((label,i)=>`<li class="${i===s.stage?'current':i<s.stage&&recorded.has(i)?'done':'pending'}" ${i===s.stage?'aria-current="step"':''}><span aria-hidden="true">${i<s.stage&&recorded.has(i)?'✓':i+1}</span>${esc(label)}</li>`).join('')}</ol>`;
  }
  function html(o,options={}){
    const s=state(o,options),events=[...s.events].reverse();
    return `<section class="order-tracking" aria-label="${s.t('Барааны байршил, явц','货物位置与进度')}"><div class="tracking-heading"><span>${s.t('БҮРТГЭЛЭЭРХ БАЙРШИЛ','已登记位置')}</span><small>${s.supplier?s.t('Нийлүүлэгчийн мэдээллээр','供应商信息'):s.t('Захиалгын хөдөлгөөн','订单流转记录')}</small></div><h3 class="tracking-location">${esc(s.location)}</h3><p class="tracking-status">${esc(s.label)}</p><p class="tracking-updated">${s.t('Сүүлд бүртгэсэн','最近记录')} · ${esc(date(s.at,options.lang))}</p>${progress(o,options)}<p class="tracking-next"><strong>${s.t('Дараагийн алхам','下一步')}</strong>${esc(s.next)}</p>${options.history===false?'':`<details class="tracking-history"><summary>${s.t('Хөдөлгөөний түүх','流转历史')} · ${events.length}</summary>${events.length?`<ol>${events.map(h=>`<li><strong>${esc(s.labels[h.status])}</strong><time datetime="${esc(h.at)}">${esc(date(h.at,options.lang))}</time></li>`).join('')}</ol>`:`<p>${s.t('Хөдөлгөөний түүх хараахан бүртгэгдээгүй.','暂无流转记录。')}</p>`}</details>`}<small class="tracking-note">${s.t('Менежер эсвэл нийлүүлэгчийн бүртгэл шинэчлэгдэхэд явц өөрчлөгдөнө.','仓库或供应商更新记录后，物流进度随之更新。')}</small></section>`;
  }
  return {state,progress,html,date};
})();
