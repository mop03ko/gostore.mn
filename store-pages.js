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
    try{localStorage.setItem(FAVORITES,JSON.stringify([...add,...saved].slice(0,100)));window.dispatchEvent(new Event('gostore-favorites-changed'));}catch{toast('Хөтөч хадгалах боломжгүй байна.');return false;}
    updateCounts();return true;
  }
  // Lines are grouped by shop with a checkbox per line, per shop and for the whole cart; only
  // the selected lines are estimated and ordered. Unchecked lines stay in the cart.
  const lineKey=i=>i.id+'|'+i.sku,shopKey=i=>i.vendor_id?'v:'+i.vendor_id:'p:'+i.id;
  const unpicked=new Set();
  const picked=items=>items.filter(i=>!unpicked.has(lineKey(i)));
  function cartLine(l){
    const on=!unpicked.has(lineKey(l)),index=l.index;
    return `<article class="store-cart-line"><label class="cart-check"><input type="checkbox" data-cart-pick="${index}" ${on?'checked':''} aria-label="${esc(l.name)} сонгох"></label>${/^https:\/\//i.test(l.image||'')?`<a href="${href(l.id)}" aria-label="${esc(l.name)}"><img src="${esc(l.image)}" alt="" referrerpolicy="no-referrer" loading="lazy"></a>`:'<span class="store-cart-noimage"></span>'}<div class="store-cart-info"><h3><a href="${href(l.id)}">${esc(l.name)}</a></h3><p>${esc(l.variant)}</p><p class="store-cart-unit">${l.unit===null?'Үнэ тооцоолно':money(l.unit)+' / ш'}</p><div class="store-cart-actions"><button type="button" class="text-button" data-compare-toggle="${esc(l.id)}" data-name="${esc(l.name)}" data-image="${esc(l.image||'')}">Харьцуулах</button>${/^tb-/.test(l.id)?`<button type="button" class="text-button" data-cart-save="${index}">Хадгалах</button>`:''}<button type="button" class="text-button danger" data-cart-remove="${index}">Хасах</button></div></div><div class="store-cart-qty"><div class="quantity-controls"><button type="button" data-cart-qty="${index}" data-delta="-1" aria-label="${esc(l.name)} тоог бууруулах" ${l.qty-l.step<l.min_qty?'disabled':''}>−</button><span>${l.qty}</span><button type="button" data-cart-qty="${index}" data-delta="1" aria-label="${esc(l.name)} тоог нэмэх" ${l.qty+l.step>Math.min(9999,l.stock??9999)?'disabled':''}>+</button></div><strong>${l.total===null?'—':money(l.total)}</strong></div></article>`;
  }
  function renderCart(){
    const items=taobaoCart.items(),lines=items.map((i,index)=>{const unit=taobaoCart.unitMnt(i);return {...i,index,unit,total:unit===null?null:Math.ceil(Number((i.cny*Number(settings().cny_rate)*i.qty).toFixed(8)))};});
    for(const k of [...unpicked])if(!items.some(i=>lineKey(i)===k))unpicked.delete(k);
    const shops=[];for(const l of lines){const k=shopKey(l);let g=shops.find(x=>x.key===k);if(!g)shops.push(g={key:k,name:'',lines:[]});g.lines.push(l);g.name||=String(l.vendor_name||'').trim();}
    const chosen=picked(items),all=chosen.length===items.length,q=chosen.length?commerceUI.estimate(chosen,settings()):null,pay=q?.total??q?.goods??null;
    const checkbox=(attr,list,label)=>{const on=list.filter(i=>!unpicked.has(lineKey(i))).length;return `<input type="checkbox" ${attr} ${on===list.length?'checked':''} ${on&&on<list.length?'data-mixed':''} aria-label="${esc(label)}">`;};
    const checkout=chosen.length?`<button type="button" class="button blue store-cart-checkout" ${all?'data-tb-checkout':'data-cart-checkout-picked'}>Төлбөр тооцох (${chosen.length}) ${icon('arrow')}</button>`:'<button type="button" class="button blue store-cart-checkout" disabled>Бараа сонгоно уу</button>';
    // The pinned phone bar repeats the summary action under its own class; it orders the same selection.
    const barCheckout=`<button type="button" class="button blue store-cart-bar-go" data-cart-checkout-picked ${chosen.length?'':'disabled'}>Төлбөр тооцох${chosen.length?' ('+chosen.length+')':''}</button>`;
    const shop=g=>`<section class="store-cart-shop"><header><label class="cart-check">${checkbox(`data-cart-shop="${esc(g.key)}"`,g.lines,(g.name||'Дэлгүүр')+' — бүх барааг сонгох')}<span>${icon('bag')}${esc(g.name||'Нийлүүлэгчийн дэлгүүр')}</span></label><small>${g.lines.length} бараа</small></header>${g.lines.map(cartLine).join('')}</section>`;
    root.innerHTML=crumbs('Миний сагс')+`<h1 class="store-title">Миний сагс <span>${items.length} бараа</span></h1>`+(items.length?`<div class="store-cart"><div class="store-cart-lines"><p class="account-hint">${esc(commerceUI.unitHelp)}</p><div class="store-cart-tools"><label class="cart-check cart-check-all">${checkbox('data-cart-all',items,'Бүх барааг сонгох')}<span>Бүгдийг сонгох</span></label><button type="button" class="text-button" data-cart-save-all>Бүх барааг хадгалах</button><button type="button" class="text-button danger" data-cart-clear>Бүгдийг хасах</button></div>${shops.map(shop).join('')}</div><aside class="store-cart-summary"><h2>Захиалгын хураангуй</h2><p class="store-cart-picked">Сонгосон: <strong>${chosen.length}</strong> / ${items.length} бараа</p>${chosen.length?commerceUI.estimateHtml(chosen,settings()):'<p class="account-hint">Тооцоо хийх бараагаа сонгоно уу.</p>'}${checkout}<p class="account-hint">Захиалахад QPay-ээр ${Number(settings().payment_window_hours)||24} цагийн дотор төлнө. Бараагаа Улаанбаатар агуулахаас авах эсвэл хүргүүлж болно.</p><div class="store-help-card"><strong>Тусламж хэрэгтэй юу?</strong><p>Захиалгатай холбоотой асуултаа бидэнд илгээгээрэй.</p>${phone()?`<a class="text-button" href="tel:${esc(phone().replace(/[^\d+]/g,''))}">${esc(phone())}</a>`:''}<a class="text-button" href="mailto:shop@gostore.mn">shop@gostore.mn</a></div></aside></div><div class="store-cart-bar"><label class="cart-check">${checkbox('data-cart-all',items,'Бүх барааг сонгох')}<span>Бүгд</span></label><p><small>${q?.total!=null?'Одоо төлөх':'Барааны дүн'}</small><strong>${pay===null?'—':money(pay)}</strong></p>${barCheckout}</div>`:`<div class="account-empty">${icon('bag')}<h3>Сагс тань хоосон байна</h3><p>Таалагдсан бараагаа сагсандаа нэмээрэй.</p><a class="button blue" href="/#catalog">Бараа үзэх</a></div>`);
    root.querySelectorAll('[data-mixed]').forEach(i=>i.indeterminate=true);
    document.documentElement.classList.toggle('store-cart-filled',!!items.length);
  }
  // ---------- Help & delivery ----------
  function renderHelp(){
    const s=settings(),window_h=Number(s.payment_window_hours)||24,domestic=Number(s.domestic_default_cny)>0;
    const faq=[
      ['Хэрхэн худалдан авах вэ?',`<ol class="help-list"><li>Бараа, өнгө/хэмжээ, тоогоо сонгоно.</li><li>«Сагслах» эсвэл «Худалдан авах» дарна.</li><li>Нэвтэрч, хүлээн авах хэлбэрээ сонгоод «Захиалах» дарна.</li><li>QPay QR эсвэл банкны аппаар төлнө.</li></ol>`],
      ['Захиалахдаа юуны төлбөр төлөх вэ?',`<p>Барааны үнэ (захиалгын тооцоонд ашигласан ханшаар төгрөгт хөрвүүлсэн)${domestic?', Хятад доторх хүргэлт':''} болон үйлчилгээний хураамжийг захиалахдаа төлнө. ${domestic?'':'Хятад доторх хүргэлт болон '}Олон улсын каргоны төлбөрийг бараа Улаанбаатарт ирэхэд бодит дүнгээр эцсийн тооцоонд нэмнэ.</p>`],
      ['Төлбөрөө хэрхэн, хэзээ төлөх вэ?',`<p>Захиалга үүсмэгц QPay нэхэмжлэл гарна. ${window_h} цагийн дотор төлөөгүй захиалга автоматаар цуцлагдана. Үлдэгдэл (карго, хүргэлт)-ийг «Миний захиалгууд» хэсгээс QPay-ээр төлнө.</p>`],
      ['Каргоны төлбөр хэрхэн тооцогдох вэ?',s.weight_step_kg?`<p>Эрээн агуулахад ачааг бодитоор жигнэж, хэмжинэ.</p><ul class="help-list"><li>Жингээр: ${esc(s.weight_step_kg)} кг тутам ${money(s.weight_step_mnt)} (дээш бүхэлчилнэ).</li><li>Эзлэхүүнээр: ${esc(s.volume_threshold)} м³-аас бага бол ${money(Math.round(s.volume_small_cny*s.cny_rate))}/м³, түүнээс их буюу тэнцүү бол ${money(Math.round(s.volume_large_cny*s.cny_rate))}/м³.</li></ul><p>Аль аргаар тооцохыг ачааны төрлөөс хамааран агуулах баталгаажуулна.</p>`:'<p>Эрээн агуулахад бодитоор жигнэж, хэмжиж тооцно.</p>'],
      ['Захиалгынхаа явцыг хаанаас харах вэ?','<p>«Миний бүртгэл → Миний захиалгууд» эсвэл «Миний ачаа» хэсгээс Эрээнд ирсэн, илгээсэн, Улаанбаатарт ирсэн явц болон агуулахын зургийг харна. Төлөв өөрчлөгдөх бүрт сайтад мэдэгдэл ирнэ.</p>'],
      ['Бараагаа хаанаас авах вэ?',`${pickupHtml()}<p>Төлбөрөө бүрэн төлсний дараа 8 оронтой авах код гарна. Кодоо агуулахын ажилтанд хэлж бараагаа авна. Хүргэлтээр авах бол хүргэлтийн төлбөр эцсийн тооцоонд нэмэгдэнэ.</p>`],
      ['Хэзээ ирэх вэ?',`<p>${esc(commerceUI.timingText())}</p>`],
      ['Захиалгаа цуцлах боломжтой юу?',`<p>Төлөөгүй захиалга ${window_h} цагийн дараа автоматаар цуцлагдана. Төлбөр төлсөн захиалгыг цуцлах бол бидэнтэй холбогдоно уу: нийлүүлэгчээс аль хэдийн захиалсан бол цуцлах боломж нийлүүлэгчээс хамаарна.</p>`],
      ['Бараа дутуу эсвэл гэмтэлтэй ирвэл яах вэ?','<p>Агуулахууд ачааг хүлээн авахдаа тулгаж, зураг авдаг. Зөрүү илэрвэл захиалга дээр бүртгэж шийдвэрлэнэ. Асуудал гарвал захиалгын код, сонгосон хувилбар, хүлээн авсан огноо болон бараа, савлагааны зургийг бидэнд илгээнэ үү. Хүсэлтийг шалгасны дараа боломжит шийдэл, хугацаа, буцаах тээврийн зардлыг тусад нь мэдээлнэ. Нийлүүлэгчийн баталгаагүй буцаалт, нөхөн төлбөрийг урьдчилан амлахгүй.</p>'],
    ];
    const topics=[['all','Бүгд'],['order','Захиалга'],['payment','Төлбөр'],['delivery','Карго, хүргэлт'],['returns','Буцаалт, цуцлалт']];
    const groups=['order','payment','payment','delivery','order','delivery','delivery','returns','returns'];
    const ids=['ordering','payment-details','payment-deadline','cargo-pricing','order-tracking','collecting','arrival','cancellation','returns'];
    const telephone=phone()?`<a href="tel:${esc(phone().replace(/[^\d+]/g,''))}">${esc(phone())}</a>`:'';
    root.classList.add('help-page');
    root.innerHTML=crumbs('Тусламж')+`
      <header class="help-hero">
        <div><span class="help-eyebrow">GOSTORE · ТУСЛАМЖИЙН ТӨВ</span><h1>Танд юугаар туслах вэ?</h1><p>Захиалахаас эхлээд бараагаа хүлээн авах хүртэл — хэрэгтэй мэдээлэл нэг дор.</p>
        <div class="help-search"><label class="sr-only" for="help-search">Асуулт хайх</label>${icon('search')}<input id="help-search" type="search" placeholder="Төлбөр, карго, бараа авах..." autocomplete="off" aria-controls="help-questions"><button type="button" data-help-clear aria-label="Хайлтыг цэвэрлэх" hidden>×</button></div></div>
        <span class="help-hero-mark" aria-hidden="true">?</span>
      </header>
      <div class="help-shortcuts">
        <a href="/account/orders"><span class="help-shortcut-icon">${icon('bag')}</span><span><strong>Захиалгаа хянах</strong><small>Явц, агуулахын зураг, авах код</small></span><span aria-hidden="true">↗</span></a>
        <a href="#delivery"><span class="help-shortcut-icon">${icon('truck')}</span><span><strong>Каргоны төлбөр</strong><small>Тариф болон зардлын тооцоолуур</small></span><span aria-hidden="true">↗</span></a>
        <a href="#contact"><span class="help-shortcut-icon">?</span><span><strong>Бидэнтэй холбогдох</strong><small>Танд нэмэлт тусламж хэрэгтэй юу?</small></span><span aria-hidden="true">↗</span></a>
      </div>
      <div class="help-layout">
        <nav class="help-nav" aria-label="Тусламжийн бүлгүүд"><span>ЭНЭ ХУУДСАНД</span><a href="#questions">Түгээмэл асуулт</a><a href="#payment">Төлбөрийн мэдээлэл</a><a href="#delivery">Карго, хүргэлт</a><a href="#pickup">Бараа хүлээн авах</a><a href="#contact">Холбоо барих</a></nav>
        <div class="help-content">
          <section id="questions" class="help-section">
            <div class="help-section-heading"><span>01</span><div><h2>Түгээмэл асуултууд</h2><p>Сэдвээ сонгох эсвэл дээрх хайлтаар асуултаа олоорой.</p></div></div>
            <div class="help-topics" role="group" aria-label="Асуултын сэдэв">${topics.map(([id,label])=>`<button type="button" data-help-topic="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div>
            <p id="help-results" class="help-results" role="status">Нийт ${faq.length} асуулт</p>
            <div id="help-questions" class="store-faq">${faq.map(([q,a],i)=>`<details id="${ids[i]}" data-topic="${groups[i]}"><summary>${esc(q)}</summary><div>${a}</div></details>`).join('')}</div>
            <div id="help-empty" class="help-empty" hidden><strong>Тохирох асуулт олдсонгүй</strong><p>Өөр үгээр хайх эсвэл бидэнд <a href="mailto:shop@gostore.mn">и-мэйл бичээрэй.</a></p><button type="button" class="text-button" data-help-reset>Бүх асуултыг харах →</button></div>
          </section>
          <section id="payment" class="help-section">
            <div class="help-section-heading"><span>02</span><div><h2>Хэзээ, юунд төлөх вэ?</h2><p>Захиалгын төлбөр ба тээврийн эцсийн тооцоо.</p></div></div>
            <div class="help-payment-grid">
              <article class="help-panel"><span class="help-badge">Захиалга хийхэд</span><h3>Одоо төлөх</h3><ul class="help-list"><li>Барааны үнэ</li><li>Үйлчилгээний хураамж</li>${domestic?'<li>Хятад доторх хүргэлтийн урьдчилсан төлбөр</li>':''}</ul><p>QPay QR эсвэл банкны апп ашиглан ${window_h} цагийн дотор төлнө.</p></article>
              <article class="help-panel"><span class="help-badge help-badge-muted">Эцсийн тооцоогоор</span><h3>Дараа төлөх</h3><ul class="help-list">${!domestic?'<li>Хятад доторх хүргэлт</li>':''}<li>Олон улсын каргоны төлбөр</li><li>Хот доторх хүргэлт сонгосон бол хүргэлтийн төлбөр</li></ul><p>Бодит жин, хэмжээ болон хүргэлтийн мэдээллээр баталгаажуулна.</p></article>
            </div>
            <p class="help-note">Төлбөрийн задаргаа, үлдэгдлээ <a href="/account/orders">Миний захиалгууд</a> хэсгээс харж, QPay-ээр төлөх боломжтой. Урьдчилсан дүн эцсийн тооцоогоор өөрчлөгдөж болно.</p>
          </section>
          <section id="delivery" class="help-section store-delivery">
            <div class="help-section-heading"><span>03</span><div><h2>Карго, хүргэлт</h2><p>Таны бараа ямар замаар ирэх вэ?</p></div></div>
            <ol class="store-route"><li><strong>Нийлүүлэгч</strong><span>Барааг Эрээн агуулах руу илгээнэ.</span></li><li><strong>Эрээн агуулах</strong><span>Хүлээн авч, зураг авч, жигнэж, багцална.</span></li><li><strong>Замын-Үүд</strong><span>Хил дамжин Монголд орж ирнэ.</span></li><li><strong>Улаанбаатар</strong><span>Захиалга бүрээр ангилж, танд мэдэгдэнэ.</span></li></ol>
            <p class="help-note">${esc(commerceUI.timingText())}</p>
            <div class="help-delivery-grid"><div class="help-panel"><h3>Каргоны тариф</h3>${s.weight_step_kg?`<table class="store-tariff"><caption class="sr-only">Каргоны одоогийн тариф</caption><tbody><tr><th scope="row">Жингээр</th><td>${esc(s.weight_step_kg)} кг тутам <strong>${money(s.weight_step_mnt)}</strong></td></tr><tr><th scope="row">Эзлэхүүн &lt; ${esc(s.volume_threshold)} м³</th><td>${money(Math.round(s.volume_small_cny*s.cny_rate))} / м³</td></tr><tr><th scope="row">Эзлэхүүн ≥ ${esc(s.volume_threshold)} м³</th><td>${money(Math.round(s.volume_large_cny*s.cny_rate))} / м³</td></tr></tbody></table><p>Жинг дээш бүхэлчилнэ. Тооцох аргыг ачааны төрлөөс хамааран агуулах баталгаажуулна.</p>`:'<p>Тарифын мэдээлэл ачаалагдсангүй. Бидэнтэй холбогдож лавлана уу.</p>'}</div><div class="help-panel"><h3>Зардлаа урьдчилан тооцоолох</h3><p>Жин эсвэл эзлэхүүнээ оруулж каргоны ойролцоо төлбөрийг хараарай.</p>${commerceUI.calculator(s)}</div></div>
          </section>
          <section id="pickup" class="help-section">
            <div class="help-section-heading"><span>04</span><div><h2>Бараагаа хүлээн авах</h2><p>Агуулахаас авах эсвэл хүргүүлэх боломжтой.</p></div></div>
            <div class="help-pickup-grid"><div class="help-panel help-address"><span class="help-badge">Агуулахын хаяг</span>${pickupHtml()}${telephone?`<p>Утас: ${telephone}</p>`:''}</div><div class="help-panel"><h3>Ирж авахын өмнө</h3><ol class="help-list"><li>Бараа Улаанбаатар агуулахад ирсэн эсэхийг шалгана.</li><li>Төлбөрийн үлдэгдлээ бүрэн төлнө.</li><li>8 оронтой авах кодоо агуулахын ажилтанд хэлнэ.</li></ol><a class="text-button" href="/account/orders">Миний захиалгууд →</a></div></div>
          </section>
          <section id="contact" class="help-contact">
            <div><span class="help-eyebrow">БИД ТАНД ТУСАЛЪЯ</span><h2>Асуултынхаа хариуг олсонгүй юу?</h2><p>Захиалгын код, барааны мэдээлэл болон шаардлагатай зургийг бэлдвэл бид хурдан шалгах боломжтой.</p></div>
            <div class="help-contact-links">${telephone?`<div><small>Утсаар холбогдох</small>${telephone}</div>`:''}<div><small>И-мэйл бичих</small><a href="mailto:shop@gostore.mn">shop@gostore.mn</a></div>${s.pickup?.hours?`<p>Агуулахын цаг: ${esc(s.pickup.hours)}</p>`:''}</div>
          </section>
        </div>
      </div>`;
    revealHelpAnchor();
  }
  let helpTopic='all';
  function filterHelp(){
    const q=root.querySelector('#help-search').value.trim().toLocaleLowerCase('mn');
    let shown=0;
    root.querySelectorAll('.store-faq details').forEach(d=>{
      const hit=(helpTopic==='all'||d.dataset.topic===helpTopic)&&(!q||d.textContent.toLocaleLowerCase('mn').includes(q));
      d.hidden=!hit;d.open=!!q&&hit;if(hit)shown++;
    });
    root.querySelectorAll('[data-help-topic]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.helpTopic===helpTopic)));
    root.querySelector('[data-help-clear]').hidden=!q;
    root.querySelector('#help-results').textContent=q||helpTopic!=='all'?`${shown} асуулт олдлоо`:`Нийт ${shown} асуулт`;
    root.querySelector('#help-empty').hidden=shown>0;
  }
  function revealHelpAnchor(){
    if(page!=='help'||!location.hash)return;
    const target=[...root.querySelectorAll('[id]')].find(el=>'#'+el.id===location.hash);
    if(!target)return;
    if(target.tagName==='DETAILS'){helpTopic='all';root.querySelector('#help-search').value='';filterHelp();target.open=true;}
    requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  }
  window.addEventListener('hashchange',revealHelpAnchor);
  const render=()=>page==='cart'?renderCart():renderHelp();
  document.title=(page==='cart'?'Миний сагс':'Тусламж')+' · gostore.mn';
  root.innerHTML='<p class="account-loading">Ачаалж байна…</p>';
  (async()=>{try{await window.catalogReady;}catch{}render();})();
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(page==='help'){
      if(b.hasAttribute('data-help-topic')){helpTopic=b.dataset.helpTopic;filterHelp();}
      if(b.hasAttribute('data-help-clear')||b.hasAttribute('data-help-reset')){helpTopic='all';const input=root.querySelector('#help-search');input.value='';filterHelp();input.focus({preventScroll:true});}
      return;
    }
    const items=taobaoCart.items();
    if(b.dataset.cartQty!==undefined){const i=items[Number(b.dataset.cartQty)];if(!i)return;const qty=i.qty+Number(b.dataset.delta)*i.step;if(qty<i.min_qty||qty>Math.min(9999,i.stock??9999))return;i.qty=qty;taobaoCart.save(items);renderCart();return;}
    if(b.dataset.cartRemove!==undefined){items.splice(Number(b.dataset.cartRemove),1);taobaoCart.save(items);renderCart();toast('Сагснаас хаслаа');return;}
    if(b.dataset.cartSave!==undefined){const index=Number(b.dataset.cartSave);if(saveForLater([items[index]])){items.splice(index,1);taobaoCart.save(items);renderCart();toast('Хадгалсан бараанд шилжүүллээ');}return;}
    if(b.hasAttribute('data-cart-save-all')){const rest=items.filter(i=>!/^tb-/.test(i.id));if(saveForLater(items)){taobaoCart.save(rest);renderCart();toast('Сагсны барааг хадгалсан бараанд шилжүүллээ');}return;}
    if(b.hasAttribute('data-cart-checkout-picked')){const chosen=picked(items);if(chosen.length)taobaoCart.checkout('',chosen.length===items.length?null:chosen);return;}
    if(b.hasAttribute('data-cart-clear')){if(!confirm('Сагсны бүх барааг хасах уу?'))return;taobaoCart.save([]);renderCart();toast('Сагс хоосорлоо');}
  });
  root.addEventListener('input',e=>{if(e.target.id==='help-search')filterHelp();});
  root.addEventListener('change',e=>{
    const box=e.target;if(page!=='cart'||box.type!=='checkbox')return;
    const items=taobaoCart.items(),set=(list,on)=>list.forEach(i=>on?unpicked.delete(lineKey(i)):unpicked.add(lineKey(i)));
    if(box.hasAttribute('data-cart-all'))set(items,box.checked);
    else if(box.dataset.cartShop)set(items.filter(i=>shopKey(i)===box.dataset.cartShop),box.checked);
    else if(box.dataset.cartPick!==undefined){const i=items[Number(box.dataset.cartPick)];if(i)set([i],box.checked);}
    else return;
    // Re-rendering replaces the controls; keep keyboard focus on the same checkbox.
    const focus=[...root.querySelectorAll('input[type=checkbox]')].indexOf(box);renderCart();root.querySelectorAll('input[type=checkbox]')[focus]?.focus({preventScroll:true});
  });
  // The cart page stays in sync with changes from other tabs and from a completed checkout.
  window.addEventListener('storage',e=>{if(page==='cart'&&e.key===taobaoCart.key)renderCart();});
  window.addEventListener('gostore-cart-changed',()=>{if(page==='cart')renderCart();});
})();
