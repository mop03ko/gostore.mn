'use strict';
(()=>{
  const nav=document.querySelector('#catalog-category-nav');if(!nav)return;
  const row=nav.querySelector('.catalog-category-list');
  const first=['men','women','kids','women-shoes','shoes','accessories','kitchen'];
  const ordered=[...first.map(id=>categories.find(c=>c.id===id)),...categories.filter(c=>!first.includes(c.id))].filter(Boolean);
  row.innerHTML='<button type="button" data-catalog-category="all" aria-pressed="true">Бүгд</button>'+ordered.map(c=>`<button type="button" data-catalog-category="${esc(c.id)}" aria-pressed="false">${esc(c.name)}</button>`).join('');
  const buttons=[...row.querySelectorAll('button')];
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function arrows(){const max=row.scrollWidth-row.clientWidth;nav.querySelector('[data-catalog-scroll="-1"]').hidden=row.scrollLeft<=1;nav.querySelector('[data-catalog-scroll="1"]').hidden=max<=1||row.scrollLeft>=max-1;}
  function reveal(button){if(!button)return;const target=button.getBoundingClientRect(),bounds=row.getBoundingClientRect();if(target.left<bounds.left+54)row.scrollBy({left:target.left-bounds.left-54,behavior:reduced()?'instant':'smooth'});else if(target.right>bounds.right-54)row.scrollBy({left:target.right-bounds.right+54,behavior:reduced()?'instant':'smooth'});}
  window.syncSupplierCategories=(category,saved,image)=>{
    const selected=saved||image?'':category;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.catalogCategory===selected)));
    reveal(buttons.find(b=>b.dataset.catalogCategory===selected));arrows();
  };
  nav.addEventListener('click',e=>{
    const control=e.target.closest('[data-catalog-scroll]');if(control){row.scrollBy({left:Number(control.dataset.catalogScroll)*row.clientWidth*.75,behavior:reduced()?'instant':'smooth'});return;}
    const button=e.target.closest('[data-catalog-category]');if(!button)return;
    const id=button.dataset.catalogCategory;
    window.supplierBrowse(id==='all'?'__all__':categories.find(c=>c.id===id).query,false,id);
  });
  row.addEventListener('keydown',e=>{const index=buttons.indexOf(e.target);if(index<0)return;let next;if(e.key==='ArrowRight')next=Math.min(index+1,buttons.length-1);else if(e.key==='ArrowLeft')next=Math.max(index-1,0);else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus({preventScroll:true});reveal(buttons[next]);});
  row.addEventListener('scroll',arrows,{passive:true});new ResizeObserver(arrows).observe(row);document.fonts.ready.then(arrows);arrows();
})();

// Official storefront identities are enforced by the server; see docs/brand-storefronts.md.
(()=>{
  const brands=[
    {id:'nike',name:'Nike',shop:'nike'},
    {id:'adidas',name:'adidas',shop:'adidas'},
    {id:'puma',name:'Puma',shop:'puma'},
    {id:'newbalance',name:'New Balance',shop:'newbalance'},
    {id:'uniqlo',name:'UNIQLO',shop:'uniqlo'},
    {id:'zara',name:'ZARA',shop:'zara'},
    {id:'sony',name:'Sony',shop:'sony'},
    {id:'xiaomi',name:'Xiaomi',shop:'xiaomi'},
    {id:'lego',name:'LEGO',shop:'lego'},
    {id:'ikea',name:'IKEA',shop:'ikea'}
  ];
  window.supplierBrands=brands;
  const section=document.querySelector('#brands');if(!section)return;
  section.querySelector('.brand-grid').innerHTML=brands.map(b=>`<a class="brand-card" data-brand="${b.id}" href="/?brand=${b.id}#catalog" aria-label="${esc(b.name)} брэндийн бараа үзэх"><span class="brand-logo"><img src="/assets/brands/${b.id}.svg" alt="" width="112" height="56" decoding="async"></span><strong>${esc(b.name)}</strong><span class="brand-store-label">Бараа үзэх <span aria-hidden="true">→</span></span></a>`).join('');
  window.syncSupplierBrands=id=>section.querySelectorAll('[data-brand]').forEach(a=>{if(a.dataset.brand===id)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
  section.addEventListener('click',e=>{
    const link=e.target.closest('[data-brand],[data-brand-all]');if(!link)return;
    if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||typeof window.supplierBrowse!=='function')return;
    e.preventDefault();if(link.dataset.brand)window.supplierBrowseBrand(link.dataset.brand);else window.supplierBrowse('__all__',false,'all');scrollCatalog();
  });
})();
