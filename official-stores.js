'use strict';
(()=>{
  const section=document.querySelector('#official-stores');if(!section||document.documentElement.matches('.product-view,.account-view,.store-page-view'))return;
  const host=section.querySelector('[data-official-stores-list]'),directory=location.pathname.startsWith('/official-stores');let data=null;
  // Temporarily removed from the homepage; direct store links remain usable.
  if(!directory){section.remove();return;}section.hidden=false;
  if(directory){document.title='Албан ёсны дэлгүүрүүд | GOStore';section.querySelector('.section-heading>a').textContent='Нүүр хуудас';section.querySelector('.section-heading>a').href='/';}
  function paint(){
    const stores=data.stores;
    host.innerHTML=(data.incomplete?'<p role="status">Зарим дэлгүүрийн мэдээлэл түр ирсэнгүй. <button class="text-button" data-stores-retry>Дахин шалгах</button></p>':'')+
      (stores.length?stores.map((s,i)=>`<article class="official-store-row"><div class="official-store-heading"><img src="${esc(s.logo)}" alt="" width="56" height="56" loading="lazy"><div><h3>${esc(s.display_name)}</h3><p>${esc(s.name)}</p><a class="text-button" href="/official-stores?shop=${encodeURIComponent(s.id)}#catalog">Дэлгүүрийн бараа →</a></div></div><div class="official-store-products product-grid" id="official-store-products-${i}"></div></article>`).join(''):'<p class="empty-state">Одоогоор баталгаажсан дэлгүүрүүдээс бараа ирээгүй байна.</p>')+
      '<p class="official-stores-note">Баталгаажсан жагсаалтын API-аар боломжтой дэлгүүрүүд. Tmall-ийн бүх дэлгүүрийг хамарсан жагсаалт биш.</p>';
    stores.forEach((s,i)=>renderSupplierCards(s.products,false,host.querySelector('#official-store-products-'+i)));
  }
  async function load(){host.setAttribute('aria-busy','true');try{data=await supplierApi('supplier-official-stores',{});paint();}catch{host.innerHTML='<p>Дэлгүүрүүдийг ачаалж чадсангүй.</p><button class="button outline" data-stores-retry>Дахин оролдох</button>';}finally{host.removeAttribute('aria-busy');}}
  section.addEventListener('click',e=>{if(e.target.closest('[data-stores-retry]'))load();});
  window.addEventListener('gostore-favorites-changed',()=>{if(data)paint();});
  // Home loads this secondary shelf only when near the viewport.
  if(directory||typeof IntersectionObserver!=='function')load();else{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}},{rootMargin:'300px'});observer.observe(section);}
})();
