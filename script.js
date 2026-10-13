'use strict';

// Demo catalog only. Replace with a verified server-side catalog before launch.
const products = [
  {id:'chair',name:'Nordic загварын зөөлөн сандал',category:'home',price:189000,type:'china',source:'Хятад захиалга',image:'chair',variants:['Зураг дээрх өнгө'],description:'Гэрийн амралтын булан, ажлын өрөөнд зориулсан сандлын жишээ загвар. Бодит материал, хэмжээ, үлдэгдлийг нийлүүлэгчтэй баталгаажуулна.'},
  {id:'headphones',name:'Өдөр тутмын утасгүй чихэвч',category:'tech',price:129000,type:'local',source:'GOStore сонголт',image:'headphones',variants:['Зураг дээрх өнгө'],description:'Хөгжим сонсох, ажиллах, хичээллэхэд зориулсан чихэвчийн жишээ загвар. Батарей, холболт, баталгааны бодит үзүүлэлтийг каталогт оруулахдаа тодорхойлно.'},
  {id:'backpack',name:'Хотын хэмнэлд тохирох үүргэвч',category:'bags',price:79000,type:'china',source:'Хятад захиалга',image:'backpack',variants:['Стандарт'],description:'Ажил, аялал, өдөр тутмын хэрэгцээнд зориулсан үүргэвчийн жишээ. Багтаамж, материал, өнгөний сонголтыг бодит барааны мэдээллээр баталгаажуулна.'},
  {id:'sneakers',name:'Спорт загварын өдөр тутмын пүүз',category:'shoes',price:159000,type:'local',source:'GOStore сонголт',image:'sneakers',variants:['38','39','40','41','42'],description:'Өдөр тутмын хувцастай хослуулах пүүзний жишээ. Хэмжээний хүснэгт болон бодит үлдэгдлийг захиалга авахаас өмнө оруулна.'},
  {id:'watch',name:'Минимал загварын бугуйн цаг',category:'accessories',price:89000,type:'local',source:'GOStore сонголт',image:'watch',variants:['Стандарт'],description:'Цэвэрхэн нүүр, энгийн хийцтэй цагийн жишээ загвар. Механизм, оосрын материал, баталгааны нөхцөл хараахан баталгаажаагүй.'},
  {id:'lamp',name:'Тухтай орчны ширээний гэрэл',category:'lighting',price:65000,type:'china',source:'Хятад захиалга',image:'lamp',variants:['Зураг дээрх загвар'],description:'Гэрийн орчинд дулаан мэдрэмж нэмэх гэрлийн жишээ. Залгуур, хүчдэл, гэрлийн чадлыг бодит бүтээгдэхүүнтэй тулган баталгаажуулна.'},
  {id:'skincare',name:'Өдөр тутмын арьс арчилгааны багц',category:'beauty',price:59000,type:'local',source:'GOStore сонголт',image:'skincare',variants:['Жишээ багц'],description:'Арьс арчилгааны багцын жишээ зураг. Найрлага, үйлдвэрлэгч, хугацаа болон хэрэглэх заавар нь бодит каталогт заавал орно.'},
  {id:'home-set',name:'Гэрийн интерьерийн сонголт',category:'home',price:249000,type:'china',source:'Хятад захиалга',image:'living',variants:['Үнийн санал авах'],description:'Гэрийн интерьерийн жишээ сонголт. Зурагт харагдах бүх эд зүйл энэ үнэд багтсан гэсэн үг биш; багцын бүрдэл, үнэ нь бодит захиалгаас өмнө баталгаажна.'}
];
const categories = [
  {id:'home',name:'Гэр ахуй',image:'chair',subtitle:'Тухтай орон зай'},
  {id:'tech',name:'Электроник',image:'headphones',subtitle:'Өдөр тутмын технологи'},
  {id:'bags',name:'Цүнх, үүргэвч',image:'backpack',subtitle:'Тантай хамт'},
  {id:'shoes',name:'Гутал',image:'sneakers',subtitle:'Өөрийн хэмнэлээр'},
  {id:'accessories',name:'Аксессуар',image:'watch',subtitle:'Жижигхэн онцлог'},
  {id:'beauty',name:'Гоо сайхан',image:'skincare',subtitle:'Өөртөө цаг гарга'},
  {id:'lighting',name:'Гэрэлтүүлэг',image:'lamp',subtitle:'Шинэ уур амьсгал'}
];
const $ = (selector, root=document) => root.querySelector(selector);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('en-US').format(value) + ' ₮';
let localProductsEnabled = false;
const productAvailable = p => p && (p.type !== 'local' || localProductsEnabled);
const productById = id => products.find(p => p.id === id && productAvailable(p));
const STORAGE_KEY = 'gostore-demo-v1';
let storageAvailable = true;
function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      cart: Array.isArray(raw.cart) ? raw.cart.filter(item => item && productById(item.id)?.variants.includes(item.variant) && Number.isInteger(item.qty) && item.qty>0 && item.qty<=99).slice(0,100) : [],
      favorites: Array.isArray(raw.favorites) ? [...new Set(raw.favorites.filter(id => productById(id)))] : [],
      drafts: Array.isArray(raw.drafts) ? raw.drafts.filter(d => d && typeof d.id==='string' && typeof d.created==='string' && typeof d.title==='string' && typeof d.text==='string' && ['link','cart'].includes(d.type)).slice(0,100) : []
    };
  } catch { return {cart:[],favorites:[],drafts:[]}; }
}
const state = readState();
let filters = {type:'all',category:'all',query:'',sort:'featured'};
let toastTimer;
let lastFocus;
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
function persist() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); storageAvailable=true; }
  catch { storageAvailable=false; toast('Хөтөч хадгалах боломжгүй байна. Нооргоо татаж аваарай.'); }
  updateCounts();
  return storageAvailable;
}
function updateCounts() {
  const count=state.cart.reduce((sum,item)=>sum+item.qty,0);
  $('#cart-count').textContent=count;
  $('#mobile-cart-count').textContent=count;
  $('#favorite-count').textContent=state.favorites.length;
  $('#favorite-count').hidden=!state.favorites.length;
}
function openModal(title,html) {
  const modal=$('#modal');
  if(!modal.open) lastFocus=document.activeElement;
  $('#modal-title').textContent=title; $('#modal-body').innerHTML=html;
  if(!modal.open) modal.showModal();
  document.body.classList.add('modal-open'); modal.scrollTop=0;
  $('#close-modal').focus({preventScroll:true});
}
function closeModal() { $('#modal').close(); }
$('#modal').addEventListener('close',()=>{document.body.classList.remove('modal-open');if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});});
$('#close-modal').addEventListener('click',closeModal);
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});

