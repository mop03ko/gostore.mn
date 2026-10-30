'use strict';
// Marketplace-style first screen: category rows with a hover flyout, popular searches,
// the customer's order shortcuts and, on phones, a two-row grid of category shortcuts.
// Every link is a real URL; plain clicks browse the catalog in place without a reload.
(()=>{
  const hub=document.querySelector('#home-hub');if(!hub)return;
  const byId=id=>categories.find(c=>c.id===id);
  // Each row reads as one phrase ("Эмэгтэй / Эрэгтэй хувцас"), so the labels are shorter than the category names.
  const rows=[[['women','Эмэгтэй'],['men','Эрэгтэй хувцас']],[['women-shoes','Эмэгтэй'],['shoes','Эрэгтэй гутал']],[['bags','Цүнх'],['accessories','Аксессуар']],[['beauty','Гоо сайхан'],['health','Арчилгаа']],[['tech','Электроник'],['appliances','Цахилгаан']],[['home','Гэр ахуй'],['kitchen','Гал тогоо']],[['furniture','Тавилга'],['decor','Чимэглэл'],['lighting','Гэрэл']],[['baby','Нярай'],['kids','Хүүхэд'],['toys','Тоглоом']],[['sports','Спорт'],['outdoor','Аялал, амралт']],[['auto','Авто'],['tools','Багаж, засвар']],[['garden','Цэцэрлэг'],['pets','Амьтны хэрэгсэл']],[['office','Бичиг хэрэг, оффис']]]
    .map(r=>r.map(([id,label])=>byId(id)&&{...byId(id),label}).filter(Boolean)).filter(r=>r.length);
  // Short labels keep the phone grid to one line per tile.
  const channels=[['women','👗','Эмэгтэй'],['men','👔','Эрэгтэй'],['shoes','👟','Гутал'],['bags','👜','Цүнх'],['beauty','💄','Гоо сайхан'],['tech','🎧','Техник'],['home','🏠','Гэр ахуй'],['kids','🧸','Хүүхэд'],['sports','🏃','Спорт']].filter(([id])=>byId(id));
  const hot=[['Пүүз','men sneakers'],['Чихэвч','headphones'],['Үүргэвч','backpack'],['Даашинз','dress'],['Ухаалаг цаг','smart watch'],['Агаар шарагч','air fryer'],['Хадгалах хайрцаг','storage box'],['Арьс арчилгаа','skincare']];
  const categoryHref=id=>'/?category='+encodeURIComponent(id)+'#catalog',queryHref=q=>'/?q='+encodeURIComponent(q)+'#catalog';

  const cats=hub.querySelector('#hub-cats'),flyout=hub.querySelector('#hub-flyout');
  cats.innerHTML=`<h2 class="hub-cats-title">${icon('grid')}Ангилал</h2><ul>${rows.map((r,i)=>`<li data-hub-row="${i}">${r.map(c=>`<a href="${categoryHref(c.id)}" data-hub-category="${esc(c.id)}"${c.label===c.name?'':` aria-label="${esc(c.name)}"`}>${esc(c.label)}</a>`).join('<span aria-hidden="true">/</span>')}</li>`).join('')}</ul>`;
  hub.querySelector('#hub-channels').innerHTML=channels.map(([id,emoji,label])=>`<a href="${categoryHref(id)}" data-hub-category="${esc(id)}"><span aria-hidden="true">${emoji}</span>${esc(label)}</a>`).join('')+`<button type="button" data-hub-all-categories><span aria-hidden="true">${icon('grid')}</span>Бүгд</button>`;
  hub.querySelector('#hub-hot').innerHTML=`<span>Түгээмэл хайлт</span>`+hot.map(([label,q])=>`<a href="${queryHref(q)}" data-hub-query="${esc(q)}">${esc(label)}</a>`).join('');

  // Flyout: the row under the pointer (or keyboard focus) lists its subcategories.
  let open=null,closeTimer=0;
  function show(index){
    clearTimeout(closeTimer);if(open===index)return;open=index;
    cats.querySelectorAll('[data-hub-row]').forEach(li=>li.classList.toggle('active',li.dataset.hubRow===String(index)));
    flyout.innerHTML=rows[index].map(c=>`<section><h3><a href="${categoryHref(c.id)}" data-hub-category="${esc(c.id)}">${esc(c.name)} ${icon('arrow')}</a></h3><div>${c.children.map(x=>`<a href="${queryHref(x.query)}" data-hub-query="${esc(x.query)}">${esc(x.name)}</a>`).join('')}</div></section>`).join('');
    flyout.hidden=false;
  }
  function hide(){clearTimeout(closeTimer);open=null;flyout.hidden=true;cats.querySelectorAll('.active').forEach(li=>li.classList.remove('active'));}
  const hideSoon=()=>{clearTimeout(closeTimer);closeTimer=setTimeout(hide,180);};
  const hoverable=()=>matchMedia('(hover: hover) and (min-width: 761px)').matches;
  cats.addEventListener('mouseover',e=>{const li=e.target.closest('[data-hub-row]');if(li&&hoverable())show(Number(li.dataset.hubRow));});
  cats.addEventListener('focusin',e=>{const li=e.target.closest('[data-hub-row]');if(li&&getComputedStyle(cats).display!=='none')show(Number(li.dataset.hubRow));});
  for(const el of [cats,flyout]){el.addEventListener('mouseleave',hideSoon);el.addEventListener('mouseenter',()=>clearTimeout(closeTimer));}
  hub.addEventListener('focusout',e=>{if(!cats.contains(e.relatedTarget)&&!flyout.contains(e.relatedTarget))hide();});
  hub.addEventListener('keydown',e=>{if(e.key==='Escape'&&!flyout.hidden){const row=cats.querySelector('.active a');hide();row?.focus();}});

  hub.addEventListener('click',e=>{
    if(e.target.closest('[data-hub-all-categories]')){document.querySelector('#category-trigger')?.click();return;}
    const link=e.target.closest('[data-hub-category],[data-hub-query]');
    if(!link||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||typeof window.supplierBrowse!=='function')return;
    e.preventDefault();hide();
    const c=link.dataset.hubCategory&&byId(link.dataset.hubCategory);
    if(c)window.supplierBrowse(c.query,false,c.id);else window.supplierBrowse(link.dataset.hubQuery);
    scrollCatalog();
  });
  hub.querySelector('[data-hub-register]')?.addEventListener('click',()=>window.customerAccount?customerAccount.open('register'):runAction('account'));

  // Cart and saved counts follow the header badges.
  const counts=()=>{for(const [key,source] of [['cart','#cart-count'],['favorites','#favorite-count']]){const from=document.querySelector(source),to=hub.querySelector(`[data-hub-count="${key}"]`);if(from&&to){to.textContent=from.hidden?'':from.textContent;}}};
  for(const source of ['#cart-count','#favorite-count']){const el=document.querySelector(source);if(el)new MutationObserver(counts).observe(el,{childList:true,attributes:true,attributeFilter:['hidden']});}
  counts();
})();
