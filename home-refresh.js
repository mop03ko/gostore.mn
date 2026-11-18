'use strict';
// Storefront navigation and editorial category tiles reuse the existing catalog URLs and assets.
// No extra supplier requests are needed for these entry points.
(()=>{
 const hub=document.getElementById('home-hub'),header=document.querySelector('.header-main');
 if(!hub||!header||typeof esc!=='function'||document.querySelector('.market-nav'))return;
 const groups=window.GOStoreDiscovery||[],find=id=>groups.find(c=>c.id===id);
 const arrow='<span class="market-arrow" aria-hidden="true">↗</span>';
 const photo=c=>{try{const u=new URL(c?.image||'',location.origin);return u.hostname==='gostore.mn'&&u.pathname.startsWith('/assets/category-images/')?u.pathname:'';}catch{return '';}};
 const nav=document.createElement('nav');nav.className='container market-nav';nav.setAttribute('aria-label','Дэлгүүрийн үндсэн ангилал');
 nav.innerHTML='<div class="market-nav-categories">'+[['tech','Электроник'],['women','Эмэгтэй'],['men','Эрэгтэй'],['kids','Хүүхэд'],['shoes','Гутал'],['beauty','Гоо сайхан'],['home','Гэр ахуй'],['sports','Спорт']].filter(([id])=>find(id)).map(([id,name])=>'<a href="/c/'+id+'">'+esc(name)+'</a>').join('')+'</div><div class="market-nav-tools"><a href="/self-cargo.html">Өөрөө захиалах ↗</a><a href="/help">Тусламж</a></div>';
 header.after(nav);
 const promos=document.createElement('aside');promos.className='market-promos';promos.setAttribute('aria-label','Онцлох сонголтууд');
 promos.innerHTML='<a class="market-promo market-tech" href="/c/tech"><span class="market-promo-copy"><small>ӨДӨР ТУТМЫН ТЕХНОЛОГИ</small><strong>Жижиг зүйлс.<br>Том боломж.</strong><span>Электроник, дагалдах хэрэгсэл</span></span>'+arrow+'<img src="/assets/hero-headphones.webp" width="330" height="220" alt="" decoding="async"></a><a class="market-promo market-living" href="/c/home"><span class="market-promo-copy"><strong>Гэртээ<br>өнгө нэмье.</strong><span>Гэр ахуйн сонголт</span></span>'+arrow+'<img src="/assets/hero-chair.webp" width="520" height="781" alt="" loading="lazy"></a><a class="market-promo market-forward" href="/self-cargo.html"><span class="market-promo-copy"><small>GOSTORE КАРГО</small><strong>Та захиал.<br>Бид хүргэе.</strong><span>Эрээн агуулахын хаягаа аваарай</span></span>'+arrow+'<svg class="market-forward-icon icon" aria-hidden="true"><use href="#i-box"/></svg></a>';
 hub.append(promos);
 const shelf=document.createElement('section');shelf.className='container market-shelf';shelf.setAttribute('aria-label','Зурагтай ангиллууд');
 shelf.innerHTML=[['women','Өөрийн хэв маяг','Өдөр тутмын хувцас'],['shoes','Алхам бүрд','Гутал, пүүз'],['beauty','Өөртөө цаг гарга','Гоо сайхан, арчилгаа'],['bags','Хаашаа ч хамт','Цүнх, үүргэвч'],['kids','Бяцхан ертөнц','Хүүхдийн хувцас'],['kitchen','Гал тогоондоо','Хэрэгтэй бүхнээ']].map(([id,title,caption])=>{const c=find(id),src=photo(c);return c?'<a class="market-tile market-tile-'+id+'" href="/c/'+id+'"><strong>'+title+'</strong><span>'+caption+'</span>'+arrow+(src?'<img src="'+esc(src)+'" width="160" height="160" alt="" loading="lazy" decoding="async">':'')+'</a>':'';}).join('');
 // Shopping comes first; forwarding and pickup remain one click away and in the same DOM.
 document.getElementById('main').prepend(hub);hub.after(shelf);
 const branch=document.getElementById('branch-promo');if(branch)document.getElementById('catalog')?.after(branch);
 document.documentElement.classList.add('marketplace-ready');
})();
// Keep visual overrides on the actual home route, including browser Back / in-place navigation.
(()=>{
 const root=document.documentElement;
 const sync=()=>{const home=/^\/(?:index\.html)?$/.test(location.pathname)&&!/[?&](?:q|category|image)=|[?&](?:filter=saved|sale=11\.11)(?:&|$)/.test(location.search)&&!root.matches('.listing-view,.product-view,.account-view,.store-page-view,.auth-view-open,.eleven-sale-view,.official-stores-view');if(root.classList.contains('home-refresh')!==home)root.classList.toggle('home-refresh',home);};
 sync();new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});addEventListener('popstate',sync);
 document.querySelector('.home-services')?.addEventListener('click',e=>{const button=e.target.closest('[data-home-discovery]');if(!button)return;const tab=document.querySelector('[role="tab"][data-discovery-tab="'+button.dataset.homeDiscovery+'"]');if(!tab)return;tab.click();tab.focus({preventScroll:true});document.querySelector('#discovery-home')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
})();

