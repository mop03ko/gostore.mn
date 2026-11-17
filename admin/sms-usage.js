'use strict';
// Read-only usage view; credentials, OTPs and SMS bodies never enter this page.
window.ADMIN_EXTRA_TITLES.sms='SMS хэрэглээ';
(()=>{
  const today=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
  const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400e3).toISOString().slice(0,10);
  let range={from:shift(today(),-29),to:today(),kind:'all',page:1},generation=0;
  const states={pending:'Илгээхээр хүлээж буй',sending:'Хүсэлт явуулж буй',accepted:'Үйлчилгээ хүлээн авсан',failed:'Татгалзсан',uncertain:'Хариу тодорхойгүй',cancelled:'Илгээхээс өмнө цуцалсан'};
  const events={register:'Шинэ бүртгэл',reset:'PIN сэргээх',link:'Утас холбох',verify:'Утас баталгаажуулах',paid:'Төлбөр баталгаажсан',pickup:'Салбарт бэлэн'};
  const when=v=>v?new Date(v).toLocaleString('mn-MN',{timeZone:'Asia/Ulaanbaatar'}):'—';
  const amount=v=>v==null?'Тодорхойгүй':money(v);
  function html(){return `<section class="panel sms-panel"><div class="panel-heading"><div><h2>SendSMS.mn хэрэглээ</h2><p class="muted">GOStore-оос үүсгэсэн SMS хүсэлтүүд · Улаанбаатарын цагаар</p></div><a class="quiet" href="https://sendsms.mn" target="_blank" rel="noopener noreferrer">SendSMS.mn ↗</a></div><form id="sms-range" class="sms-filters"><label>Эхлэх огноо<input name="from" type="date" value="${range.from}" required></label><label>Дуусах огноо<input name="to" type="date" value="${range.to}" required></label><label>SMS төрөл<select name="kind"><option value="all">Бүгд</option><option value="otp" ${range.kind==='otp'?'selected':''}>Баталгаажуулах код</option><option value="order" ${range.kind==='order'?'selected':''}>Захиалгын мэдэгдэл</option></select></label><button class="primary" type="submit">Шинэчлэх</button></form><div id="sms-result" aria-live="polite"></div></section>`;}
  async function load(){
    const box=document.querySelector('#sms-result');if(!box)return;const request=++generation;
    box.innerHTML='<p class="muted" role="status">SMS хэрэглээг ачаалж байна…</p>';
    try{
      const r=await api('admin-sms-usage&'+new URLSearchParams(range));if(!box.isConnected||request!==generation)return;
      const s=r.summary,c=r.states,service=r.service;
      box.innerHTML=`<div class="sms-service"><span>SMS код: <strong>${service.otp_enabled?'Идэвхтэй':'Идэвхгүй'}</strong></span><span>Захиалгын SMS: <strong>${service.orders_enabled?'Идэвхтэй':'Идэвхгүй'}</strong></span><span>Төрөл: <strong>${esc(service.type)}</strong></span><span>Сүүлд ажилласан: <strong>${esc(when(service.worker_last))}</strong>${service.orders_enabled&&!service.worker_healthy?' · Ажиллагааг шалгана уу':''}</span></div>
        <div class="sms-metrics"><div><small>Нийт хүсэлт</small><strong>${s.total}</strong></div><div><small>Үйлчилгээ хүлээн авсан</small><strong>${c.accepted}</strong></div><div><small>Буцаасан зардал</small><strong>${amount(s.known_cost)}</strong></div><div><small>Хүлээгдэж буй</small><strong>${c.pending+c.sending}</strong></div><div><small>Татгалзсан / тодорхойгүй</small><strong>${c.failed} / ${c.uncertain}</strong></div><div><small>Кодоо баталсан</small><strong>${s.verified}</strong></div></div>
        <p class="sms-note">“Хүлээн авсан” нь SendSMS дараалалд орсныг илэрхийлнэ; утсанд хүрснийг батлахгүй. Зардал нь үйлчилгээний хариунд ирсэн дүн бөгөөд дараах буцаалтыг тусгаагүй. Үнэ тодорхойгүй хүлээн авсан хүсэлт: ${s.unknown_cost}. Хэтэвчийн үлдэгдэл, хүргэлтийн эцсийн төлөвийг SendSMS.mn-ээс харна.</p>
        <p class="muted">Баталгаажуулах SMS-ийн түүх ${esc(when(r.otp_recorded_since))}-ээс бүртгэгдэнэ. Өмнөх OTP хэрэглээ ороогүй. Шүүлт нь хүсэлт үүссэн огноогоор үйлчилнэ.</p>
        <div class="sms-table-wrap"><table class="sms-table"><thead><tr><th>Огноо</th><th>Төрөл</th><th>Утас</th><th>Захиалга</th><th>Төлөв</th><th>Зардал</th></tr></thead><tbody>${r.rows.length?r.rows.map(x=>`<tr><td>${esc(when(x.created))}</td><td>${esc(events[x.event]||x.event)}</td><td>${esc(x.phone_mask)}</td><td>${esc(x.order_id||'—')}</td><td><span class="sms-state sms-state-${Object.hasOwn(states,x.state)?x.state:'uncertain'}">${esc(states[x.state]||x.state)}</span>${x.verified_at?'<small class="sms-verified">Код баталгаажсан</small>':''}</td><td>${x.state==='accepted'?amount(x.cost):'—'}</td></tr>`).join(''):'<tr><td colspan="6" class="muted">Энэ хугацаанд бүртгэгдсэн SMS алга.</td></tr>'}</tbody></table></div>
        <div class="sms-pagination"><button type="button" class="quiet" data-sms-page="${r.page-1}" ${r.page<=1?'disabled':''}>← Өмнөх</button><span>${r.page} / ${r.pages} · ${s.total} хүсэлт</span><button type="button" class="quiet" data-sms-page="${r.page+1}" ${r.page>=r.pages?'disabled':''}>Дараах →</button></div>`;
    }catch(e){if(box.isConnected&&request===generation)box.innerHTML=`<p class="error" role="alert">${esc(e.message)}</p><button class="quiet" type="button" data-sms-retry>Дахин оролдох</button>`;}
  }
  window.AdminExtra.pages.sms={html,load};
  addEventListener('submit',e=>{if(e.target.id!=='sms-range')return;e.preventDefault();const f=new FormData(e.target);range={from:f.get('from'),to:f.get('to'),kind:f.get('kind'),page:1};load();});
  addEventListener('click',e=>{const b=e.target.closest('[data-sms-page],[data-sms-retry]');if(!b||b.disabled)return;if(b.dataset.smsPage)range.page=Number(b.dataset.smsPage);load();});
})();
