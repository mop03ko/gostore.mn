'use strict';
// A storefront keeps its verified seller scope; global search still opens the main catalog.
const storefrontMatch=location.pathname.match(/^\/brands\/([a-z]+)\/?$/);
const storefrontBrand=window.supplierBrands?.find(b=>b.id===storefrontMatch?.[1]);
window.brandStorefront=storefrontBrand?.id||'';
(()=>{
  if(!window.brandStorefront)return;
  const {id,name}=storefrontBrand,path=window.supplierBrandHref(id);
  const copy={
    nike:['СПОРТ. ӨДӨР ТУТАМ. ТАНЫ ХЭМНЭЛ.','Хөдөлгөөн бүрд','таны','сонголт.','ӨӨРИЙН ХЭМНЭЛЭЭ ОЛ.'],
    adidas:['СПОРТ. ХЭВ МАЯГ. ӨДӨР БҮР.','Өөрийн хэмнэлээр','урагш','алхаарай.','ТАНЫ ӨДРИЙН ШИНЭ ХЭМНЭЛ.'],
    puma:['ЭРЧ ХҮЧ. ХӨДӨЛГӨӨН. ХЭВ МАЯГ.','Эрч хүчтэй өдөр','таны','сонголтоос.','ХӨДӨЛГӨӨНД БЭЛЭН.'],
    newbalance:['АЛХАМ БҮРД. ӨДӨР БҮР.','Өдөр тутмын алхамд','өөрийн','хэв маяг.','ӨӨРИЙН ЗАМААР АЛХ.'],
    uniqlo:['ЭНГИЙН. ЭВТЭЙХЭН. ӨДӨР ТУТАМ.','Өдөр бүр өмсөх','таны','сонголт.','ӨДӨР ТУТМЫН ХЭВ МАЯГ.'],
    zara:['ЗАГВАР. МЭДРЭМЖ. ТАНЫ ӨНГӨ.','Хэв маягаа','өөрийнхөөрөө','илэрхийл.','ТАНЫ ӨНГӨ. ТАНЫ СОНГОЛТ.'],
    hm:['ЗАГВАР. ӨНГӨ. ӨДӨР ТУТАМ.','Өдөр бүрийн','хэв маягаа','бүтээгээрэй.','ӨӨРИЙНХӨӨ ӨНГӨӨР.'],
    thenorthface:['БАЙГАЛЬ. АЯЛАЛ. ШИНЭ АДАЛ ЯВДАЛ.','Шинэ замд','гарахад','бэлэн.','АЯЛАЛ БҮРД ХАМТ.'],
    sony:['ТЕХНОЛОГИ. ДУУ. ДҮРС.','Шинэ мэдрэмжийг','өдөр бүр','нээе.','ТЕХНОЛОГИЙГ ОЙРТУУЛНА.'],
    xiaomi:['ТЕХНОЛОГИ. ГЭР. ӨДӨР ТУТАМ.','Өдөр тутмын','ухаалаг','сонголт.','ТАНЫ ӨДРИЙГ ХЯЛБАРЧИЛНА.'],
    lego:['ТОГЛООМ. ТӨСӨӨЛӨЛ. БҮТЭЭЛ.','Төсөөллөө','хамтдаа','бүтээе.','ШИНЭ САНАА ЭНДЭЭС ЭХЭЛНЭ.'],
    ikea:['ГЭР. ТАВ ТУХ. ТАНЫ ОРОН ЗАЙ.','Гэрийнхээ өнгийг','өөрийнхөөрөө','бүтээ.','ТАВ ТУХТАЙ ГЭРИЙН СОНГОЛТ.']
  }[id];
  document.title=name+' — Брэндийн дэлгүүр | GOStore';
  document.querySelector('meta[name="description"]').content=name+' брэндийн албан ёсны дэлгүүрийн бараа, үнэ, урамшууллыг GOStore дотроо үзэж, Монголд захиалаарай.';
  const canonical=document.createElement('link');canonical.rel='canonical';canonical.href='https://gostore.mn'+path;document.head.append(canonical);
  const section=document.createElement('section');section.id='brand-storefront';section.className='container storefront-page';section.dataset.brand=id;section.setAttribute('aria-labelledby','storefront-title');
  section.innerHTML=`
    <nav class="storefront-breadcrumb" aria-label="Хуудасны зам"><a href="/">Нүүр</a><span aria-hidden="true">/</span><a href="/#brands">Брэндүүд</a><span aria-hidden="true">/</span><span aria-current="page">${esc(name)}</span></nav>
    <div class="storefront-store-heading"><div class="storefront-store-identity"><span class="storefront-logo-tile"><img src="/assets/brands/${id}.svg" alt="${esc(name)}" width="64" height="48"></span><div><strong>${esc(name)}</strong><p>Албан ёсны дэлгүүрийн сонголт</p></div></div><span class="storefront-store-label">GOStore брэндийн хуудас</span></div>
    <div class="storefront-hero">
      <div class="storefront-hero-copy"><span class="section-kicker">${copy[0]}</span><h1 id="storefront-title">${copy[1]}<br>${copy[2]} <em>${copy[3]}</em></h1><p>${esc(name)} брэндийн барааг нэг дороос сонгож,<br>GOStore-оор Монголд захиалаарай.</p><div class="storefront-hero-actions"><a class="button yellow" href="#catalog">${esc(name)} бараа үзэх ${icon('arrow')}</a><a class="storefront-new-link" href="${path}?sort=-updated_time#catalog" data-storefront-sort="-updated_time">Шинээр нэмэгдсэн ↗</a></div></div>
      <div class="storefront-hero-art" aria-hidden="true"><span class="storefront-orbit"></span><span class="storefront-art-word">${esc(name.toUpperCase())}</span><img src="/assets/brands/${id}.svg" alt="" width="400" height="240"><span class="storefront-art-caption">${copy[4]}</span></div>
    </div>
    <div class="storefront-service-row"><div>${icon('bag')}<p><strong>Дэлгүүрээс шууд</strong><span>${esc(name)} дэлгүүрийн барааны каталог</span></p></div><div>${icon('heart')}<p><strong>Үнэ, урамшуулал</strong><span>Бараа бүрийн дэлгэрэнгүйд</span></p></div><div>${icon('truck')}<p><strong>Монголд хүргүүлээрэй</strong><span>Захиалгын явцаа GOStore-оос хянана</span></p></div></div>`;
  const catalog=document.querySelector('#catalog');catalog.before(section);
  catalog.querySelector('.section-kicker').textContent=name.toUpperCase()+' / БАРААНЫ КАТАЛОГ';
  const tabs=document.createElement('nav');tabs.className='storefront-catalog-tabs';tabs.setAttribute('aria-label',name+' барааны сонголт');
  tabs.innerHTML=[['default','Бүх бараа'],['-updated_time','Шинээр нэмэгдсэн'],['-volume','Борлуулалтаар']].map(([sort,label])=>`<a href="${path}${sort==='default'?'':'?sort='+sort}#catalog" data-storefront-sort="${sort}">${label}</a>`).join('')+'<a href="#storefront-shopping-info">Үнэ, урамшууллын тухай ↗</a>';
  catalog.querySelector('.section-heading').after(tabs);
  const info=document.createElement('aside');info.id='storefront-shopping-info';info.className='storefront-shopping-info';info.innerHTML=`<div><span class="section-kicker">СОНГООД, НЯГТЛААД, ЗАХИАЛААРАЙ</span><h2>Таны сонголт.<br>Бидний хүргэлт.</h2></div><div><h3>Үнэ, хямдрал, урамшуулал</h3><p>Бараан дээр дарж өнгө, хэмжээ, боломжит хямдрал болон дэлгүүрийн урамшууллын нөхцөлийг үзээрэй. Үнэ, үлдэгдэл сонгосон хувилбараас хамаарна.</p><p>Хүргэлтийн төлбөр барааны үнэд нэмэгдэнэ. Захиалгын эцсийн үнийг баталгаажуулна.</p><a class="text-button" href="/help">Хэрхэн захиалах вэ? ${icon('arrow')}</a></div>`;catalog.append(info);
  window.syncBrandStorefront=sort=>tabs.querySelectorAll('[data-storefront-sort]').forEach(a=>{const active=a.dataset.storefrontSort===sort;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
  document.addEventListener('click',e=>{const link=e.target.closest('[data-storefront-sort]');if(!link||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();const select=document.querySelector('#supplier-sort');select.value=link.dataset.storefrontSort;select.dispatchEvent(new Event('change',{bubbles:true}));scrollCatalog();});
  // Search in the shared header is explicitly site-wide, not a silent seller switch.
  document.querySelector('#search').placeholder='GOStore-ийн бүх бараанаас хайх';
})();
