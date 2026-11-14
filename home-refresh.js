'use strict';
// Keep visual overrides on the actual home route, including browser Back / in-place navigation.
(()=>{
 const root=document.documentElement;
 const sync=()=>{const home=/^\/(?:index\.html)?$/.test(location.pathname)&&!/[?&](?:q|category|image)=|[?&](?:filter=saved|sale=11\.11)(?:&|$)/.test(location.search)&&!root.matches('.listing-view,.product-view,.account-view,.store-page-view,.auth-view-open,.eleven-sale-view,.official-stores-view');if(root.classList.contains('home-refresh')!==home)root.classList.toggle('home-refresh',home);};
 sync();new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});addEventListener('popstate',sync);
 document.querySelector('.home-services')?.addEventListener('click',e=>{const button=e.target.closest('[data-home-discovery]');if(!button)return;const tab=document.querySelector('[role="tab"][data-discovery-tab="'+button.dataset.homeDiscovery+'"]');if(!tab)return;tab.click();tab.focus({preventScroll:true});document.querySelector('#discovery-home')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
})();

// Active pickup points use the same addresses as checkout.
Promise.resolve(window.catalogReady).then(()=>{
 const host=document.querySelector('#branch-promo'),cities=['Улаанбаатар','Замын-Үүд','Сайншанд'];
 const branches=(window.storeServer?.shipping?.pickup_locations||[]).filter(p=>cities.includes(p.city)).sort((a,b)=>cities.indexOf(a.city)-cities.indexOf(b.city));
 if(!host||!branches.length)return;
 host.innerHTML='<div class="branch-promo-heading"><div><span class="branch-eyebrow">GOSTORE · БАРАА АВАХ ЦЭГҮҮД</span><h2>Танд ойр '+branches.length+' агуулах</h2><p>Захиалга хийхдээ авах салбараа сонгоорой.</p></div><a href="/products" class="button">Бараа үзэж захиалах →</a></div><div class="branch-promo-locations">'+branches.map(p=>'<article><div class="branch-card-heading"><span class="branch-promo-pin" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><div><h3>'+esc(p.city)+'</h3><span class="branch-card-kind">Бараа авах агуулах</span></div></div><p class="branch-card-address">'+esc(p.address)+'</p>'+(p.hours?'<p class="branch-card-hours">'+esc(p.hours)+'</p>':'')+(p.phone?'<a class="branch-card-call" aria-label="'+esc(p.city+' салбар руу залгах '+p.phone)+'" href="tel:'+esc(p.phone.replace(/[^+0-9]/g,''))+'"><span>Залгах</span><strong>'+esc(p.phone)+'</strong> ↗</a>':'')+'</article>').join('')+'</div><p class="branch-promo-note">Салбарт ирж, авахад бэлэн болмогц захиалгын төлөвөөс шалгаад бараагаа авна.</p>';
 host.hidden=false;
}).catch(()=>{});
