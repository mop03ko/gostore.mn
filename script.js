'use strict';

// Products are loaded exclusively from the server catalog.
const products = [];
const categories = [
  {"id":"home","name":"Гэр ахуй","image":"chair","query":"home storage","subtitle":"Шууд захиалга · Гэр ахуй","children":[{"name":"Хадгалах хайрцаг","query":"storage box"},{"name":"Цэвэрлэгээ","query":"cleaning tools"},{"name":"Угаалгын хэрэгсэл","query":"laundry accessories"},{"name":"Орны хэрэглэл","query":"bedding"},{"name":"Алчуур","query":"towels"},{"name":"Хөшиг","query":"curtains"},{"name":"Хивс","query":"rug"},{"name":"Угаалгын өрөө","query":"bathroom accessories"}]},
  {"id":"tech","name":"Электроник","image":"headphones","query":"electronics","subtitle":"Шууд захиалга · Электроник","children":[{"name":"Чихэвч","query":"headphones"},{"name":"Утасны дагалдах","query":"phone accessories"},{"name":"Компьютерын дагалдах","query":"computer accessories"},{"name":"Цэнэглэгч","query":"charger"},{"name":"Гар","query":"keyboard"},{"name":"Хулгана","query":"computer mouse"},{"name":"Камер","query":"camera"},{"name":"Ухаалаг цаг","query":"smart watch"}]},
  {"id":"bags","name":"Цүнх, үүргэвч","image":"catalog-backpack","query":"bag","subtitle":"Шууд захиалга · Цүнх, үүргэвч","children":[{"name":"Үүргэвч","query":"backpack"},{"name":"Эмэгтэй цүнх","query":"handbag"},{"name":"Аяллын цүнх","query":"travel bag"},{"name":"Түрийвч","query":"wallet"},{"name":"Чемодан","query":"suitcase"},{"name":"Зөөврийн компьютерын цүнх","query":"laptop bag"}]},
  {"id":"shoes","name":"Эрэгтэй гутал","image":"sneakers","query":"men shoes","subtitle":"Шууд захиалга · Эрэгтэй гутал","children":[{"name":"Пүүз","query":"men sneakers"},{"name":"Өдөр тутмын гутал","query":"men casual shoes"},{"name":"Спорт гутал","query":"men running shoes"},{"name":"Арьсан гутал","query":"men leather shoes"},{"name":"Өвлийн гутал","query":"men winter boots"},{"name":"Углааш","query":"slippers men"}]},
  {"id":"accessories","name":"Гоёл, аксессуар","image":"watch","query":"jewelry accessories","subtitle":"Шууд захиалга · Гоёл, аксессуар","children":[{"name":"Цаг","query":"watch"},{"name":"Гоёл чимэглэл","query":"jewelry"},{"name":"Нүдний шил","query":"sunglasses"},{"name":"Малгай","query":"baseball cap"},{"name":"Бүс","query":"belt"},{"name":"Ороолт","query":"scarf"},{"name":"Ээмэг","query":"earrings"},{"name":"Хүзүүний зүүлт","query":"necklace"}]},
  {"id":"beauty","name":"Гоо сайхан","image":"skincare","query":"beauty","subtitle":"Шууд захиалга · Гоо сайхан","children":[{"name":"Арьс арчилгаа","query":"skincare"},{"name":"Нүүр будалт","query":"makeup"},{"name":"Гоо сайхны хэрэгсэл","query":"beauty tools"},{"name":"Үсний хэрэгсэл","query":"hair accessories"},{"name":"Уруулын будаг","query":"lipstick"},{"name":"Нарны тос","query":"sunscreen"},{"name":"Хумсны хэрэгсэл","query":"nail tools"},{"name":"Үнэртэн","query":"perfume"}]},
  {"id":"lighting","name":"Гэрэлтүүлэг","image":"lamp","query":"lamp","subtitle":"Шууд захиалга · Гэрэлтүүлэг","children":[{"name":"Ширээний гэрэл","query":"desk lamp"},{"name":"Таазны гэрэл","query":"ceiling lamp"},{"name":"LED гэрэл","query":"LED light"},{"name":"Шөнийн гэрэл","query":"night light"},{"name":"Ханын гэрэл","query":"wall lamp"},{"name":"Гадна гэрэл","query":"outdoor light"}]},
  {"id":"men","name":"Эрэгтэй хувцас","image":"watch","query":"men clothing","subtitle":"Шууд захиалга · Эрэгтэй хувцас","children":[{"name":"Футболк","query":"men t shirt"},{"name":"Цамц","query":"men shirt"},{"name":"Жинс","query":"men jeans"},{"name":"Өмд","query":"men pants"},{"name":"Ноосон цамц","query":"men sweater"},{"name":"Хүрэм","query":"men jacket"},{"name":"Пальто","query":"men coat"},{"name":"Спорт хослол","query":"men tracksuit"},{"name":"Шорт","query":"men shorts"},{"name":"Дотуур хувцас","query":"men underwear"}]},
  {"id":"women","name":"Эмэгтэй хувцас","image":"catalog-backpack","query":"women clothing","subtitle":"Шууд захиалга · Эмэгтэй хувцас","children":[{"name":"Даашинз","query":"dress"},{"name":"Цамц","query":"women blouse"},{"name":"Футболк","query":"women t shirt"},{"name":"Жинс","query":"women jeans"},{"name":"Өмд","query":"women pants"},{"name":"Юбка","query":"skirt"},{"name":"Ноосон цамц","query":"women sweater"},{"name":"Хүрэм","query":"women jacket"},{"name":"Пальто","query":"women coat"},{"name":"Дотуур хувцас","query":"women underwear"}]},
  {"id":"kids","name":"Хүүхдийн хувцас","image":"sneakers","query":"kids clothing","subtitle":"Шууд захиалга · Хүүхдийн хувцас","children":[{"name":"Охидын хувцас","query":"girls clothing"},{"name":"Хөвгүүдийн хувцас","query":"boys clothing"},{"name":"Футболк","query":"kids t shirt"},{"name":"Өмд","query":"kids pants"},{"name":"Хүрэм","query":"kids jacket"},{"name":"Унтлагын хувцас","query":"kids pajamas"},{"name":"Нярайн хувцас","query":"baby clothes"},{"name":"Хүүхдийн малгай","query":"kids hat"}]},
  {"id":"women-shoes","name":"Эмэгтэй гутал","image":"sneakers","query":"women shoes","subtitle":"Шууд захиалга · Эмэгтэй гутал","children":[{"name":"Пүүз","query":"women sneakers"},{"name":"Өсгийтэй гутал","query":"high heels"},{"name":"Түрийтэй гутал","query":"women boots"},{"name":"Балеткан гутал","query":"women flats"},{"name":"Сандаал","query":"women sandals"},{"name":"Гэрийн углааш","query":"women slippers"}]},
  {"id":"kitchen","name":"Гал тогооны хэрэгсэл","image":"chair","query":"kitchen utensils","subtitle":"Шууд захиалга · Гал тогооны хэрэгсэл","children":[{"name":"Сав суулга","query":"cookware"},{"name":"Аяга","query":"cup"},{"name":"Таваг","query":"plate"},{"name":"Хоолны сав","query":"food container"},{"name":"Хутга","query":"kitchen knife"},{"name":"Халбага сэрээ","query":"cutlery"},{"name":"Усны сав","query":"water bottle"},{"name":"Жигнэх хэрэгсэл","query":"baking tools"}]},
  {"id":"appliances","name":"Цахилгаан хэрэгсэл","image":"lamp","query":"home appliances","subtitle":"Шууд захиалга · Цахилгаан хэрэгсэл","children":[{"name":"Ус буцалгагч","query":"electric kettle"},{"name":"Будаа агшаагч","query":"rice cooker"},{"name":"Агаар шарагч","query":"air fryer"},{"name":"Блендер","query":"blender"},{"name":"Кофе чанагч","query":"coffee maker"},{"name":"Тоос сорогч","query":"vacuum cleaner"},{"name":"Индүү","query":"iron"},{"name":"Үс хатаагч","query":"hair dryer"}]},
  {"id":"furniture","name":"Тавилга","image":"chair","query":"furniture","subtitle":"Шууд захиалга · Тавилга","children":[{"name":"Ширээ","query":"desk"},{"name":"Сандал","query":"chair"},{"name":"Буйдан","query":"sofa"},{"name":"Ор","query":"bed"},{"name":"Тавиур","query":"shelf"},{"name":"Шүүгээ","query":"cabinet"},{"name":"Гутлын шүүгээ","query":"shoe cabinet"},{"name":"Эвхдэг тавилга","query":"folding furniture"}]},
  {"id":"decor","name":"Гэрийн чимэглэл","image":"lamp","query":"home decoration","subtitle":"Шууд захиалга · Гэрийн чимэглэл","children":[{"name":"Ваар","query":"vase"},{"name":"Ханын зураг","query":"wall art"},{"name":"Толь","query":"mirror"},{"name":"Ханын цаг","query":"wall clock"},{"name":"Дэр","query":"cushion"},{"name":"Хиймэл цэцэг","query":"artificial flowers"},{"name":"Лаа","query":"candle"},{"name":"Баярын чимэглэл","query":"party decoration"}]},
  {"id":"baby","name":"Ээж, нярай","image":"catalog-backpack","query":"baby products","subtitle":"Шууд захиалга · Ээж, нярай","children":[{"name":"Хүүхдийн тэрэг","query":"baby stroller"},{"name":"Угж","query":"baby bottle"},{"name":"Живх","query":"diapers"},{"name":"Хооллох хэрэгсэл","query":"baby feeding"},{"name":"Хүүхдийн ор","query":"baby crib"},{"name":"Усанд оруулах","query":"baby bath"},{"name":"Жирэмсний хувцас","query":"maternity clothing"},{"name":"Хүүхдийн хамгаалалт","query":"baby safety"}]},
  {"id":"toys","name":"Тоглоом","image":"catalog-backpack","query":"toys","subtitle":"Шууд захиалга · Тоглоом","children":[{"name":"Эвлүүлдэг тоглоом","query":"building blocks"},{"name":"Зөөлөн тоглоом","query":"plush toy"},{"name":"Хүүхэлдэй","query":"doll"},{"name":"Машин","query":"toy car"},{"name":"Ширээний тоглоом","query":"board game"},{"name":"Сургалтын тоглоом","query":"educational toys"},{"name":"Зураг зурах","query":"drawing set"},{"name":"Гадна тоглоом","query":"outdoor toys"}]},
  {"id":"sports","name":"Спорт, фитнес","image":"sneakers","query":"sports equipment","subtitle":"Шууд захиалга · Спорт, фитнес","children":[{"name":"Иог","query":"yoga mat"},{"name":"Фитнес","query":"fitness equipment"},{"name":"Гүйлт","query":"running accessories"},{"name":"Бөмбөг","query":"ball sports"},{"name":"Усан сэлэлт","query":"swimming equipment"},{"name":"Дугуйн хэрэгсэл","query":"cycling accessories"},{"name":"Спорт цүнх","query":"gym bag"},{"name":"Хамгаалалт","query":"sports protection"}]},
  {"id":"outdoor","name":"Аялал, амралт","image":"catalog-backpack","query":"camping equipment","subtitle":"Шууд захиалга · Аялал, амралт","children":[{"name":"Майхан","query":"tent"},{"name":"Аяны хөнжил","query":"sleeping bag"},{"name":"Эвхдэг сандал","query":"camping chair"},{"name":"Аяны сав","query":"camping cookware"},{"name":"Гар чийдэн","query":"flashlight"},{"name":"Загасчлал","query":"fishing tackle"},{"name":"Уулын хэрэгсэл","query":"hiking equipment"},{"name":"Аяллын дагалдах","query":"travel accessories"}]},
  {"id":"auto","name":"Авто хэрэгсэл","image":"watch","query":"car accessories","subtitle":"Шууд захиалга · Авто хэрэгсэл","children":[{"name":"Утас тогтоогч","query":"car phone holder"},{"name":"Суудлын бүрээс","query":"car seat cover"},{"name":"Камер","query":"dash camera"},{"name":"Цэвэрлэгээ","query":"car cleaning"},{"name":"Шалавч","query":"car floor mat"},{"name":"Цэнэглэгч","query":"car charger"},{"name":"Багаж","query":"car tools"},{"name":"Мото хэрэгсэл","query":"motorcycle accessories"}]},
  {"id":"tools","name":"Багаж, засвар","image":"chair","query":"tools","subtitle":"Шууд захиалга · Багаж, засвар","children":[{"name":"Гар багаж","query":"hand tools"},{"name":"Цахилгаан багаж","query":"power tools"},{"name":"Хэмжих хэрэгсэл","query":"measuring tools"},{"name":"Бэхэлгээ","query":"fasteners"},{"name":"Будах хэрэгсэл","query":"painting tools"},{"name":"Сантехник","query":"plumbing tools"},{"name":"Цахилгааны хэрэгсэл","query":"electrical tools"},{"name":"Хамгаалах хэрэгсэл","query":"work gloves"}]},
  {"id":"garden","name":"Цэцэрлэг, ургамал","image":"lamp","query":"garden supplies","subtitle":"Шууд захиалга · Цэцэрлэг, ургамал","children":[{"name":"Цэцгийн сав","query":"flower pot"},{"name":"Цэцэрлэгийн багаж","query":"garden tools"},{"name":"Усалгаа","query":"watering can"},{"name":"Ургамлын тавиур","query":"plant stand"},{"name":"Гадна тавилга","query":"garden furniture"},{"name":"Хүлэмж","query":"greenhouse"}]},
  {"id":"pets","name":"Амьтны хэрэгсэл","image":"catalog-backpack","query":"pet supplies","subtitle":"Шууд захиалга · Амьтны хэрэгсэл","children":[{"name":"Нохойн хэрэгсэл","query":"dog accessories"},{"name":"Муурын хэрэгсэл","query":"cat accessories"},{"name":"Амьтны ор","query":"pet bed"},{"name":"Тоглоом","query":"pet toy"},{"name":"Хоолны сав","query":"pet bowl"},{"name":"Хүзүүвч","query":"pet collar"},{"name":"Арчилгаа","query":"pet grooming"},{"name":"Аквариум","query":"aquarium accessories"}]},
  {"id":"office","name":"Бичиг хэрэг, оффис","image":"chair","query":"office supplies","subtitle":"Шууд захиалга · Бичиг хэрэг, оффис","children":[{"name":"Дэвтэр","query":"notebook stationery"},{"name":"Үзэг","query":"pen"},{"name":"Хавтас","query":"file folder"},{"name":"Ширээний зохион байгуулалт","query":"desk organizer"},{"name":"Уран зураг","query":"art supplies"},{"name":"Сургуулийн хэрэгсэл","query":"school supplies"},{"name":"Хэвлэгчийн хэрэгсэл","query":"printer supplies"},{"name":"Сав баглаа","query":"packaging supplies"}]},
  {"id":"health","name":"Эрүүл мэнд, арчилгаа","image":"skincare","query":"personal care","subtitle":"Шууд захиалга · Эрүүл мэнд, арчилгаа","children":[{"name":"Массажны хэрэгсэл","query":"massager"},{"name":"Шүдний арчилгаа","query":"oral care"},{"name":"Хувийн ариун цэвэр","query":"personal hygiene"},{"name":"Нойрны хэрэгсэл","query":"sleep mask"},{"name":"Биеийн арчилгаа","query":"body care"},{"name":"Дэмжих хэрэгсэл","query":"posture support"}]}
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
const initialFilters=new URLSearchParams(location.search);
if(initialFilters.get('filter')==='saved')filters.type='saved';
if(categories.some(c=>c.id===initialFilters.get('category')))filters.category=initialFilters.get('category');
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
  const count=state.cart.reduce((sum,item)=>sum+item.qty,0)+(window.taobaoCart?.count()||0);
  $('#cart-count').textContent=count;
  if($('#mobile-cart-count'))$('#mobile-cart-count').textContent=count;
  const favorites=window.supplierFavoriteCount?window.supplierFavoriteCount():state.favorites.length;
  $('#favorite-count').textContent=favorites;
  $('#favorite-count').hidden=!favorites;
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
  // The home page keeps one category row (in the catalog); the old card grid may be absent.
  const grid=$('#category-grid');if(!grid)return;
  grid.innerHTML=categories.slice(0,7).map(c=>`<button class="category-card ${filters.category===c.id?'active':''}" data-category="${c.id}" aria-pressed="${filters.category===c.id}"><div class="category-image"><img src="/assets/${c.image}.jpg" alt="" loading="lazy"></div><strong>${c.name}</strong><small>${c.subtitle}</small></button>`).join('');
}
function visibleProducts() {
  const query=filters.query.toLocaleLowerCase('mn').trim();
  const found=products.filter(p=>productAvailable(p)&&(filters.type==='all'||(filters.type==='saved'?state.favorites.includes(p.id):p.type===filters.type))&&(filters.category==='all'||p.category===filters.category)&&(!query||`${esc(p.name)} ${esc(p.source)} ${categories.find(c=>c.id===p.category)?.name}`.toLocaleLowerCase('mn').includes(query)));
  if(filters.sort==='price-asc')found.sort((a,b)=>a.price-b.price);
  if(filters.sort==='price-desc')found.sort((a,b)=>b.price-a.price);
  return found;
}
function renderProducts() {
  if($('#catalog[data-api-catalog]'))return;
  const found=visibleProducts();
  $('#result-count').textContent=`${found.length} бараа${filters.query?' · “'+filters.query+'”':''}`;
  $('#catalog-title').textContent=filters.category!=='all'?categories.find(c=>c.id===filters.category).name:({all:'Танд санал болгох',local:'GOStore-ийн бэлэн бараа',china:'Хятадаас захиалах',saved:'Таны хадгалсан бараа'}[filters.type]);
  $('#reset-filters').hidden=filters.type==='all'&&filters.category==='all'&&!filters.query;
  document.querySelectorAll('.filter-tabs [data-filter]').forEach(el=>{const active=el.dataset.filter===filters.type;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  $('#product-grid').innerHTML=found.length?found.map(p=>`<article class="product-card" data-product="${p.id}">
    <a class="product-image-button" href="/p/${encodeURIComponent(p.id)}" aria-label="${esc(p.name)} — дэлгэрэнгүй"><img src="/assets/${p.image}.jpg" alt="${esc(p.name)}" loading="lazy"></a>
    <span class="product-type ${p.type}">${icon(p.type==='local'?'check':'box')}${p.type==='local'?'Бэлэн бараа':'Захиалгаар'}</span>
    <button class="favorite-button ${state.favorites.includes(p.id)?'saved':''}" data-favorite="${p.id}" aria-label="${esc(p.name)} — хадгалах" aria-pressed="${state.favorites.includes(p.id)}">${icon('heart')}</button>
    <div class="product-info"><span class="product-source">${esc(p.source)}</span><a class="product-name" href="/p/${encodeURIComponent(p.id)}">${esc(p.name)}</a><div class="product-meta"><span class="product-price">${money(p.price)}</span><button class="quick-add" data-add="${p.id}" aria-label="${esc(p.name)} — сагсанд нэмэх">${icon('plus')}</button></div><p class="product-sub">${p.demo!==false?'Жишээ үнэ':'Үнэ'} · хүргэлт ороогүй</p></div></article>`).join(''):`<div class="empty-state">${icon(filters.type==='saved'?'heart':'search')}<h3>${filters.type==='saved'?'Хадгалсан бараа алга':'Тохирох бараа олдсонгүй'}</h3><p>${filters.type==='saved'?'Таалагдсан барааныхаа зүрхэн тэмдгийг дараарай.':'Өөр түлхүүр үг эсвэл ангилал сонгож үзээрэй.'}</p><button class="button blue" data-reset>Бүх барааг үзэх</button></div>`;
}
function scrollCatalog() { $('#catalog').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
function resetFilters() { filters={type:'all',category:'all',query:'',sort:'featured'};$('#search').value='';if($('#sort'))$('#sort').value='featured';if(window.supplierBrowse)window.supplierBrowse('__all__',false,'all');renderCategories();renderProducts(); }
function filterType(type) { if(window.supplierBrowse){window.supplierBrowse(type==='saved'?null:'__all__',type==='saved');scrollCatalog();return;} if(type==='local'&&!localProductsEnabled)return toast('Бэлэн барааны худалдаа түр зогссон.');if(type==='china'&&window.storeServer?.ready){$('#supplier-catalog').scrollIntoView({behavior:'smooth'});return;} filters.type=type;filters.category='all';filters.query='';$('#search').value='';renderCategories();renderProducts();scrollCatalog(); }
function filterCategory(category) { if(window.supplierBrowse){filters.category=category;renderCategories();window.supplierBrowse(supplierCategoryQuery(category));scrollCatalog();return;} filters.category=category;filters.type='all';filters.query='';$('#search').value='';renderCategories();renderProducts();scrollCatalog(); }

function showProduct(id) { location.assign('/p/'+encodeURIComponent(id)); }
function addToCart(id,variant,qty=1) {
  if(!window.customerAccount?.require())return;
  const p=productById(id);if(!p||!p.variants.includes(variant)||!Number.isInteger(qty)||qty<1||qty>99)return;
  const existing=state.cart.find(item=>item.id===id&&item.variant===variant);
  if(existing&&existing.qty+qty>99){toast('Нэг хувилбараас 99 хүртэл ширхэг сонгоно.');return;}
  if(existing)existing.qty+=qty;else state.cart.push({id,variant,qty});
  const saved=persist();if(saved)toast('Сагсанд нэмлээ');
}
function cartTotal() {return state.cart.reduce((sum,item)=>sum+productById(item.id).price*item.qty,0);}
function showCart() {
  // Ready-stock sales are paused; the header cart then holds Taobao checkout items.
  if(window.taobaoCart&&!localProductsEnabled&&!state.cart.length)return window.taobaoCart.show();
  if(!window.customerAccount?.require())return;
  if(!state.cart.length){openModal('Миний сагс',`<div class="empty-state">${icon('bag')}<h3>Сагс тань хоосон байна</h3><p>Өөрт таалагдсан бараагаа сонгоорой.</p><button class="button blue" data-action="browse">Бараа үзэх</button></div>`);return;}
  openModal('Миний сагс',state.cart.map((item,index)=>{const p=productById(item.id);return `<div class="cart-row"><img src="/assets/${p.image}.jpg" alt="${esc(p.name)}"><div><h3>${esc(p.name)}</h3><small>${esc(item.variant)} · ${p.type==='local'?'Бэлэн бараа':'Захиалгаар'}</small><div class="quantity-controls"><button data-quantity="${index}" data-delta="-1" aria-label="${esc(p.name)} тоог бууруулах" ${item.qty===1?'disabled':''}>−</button><span>${item.qty}</span><button data-quantity="${index}" data-delta="1" aria-label="${esc(p.name)} тоог нэмэх" ${item.qty===99?'disabled':''}>+</button></div></div><div><strong>${money(p.price*item.qty)}</strong><button class="remove-item" data-remove="${index}">Хасах</button></div></div>`;}).join('')+`<div class="cart-totals"><div><span>Барааны жишээ дүн</span><strong>${money(cartTotal())}</strong></div><div><span>Хүргэлт, бусад төлбөр</span><span>Баталгаажаагүй</span></div><div class="total"><span>Дэд нийт</span><strong>${money(cartTotal())}</strong></div></div><div class="info-box">${window.storeServer?.ready?'Хүсэлт илгээсний дараа админ нийт үнийг баталгаажуулна.':'Ноорог хадгалах нь бодит захиалга үүсгэхгүй.'} Тээвэр болон бусад төлбөр дэд нийтэд ороогүй.</div><div class="cart-footer"><button class="button blue" data-action="checkout">${window.storeServer?.ready?'Захиалгын хүсэлт илгээх':'Захиалгын ноорог бэлдэх'} ${icon('arrow')}</button></div>`);
}
function showCheckout() {
  if(!window.customerAccount?.require())return;
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
  if(!window.customerAccount?.require())return;
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
  help:{title:'Хэрхэн захиалах вэ?',html:`<p class="modal-intro">Үйлдвэрээс шууд захиалах каталогоос бараагаа сонгоно. Өнгө, хэмжээ, тоо, овог нэр, утсаа оруулж захиалгын хүсэлт илгээнэ.</p><p>Хятадаас ирэх ачаа Эрээн → Замын-Үүд → Улаанбаатар чиглэлээр явна. Агуулахад овог нэр, захиалгын кодоор ялган хүлээн авна.</p>`},
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
  if(action==='clear-data'){if(window.clearSupplierFavorites?.()===false)return;state.cart=[];state.favorites=[];state.drafts=[];persist();renderProducts();closeModal();toast('Хадгалсан мэдээллийг цэвэрлэлээ');}
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
$('#search-form').addEventListener('submit',e=>{e.preventDefault();if(matchMedia('(max-width:760px)').matches)$('#search').blur();const value=$('#search').value.trim();if(/^https?:\/\//i.test(value))return toast('Барааны нэрээр хайж, каталогоос сонгоно уу.');if(window.supplierBrowse){window.supplierBrowse(value||'__all__');scrollCatalog();return;}filters.query=value;filters.type='all';filters.category='all';renderCategories();renderProducts();scrollCatalog();});
$('#search').addEventListener('search',()=>{if(!$('#search').value){if(window.supplierBrowse)window.supplierBrowse('__all__',false,'all');else{filters.query='';renderProducts();}}});
$('#sort')?.addEventListener('change',e=>{filters.sort=e.target.value;renderProducts();});
$('#reset-filters')?.addEventListener('click',resetFilters);
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

// Keep the mobile location indicator aligned with the visible catalog or dialog.
(()=>{
 const nav=document.querySelector('.mobile-nav'),modal=document.querySelector('#modal');let scheduled=false;
 window.syncMobileNav=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;
   const bounds=document.querySelector('#catalog').getBoundingClientRect();
   let tab=bounds.top<innerHeight*.65&&bounds.bottom>140?(document.querySelector('#catalog [data-filter=saved]').getAttribute('aria-pressed')==='true'?'saved':'catalog'):'home';
   if(modal.open){if(modal.querySelector('#cargo-search,.cargo-detail'))tab='orders';else if(modal.querySelector('.account-form'))tab='account';}
   nav.querySelectorAll('[data-mobile-tab]').forEach(el=>{if(el.dataset.mobileTab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 });};
 nav.addEventListener('click',e=>{if(e.target.closest('[data-mobile-tab=catalog]')&&document.querySelector('#catalog [data-filter=saved]').getAttribute('aria-pressed')==='true')window.supplierBrowse?.(document.querySelector('#supplier-query').value||'bag');});
 addEventListener('scroll',syncMobileNav,{passive:true});addEventListener('resize',syncMobileNav);addEventListener('hashchange',syncMobileNav);
 new MutationObserver(syncMobileNav).observe(modal,{attributes:true,attributeFilter:['open'],childList:true,subtree:true});syncMobileNav();
})();

// Accessible category browser. Opening a department does not call the supplier API.
(()=>{
 const menu=$('#category-menu'),trigger=$('#category-trigger');if(!menu||!trigger)return;

 let selected=categories[0].id;
 function draw(){const q=$('#category-search').value.trim().toLocaleLowerCase('mn');const visible=categories.filter(c=>[c.name,c.query,...c.children.map(x=>x.name+' '+x.query)].join(' ').toLocaleLowerCase('mn').includes(q));if(visible.length&&!visible.some(c=>c.id===selected))selected=visible[0].id;const c=categories.find(c=>c.id===selected);$('#category-departments').innerHTML=visible.map(x=>`<button type="button" data-department="${x.id}" aria-pressed="${selected===x.id}">${esc(x.name)}<span aria-hidden="true">›</span></button>`).join('');$('#category-suggestions').innerHTML=visible.length?`<div class="category-suggestion-heading"><div><small>АНГИЛЛААР ХАЙХ</small><h3>${esc(c.name)}</h3><p>${esc(c.subtitle)}</p></div><img src="/assets/${c.image}.jpg" alt=""></div><div class="category-suggestion-grid">${c.children.map(({name:label,query:q})=>`<a href="/?q=${encodeURIComponent(q)}#catalog" data-menu-query="${esc(q)}">${esc(label)}<svg class="icon"><use href="#i-arrow"/></svg></a>`).join('')}</div><a class="button dark category-view-all" href="/?category=${selected}#catalog" data-menu-category="${selected}">${esc(c.name)} · бүгдийг үзэх →</a>`:'<p role="status">Тохирох ангилал олдсонгүй. Өөр нэрээр хайна уу.</p>';}
 $('#category-search').addEventListener('input',draw);
 document.querySelector('[data-open-categories]')?.addEventListener('click',()=>trigger.click());
 trigger.addEventListener('click',()=>{draw();menu.showModal();trigger.setAttribute('aria-expanded','true');});
 $('#close-category-menu').addEventListener('click',()=>menu.close());menu.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus({preventScroll:true});});
 menu.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)menu.close();}const department=e.target.closest('[data-department]');if(department){selected=department.dataset.department;draw();menu.querySelector('[data-department="'+selected+'"]').focus();return;}const choice=e.target.closest('[data-menu-query],[data-menu-category]');if(!choice)return;if(document.documentElement.classList.contains('product-view')||typeof window.supplierBrowse!=='function')return; e.preventDefault();menu.close();if(choice.dataset.menuCategory)filterCategory(choice.dataset.menuCategory);else{window.supplierBrowse(choice.dataset.menuQuery);scrollCatalog();}});
})();

// Share the full taxonomy with the header without issuing a catalog request.
(()=>{
 const row=document.querySelector('#quick-categories');if(!row)return;
 row.innerHTML=categories.map(c=>`<button type="button" class="nav-link" data-supplier-query="${esc(c.query)}">${esc(c.name)}</button>`).join('');
 const controls=[...document.querySelectorAll('[data-nav-scroll]')];
 function sync(){const max=row.scrollWidth-row.clientWidth;controls.forEach(b=>b.disabled=Number(b.dataset.navScroll)<0?row.scrollLeft<=1:row.scrollLeft>=max-1);}
 controls.forEach(b=>b.addEventListener('click',()=>row.scrollBy({left:Number(b.dataset.navScroll)*row.clientWidth*.75,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})));
 row.addEventListener('scroll',sync,{passive:true});new ResizeObserver(sync).observe(row);document.fonts.ready.then(sync);sync();
})();
