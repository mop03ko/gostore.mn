'use strict';
(()=>{
  // Seasonal merchandising only. Provider offers are not assumed to belong to an official campaign.
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const active=()=>{const d=today();return d.find(p=>p.type==='month').value==='11'&&Number(d.find(p=>p.type==='day').value)<=11;};
  const hub=document.getElementById('home-hub');
  if(!hub||!/^\/(?:index\.html)?$/.test(location.pathname)||!active())return;
  const section=document.createElement('section');section.id='eleven-sale';section.className='eleven-sale page-width';section.setAttribute('aria-labelledby','eleven-sale-title');
  section.innerHTML='<div class="eleven-sale-heading"><span class="eleven-sale-mark" aria-hidden="true">11.11</span><div><p class="eleven-sale-eyebrow">11.11-ИЙН СОНГОЛТ</p><h2 id="eleven-sale-title">Хямдрал, купонтой бараа</h2><p>Таалагдсан барааныхаа саналыг шалгаарай.</p></div><a class="eleven-sale-link" href="#eleven-sale-products">Сонголт үзэх ↓</a></div><p class="eleven-sale-note">Нийлүүлэгчээс ирсэн одоогийн саналууд. Купон, урамшуулал нь нөхцөлтэй; бүх бараа албан ёсны 11.11 аянд хамрагдсан гэсэн үг биш. Эцсийн үнэ, хүргэлтийг захиалах үед шалгана.</p><div id="eleven-sale-products" aria-live="polite" aria-busy="true"><p role="status">Хямдралын мэдээлэл ачаалж байна…</p></div>';
  hub.after(section);
  const target=section.querySelector('#eleven-sale-products'),key='gostore-eleven-offers-v1';let busy=false,expiryTimer;
  const valid=p=>{
    if(!p||!/^tb-\d{5,20}$/.test(p.id)||p.sellable===false||window.productPolicyBlocked?.(p))return false;
    const now=Date.now()/1000,amount=p.mnt||p.approx_mnt,d=p.card_discount,o=p.offers;
    return amount>0&&((d?.expires>now&&d.current_mnt===amount&&d.was_mnt>amount)||(o?.expires>now&&(o.coupon_mnt>0&&o.coupon_mnt<amount||o.promotions?.some(v=>v.name))));
  };
  function render(rows){
    clearTimeout(expiryTimer);
    if(!active()){section.remove();return;}
    const seen=new Set(),items=rows.filter(p=>valid(p)&&!seen.has(p.id)&&seen.add(p.id)).slice(0,8);
    target.setAttribute('aria-busy','false');
    target.innerHTML=items.length?'<div class="eleven-sale-grid">'+items.map(p=>`<a class="eleven-sale-card" href="/v/${encodeURIComponent(p.id)}">${p.image?`<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'<div class="eleven-sale-placeholder" aria-hidden="true">GOStore</div>'}<div class="eleven-sale-card-body"><h3>${esc(p.name)}</h3><strong>${p.mnt?'':'≈ '}${money(p.mnt||p.approx_mnt)}</strong>${supplierPromotionHtml(p,p.mnt||p.approx_mnt)}<small class="eleven-sale-details">Үнэ, нөхцөл харах →</small></div></a>`).join('')+'</div>':'<p class="eleven-sale-empty">Одоогоор хүчинтэй хямдралын мэдээлэл олдсонгүй. <a href="/#supplier-catalog">Бүх барааг үзэх →</a></p>';
    // Remove expired badges/cards on an open page without polling the supplier API.
    const end=Date.parse(`${new Date().getFullYear()}-11-12T00:00:00+08:00`);
    const expires=items.flatMap(p=>[p.card_discount?.expires,p.offers?.expires]).filter(t=>t*1000>Date.now()).map(t=>t*1000);
    expiryTimer=setTimeout(()=>render(rows),Math.max(100,Math.min(end,Date.now()+86400000,...expires)-Date.now()+50));
  }
  async function load(){
    if(busy)return;busy=true;target.setAttribute('aria-busy','true');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch('/api/index.php?action=supplier-deals&page=1',{credentials:'omit',signal:controller.signal});
      if(!response.ok)throw Error('Unavailable');const data=await response.json();if(!Array.isArray(data.products))throw Error('Invalid offers');
      try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),products:data.products}));}catch{}
      render(data.products);
    }catch{
      target.setAttribute('aria-busy','false');target.innerHTML='<p class="eleven-sale-empty">Хямдралын мэдээлэл түр боломжгүй байна.</p><button type="button" class="eleven-sale-retry">Дахин ачаалах</button>';target.querySelector('button').onclick=load;
    }finally{clearTimeout(timeout);busy=false;}
  }
  function start(){try{const cached=JSON.parse(sessionStorage.getItem(key));if(cached&&Date.now()-cached.at>=0&&Date.now()-cached.at<60000&&Array.isArray(cached.products)){render(cached.products);return;}}catch{}load();}
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();start();}},{rootMargin:'400px'});observer.observe(section);}else start();
})();