// Active pickup points use the same addresses as checkout.
Promise.resolve(window.catalogReady).then(()=>{
 // The footer lists every pickup point; its static copy in index.html is replaced when the settings differ.
 {const list=document.querySelector('[data-footer-places]'),all=window.storeServer?.shipping?.pickup_locations||[];
  if(list&&all.length&&typeof esc==='function'){
   const tel=p=>String(p.phone||'').replace(/[^+0-9]/g,'');
   const items=all.map(p=>'<li><strong>'+esc(p.name)+'</strong><address>'+esc(p.address)+'</address>'+(p.hours?'<span>'+esc(p.hours)+'</span>':'')+(tel(p)?'<a href="tel:'+esc(tel(p))+'" aria-label="'+esc(p.name+' руу залгах: '+p.phone)+'">'+esc(p.phone)+'</a>':'')+'</li>').join('');
   const erenhot=list.querySelector('[data-footer-erenhot]')?.outerHTML||'';
   if(list.innerHTML.replace(/>\s+</g,'><').trim()!==items+erenhot)list.innerHTML=items+erenhot;
   const main=all.find(p=>p.location==='ulaanbaatar')||all[0],hours=document.querySelector('[data-footer-hours]'),phone=document.querySelector('[data-footer-phone]');
   if(hours&&main.hours)hours.textContent=main.hours;
   if(phone&&tel(main)){phone.textContent='Утас: '+main.phone;phone.href='tel:'+tel(main);phone.setAttribute('aria-label','GOStore руу залгах: '+main.phone);}
  }}
 const host=document.querySelector('#branch-promo'),cities=['Улаанбаатар','Замын-Үүд','Сайншанд'];
 const branches=(window.storeServer?.shipping?.pickup_locations||[]).filter(p=>cities.includes(p.city)).sort((a,b)=>cities.indexOf(a.city)-cities.indexOf(b.city));
 if(!host||!branches.length)return;
 host.innerHTML='<div class="branch-promo-heading"><div><span class="branch-eyebrow">GOSTORE · БАРАА АВАХ ЦЭГҮҮД</span><h2>Хүлээн авах боломжтой агуулах</h2><p>Захиалга хийхдээ авах салбараа сонгоорой.</p></div><a href="/products" class="button">Бараа үзэж захиалах →</a></div><div class="branch-promo-locations">'+branches.map(p=>'<article><div class="branch-card-heading"><span class="branch-promo-pin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><div><h3>'+esc(p.city)+'</h3><span class="branch-card-kind">Бараа авах агуулах</span></div></div><p class="branch-card-address">'+esc(p.address)+'</p>'+(p.hours?'<p class="branch-card-hours">'+esc(p.hours)+'</p>':'')+(p.phone?'<a class="branch-card-call" aria-label="'+esc(p.city+' салбар руу залгах '+p.phone)+'" href="tel:'+esc(p.phone.replace(/[^+0-9]/g,''))+'"><span>Залгах</span><strong>'+esc(p.phone)+'</strong> ↗</a>':'')+'</article>').join('')+'</div><p class="branch-promo-note">Салбарт ирж, авахад бэлэн болмогц захиалгын төлөвөөс шалгаад бараагаа авна.</p>';
 host.hidden=false;
}).catch(()=>{});