function renderCategories() {
  $('#category-grid').innerHTML=categories.map(c=>`<button class="category-card ${filters.category===c.id?'active':''}" data-category="${c.id}" aria-pressed="${filters.category===c.id}"><div class="category-image"><img src="assets/${c.image}.jpg" alt="" loading="lazy"></div><strong>${c.name}</strong><small>${c.subtitle}</small></button>`).join('');
}
function visibleProducts() {
  const query=filters.query.toLocaleLowerCase('mn').trim();
  const found=products.filter(p=>productAvailable(p)&&(filters.type==='all'||(filters.type==='saved'?state.favorites.includes(p.id):p.type===filters.type))&&(filters.category==='all'||p.category===filters.category)&&(!query||`${esc(p.name)} ${esc(p.source)} ${categories.find(c=>c.id===p.category)?.name}`.toLocaleLowerCase('mn').includes(query)));
  if(filters.sort==='price-asc')found.sort((a,b)=>a.price-b.price);
  if(filters.sort==='price-desc')found.sort((a,b)=>b.price-a.price);
  return found;
}
function renderProducts() {
  const found=visibleProducts();
  $('#result-count').textContent=`${found.length} бараа${filters.query?' · “'+filters.query+'”':''}`;
  $('#catalog-title').textContent=filters.category!=='all'?categories.find(c=>c.id===filters.category).name:({all:'Танд санал болгох',local:'GOStore-ийн бэлэн бараа',china:'Хятадаас захиалах',saved:'Таны хадгалсан бараа'}[filters.type]);
  $('#reset-filters').hidden=filters.type==='all'&&filters.category==='all'&&!filters.query;
  document.querySelectorAll('.filter-tabs [data-filter]').forEach(el=>{const active=el.dataset.filter===filters.type;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  $('#product-grid').innerHTML=found.length?found.map(p=>`<article class="product-card" data-product="${p.id}">
    <button class="product-image-button" data-detail="${p.id}" aria-label="${esc(p.name)} — дэлгэрэнгүй"><img src="assets/${p.image}.jpg" alt="${esc(p.name)}" loading="lazy"></button>
    <span class="product-type ${p.type}">${icon(p.type==='local'?'check':'box')}${p.type==='local'?'Бэлэн бараа':'Захиалгаар'}</span>
    <button class="favorite-button ${state.favorites.includes(p.id)?'saved':''}" data-favorite="${p.id}" aria-label="${esc(p.name)} — хадгалах" aria-pressed="${state.favorites.includes(p.id)}">${icon('heart')}</button>
    <div class="product-info"><span class="product-source">${esc(p.source)}</span><button class="product-name" data-detail="${p.id}">${esc(p.name)}</button><div class="product-meta"><span class="product-price">${money(p.price)}</span><button class="quick-add" data-add="${p.id}" aria-label="${esc(p.name)} — сагсанд нэмэх">${icon('plus')}</button></div><p class="product-sub">${p.demo!==false?'Жишээ үнэ':'Үнэ'} · хүргэлт ороогүй</p></div></article>`).join(''):`<div class="empty-state">${icon(filters.type==='saved'?'heart':'search')}<h3>${filters.type==='saved'?'Хадгалсан бараа алга':'Тохирох бараа олдсонгүй'}</h3><p>${filters.type==='saved'?'Таалагдсан барааныхаа зүрхэн тэмдгийг дараарай.':'Өөр түлхүүр үг эсвэл ангилал сонгож үзээрэй.'}</p><button class="button blue" data-reset>Бүх барааг үзэх</button></div>`;
}
function scrollCatalog() { $('#catalog').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
function resetFilters() { filters={type:'all',category:'all',query:'',sort:'featured'};$('#search').value='';$('#sort').value='featured';renderCategories();renderProducts(); }
function filterType(type) { if(type==='local'&&!localProductsEnabled)return toast('Бэлэн барааны худалдаа түр зогссон.');if(type==='china'&&window.storeServer?.ready){$('#supplier-catalog').scrollIntoView({behavior:'smooth'});return;} filters.type=type;filters.category='all';filters.query='';$('#search').value='';renderCategories();renderProducts();scrollCatalog(); }
function filterCategory(category) { filters.category=category;filters.type='all';filters.query='';$('#search').value='';renderCategories();renderProducts();scrollCatalog(); }

function showProduct(id) {
  const p=productById(id);if(!p)return;
  openModal(p.name,`<img class="detail-photo" src="assets/${p.image}.jpg" alt="${esc(p.name)}"><div class="detail-heading"><span class="product-source">${esc(p.source)}</span><strong class="product-price">${money(p.price)}</strong></div><p class="detail-copy">${esc(p.description)}</p><form id="product-form" data-product="${p.id}"><div class="form-grid"><label class="field">${p.id==='sneakers'?'Хэмжээ':'Хувилбар'}<select name="variant">${p.variants.map(v=>`<option>${esc(v)}</option>`).join('')}</select></label><label class="field">Тоо ширхэг<input name="qty" type="number" value="1" min="1" max="99" step="1" required></label></div><div class="detail-specs"><div>Захиалгын төрөл<strong>${p.type==='local'?'Бэлэн бараа':'Хятадаас захиалах'}</strong></div><div>Хүргэлт<strong>Үнэ, хугацаа баталгаажаагүй</strong></div></div><div class="info-box">${p.demo!==false?'Жишээ бараа. Бодит худалдааны санал биш.':'Үнэ, үлдэгдэл, хүргэлтийг хүсэлт илгээсний дараа баталгаажуулна.'} Сагсанд нэмэхэд төлбөр төлөгдөхгүй.</div><div class="form-actions"><button class="button outline" type="button" data-action="cart">Сагс харах</button><button class="button blue" type="submit">${icon('bag')} Сагсанд нэмэх</button></div></form>`);
}
function addToCart(id,variant,qty=1) {
  const p=productById(id);if(!p||!p.variants.includes(variant)||!Number.isInteger(qty)||qty<1||qty>99)return;
  const existing=state.cart.find(item=>item.id===id&&item.variant===variant);
  if(existing&&existing.qty+qty>99){toast('Нэг хувилбараас 99 хүртэл ширхэг сонгоно.');return;}
  if(existing)existing.qty+=qty;else state.cart.push({id,variant,qty});
  const saved=persist();if(saved)toast('Сагсанд нэмлээ');
}
function cartTotal() {return state.cart.reduce((sum,item)=>sum+productById(item.id).price*item.qty,0);}
function showCart() {
  if(!state.cart.length){openModal('Миний сагс',`<div class="empty-state">${icon('bag')}<h3>Сагс тань хоосон байна</h3><p>Өөрт таалагдсан бараагаа сонгоорой.</p><button class="button blue" data-action="browse">Бараа үзэх</button></div>`);return;}
  openModal('Миний сагс',state.cart.map((item,index)=>{const p=productById(item.id);return `<div class="cart-row"><img src="assets/${p.image}.jpg" alt="${esc(p.name)}"><div><h3>${esc(p.name)}</h3><small>${esc(item.variant)} · ${p.type==='local'?'Бэлэн бараа':'Захиалгаар'}</small><div class="quantity-controls"><button data-quantity="${index}" data-delta="-1" aria-label="${esc(p.name)} тоог бууруулах" ${item.qty===1?'disabled':''}>−</button><span>${item.qty}</span><button data-quantity="${index}" data-delta="1" aria-label="${esc(p.name)} тоог нэмэх" ${item.qty===99?'disabled':''}>+</button></div></div><div><strong>${money(p.price*item.qty)}</strong><button class="remove-item" data-remove="${index}">Хасах</button></div></div>`;}).join('')+`<div class="cart-totals"><div><span>Барааны жишээ дүн</span><strong>${money(cartTotal())}</strong></div><div><span>Хүргэлт, бусад төлбөр</span><span>Баталгаажаагүй</span></div><div class="total"><span>Дэд нийт</span><strong>${money(cartTotal())}</strong></div></div><div class="info-box">${window.storeServer?.ready?'Хүсэлт илгээсний дараа админ нийт үнийг баталгаажуулна.':'Ноорог хадгалах нь бодит захиалга үүсгэхгүй.'} Тээвэр болон бусад төлбөр дэд нийтэд ороогүй.</div><div class="cart-footer"><button class="button blue" data-action="checkout">${window.storeServer?.ready?'Захиалгын хүсэлт илгээх':'Захиалгын ноорог бэлдэх'} ${icon('arrow')}</button></div>`);
}
function showCheckout() {
  if(window.storeServer?.ready)return window.storeServer.checkout();
  if(!state.cart.length)return showCart();
  openModal('Захиалгын ноорог',`<p class="modal-intro">Сонгосон бараануудаа нэг ноорогт хадгалаарай. Энэ мэдээлэл сервер рүү илгээгдэхгүй, зөвхөн энэ хөтөчид үлдэнэ.</p><form id="checkout-form"><div class="form-grid"><label class="field full">Нооргийн нэр<input name="title" placeholder="Жишээ: Гэрийн шинэ сонголт" maxlength="80" required></label><label class="field full">Хүлээн авах хүсэлт<select name="delivery"><option>Хүргэлтээр авах</option><option>Өөрөө очиж авах</option><option>Дараа шийдэх</option></select></label><label class="field full">Нэмэлт тэмдэглэл<textarea name="notes" maxlength="500" placeholder="Өнгө, хэмжээ болон бусад хүсэлт"></textarea></label></div><div class="cart-totals"><div class="total"><span>Барааны жишээ дүн</span><strong>${money(cartTotal())}</strong></div></div><div class="info-box">Хүргэлтийн төлбөр баталгаажаагүй. Ноорог хадгалахад төлбөр төлөгдөхгүй, сагс тань хэвээр үлдэнэ.</div><div class="form-actions"><button type="button" class="button outline" data-action="cart">Сагс руу буцах</button><button class="button blue" type="submit">Ноорог хадгалах ${icon('check')}</button></div></form>`);
}

function saveDraft(type,title,text) {
  if(state.drafts.length>=100){toast('100 ноорог хадгалсан байна. Хэрэггүй нооргоо устгаад дахин оролдоорой.');return false;}
  const id='GS-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
  state.drafts.unshift({id,type,title,created:new Date().toISOString(),text});persist();showOrders();
  toast(storageAvailable?'Ноорог энэ хөтөчид хадгалагдлаа':'Нооргоо алдахгүйн тулд одоо татаж аваарай.');return true;
}
function showOrders() {
  if(window.storeServer?.ready)return window.storeServer.orders();
  openModal('Миний захиалгын ноорог',`<p class="modal-intro">Энд зөвхөн энэ хөтөчид бэлдсэн нооргууд харагдана. Серверт баталгаажсан захиалга болон ачааны бодит хяналт хараахан холбогдоогүй.</p>`+(state.drafts.length?state.drafts.map(d=>`<article class="draft-card"><div class="draft-top"><h3>${esc(d.title)}</h3><span class="draft-tag">Ноорог · илгээгээгүй</span></div><p>${esc(d.id)} · ${Number.isNaN(Date.parse(d.created))?'Огноо тодорхойгүй':new Date(d.created).toLocaleDateString('mn-MN')}</p><p>${d.type==='link'?'Хуучин хүсэлтийн ноорог':'GOStore сагсны ноорог'}</p><div class="draft-buttons"><button class="text-button" data-view-draft="${esc(d.id)}">Дэлгэрэнгүй</button><button class="text-button" data-download="${esc(d.id)}">Татах ↓</button><button class="text-button" data-delete-draft="${esc(d.id)}">Устгах</button></div></article>`).join(''):`<div class="empty-state">${icon('box')}<h3>Ноорог хараахан алга</h3><p>Сагснаасаа ноорог үүсгээрэй.</p><button class="button blue" data-action="browse">Бараа үзэх</button></div>`));
}
function downloadDraft(id) {
  const d=state.drafts.find(d=>d.id===id);if(!d)return;
  const text=`GOSTORE.MN — ЗАХИАЛГЫН НООРОГ\nБОДИТ ЗАХИАЛГА БИШ / ИЛГЭЭГЭЭГҮЙ\n\n${d.title}\n${d.id}\n${d.created}\n\n${d.text}\n\nҮнэ, хүргэлт, үлдэгдэл баталгаажаагүй.\n`;
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`${d.id.replace(/[^a-z0-9-]/gi,'')}.txt`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const helpContent = {
  help:{title:'Хэрхэн захиалах вэ?',html:`<p class="modal-intro">1688 болон Хятад захиалгын каталогоос бараагаа сонгоно. Өнгө, хэмжээ, тоо, овог нэр, утсаа оруулж захиалгын хүсэлт илгээнэ.</p><p>Хятадаас ирэх ачаа Эрээн → Замын-Үүд → Улаанбаатар чиглэлээр явна. Агуулахад овог нэр, захиалгын кодоор ялган хүлээн авна.</p>`},
  shipping:{title:'Хүргэлтийн тухай',html:`<p class="modal-intro">Хятадаас захиалах барааны хүргэлтийн нөхцөлийг баталгаажуулна.</p><ol class="help-list"><li><strong>Хятад захиалга</strong>Нийлүүлэгчийн хүргэлт, агуулахад ирэх хугацаа, барааны жин ба овор хэмжээгээр тээврийн нөхцөлийг тогтооно.</li></ol><div class="info-box">Одоогоор тариф, хугацаа баталгаажаагүй. Каталогийн жишээ үнэд тээврийн төлбөр ороогүй.</div>`},
  privacy:{title:'Мэдээллийн хадгалалт',html:`<p class="modal-intro">Энэ загварын сагс, хадгалсан бараа, захиалгын ноорог зөвхөн таны хөтөчийн localStorage-д хадгалагдана. Сервер рүү мэдээлэл дамжуулахгүй.</p><p class="detail-copy">Хөтөчийн өгөгдлийг цэвэрлэхэд эдгээр мэдээлэл устах тул хэрэгтэй нооргоо татаж аваарай. Нууц үг, картын дугаар, регистр зэрэг мэдээллийг тэмдэглэлд оруулахгүй байхыг зөвлөж байна.</p><button class="button outline" data-action="clear-data-confirm">Энэ хөтөчийн GOStore мэдээллийг цэвэрлэх</button>`}
};
function runAction(action) {
  if(action==='account')return window.customerAccount?customerAccount.open():toast('Серверийн холболт хүлээгдэж байна.');
  if(action==='cart')return showCart();if(action==='orders')return showOrders();if(action==='checkout')return showCheckout();
  if(action==='favorites'){if($('#modal').open)closeModal();return filterType('saved');}
  if(action==='browse'){closeModal();resetFilters();return scrollCatalog();}
  if(helpContent[action])return openModal(helpContent[action].title,helpContent[action].html);
  if(action==='clear-data-confirm')return openModal('Хадгалсан мэдээллийг цэвэрлэх үү?',`<p class="modal-intro">Сагс, хадгалсан бараа, бүх ноорог энэ хөтөчөөс устна. Хэрэгтэй нооргоо эхлээд татаж аваарай.</p><div class="form-actions"><button class="button outline" data-action="orders">Нооргуудыг харах</button><button class="button blue" data-action="clear-data">Бүгдийг цэвэрлэх</button></div>`);
  if(action==='clear-data'){state.cart=[];state.favorites=[];state.drafts=[];persist();renderProducts();closeModal();toast('Хадгалсан мэдээллийг цэвэрлэлээ');}
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.action)return runAction(b.dataset.action);
  if(b.hasAttribute('data-filter'))return filterType(b.dataset.filter);
  if(b.hasAttribute('data-category'))return filterCategory(b.dataset.category);
  if(b.hasAttribute('data-reset')){resetFilters();return;}
  if(b.dataset.detail)return showProduct(b.dataset.detail);
  if(b.dataset.add){const p=productById(b.dataset.add);if(!p)return;if(p.variants.length>1)return showProduct(p.id);return addToCart(p.id,p.variants[0]);}
  if(b.dataset.favorite){const id=b.dataset.favorite;if(state.favorites.includes(id))state.favorites=state.favorites.filter(x=>x!==id);else state.favorites.push(id);persist();renderProducts();$(`[data-favorite="${id}"]`)?.focus({preventScroll:true});return;}
  if(b.hasAttribute('data-quantity')){const i=Number(b.dataset.quantity),item=state.cart[i];if(item){item.qty=Math.max(1,Math.min(99,item.qty+Number(b.dataset.delta)));persist();showCart();}return;}
  if(b.hasAttribute('data-remove')){state.cart.splice(Number(b.dataset.remove),1);persist();showCart();return;}
  if(b.dataset.download)return downloadDraft(b.dataset.download);
  if(b.dataset.viewDraft){const d=state.drafts.find(x=>x.id===b.dataset.viewDraft);if(d)openModal(d.title,`<p class="modal-intro">Ноорог · Серверт илгээгээгүй</p><div class="info-box" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(d.text)}</div><div class="form-actions"><button class="button outline" data-action="orders">Буцах</button><button class="button blue" data-download="${esc(d.id)}">Ноорог татах</button></div>`);return;}
  if(b.dataset.deleteDraft){state.drafts=state.drafts.filter(d=>d.id!==b.dataset.deleteDraft);persist();showOrders();return;}
});
$('#search-form').addEventListener('submit',e=>{e.preventDefault();const value=$('#search').value.trim();if(/^https?:\/\//i.test(value))return toast('Барааны нэрээр хайж, каталогоос сонгоно уу.');filters.query=value;filters.type='all';filters.category='all';renderCategories();renderProducts();scrollCatalog();});
$('#search').addEventListener('search',()=>{if(!$('#search').value){filters.query='';renderProducts();}});
$('#sort').addEventListener('change',e=>{filters.sort=e.target.value;renderProducts();});
$('#reset-filters').addEventListener('click',resetFilters);
document.addEventListener('submit',event=>{
  const form=event.target;
  if(form.id==='product-form'){event.preventDefault();const data=new FormData(form);addToCart(form.dataset.product,String(data.get('variant')),Number(data.get('qty')));return;}
  if(form.id==='checkout-form'){
    event.preventDefault();const data=new FormData(form),title=String(data.get('title')).trim();if(!title)return;
    const text=state.cart.map(item=>{const p=productById(item.id);return `${esc(p.name)} / ${item.variant} / ${item.qty} ширхэг / ${money(p.price*item.qty)}`;}).join('\n')+`\n\nБарааны жишээ дүн: ${money(cartTotal())}\nХүлээн авах: ${data.get('delivery')}\nТэмдэглэл: ${data.get('notes')||'—'}`;
    saveDraft('cart',title,text);return;
  }

});
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){Object.assign(state,readState());updateCounts();renderProducts();if($('#modal').open)closeModal();}});
$('#year').textContent=new Date().getFullYear();renderCategories();renderProducts();updateCounts();
