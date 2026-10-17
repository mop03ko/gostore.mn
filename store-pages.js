'use strict';
// Full cart page (/cart) and help & delivery page (/help), built from the live site settings.
(()=>{
  const path=location.pathname.replace(/\/$/,'');
  const page=path==='/cart'?'cart':path==='/help'?'help':null;
  // Floating help shortcut on every storefront page except the help page itself.
  if(page!=='help'){const a=document.createElement('a');a.href='/help';a.className='float-help';a.setAttribute('aria-label','Тусламж, холбоо барих');a.innerHTML='<span aria-hidden="true">?</span>';document.body.append(a);}
  // Header and footer help links open the full page instead of the short modal.
  document.addEventListener('click',e=>{const b=e.target.closest('[data-action="help"],[data-action="shipping"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();location.assign(b.dataset.action==='shipping'?'/help#delivery':'/help');},true);
  if(!page)return;
  const root=document.createElement('section');root.id='store-page';root.className='container store-page';document.querySelector('#main').prepend(root);
  const crumbs=title=>`<nav class="pd-breadcrumb" aria-label="Байршил"><a href="/">Нүүр</a><span>/</span><span>${esc(title)}</span></nav>`;
  const settings=()=>window.storeServer?.shipping||{};
  const pickupHtml=()=>{const p=settings().pickup;return p?.address?`<p><strong>${esc(p.name)}</strong></p><p class="store-pre">${esc(p.address)}</p>${p.hours?`<p>Ажиллах цаг: ${esc(p.hours)}</p>`:''}`:'<p>Улаанбаатар агуулах</p>';};
  const phone=()=>settings().pickup?.phone||'';

  // ---------- Cart ----------
  const FAVORITES='gostore-taobao-favorites-v1';
  const href=id=>'/v/'+encodeURIComponent(id.replace(/^abb-/,''));
  function saveForLater(items){
    let saved=[];try{saved=JSON.parse(localStorage.getItem(FAVORITES)||'[]');if(!Array.isArray(saved))saved=[];}catch{}
    const add=items.filter(i=>/^tb-/.test(i.id)&&!saved.some(s=>s.id===i.id)).map(i=>({id:i.id,name:i.name,image:i.image,mnt:null,approx_mnt:taobaoCart.unitMnt(i),price_status:'unverified'}));
    try{localStorage.setItem(FAVORITES,JSON.stringify([...add,...saved].slice(0,100)));}catch{toast('Хөтөч хадгалах боломжгүй байна.');return false;}
    updateCounts();return true;
  }
  function renderCart(){
    const items=taobaoCart.items(),lines=items.map(i=>{const unit=taobaoCart.unitMnt(i);return {...i,unit,total:unit===null?null:unit*i.qty};});
    const known=lines.every(l=>l.total!==null),subtotal=lines.reduce((s,l)=>s+(l.total||0),0),pieces=lines.reduce((s,l)=>s+l.qty,0),domestic=Number(settings().domestic_default_cny)>0;
    root.innerHTML=crumbs('Миний сагс')+`<h1 class="store-title">Миний сагс <span>${items.length} бараа</span></h1>`+(items.length?`<div class="store-cart"><div class="store-cart-lines"><div class="store-cart-tools"><button type="button" class="text-button" data-cart-save-all>Бүх барааг хадгалах</button><button type="button" class="text-button danger" data-cart-clear>Бүгдийг хасах</button></div>${lines.map((l,index)=>`<article class="store-cart-line">${/^https:\/\//i.test(l.image||'')?`<a href="${href(l.id)}" aria-label="${esc(l.name)}"><img src="${esc(l.image)}" alt="" referrerpolicy="no-referrer" loading="lazy"></a>`:'<span class="store-cart-noimage"></span>'}<div class="store-cart-info"><h3><a href="${href(l.id)}">${esc(l.name)}</a></h3><p>${esc(l.variant)} · ${l.id.startsWith('abb-')?'1688':'Taobao'}</p><p class="store-cart-unit">${l.unit===null?'Үнэ тооцоолно':money(l.unit)+' / ширхэг'}</p><div class="store-cart-actions"><button type="button" class="text-button" data-compare-toggle="${esc(l.id)}" data-name="${esc(l.name)}" data-image="${esc(l.image||'')}">Харьцуулах</button>${/^tb-/.test(l.id)?`<button type="button" class="text-button" data-cart-save="${index}">Хадгалах</button>`:''}<button type="button" class="text-button danger" data-cart-remove="${index}">Хасах</button></div></div><div class="store-cart-qty"><div class="quantity-controls"><button type="button" data-cart-qty="${index}" data-delta="-1" aria-label="${esc(l.name)} тоог бууруулах" ${l.qty-l.step<l.min_qty?'disabled':''}>−</button><span>${l.qty}</span><button type="button" data-cart-qty="${index}" data-delta="1" aria-label="${esc(l.name)} тоог нэмэх" ${l.qty+l.step>Math.min(9999,l.stock??9999)?'disabled':''}>+</button></div><strong>${l.total===null?'—':money(l.total)}</strong></div></article>`).join('')}</div><aside class="store-cart-summary"><h2>Захиалгын хураангуй</h2><dl><div><dt>Бараа (${pieces} ширхэг)</dt><dd>${known?money(subtotal):'Тооцоолно'}</dd></div><div><dt>Үйлчилгээний хураамж</dt><dd>Төлбөр тооцоход</dd></div><div><dt>Хятад доторх хүргэлт</dt><dd>${domestic?'Төлбөр тооцоход':'УБ-д ирэхэд бодит дүнгээр'}</dd></div><div><dt>Олон улсын карго</dt><dd>УБ-д ирэхэд жингээр</dd></div><div class="total"><dt>Барааны дүн</dt><dd>${known?money(subtotal):'—'}</dd></div></dl><button type="button" class="button blue store-cart-checkout" data-tb-checkout>Захиалга баталгаажуулах ${icon('arrow')}</button><p class="account-hint">Захиалахад QPay-ээр ${Number(settings().payment_window_hours)||24} цагийн дотор төлнө. Бараагаа Улаанбаатар агуулахаас авах эсвэл хүргүүлж болно.</p><div class="store-help-card"><strong>Тусламж хэрэгтэй юу?</strong><p>Захиалгатай холбоотой асуултаа бидэнд илгээгээрэй.</p>${phone()?`<a class="text-button" href="tel:${esc(phone().replace(/[^\d+]/g,''))}">${esc(phone())}</a>`:''}<a class="text-button" href="mailto:shop@gostore.mn">shop@gostore.mn</a></div></aside></div>`:`<div class="account-empty">${icon('bag')}<h3>Сагс тань хоосон байна</h3><p>Taobao каталогоос бараагаа сонгоод сагсандаа нэмээрэй.</p><a class="button blue" href="/#catalog">Бараа үзэх</a></div>`);
  }
  // ---------- Help & delivery ----------
  function renderHelp(){
    const s=settings(),window_h=Number(s.payment_window_hours)||24,domestic=Number(s.domestic_default_cny)>0;
    const faq=[
      ['Хэрхэн захиалах вэ?',`<ol class="help-list"><li>Каталогоос бараа, өнгө/хэмжээ, тоогоо сонгоно.</li><li>«Сагслах» эсвэл «Худалдан авах» дарна.</li><li>Нэвтэрч, хүлээн авах хэлбэрээ сонгоод «Захиалах» дарна.</li><li>QPay QR эсвэл банкны аппаар төлнө.</li></ol>`],
      ['Захиалахдаа юуны төлбөр төлөх вэ?',`<p>Барааны үнэ (тухайн өдрийн ханшаар төгрөгт хөрвүүлсэн)${domestic?', Хятад доторх хүргэлт':''} болон үйлчилгээний хураамжийг захиалахдаа төлнө. ${domestic?'':'Хятад доторх хүргэлт болон '}Олон улсын каргоны төлбөрийг бараа Улаанбаатарт ирэхэд бодит дүнгээр эцсийн тооцоонд нэмнэ.</p>`],
      ['Төлбөрөө хэрхэн, хэзээ төлөх вэ?',`<p>Захиалга үүсмэгц QPay нэхэмжлэл гарна. ${window_h} цагийн дотор төлөөгүй захиалга автоматаар цуцлагдана. Үлдэгдэл (карго, хүргэлт)-ийг «Миний захиалгууд» хэсгээс QPay-ээр төлнө.</p>`],
      ['Каргоны төлбөр хэрхэн тооцогдох вэ?',s.weight_step_kg?`<p>Эрээн агуулахад ачааг бодитоор жигнэж, хэмжинэ.</p><ul class="help-list"><li>Жингээр: ${esc(s.weight_step_kg)} кг тутам ${money(s.weight_step_mnt)} (дээш бүхэлчилнэ).</li><li>Эзлэхүүнээр: ${esc(s.volume_threshold)} м³-аас бага бол ${money(Math.round(s.volume_small_cny*s.cny_rate))}/м³, түүнээс их бол ${money(Math.round(s.volume_large_cny*s.cny_rate))}/м³.</li></ul><p>Аль аргаар тооцохыг ачааны төрлөөс хамааран агуулах баталгаажуулна.</p>`:'<p>Эрээн агуулахад бодитоор жигнэж, хэмжиж тооцно.</p>'],
      ['Захиалгынхаа явцыг хаанаас харах вэ?','<p>«Миний бүртгэл → Миний захиалгууд» эсвэл «Миний ачаа» хэсгээс Эрээнд ирсэн, илгээсэн, Улаанбаатарт ирсэн явц болон агуулахын зургийг харна. Төлөв өөрчлөгдөх бүрт сайтад мэдэгдэл ирнэ.</p>'],
      ['Бараагаа хаанаас авах вэ?',`${pickupHtml()}<p>Төлбөрөө бүрэн төлсний дараа 8 оронтой авах код гарна. Кодоо агуулахын ажилтанд хэлж бараагаа авна. Хүргэлтээр авах бол хүргэлтийн төлбөр эцсийн тооцоонд нэмэгдэнэ.</p>`],
      ['Захиалгаа цуцлах боломжтой юу?',`<p>Төлөөгүй захиалга ${window_h} цагийн дараа автоматаар цуцлагдана. Төлбөр төлсөн захиалгыг цуцлах бол бидэнтэй холбогдоно уу: нийлүүлэгчээс аль хэдийн захиалсан бол цуцлах боломж нийлүүлэгчээс хамаарна.</p>`],
      ['Бараа дутуу эсвэл гэмтэлтэй ирвэл яах вэ?','<p>Агуулахууд ачааг хүлээн авахдаа тулгаж, зураг авдаг. Зөрүү илэрвэл захиалга дээр бүртгэж шийдвэрлэнэ. Асуудал гарвал захиалгын кодоо дурдаж бидэнтэй холбогдоно уу.</p>'],
    ];
    root.innerHTML=crumbs('Тусламж')+`<div class="store-help-hero"><span class="section-kicker">ТУСЛАМЖ & ДЭМЖЛЭГ</span><h1 class="store-title">Танд юугаар туслах вэ?</h1><label class="field store-help-search"><span class="sr-only">Асуулт хайх</span><input id="help-search" type="search" placeholder="Жишээ нь: төлбөр, карго, авах" autocomplete="off"></label></div><div class="store-contact">${phone()?`<a class="account-card" href="tel:${esc(phone().replace(/[^\d+]/g,''))}"><strong>Утсаар залгах</strong><span>${esc(phone())}</span></a>`:''}<a class="account-card" href="mailto:shop@gostore.mn"><strong>И-мэйл</strong><span>shop@gostore.mn</span></a><a class="account-card" href="#delivery"><strong>Агуулахын хаяг</strong><span>${esc((settings().pickup?.address||'Улаанбаатар').split('\n')[0])}</span></a></div><h2 class="store-subtitle">Түгээмэл асуултууд</h2><div class="store-faq">${faq.map(([q,a])=>`<details class="account-card"><summary>${esc(q)}</summary><div>${a}</div></details>`).join('')}</div><p class="account-hint" id="help-empty" hidden>Тохирох асуулт олдсонгүй. shop@gostore.mn хаягаар бидэнд бичээрэй.</p><section id="delivery" class="store-delivery"><span class="section-kicker">ХҮРГЭЛТ & КАРГО</span><h2 class="store-subtitle">Хүргэлтийн нөхцөл</h2><ol class="store-route"><li><strong>Нийлүүлэгч</strong><span>Taobao дэлгүүр барааг Эрээн агуулах руу илгээнэ.</span></li><li><strong>Эрээн агуулах</strong><span>Хүлээн авч, тулгаж, жигнэж, багцална.</span></li><li><strong>Замын-Үүд</strong><span>Хил дамжин Монголд орж ирнэ.</span></li><li><strong>Улаанбаатар агуулах</strong><span>Задалж, захиалга бүрээр ангилж, танд мэдэгдэнэ.</span></li></ol>${s.weight_step_kg?`<table class="store-tariff"><caption>Каргоны тариф (одоогийн тохиргоо)</caption><tbody><tr><th scope="row">Жингээр</th><td>${esc(s.weight_step_kg)} кг тутам ${money(s.weight_step_mnt)}</td></tr><tr><th scope="row">Эзлэхүүн &lt; ${esc(s.volume_threshold)} м³</th><td>${money(Math.round(s.volume_small_cny*s.cny_rate))} / м³</td></tr><tr><th scope="row">Эзлэхүүн ≥ ${esc(s.volume_threshold)} м³</th><td>${money(Math.round(s.volume_large_cny*s.cny_rate))} / м³</td></tr></tbody></table>`:''}<div class="store-pickup account-card"><h3>Хүлээн авах</h3>${pickupHtml()}${phone()?`<p>Утас: <a href="tel:${esc(phone().replace(/[^\d+]/g,''))}">${esc(phone())}</a></p>`:''}</div></section>`;
    if(location.hash==='#delivery')root.querySelector('#delivery').scrollIntoView();
  }
  const render=()=>page==='cart'?renderCart():renderHelp();
  document.title=(page==='cart'?'Миний сагс':'Тусламж')+' · gostore.mn';
  root.innerHTML='<p class="account-loading">Ачаалж байна…</p>';
  (async()=>{try{await window.catalogReady;}catch{}render();})();
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||page!=='cart')return;
    const items=taobaoCart.items();
    if(b.dataset.cartQty!==undefined){const i=items[Number(b.dataset.cartQty)];if(!i)return;const qty=i.qty+Number(b.dataset.delta)*i.step;if(qty<i.min_qty||qty>Math.min(9999,i.stock??9999))return;i.qty=qty;taobaoCart.save(items);renderCart();return;}
    if(b.dataset.cartRemove!==undefined){items.splice(Number(b.dataset.cartRemove),1);taobaoCart.save(items);renderCart();toast('Сагснаас хаслаа');return;}
    if(b.dataset.cartSave!==undefined){const index=Number(b.dataset.cartSave);if(saveForLater([items[index]])){items.splice(index,1);taobaoCart.save(items);renderCart();toast('Хадгалсан бараанд шилжүүллээ');}return;}
    if(b.hasAttribute('data-cart-save-all')){const rest=items.filter(i=>!/^tb-/.test(i.id));if(saveForLater(items)){taobaoCart.save(rest);renderCart();toast('Сагсны барааг хадгалсан бараанд шилжүүллээ');}return;}
    if(b.hasAttribute('data-cart-clear')){if(!confirm('Сагсны бүх барааг хасах уу?'))return;taobaoCart.save([]);renderCart();toast('Сагс хоосорлоо');}
  });
  root.addEventListener('input',e=>{if(e.target.id!=='help-search')return;const q=e.target.value.trim().toLocaleLowerCase('mn');let shown=0;root.querySelectorAll('.store-faq details').forEach(d=>{const hit=!q||d.textContent.toLocaleLowerCase('mn').includes(q);d.hidden=!hit;if(hit)shown++;if(q&&hit)d.open=true;});root.querySelector('#help-empty').hidden=shown>0;});
  // The cart page stays in sync with changes from other tabs and from a completed checkout.
  window.addEventListener('storage',e=>{if(page==='cart'&&e.key===taobaoCart.key)renderCart();});
  window.addEventListener('gostore-cart-changed',()=>{if(page==='cart')renderCart();});
})();
