'use strict';
// «Миний бүртгэл» page (/account/<section>): orders by stage, ordered products, saved items,
// address book, notifications and personal details. Login and registration stay in the modal.
(()=>{
  const match=location.pathname.match(/^\/account(?:\/([a-z]+))?\/?$/);
  const sections={orders:'Миний захиалгууд',products:'Миний бүтээгдэхүүнүүд',saved:'Хадгалсан бараа',addresses:'Хаягууд',notifications:'Мэдэгдэл',profile:'Хувийн мэдээлэл'};
  const go=section=>{if(window.accountPage.active){window.accountPage.show(section);return;}location.assign('/account'+(section&&section!=='orders'?'/'+section:''));};
  window.accountPage={active:!!match,go,show:()=>{}};
  if(!match)return;
  const groups={all:'Бүгд',payment:'Төлбөр хүлээж буй',transit:'Замд / Бэлтгэж байна',ready:'Авах / Хүргүүлэх',done:'Хүлээн авсан',cancelled:'Цуцлагдсан'};
  const status=new URLSearchParams(location.search).get('status');
  let section=sections[match[1]]?match[1]:'orders',orders=null,filter=Object.hasOwn(groups,status)?status:'all',query='',editing=null;
  const root=document.createElement('section');root.id='account-page';root.className='container account-page';document.querySelector('#main').prepend(root);
  document.title='Миний бүртгэл · gostore.mn';
  const content=()=>root.querySelector('#account-content');
  const date=v=>v?new Date(v).toLocaleDateString('mn-MN'):'';
  const empty=(title,text,action='')=>`<div class="account-empty">${icon('box')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
  const productHref=id=>'/v/'+encodeURIComponent(id.replace(/^abb-/,''));

  async function allOrders(){
    const list=[];for(let offset=0;offset<200;offset+=20){const r=await shopApi('customer-orders&offset='+offset);list.push(...r.orders);if(!r.more)break;}
    return list;
  }
  function layout(){
    const u=customerAccount.user,payment=(orders||[]).filter(o=>cargoGroup(o)==='payment').length;
    root.innerHTML=`<nav class="pd-breadcrumb" aria-label="Байршил"><a href="/">Нүүр</a><span>/</span><span>Миний бүртгэл</span></nav><h1 class="account-title">Миний бүртгэл</h1><div class="account-layout"><aside class="account-side"><div class="account-summary"><span class="account-avatar" aria-hidden="true">${esc(Array.from(u.name)[0]||'G')}</span><div><h3>${esc(u.name)}</h3><p>${esc(u.phone||u.email)}</p></div></div><div class="account-stats"><div><strong>${orders?orders.length:'–'}</strong><small>Захиалга</small></div><div><strong>${orders?payment:'–'}</strong><small>Төлбөр хүлээж буй</small></div><div><strong>${window.supplierFavoriteCount?.()??0}</strong><small>Хадгалсан</small></div></div><nav class="account-menu" aria-label="Миний бүртгэлийн цэс">${Object.entries(sections).map(([k,v])=>`<button type="button" data-account-section="${k}" ${k===section?'aria-current="page"':''}>${esc(v)}${k==='orders'&&payment?`<b>${payment}</b>`:''}</button>`).join('')}<button type="button" class="account-logout" data-customer-logout>Гарах</button></nav></aside><div class="account-content" id="account-content" tabindex="-1"></div></div>`;
  }
  async function render(){
    const box=content();box.innerHTML=`<h2>${esc(sections[section])}</h2><p class="account-loading">Ачаалж байна…</p>`;
    try{
      if(section==='orders'){orders=await allOrders();layout();renderOrders();return;}
      if(section==='products'){const {products}=await shopApi('customer-products');box.innerHTML=`<h2>${sections.products}</h2>`+(products.length?`<div class="account-products">${products.map(p=>`<article class="account-product">${p.image?`<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span class="account-product-image">${icon('box')}</span>`}<div><h3>${p.supplier?`<a href="${productHref(p.id)}">${esc(p.name)}</a>`:esc(p.name)}</h3><p>${esc(p.variant)}${p.qty?' · '+p.qty+' ширхэг':''}</p><small>${date(p.ordered_at)} · ${esc(p.order_id)}${p.times>1?` · ${p.times} удаа захиалсан`:''}</small></div>${p.supplier?`<a class="button outline" href="${productHref(p.id)}">Дахин захиалах</a>`:''}</article>`).join('')}</div>`:empty('Захиалсан бараа алга','Захиалга хийсний дараа бараанууд энд харагдана.','<a class="button blue" href="/#catalog">Бараа үзэх</a>'));return;}
      if(section==='saved'){const items=typeof supplierFavoriteItems==='function'?supplierFavoriteItems():[];box.innerHTML=`<h2>${sections.saved}</h2>`+(items.length?`<div class="account-products">${items.map(p=>`<article class="account-product">${/^https:\/\//i.test(p.image||'')?`<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span class="account-product-image">${icon('heart')}</span>`}<div><h3><a href="${productHref(p.id)}">${esc(p.name)}</a></h3><p>${Number(p.mnt)>0?money(p.mnt):'Үнийг барааны хуудаснаас шалгана'}</p></div><a class="button outline" href="${productHref(p.id)}">Харах</a></article>`).join('')}</div>`:empty('Хадгалсан бараа алга','Барааны зүрхэн тэмдгийг дарж хадгалаарай.','<a class="button blue" href="/#catalog">Бараа үзэх</a>'));return;}
      if(section==='addresses'){const {addresses}=await shopApi('customer-addresses');renderAddresses(addresses);return;}
      if(section==='notifications'){const r=await shopApi('customer-notifications');box.innerHTML=`<h2>${sections.notifications}</h2>`+(r.notifications.length?`<ol class="account-notices">${r.notifications.map(n=>`<li class="${n.read_at?'':'unread'}"><button type="button" data-server-order="${esc(n.order_id)}"><strong>${esc(n.order_id)}</strong><span>${esc(n.message)}</span><small>${new Date(n.created).toLocaleString('mn-MN')}</small></button></li>`).join('')}</ol>`:empty('Мэдэгдэл алга','Захиалгын явц өөрчлөгдөхөд энд мэдэгдэнэ.'));
        if(r.unread&&r.notifications.length)shopApi('customer-notifications-read',{through_id:Math.max(...r.notifications.map(n=>Number(n.id)))}).then(()=>window.refreshCargoNotifications?.()).catch(()=>{});return;}
      const u=customerAccount.user;
      box.innerHTML=`<h2>${sections.profile}</h2><form id="account-profile-form" class="account-form account-card"><div class="form-grid"><label class="field">Таны нэр<input name="name" value="${esc(u.name)}" autocomplete="name" maxlength="100" required></label><label class="field">Утасны дугаар<input name="phone" value="${esc(u.phone)}" type="tel" autocomplete="tel" maxlength="25"></label><label class="field full">Имэйл<input value="${esc(u.email)}" disabled></label></div><p class="form-error" data-account-error role="alert"></p><button class="button blue" type="submit">Мэдээлэл хадгалах</button></form><h3 class="account-subtitle">Нууц үг солих</h3><form id="account-password-form" class="account-form account-card"><div class="form-grid"><label class="field full">Одоогийн нууц үг<input name="current_password" type="password" autocomplete="current-password" maxlength="72" required></label><label class="field">Шинэ нууц үг<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="72" required></label><label class="field">Шинэ нууц үг давтах<input name="password_confirm" type="password" autocomplete="new-password" minlength="10" maxlength="72" required></label></div><p class="account-hint">Нууц үг солиход бусад төхөөрөмжөөс дахин нэвтрэх шаардлагатай болно.</p><p class="form-error" data-account-error role="alert"></p><button class="button outline" type="submit">Нууц үг солих</button></form>`;
    }catch(e){box.innerHTML=`<h2>${esc(sections[section])}</h2><p class="form-error" role="alert">${esc(e.message)}</p><button class="button outline" data-account-section="${section}">Дахин оролдох</button>`;}
  }
  function renderOrders(){
    const counts=Object.fromEntries(Object.keys(groups).map(k=>[k,k==='all'?orders.length:orders.filter(o=>cargoGroup(o)===k).length]));
    const rows=orders.filter(o=>(filter==='all'||cargoGroup(o)===filter)&&(!query||(o.id+' '+o.title).toLowerCase().includes(query.toLowerCase())));
    content().innerHTML=`<h2>${sections.orders}</h2><div class="account-tabs-row" role="tablist" aria-label="Захиалгын төлөв">${Object.entries(groups).map(([k,v])=>`<button type="button" role="tab" data-account-filter="${k}" aria-selected="${k===filter}">${esc(v)}<span>${counts[k]}</span></button>`).join('')}</div><label class="field account-search">Код эсвэл барааны нэрээр хайх<input id="account-order-search" value="${esc(query)}" placeholder="GS-A1B2C3" autocomplete="off"></label><div class="account-orders">${rows.length?rows.map(o=>`<article class="cargo-card account-order"><div><span class="cargo-code">${esc(o.id)}</span><span class="cargo-status">${esc(orderStatusLabel(o))}</span></div><h3>${esc(o.title)}</h3><p>${esc(cargoNext(o))}</p><div class="cargo-card-footer"><small>${cargoDate(o.created,true)}${o.amount?' · '+money(o.amount):''}</small><span class="account-order-actions">${cargoGroup(o)==='payment'&&o.status==='quoted'&&!o.paid&&qpayEnabled?`<button class="button blue" data-invoice="${esc(o.id)}">Төлөх</button>`:''}<button class="text-button" data-server-order="${esc(o.id)}">Дэлгэрэнгүй →</button></span></div></article>`).join(''):empty(orders.length?'Тохирох захиалга алга':'Захиалга олдсонгүй',orders.length?'Өөр төлөв эсвэл кодоор хайна уу.':'Танд одоогоор захиалга байхгүй байна.',orders.length?'':'<a class="button blue" href="/#catalog">Бараа үзэх</a>')}</div>`;
  }
  function renderAddresses(addresses){
    const form=a=>`<form id="account-address-form" class="account-form account-card" data-id="${esc(a?.id||'')}"><h3>${a?'Хаяг засах':'Шинэ хаяг'}</h3><div class="form-grid"><label class="field">Нэр (жишээ: Гэр, Ажил)<input name="label" value="${esc(a?.label||'')}" maxlength="40" placeholder="Гэр"></label><label class="field">Хүлээн авагч<input name="recipient" value="${esc(a?.recipient||customerAccount.user.name)}" maxlength="100" autocomplete="name" required></label><label class="field">Утас<input name="phone" value="${esc(a?.phone||customerAccount.user.phone)}" type="tel" maxlength="25" autocomplete="tel" required></label><label class="field full">Хаяг<textarea name="address" maxlength="500" autocomplete="street-address" placeholder="Дүүрэг, хороо, байр, орц, тоот" required>${esc(a?.address||'')}</textarea></label><label class="check full"><input type="checkbox" name="is_default" ${a?.is_default||!addresses.length?'checked':''}> Үндсэн хаяг болгох</label></div><p class="form-error" data-account-error role="alert"></p><div class="form-actions"><button class="button blue" type="submit">Хадгалах</button><button class="button outline" type="button" data-address-cancel>Болих</button></div></form>`;
    content().innerHTML=`<h2>${sections.addresses}</h2><p class="account-hint">Хүргэлтээр авах үед эдгээр хаягаас сонгоно. Бараагаа Улаанбаатар агуулахаас авах бол хаяг шаардлагагүй.</p>${addresses.length?`<div class="account-addresses">${addresses.map(a=>`<article class="account-card account-address${a.is_default?' default':''}"><div><strong>${esc(a.label)}</strong>${a.is_default?'<span class="tag">Үндсэн</span>':''}</div><p>${esc(a.recipient)} · ${esc(a.phone)}</p><p class="account-address-text">${esc(a.address)}</p><div class="account-address-actions"><button type="button" class="text-button" data-address-edit="${esc(a.id)}">Засах</button>${a.is_default?'':`<button type="button" class="text-button" data-address-default="${esc(a.id)}">Үндсэн болгох</button>`}<button type="button" class="text-button danger" data-address-delete="${esc(a.id)}">Устгах</button></div></article>`).join('')}</div>`:''}${editing!==null?form(addresses.find(a=>a.id===editing)):addresses.length<10?`<button type="button" class="button outline" data-address-new>+ Шинэ хаяг нэмэх</button>`:''}${!addresses.length&&editing===null?empty('Хадгалсан хаяг алга','Хүргэлтийн хаягаа нэмбэл захиалахдаа дахин бичих шаардлагагүй.'):''}`;
    content().dataset.addresses=JSON.stringify(addresses);
  }
  function show(next){
    section=sections[next]?next:'orders';editing=null;
    history.pushState(null,'','/account'+(section==='orders'?'':'/'+section));
    root.querySelectorAll('[data-account-section]').forEach(b=>{if(b.dataset.accountSection===section)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    render();content()?.focus({preventScroll:true});
  }
  async function start(){
    root.innerHTML='<p class="account-loading">Ачаалж байна…</p>';
    await window.catalogReady;
    try{await customerAccount.refresh();}catch{}
    if(!customerAccount.user){root.innerHTML=`<nav class="pd-breadcrumb" aria-label="Байршил"><a href="/">Нүүр</a><span>/</span><span>Миний бүртгэл</span></nav><h1 class="account-title">Миний бүртгэл</h1>${empty('Нэвтэрч орно уу','Захиалга, хаяг, хадгалсан бараагаа харахын тулд бүртгэлээрээ нэвтэрнэ үү.','<div class="form-actions"><button class="button blue" data-action="account">Нэвтрэх</button><button class="button outline" data-account-register>Бүртгүүлэх</button></div>')}`;return;}
    layout();render();
  }
  window.accountPage.show=show;
  window.addEventListener('popstate',()=>{const m=location.pathname.match(/^\/account(?:\/([a-z]+))?\/?$/);if(!m)return;section=sections[m[1]]?m[1]:'orders';editing=null;if(customerAccount.user){layout();render();}});
  root.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.accountSection){show(b.dataset.accountSection);return;}
    if(b.hasAttribute('data-account-register')){accountForm('register');return;}
    if(b.dataset.accountFilter){filter=b.dataset.accountFilter;renderOrders();return;}
    const list=()=>JSON.parse(content().dataset.addresses||'[]');
    if(b.hasAttribute('data-address-new')){editing='';renderAddresses(list());content().querySelector('#account-address-form [name=label]').focus();return;}
    if(b.dataset.addressEdit){editing=b.dataset.addressEdit;renderAddresses(list());return;}
    if(b.hasAttribute('data-address-cancel')){editing=null;renderAddresses(list());return;}
    try{
      if(b.dataset.addressDefault){const a=list().find(x=>x.id===b.dataset.addressDefault);b.disabled=true;renderAddresses((await shopApi('customer-address-save',{...a,is_default:true})).addresses);await customerAccount.refresh();toast('Үндсэн хаяг солигдлоо');}
      if(b.dataset.addressDelete){if(!confirm('Энэ хаягийг устгах уу?'))return;b.disabled=true;renderAddresses((await shopApi('customer-address-delete',{id:b.dataset.addressDelete})).addresses);await customerAccount.refresh();toast('Хаяг устгагдлаа');}
    }catch(err){toast(err.message);b.disabled=false;}
  });
  root.addEventListener('input',e=>{if(e.target.id==='account-order-search'){query=e.target.value.trim();const pos=e.target.selectionStart;renderOrders();const input=root.querySelector('#account-order-search');input.focus();input.setSelectionRange(pos,pos);}});
  root.addEventListener('submit',async e=>{
    const f=e.target;if(!['account-profile-form','account-password-form','account-address-form'].includes(f.id))return;
    e.preventDefault();const button=f.querySelector('[type=submit]'),error=f.querySelector('[data-account-error]');button.disabled=true;if(error)error.textContent='';
    try{
      const b=Object.fromEntries(new FormData(f));
      if(f.id==='account-profile-form'){customerAccount.setUser((await shopApi('customer-profile',{name:b.name,phone:b.phone})).customer);layout();render();toast('Мэдээлэл хадгалагдлаа');}
      else if(f.id==='account-password-form'){if(b.password!==b.password_confirm)throw Error('Нууц үгийн давталт таарахгүй байна.');await shopApi('customer-password',b);f.reset();toast('Нууц үг шинэчлэгдлээ');}
      else{const saved=await shopApi('customer-address-save',{id:f.dataset.id||'',label:b.label,recipient:b.recipient,phone:b.phone,address:b.address,is_default:f.elements.is_default.checked});editing=null;renderAddresses(saved.addresses);await customerAccount.refresh();toast('Хаяг хадгалагдлаа');}
    }catch(err){if(error)error.textContent=err.message;else toast(err.message);}
    finally{button.disabled=false;}
  });
  // Signing in or out elsewhere (modal, another tab) redraws the page for the current account.
  const setUser=customerAccount.setUser;customerAccount.setUser=user=>{const changed=(customerAccount.user?.id||null)!==(user?.id||null);setUser(user);if(changed){orders=null;start();}};
  start();
})();
