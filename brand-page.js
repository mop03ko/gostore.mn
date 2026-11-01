'use strict';
// Brand selections are checked against supplier brand attributes on the server.
const storefrontMatch=location.pathname.match(/^\/brands\/([a-z]+)\/?$/);
const storefrontBrand=window.supplierBrands?.find(b=>b.id===storefrontMatch?.[1]);
window.brandStorefront=storefrontBrand?.id||'';
(()=>{
  if(!window.brandStorefront)return;
  const {id,name}=storefrontBrand,path=window.supplierBrandHref(id);
  document.title=name+' — Брэндийн дэлгүүр | GOStore';
  document.querySelector('meta[name="description"]').content=name+' брэндийн сонгосон бараа, үнийг GOStore дотроо үзэж, Монголд захиалаарай.';
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href='https://gostore.mn'+path;document.head.append(canonical);
  const section=document.createElement('section');section.id='brand-storefront';section.className='container storefront-page';section.dataset.brand=id;section.setAttribute('aria-labelledby','storefront-title');
  section.innerHTML=`
    <nav class="storefront-breadcrumb" aria-label="Хуудасны зам"><a href="/">Нүүр</a><span aria-hidden="true">/</span><a href="/#brands">Брэндүүд</a><span aria-hidden="true">/</span><span aria-current="page">${esc(name)}</span></nav>
    <div class="storefront-store-heading"><div class="storefront-store-identity"><span class="storefront-logo-tile"><img src="/assets/brands/${id}.svg" alt="${esc(name)}" width="64" height="48"></span><div><span class="section-kicker">GOSTORE · БРЭНДИЙН СОНГОЛТ</span><h1 id="storefront-title">${esc(name)}</h1><p data-brand-store-name>Дэлгүүрийн үнэлгээ 4.7+</p></div></div><a class="storefront-source-link" data-brand-source hidden target="_blank" rel="noopener noreferrer">Flagship дэлгүүрийг Tmall дээр үзэх ↗</a></div>
    <p class="storefront-intro">Брэндийн үзүүлэлт тохирсон, дэлгүүрийн үнэлгээ 4.7/5-аас дээш, үнэ болон үлдэгдэлтэй барааны сонголт. Нийлүүлэгчийн мэдээлэлд тулгуурласан; жинхэнэ эсэх, чанарын баталгаа биш.</p>`;
  const catalog=document.querySelector('#catalog');catalog.before(section);
  catalog.querySelector('.section-kicker').textContent=name.toUpperCase()+' / БРЭНДИЙН СОНГОЛТ';
  const tabs=document.createElement('nav');tabs.className='storefront-catalog-tabs';tabs.setAttribute('aria-label',name+' барааны сонголт');
  tabs.innerHTML=[['default','Бүх бараа'],['-updated_time','Санал болгох'],['-volume','Борлуулалтаар']].map(([sort,label])=>`<a href="${path}${sort==='default'?'':'?sort='+sort}#catalog" data-storefront-sort="${sort}">${label}</a>`).join('')+'<a href="#storefront-shopping-info">Үнэ, урамшууллын тухай ↗</a>';
  catalog.querySelector('.section-heading').after(tabs);
  const info=document.createElement('aside');info.id='storefront-shopping-info';info.className='storefront-shopping-info';info.innerHTML=`<div><span class="section-kicker">СОНГООД, САГСЛААД, ТӨЛӨӨРЭЙ</span><h2>Таны сонголт.<br>Бидний хүргэлт.</h2></div><div><h3>Үнэ, хямдрал, урамшуулал</h3><p>Бараан дээр дарж өнгө, хэмжээ, боломжит хямдрал болон дэлгүүрийн урамшууллын нөхцөлийг үзээрэй. Үнэ, үлдэгдэл сонгосон хувилбараас хамаарна.</p><p>Хүргэлтийн төлбөр барааны үнэд нэмэгдэнэ. Захиалгын эцсийн үнийг баталгаажуулна.</p><a class="text-button" href="/help">Хэрхэн худалдан авах вэ? ${icon('arrow')}</a></div>`;catalog.append(info);
  window.syncBrandStorefront=sort=>tabs.querySelectorAll('[data-storefront-sort]').forEach(a=>{const active=a.dataset.storefrontSort===sort;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
  document.addEventListener('click',e=>{const link=e.target.closest('[data-storefront-sort]');if(!link||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();const select=document.querySelector('#supplier-sort');select.value=link.dataset.storefrontSort;select.dispatchEvent(new Event('change',{bubbles:true}));scrollCatalog();});
  // Search in the shared header is explicitly site-wide, not a silent seller switch.
  document.querySelector('#search').placeholder='GOStore-ийн бүх бараанаас хайх';
})();
