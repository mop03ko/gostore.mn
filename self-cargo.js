'use strict';
(()=>{
  const root=document.getElementById('self-cargo');
  // Discoverable entry on the storefront without changing its compiled bundle.
  if(!root){
    const host=document.querySelector('footer .footer-main > div:nth-child(3)');
    if(host){const a=document.createElement('a');a.href='/self-cargo.html';a.textContent='Өөрөө захиалах · Эрээн карго';a.style.display='block';a.style.marginTop='12px';host.append(a);}
    if(location.pathname==='/'||location.pathname.startsWith('/account')){
      const main=document.querySelector('#account-page')||document.querySelector('main');
      if(main){
        const entry=()=>{if(main.querySelector('#self-cargo-entry'))return;const card=document.createElement('div');card.id='self-cargo-entry';card.className='container info-box';card.style.margin='20px auto';card.innerHTML='<strong>Хятадаас өөрөө захиалдаг уу?</strong><p>Эрээн агуулахын хаяг авч, өөрийн ачаагаа бүртгэн тээвэрлүүлээрэй.</p><a class="button outline" href="/self-cargo.html">Өөрөө захиалах →</a>';main.prepend(card);};
        entry();if(main.id==='account-page')new MutationObserver(entry).observe(main,{childList:true});
      }
    }return;
  }
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let csrf='',owner='',orders=[],delivery=null;
  async function api(action,body){
    const response=await fetch('/api/index.php?action='+action,{credentials:'same-origin',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},body:body?JSON.stringify(body):undefined});
    const data=await response.json();if(data.csrf)csrf=data.csrf;if(!response.ok)throw Error(data.error||'Хүсэлт амжилтгүй.');return data;
  }
  const statuses={confirmed:'Бүртгэгдсэн · хүргэлтийн дугаар хүлээж байна',shipping:'Эрээн рүү хүргэгдэж байна',erenhot:'Эрээн агуулахад ирсэн',erenhot_ready:'Улаанбаатар руу гарахад бэлэн',erenhot_dispatched:'Эрээнээс Замын-Үүд рүү илгээсэн',zamyn_uud:'Замын-Үүдэд ирсэн',ulaanbaatar_unsorted:'Улаанбаатарт ангилж байна',ulaanbaatar:'Улаанбаатар агуулахад ирсэн',ready_pickup:'Ирж авахад бэлэн',ready_delivery:'Хүргэлтэд бэлэн',out_for_delivery:'Хүргэлтээр гарсан',completed:'Хүлээлгэн өгсөн',cancelled:'Цуцлагдсан'};
  const trackingFields='<div class="sc-grid"><label>Хятадын хүргэлтийн дугаар<input name="number" minlength="6" maxlength="40" pattern="[A-Za-z0-9-]{6,40}" autocomplete="off" required placeholder="Жишээ: YT1234567890123"></label><label>Хүргэлтийн компани<input name="company" maxlength="80" placeholder="Жишээ: 圆通 / YTO"></label></div>';
  function card(o){return `<article class="sc-card" data-order="${escape(o.id)}"><div class="sc-actions"><strong class="sc-code">${escape(o.id)}</strong><span class="sc-status">${escape(statuses[o.status]||o.status)}</span></div><h3>${escape(o.title)}</h3><p>${o.items?.[0]?.qty||0} ширхэг · Өөрөө худалдан авсан бараа</p><details ${['confirmed','shipping'].includes(o.status)?'open':''}><summary>Худалдагчид өгөх хаяг</summary><p class="sc-muted">Хаягт байгаа кодыг өөрчлөхгүй. Өмнө бүртгэсэн ачааны хаяг хэвээр хадгалагдана.</p><pre>${escape(o.warehouse?.label)}</pre><button type="button" data-copy="${escape(o.id)}">Хаяг хуулах</button></details><p>Бүртгэсэн хүргэлт: ${(o.inbound?.numbers||[]).map(n=>escape(n.no)+' '+escape(n.company)).join(' · ')||'Дугаар хараахан нэмээгүй'}</p>${['confirmed','shipping'].includes(o.status)?`<details><summary>Хүргэлтийн дугаар нэмэх</summary><form data-tracking="${escape(o.id)}">${trackingFields}<p role="alert" class="sc-error"></p><button>Дугаар хадгалах</button></form></details>`:''}<p>${o.cargo?.billing?.finalized?'Тээврийн үлдэгдэл: '+Number(o.cargo.billing.due).toLocaleString()+'₮':'Тээврийн үнийг агуулахад жигнэж, хэмжсэний дараа батална.'}</p><a href="/account/orders">Явц, агуулахын зураг, төлбөр харах →</a></article>`;}
  function addressCard(){
    const rows=[['cargo_id','Таны карго ID'],['recipient','Хүлээн авагч'],['phone','Утасны дугаар'],['address','Хаяг']];
    return '<section class="sc-card sc-address" aria-label="Агуулахын хаяг"><div class="sc-actions sc-section-title"><h2>Эрээн агуулах</h2><button type="button" class="sc-primary" data-field="label">Бүгдийг хуулах ⧉</button></div><dl>'+rows.map(([key,label])=>'<div class="sc-address-row"><dt>'+label+'</dt><dd class="'+(key==='cargo_id'?'sc-cargo-id':'')+'">'+escape(delivery[key])+'</dd><button type="button" class="sc-copy" data-field="'+key+'" aria-label="'+label+' хуулах">⧉</button></div>').join('')+'</dl><p id="sc-copy-status" role="status" aria-live="polite">Энэ ID таны бүх ачаанд тогтмол ашиглагдана.</p><p class="sc-muted">Хаяг болон хүлээн авагчийн нэр дэх карго ID-г хэвээр үлдээгээрэй.</p></section>';
  }
  async function render(){
    const me=await api('customer-me');owner=me.customer?.id||'';
    const intro='<section class="sc-hero"><span class="sc-eyebrow">GOSTORE КАРГО · ЭРЭЭН → УЛААНБААТАР</span><h1>Та захиал, бид тээвэрлэе.</h1><p>Хятадаас өөрөө худалдан аваад<br>өөрийн карго ID-гаар хүлээн аваарай.</p><a class="sc-guide-link" href="#sc-guide">Хэрхэн эхлэх вэ? <span>↗</span></a><span class="sc-parcel" aria-hidden="true">▱</span></section>';

    if(!owner){root.innerHTML=intro.replace('href="#sc-guide"','href="/login?next=%2Fself-cargo.html"')+'<section class="sc-card"><h2>Эхлээд нэвтэрнэ үү</h2><p>Ачааг таны бүртгэлтэй холбоно. Нэвтэрсний дараа ачаагаа бүртгэнэ.</p><a class="sc-button" href="/login?next=%2Fself-cargo.html">Нэвтрэх / Бүртгүүлэх</a></section>';return;}
    const data=await api('customer-self-cargo');orders=data.orders;delivery=data.delivery;
    root.innerHTML=intro+addressCard()+`<details id="sc-guide" class="sc-card sc-guide"><summary>Хэрхэн эхлэх вэ?</summary><ol><li>Тогтмол карго ID-тай агуулахын хаягаа хуулна.</li><li>Худалдан авах платформдоо хүргэлтийн хаягаар оруулна.</li><li>Ачаагаа энд бүртгэж, худалдагчаас өгсөн хүргэлтийн дугаарыг нэмнэ.</li><li>Ирсэн ачааны зураг, явцыг хянаж тээврийн төлбөрөө төлнө.</li></ol></details><div class="sc-actions sc-section-title"><h2>Миний ачаа <span class="sc-count">${orders.length}</span></h2><a href="#sc-new">+ Ачаа бүртгэх</a></div><section id="sc-new" class="sc-card"><h2>Шинэ ачаа бүртгэх</h2><p class="sc-muted">GOStore барааны үнийг авахгүй. Худалдагчийн төлбөр, Хятад доторх хүргэлтийг та өөрөө төлнө. Энэ бүртгэл худалдагчид худалдан авах захиалга илгээхгүй.</p><form id="self-cargo-create"><label>Барааны нэр<input name="title" maxlength="200" required placeholder="Жишээ: Өвлийн гутал"></label><div class="sc-grid"><label>Нийт барааны тоо ширхэг<input name="qty" type="number" min="1" max="10000" step="1" value="1" required></label><label>Таны холбоо барих утас<input name="phone" type="tel" maxlength="30" value="${escape(me.customer.phone)}" required></label></div><label>Тайлбар / өнгө / хэмжээ<textarea name="note" maxlength="500" rows="2"></textarea></label><p role="alert" class="sc-error"></p><button class="sc-primary">Ачаа бүртгэх</button></form></section><div class="sc-actions"><h2>Миний өөрөө захиалсан ачаа</h2><button type="button" id="sc-refresh">Шинэчлэх</button></div><div id="sc-orders">${orders.length?orders.map(card).join(''):'<p>Одоогоор ачаа бүртгээгүй байна.</p>'}</div>`;
  }
  root.addEventListener('submit',async event=>{
    const form=event.target;if(!form.matches('#self-cargo-create,[data-tracking]'))return;event.preventDefault();
    const button=form.querySelector('button'),error=form.querySelector('[role=alert]');button.disabled=true;error.textContent='';
    try{
      const me=await api('customer-me');if(me.customer?.id!==owner){await render();return;}
      const body=Object.fromEntries(new FormData(form));let action='customer-self-cargo-tracking';
      if(form.id==='self-cargo-create'){action='customer-self-cargo-create';form.dataset.key||=crypto.randomUUID();body.request_key=form.dataset.key;body.qty=Number(body.qty);}else body.id=form.dataset.tracking;
      const result=await api(action,body);await render();document.querySelector('[data-order="'+result.order.id+'"]')?.scrollIntoView({behavior:'smooth'});
    }catch(e){error.textContent=e.message;}finally{button.disabled=false;}
  });
  root.addEventListener('click',async event=>{
    if(event.target.closest('.sc-guide-link')){const guide=document.getElementById('sc-guide');if(guide)guide.open=true;}
    const b=event.target.closest('[data-copy],[data-field],#sc-refresh');if(!b)return;
    if(b.id==='sc-refresh'){await render().catch(e=>alert(e.message));return;}
    try{const text=b.dataset.field?delivery?.[b.dataset.field]:orders.find(o=>o.id===b.dataset.copy)?.warehouse.label;if(!text)throw Error('Missing address');await navigator.clipboard.writeText(text);document.getElementById('sc-copy-status').textContent='Хууллаа ✓';}catch{document.getElementById('sc-copy-status').textContent='Хуулж чадсангүй. Текстийг сонгож хуулна уу.';}
  });
  render().catch(e=>{root.innerHTML='<h1>Ачаа бүртгэх</h1><p role="alert">'+escape(e.message)+'</p><button onclick="location.reload()">Дахин оролдох</button>';});
})();
