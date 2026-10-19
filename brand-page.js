'use strict';
// A storefront keeps its verified seller scope; global search still opens the main catalog.
window.brandStorefront=/^\/brands\/nike\/?$/.test(location.pathname)?'nike':'';
(()=>{
  if(!window.brandStorefront)return;
  document.title='Nike — Брэндийн дэлгүүр | GOStore';
  document.querySelector('meta[name="description"]').content='Nike-ийн албан ёсны дэлгүүрийн бараа, үнэ, урамшууллыг GOStore дотроо үзэж, Монголд захиалаарай.';
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href='https://gostore.mn/brands/nike';document.head.append(canonical);
  const section=document.createElement('section');section.id='brand-storefront';section.className='container nike-storefront';section.setAttribute('aria-labelledby','nike-title');
  section.innerHTML=`
    <nav class="nike-breadcrumb" aria-label="Хуудасны зам"><a href="/">Нүүр</a><span aria-hidden="true">/</span><a href="/#brands">Брэндүүд</a><span aria-hidden="true">/</span><span aria-current="page">Nike</span></nav>
    <div class="nike-store-heading"><div class="nike-store-identity"><span class="nike-logo-tile"><img src="/assets/brands/nike.svg" alt="Nike" width="64" height="48"></span><div><strong>NIKE</strong><p>Албан ёсны дэлгүүрийн сонголт</p></div></div><span class="nike-store-label">GOStore брэндийн хуудас</span></div>
    <div class="nike-hero">
      <div class="nike-hero-copy"><span class="section-kicker">СПОРТ. ӨДӨР ТУТАМ. ТАНЫ ХЭМНЭЛ.</span><h1 id="nike-title">Хөдөлгөөн бүрд<br>таны <em>сонголт.</em></h1><p>Nike-ийн барааг нэг дороос сонгож,<br>GOStore-оор Монголд захиалаарай.</p><div class="nike-hero-actions"><a class="button yellow" href="#catalog">Nike бараа үзэх ${icon('arrow')}</a><a class="nike-new-link" href="/brands/nike?sort=-updated_time#catalog" data-nike-sort="-updated_time">Шинээр нэмэгдсэн ↗</a></div></div>
      <div class="nike-hero-art" aria-hidden="true"><span class="nike-orbit"></span><span class="nike-art-word">NIKE</span><img src="/assets/brands/nike.svg" alt="" width="400" height="240"><span class="nike-art-caption">ӨӨРИЙН ХЭМНЭЛЭЭ ОЛ.</span></div>
    </div>
    <div class="nike-service-row"><div>${icon('bag')}<p><strong>Дэлгүүрээс шууд</strong><span>Nike дэлгүүрийн барааны каталог</span></p></div><div>${icon('heart')}<p><strong>Үнэ, урамшуулал</strong><span>Бараа бүрийн дэлгэрэнгүйд</span></p></div><div>${icon('truck')}<p><strong>Монголд хүргүүлээрэй</strong><span>Захиалгын явцаа GOStore-оос хянана</span></p></div></div>`;
  const catalog=document.querySelector('#catalog');catalog.before(section);
  catalog.querySelector('.section-kicker').textContent='NIKE / БАРААНЫ КАТАЛОГ';
  const tabs=document.createElement('nav');tabs.className='nike-catalog-tabs';tabs.setAttribute('aria-label','Nike барааны сонголт');
  tabs.innerHTML=[['default','Бүх бараа'],['-updated_time','Шинээр нэмэгдсэн'],['-volume','Борлуулалтаар']].map(([sort,label])=>`<a href="/brands/nike${sort==='default'?'':'?sort='+sort}#catalog" data-nike-sort="${sort}">${label}</a>`).join('')+'<a href="#nike-shopping-info">Үнэ, урамшууллын тухай ↗</a>';
  catalog.querySelector('.section-heading').after(tabs);
  const info=document.createElement('aside');info.id='nike-shopping-info';info.className='nike-shopping-info';info.innerHTML=`<div><span class="section-kicker">СОНГООД, НЯГТЛААД, ЗАХИАЛААРАЙ</span><h2>Таны сонголт.<br>Бидний хүргэлт.</h2></div><div><h3>Үнэ, хямдрал, урамшуулал</h3><p>Бараан дээр дарж өнгө, хэмжээ, боломжит хямдрал болон дэлгүүрийн урамшууллын нөхцөлийг үзээрэй. Үнэ, үлдэгдэл сонгосон хувилбараас хамаарна.</p><p>Хүргэлтийн төлбөр барааны үнэд нэмэгдэнэ. Захиалгын эцсийн үнийг баталгаажуулна.</p><a class="text-button" href="/help">Хэрхэн захиалах вэ? ${icon('arrow')}</a></div>`;catalog.append(info);
  window.syncBrandStorefront=sort=>tabs.querySelectorAll('[data-nike-sort]').forEach(a=>{const active=a.dataset.nikeSort===sort;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
  document.addEventListener('click',e=>{const link=e.target.closest('[data-nike-sort]');if(!link||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();const select=document.querySelector('#supplier-sort');select.value=link.dataset.nikeSort;select.dispatchEvent(new Event('change',{bubbles:true}));scrollCatalog();});
  // Search in the shared header is explicitly site-wide, not a silent seller switch.
  document.querySelector('#search').placeholder='GOStore-ийн бүх бараанаас хайх';
})();
