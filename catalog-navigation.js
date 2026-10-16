'use strict';
(()=>{
  const nav=document.querySelector('#catalog-category-nav');if(!nav)return;
  const row=nav.querySelector('.catalog-category-list');
  const first=['men','women','kids','women-shoes','shoes','kids-shoes','accessories','kitchen'];
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
    window.supplierBrowse(id==='all'?'bag':categories.find(c=>c.id===id).query,false,id);
  });
  row.addEventListener('keydown',e=>{const index=buttons.indexOf(e.target);if(index<0)return;let next;if(e.key==='ArrowRight')next=Math.min(index+1,buttons.length-1);else if(e.key==='ArrowLeft')next=Math.max(index-1,0);else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus({preventScroll:true});reveal(buttons[next]);});
  row.addEventListener('scroll',arrows,{passive:true});new ResizeObserver(arrows).observe(row);document.fonts.ready.then(arrows);arrows();
})();
