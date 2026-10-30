'use strict';
(()=>{
 const taxonomy=window.GOStoreDiscovery||[],photo=q=>taxonomy.flatMap(c=>[c,...c.children]).find(c=>c.query===q)?.image||'';
 const image=(src,cls='')=>src?`<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'';
 const products=(items)=>`<div class="discovery-products">${items.map(p=>`<a href="/v/${encodeURIComponent(p.id)}" class="discovery-product">${image(p.image)}<span>${esc(p.name)}</span><strong>${p.mnt?money(p.mnt):p.approx_mnt?'≈ '+money(p.approx_mnt):'Үнэ шалгах'}</strong></a>`).join('')}</div>`;
 async function load(q,free,signal){const params=new URLSearchParams(free?{action:'supplier-free-shipping'}:{action:'supplier-search',q,page:'1',limit:'12'});const r=await fetch('/api/index.php?'+params,{signal,credentials:'omit'});if(!r.ok)throw Error('unavailable');return r.json();}
 // Shared photos replace emoji on the phone home grid, and generic category portraits.
 document.querySelectorAll('#hub-channels [data-hub-category]').forEach(a=>{const c=taxonomy.find(c=>c.id===a.dataset.hubCategory);if(c?.image)a.querySelector('span').innerHTML=image(c.image);});
 const suggestions=document.querySelector('#category-suggestions');let current='',controller;
 function decorateCategories(){
  if(!suggestions)return;const id=suggestions.querySelector('[data-menu-category]')?.dataset.menuCategory;if(!id||current===id)return;current=id;
  controller?.abort();controller=new AbortController();const c=taxonomy.find(c=>c.id===id);if(!c)return;
  const heading=suggestions.querySelector('.category-suggestion-heading img');if(heading){heading.src=c.image||'';heading.hidden=!c.image;}
  const links=[...suggestions.querySelectorAll('[data-menu-query]')];links.forEach((a,n)=>{const src=photo(a.dataset.menuQuery);a.classList.add('category-photo-link');a.innerHTML=image(src)+`<span>${esc(a.textContent)}</span>`;a.hidden=n>=6;});
  if(links.length>6){const more=document.createElement('button');more.type='button';more.className='discovery-more';more.textContent='Цааш үзэх ∨';more.setAttribute('aria-expanded','false');suggestions.querySelector('.category-suggestion-grid').after(more);more.onclick=()=>{const expanded=more.getAttribute('aria-expanded')!=='true';more.setAttribute('aria-expanded',String(expanded));links.forEach((a,n)=>a.hidden=!expanded&&n>=6);more.textContent=expanded?'Хураах ∧':'Цааш үзэх ∨';};}
  const shelf=document.createElement('section');shelf.className='category-recommendations';shelf.innerHTML='<h3>Танд санал болгох</h3><p role="status">Ачаалж байна…</p>';suggestions.append(shelf);suggestions.scrollTop=0;
  const own=controller;
  const run=()=>load(c.query,false,own.signal).then(d=>{if(!own.signal.aborted)shelf.innerHTML='<h3>Танд санал болгох</h3>'+(d.products?.length?products(d.products.slice(0,6)):'<p>Энэ ангилалд бараа олдсонгүй.</p>');}).catch(()=>{if(!own.signal.aborted){shelf.innerHTML='<h3>Танд санал болгох</h3><button type="button" class="discovery-more">Дахин оролдох</button>';shelf.querySelector('button').onclick=run;}});run();
 }
 if(suggestions)new MutationObserver(()=>{if(!suggestions.querySelector('.category-photo-link'))current='';decorateCategories();}).observe(suggestions,{childList:true});
 const flyout=document.querySelector('#hub-flyout');if(flyout)new MutationObserver(()=>{flyout.querySelectorAll('[data-hub-query]:not(.discovery-flyout-photo)').forEach(a=>{a.classList.add('discovery-flyout-photo');a.insertAdjacentHTML('afterbegin',image(photo(a.dataset.hubQuery)));});}).observe(flyout,{childList:true});
 const hub=document.querySelector('#home-hub');if(!hub)return;
 const section=document.createElement('section');section.className='discovery-home page-width';section.setAttribute('aria-label','Барааны сонголтууд');
 const tabs=[['explore','Танд зориулсан'],['free','0¥ хүргэлт'],['fashion','Хувцас'],['home','Гэр ахуй'],['tech','Технологи']];
 section.innerHTML=`<div class="discovery-tabs" role="tablist">${tabs.map(([id,label])=>`<button type="button" role="tab" data-discovery-tab="${id}" aria-selected="${id==='explore'}">${label}</button>`).join('')}</div><div class="discovery-panel" role="tabpanel"></div>`;hub.after(section);
 const panel=section.querySelector('.discovery-panel');let request;
 const freeNote='Эрээн агуулах хүртэлх лавлах үнэ 0¥. Монгол хүртэлх тээвэр тусдаа; сонгосон хувилбар, тоо ширхэгийн эцсийн хүргэлтийг сагсанд шалгана.';
 function select(tab){
  request?.abort();request=new AbortController();const own=request;
  section.querySelectorAll('[data-discovery-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.discoveryTab===tab)));
  if(tab==='explore'){
   panel.innerHTML=`<div class="discovery-collections">${[['women','Өөрийн хэв маяг'],['home','Тухтай гэр'],['tech','Өдөр тутмын технологи']].map(([id,title])=>{const c=taxonomy.find(c=>c.id===id);return `<a href="/?category=${id}#catalog" data-discovery-query="${esc(c.query)}"><div><h3>${title}</h3><p>Сонголтоо нээгээрэй ›</p></div>${image(c.image)}</a>`;}).join('')}</div><div class="discovery-category-strip">${taxonomy.slice(0,12).map(c=>`<a href="/?category=${c.id}#catalog" data-discovery-query="${esc(c.query)}">${image(c.image)}<span>${esc(c.name)}</span></a>`).join('')}</div><button type="button" class="discovery-free-banner" data-discovery-tab="free">${icon('truck')}<span><strong>Хятад дотор 0¥ хүргэлт</strong><small>Эрээн хүртэл · Монголын тээвэр тусдаа</small></span><b>Үзэх ›</b></button>`;return;
  }
  const free=tab==='free',title=free?'Хятад дотор үнэгүй хүргэлт':'Танд санал болгох',q=tab==='fashion'?'women clothing':tab==='tech'?'electronics':'home storage';
  panel.innerHTML=`<h2>${title}</h2>${free?`<p class="discovery-note">${freeNote}</p>`:''}<div class="discovery-results" aria-live="polite"><p>Ачаалж байна…</p></div>`;
  const target=panel.querySelector('.discovery-results');
  const run=()=>{target.innerHTML='<p>Ачаалж байна…</p>';load(q,free,own.signal).then(d=>{if(own.signal.aborted)return;target.innerHTML=d.products?.length?products(d.products.slice(0,8)):`<p class="discovery-empty">${free?d.status==='available'?'Одоогоор 0¥ хүргэлттэй бараа олдсонгүй.':'Үнэгүй хүргэлттэй барааны мэдээлэл түр боломжгүй байна.':'Бараа олдсонгүй.'}</p>`;}).catch(()=>{if(!own.signal.aborted){target.innerHTML='<button type="button" class="discovery-more">Ачаалж чадсангүй. Дахин оролдох</button>';target.querySelector('button').onclick=run;}});};run();
 }
 section.addEventListener('click',e=>{const tab=e.target.closest('[data-discovery-tab]');if(tab){select(tab.dataset.discoveryTab);return;}const a=e.target.closest('[data-discovery-query]');if(a&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&window.supplierBrowse){e.preventDefault();window.supplierBrowse(a.dataset.discoveryQuery);scrollCatalog();}});
 section.querySelector('[role=tablist]').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const list=[...section.querySelectorAll('[role=tab]')],i=list.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const next=list[(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length];next.focus();select(next.dataset.discoveryTab);});
 select('explore');
})();
