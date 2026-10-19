'use strict';
function shippingOrderHtml(o){if(!o.supplier&&!o.quote&&!o.route)return '';const b=o.quote?.breakdown;return `<div class="info-box"><strong>Эрээн → Замын-Үүд → Улаанбаатар</strong><p>Ачааны байршлын төлөвийг GOStore шинэчилнэ.</p>${o.fulfillment?`<p>Авах хэлбэр: ${o.fulfillment.method==='pickup'?'Агуулахаас авах':'Хүргэлтээр авах'}</p>`:''}${o.warehouse?`<h3>Эрээн агуулахын хүлээн авах мэдээлэл</h3><p><strong>${esc(o.warehouse.recipient)}</strong></p><p>${esc(o.warehouse.address)}<br>手机号: ${esc(o.warehouse.phone)}<br>Утас: ${esc(o.warehouse.contact_phone)}</p><p>Ачааг энэ овог нэр, захиалгын кодоор бүртгэнэ.</p>`:''}${o.supplier?`<p>${esc(o.supplier.variant)} × ${o.supplier.qty} · Барааны лавлах дүн ${money(Math.ceil(o.supplier.goods_cny*(o.supplier.rate||storeServer.shipping?.cny_rate||0)))}</p>`:''}${o.type==='checkout'&&o.items?.length?`<ul>${o.items.map(i=>`<li>${esc(i.name)} · ${esc(i.variant)} × ${i.qty} · ${money((i.price||0)*i.qty)}</li>`).join('')}</ul>`:''}${b?`<p>Бараа: ${money(b.goods_mnt)}<br>Хятад доторх хүргэлт: ${money(b.domestic_mnt)}<br>Үйлчилгээ: ${money(b.service_mnt)}<br>Карго: ${b.cargo_mnt||!o.quote.cargo_later?money(b.cargo_mnt):'Улаанбаатарт ирэхэд бодит жингээр тооцно'}</p>`:''}${o.history?.length?`<ol>${o.history.map(h=>`<li>${esc(orderLabels[h.status]||h.status)} · ${new Date(h.at).toLocaleString('mn-MN')}</li>`).join('')}</ol>`:''}</div>`;}
let supplierBrand=window.brandStorefront||initialFilters.get('brand')||'';
let supplierPage=1,supplierQuery=(new URLSearchParams(location.search).get('q')||'__all__').slice(0,100),supplierSort=['default','price','-price','-volume','-updated_time'].includes(initialFilters.get('sort'))?initialFilters.get('sort'):'default',supplierPriceRange={min:/^\d{1,9}$/.test(initialFilters.get('price_min')||'')?initialFilters.get('price_min'):'',max:/^\d{1,9}$/.test(initialFilters.get('price_max')||'')?initialFilters.get('price_max'):''},supplierBusy=false,supplierSelected=null,supplierImage=/^[a-f0-9]{32}$/.test(initialFilters.get('image')||'')?initialFilters.get('image'):'';
function supplierRateText(s){return `${s.weight_step_kg} кг тутам ${money(s.weight_step_mnt)} (дээш бүхэлчилнэ) · ${s.volume_threshold} м³-ээс бага: ${money(Math.round(s.volume_small_cny*s.cny_rate))}/м³, түүнээс их буюу тэнцүү: ${money(Math.round(s.volume_large_cny*s.cny_rate))}/м³. Жин эсвэл эзлэхүүнээр тооцох аргыг агуулах бодит хэмжилтээр баталгаажуулна.`;}

const SUPPLIER_FAVORITES_KEY='gostore-taobao-favorites-v1';
function supplierCategoryQuery(id){return categories.find(c=>c.id===id)?.query||'__all__';}
function supplierFavoriteItems(){try{const saved=JSON.parse(localStorage.getItem(SUPPLIER_FAVORITES_KEY)||'[]');return Array.isArray(saved)?saved.filter(p=>p&&/^tb-[0-9]{5,20}$/.test(p.id)).slice(0,100):[];}catch{return [];}}
const SUPPLIER_BATCH_SIZE=50;
let supplierResults=[],supplierSaved=false,supplierLoadSequence=0,supplierMore=false;
let supplierCategory=initialFilters.get('category')||(initialFilters.has('q')?categories.find(c=>c.query===supplierQuery)?.id||'':'all');
if(window.brandStorefront){supplierQuery='__all__';supplierCategory='';supplierImage='';}
window.supplierFavoriteCount=()=>supplierFavoriteItems().length;
window.clearSupplierFavorites=()=>{try{localStorage.removeItem(SUPPLIER_FAVORITES_KEY);if(supplierSaved)renderSupplierCards([]);return true;}catch{toast('Хөтөчийн хадгалсан мэдээллийг цэвэрлэж чадсангүй.');return false;}};
function renderSupplierCards(items,append=false){
  const saved=new Set(supplierFavoriteItems().map(p=>p.id));
  const html=items.map((p,index)=>{
    const priced=p.price_status==='available'&&Number(p.price_expires)*1000>Date.now()&&Number(p.mnt)>0;
    // Search results only carry the listed price; it is shown as approximate until a SKU price is verified.
    const approx=!priced&&Number(p.approx_mnt)>0?Number(p.approx_mnt):0,soldOut=p.price_status==='unavailable'&&Number(p.price_expires)*1000>Date.now();
    const sold=Number.isSafeInteger(p.sold_count)&&p.sold_count>0?p.sold_count:null;
    // Sales are rounded down to a leading digit (1,234 → 1,000+) like marketplace cards; 1,000+ earns a HOT badge.
    const step=sold!==null&&sold>=10?10**Math.floor(Math.log10(sold)):1,soldLabel=sold===null?'':sold<10?String(sold):new Intl.NumberFormat('en-US').format(Math.floor(sold/step)*step)+'+';
    const productHref='/v/'+p.id+(p.brand_id?'?brand='+encodeURIComponent(p.brand_id):'');
    const offer=Object.hasOwn(p,'card_discount')?p.card_discount:p.offers?.discount&&{...p.offers.discount,expires:p.offers.expires};
    const discount=!soldOut&&offer?.expires*1000>Date.now()&&offer.current_mnt===Number(priced?p.mnt:approx)&&Number.isFinite(offer.was_mnt)&&offer.was_mnt>offer.current_mnt?offer:null;
    return `<article class="supplier-card">${sold!==null&&sold>=1000?'<span class="supplier-hot">HOT</span>':''}
      <a class="supplier-photo" href="${productHref}">${/^https:\/\//i.test(p.image||'')?`<img ${supplierImageAttrs(p.image,400)} alt="${esc(p.name)}" loading="${!append&&index<4?'eager':'lazy'}" width="400" height="400" referrerpolicy="no-referrer">`:'Зураггүй'}</a>
      <button class="favorite-button ${saved.has(p.id)?'saved':''}" data-supplier-favorite="${p.id}" aria-label="${esc(p.name)} — хадгалах" aria-pressed="${saved.has(p.id)}">${icon('heart')}</button>
      <button class="favorite-button compare-button" data-compare-toggle="${p.id}" data-name="${esc(p.name)}" data-image="${esc(p.image||'')}" aria-label="${esc(p.name)} — харьцуулах" title="Харьцуулах">${icon('compare')}</button>
      <div class="supplier-card-copy">
        <h3><a href="${productHref}" title="${esc(p.name)}">${esc(p.name)}</a></h3>
        <div class="supplier-card-meta">${sold!==null?`<span class="supplier-sales"><b>${soldLabel}</b> · нийлүүлэгч дээр</span>`:'<span>Шууд захиалга</span>'}</div>
        <p class="supplier-delivery-note">Хүргэлт нэмэгдэнэ</p>
        <div class="supplier-card-bottom"><div class="supplier-card-price"><strong${discount?' aria-label="Хямдарсан үнэ"':''}>${priced?money(p.mnt):approx?'≈ '+money(approx):soldOut?'Дууссан':'Үнэ шалгах'}</strong>${discount?`<div class="supplier-discount"><del aria-label="Үндсэн үнэ">${money(discount.was_mnt)}</del>${discount.percent>0?`<span>−${discount.percent}%</span>`:''}</div>`:''}${priced?'<small>Үлдэгдэлтэй хувилбараас</small>':approx?(soldOut?'<small>Одоогоор захиалах боломжгүй</small>':'<small>-аас · нарийн үнэ хувилбараас</small>'):''}</div></div>
      </div>
    </article>`;
  }).join('');
  if(append){$('#supplier-grid').insertAdjacentHTML('beforeend',html);return;}
  $('#supplier-grid').innerHTML=html||`<div class="empty-state"><h3>${supplierSaved?'Хадгалсан бараа алга':'Тохирох бараа олдсонгүй'}</h3><p>${supplierSaved?'Таалагдсан барааныхаа зүрхэн тэмдгийг дарж хадгалаарай.':'Өөр түлхүүр үгээр хайж үзээрэй.'}</p><button class="button blue" data-supplier-reset>Бараа үзэх</button></div>`;
}
function supplierUrl(page=1){
  if(document.documentElement.matches('.product-view,.account-view,.store-page-view'))return;
  const url=new URL(location.href);url.searchParams.delete('category');
  for(const [key,value] of Object.entries({brand:supplierSaved||supplierImage?'':supplierBrand,q:supplierImage||supplierQuery==='__all__'?'':supplierQuery,image:supplierSaved?'':supplierImage,sort:supplierImage||supplierSort==='default'?'':supplierSort,page:page===1?'':String(page),filter:supplierSaved?'saved':'',price_min:supplierImage||supplierSaved?'':supplierPriceRange.min,price_max:supplierImage||supplierSaved?'':supplierPriceRange.max})){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}
  if(!supplierSaved&&!(typeof supplierImage!=='undefined'&&supplierImage)&&supplierCategory&&supplierCategory!=='all')url.searchParams.set('category',supplierCategory);
  if(window.brandStorefront)url.searchParams.delete('brand');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  $('#supplier-reset').hidden=(!supplierBrand||!!window.brandStorefront)&&!supplierSaved&&!supplierImage&&supplierQuery==='__all__'&&supplierSort==='default'&&page===1&&!supplierPriceRange.min&&!supplierPriceRange.max;
}
function supplierViewState(){
  window.syncBrandStorefront?.(supplierSort);
  const brand=!supplierSaved&&!supplierImage?window.supplierBrands?.find(b=>b.id===supplierBrand):null;window.syncSupplierBrands?.(brand?.id||'');
  window.syncSupplierCategories?.(brand?'':supplierCategory,supplierSaved,typeof supplierImage!=='undefined'&&!!supplierImage);
  document.querySelectorAll('[data-supplier-query]').forEach(b=>b.setAttribute('aria-pressed',String(!supplierSaved&&!supplierImage&&b.dataset.supplierQuery===supplierQuery)));
  window.syncMobileNav?.();
  const refinements=$('#catalog-refinements'),category=categories.find(c=>c.id===supplierCategory);
  if(refinements)refinements.innerHTML=!supplierSaved&&!supplierImage&&category?.children?.length?category.children.map(c=>`<button type="button" data-supplier-query="${esc(c.query)}" aria-pressed="${supplierQuery===c.query}">${esc(c.name)}</button>`).join(''):'';
  $('#catalog-title').textContent=supplierSaved?'Таны хадгалсан бараа':supplierImage?'Зургаар хайсан бараа':brand?brand.name+(window.brandStorefront?' бараанууд':' · эх дэлгүүр'):supplierQuery==='__all__'?'Танд санал болгох':'Хайлтын үр дүн';
  const preview=$('#image-search-preview');preview.hidden=supplierSaved||!supplierImage;if(!preview.hidden)preview.querySelector('img').src='/assets/uploads/search/'+supplierImage+'.jpg';
  document.querySelectorAll('#catalog .filter-tabs button').forEach(b=>{const active=(b.dataset.filter==='saved')===supplierSaved;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
window.supplierBrowseBrand=id=>{if(window.brandStorefront){location.assign(window.supplierBrandHref(id));return;}supplierBrand=id;supplierSaved=false;supplierImage='';supplierQuery='__all__';supplierCategory='';$('#supplier-query').value='';$('#search').value='';loadSupplier(1);};
window.supplierBrowse=(query,saved=false,category=null)=>{
  if(window.brandStorefront){const params=new URLSearchParams(saved?{filter:'saved'}:category&&category!=='all'?{category}:query&&query!=='__all__'?{q:query}:{});location.assign('/'+(params.size?'?'+params:'')+'#catalog');return;}
  supplierBrand='';
  supplierCategory=saved?'':category??(!query||query==='__all__'?'all':categories.find(c=>c.query===query)?.id||'');
  supplierSaved=saved;if(!saved)supplierImage='';supplierViewState();
  if(saved){supplierMore=false;supplierScrollObserver?.disconnect();supplierUrl();++supplierLoadSequence;supplierBusy=false;$('#supplier-search button').disabled=false;$('#supplier-grid').removeAttribute('aria-busy');renderSupplierCards(supplierFavoriteItems());$('#supplier-paging').replaceChildren();$('#supplier-status').textContent='Хадгалсан бараа · Үнэ, үлдэгдлийг дэлгэрэнгүй хуудаснаас шинэчилж харна.';return;}
  supplierQuery=String(query||'__all__').trim().slice(0,100)||'__all__';$('#supplier-query').value=supplierQuery==='__all__'?'':supplierQuery;$('#search').value=$('#supplier-query').value;loadSupplier();
};
// Append one batch at a time; filters invalidate older in-flight requests.
const supplierScrollObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  if(entries.some(e=>e.isIntersecting)&&!supplierBusy&&!supplierSaved&&supplierMore&&$('#supplier-paging').offsetParent!==null)loadSupplier(supplierPage+1,true);
},{rootMargin:'0px 0px 300px 0px'}):null;
function supplierLoadMoreControl(retryPage=null,append=true){
  supplierScrollObserver?.disconnect();
  const host=$('#supplier-paging');host.replaceChildren();
  if(retryPage!==null){host.innerHTML='<button type="button" class="button outline" data-supplier-retry="'+retryPage+'" data-append="'+append+'">Дахин оролдох</button>';return;}
  if(!supplierMore||supplierSaved){if(supplierResults.length&&!supplierSaved)host.textContent='Бүх барааг харууллаа';return;}
  host.innerHTML='<button type="button" class="button outline" data-supplier-more>Дараагийн 50 барааг харах</button>';
  supplierScrollObserver?.observe(host.firstElementChild);
}
async function loadSupplier(page=1,append=false){
  if(append&&(supplierBusy||supplierSaved||!supplierMore))return;
  supplierScrollObserver?.disconnect();
  const request=++supplierLoadSequence,query=supplierQuery,sort=supplierSort,image=supplierImage,brand=supplierBrand;
  supplierSaved=false;supplierViewState();if(!append)supplierUrl(page);supplierBusy=true;
  $('#supplier-search button').disabled=true;$('#supplier-grid').setAttribute('aria-busy','true');
  if(!append){supplierResults=[];supplierPage=0;supplierMore=false;$('#supplier-status').textContent='Бараа ачаалж байна…';$('#supplier-grid').innerHTML=Array.from({length:6},()=>'<div class="product-skeleton" aria-hidden="true"><span></span><i></i><i></i></div>').join('');}
  $('#supplier-paging').innerHTML='<span role="status">'+(append?'Дараагийн бараануудыг ачаалж байна…':'')+'</span>';
  const range={...(supplierPriceRange.min?{price_min:supplierPriceRange.min}:{}),...(supplierPriceRange.max?{price_max:supplierPriceRange.max}:{})};
  let failure=false;
  try{
    const r=await supplierApi('supplier-search',image?{image,page,limit:SUPPLIER_BATCH_SIZE}:{q:query,...(brand?{brand}:{}),page,limit:SUPPLIER_BATCH_SIZE,sort,...range});
    if(request!==supplierLoadSequence)return;
    const seen=new Set(supplierResults.map(p=>p.id)),incoming=(r.products||[]).filter(p=>{if(!/^tb-[0-9]{5,20}$/.test(p.id)||seen.has(p.id))return false;seen.add(p.id);return true;});
    supplierPage=page;supplierResults.push(...incoming);renderSupplierCards(append?incoming:supplierResults,append);
    supplierMore=r.more===true&&page<100&&incoming.length>0;
    const total=Number.isSafeInteger(r.total)?r.total:null;
    $('#supplier-status').textContent=(supplierResults.length?supplierResults.length+' бараа харуулж байна'+(total!==null?' · нийт '+new Intl.NumberFormat('en-US').format(total)+' үр дүн':''):'Тохирох бараа олдсонгүй.')+(range.price_min||range.price_max?' · Үнэ: '+(range.price_min?money(Number(range.price_min)):'0 ₮')+' – '+(range.price_max?money(Number(range.price_max)):'дээд хязгааргүй'):'')+(brand?' · Хямдрал, урамшууллын мэдээллийг бараа дээр дарж үзнэ.':'')+(r.stale?' · Үнэ, үлдэгдлийг барааны хуудаснаас шалгана уу.':'');
    $('#shipping-rates').textContent=supplierRateText(r.shipping)+' Бараа, Хятад доторх хүргэлт, үйлчилгээний шимтгэл тусдаа тооцогдоно.';
  }catch(e){if(request!==supplierLoadSequence)return;failure=true;if(!append){supplierResults=[];$('#supplier-grid').replaceChildren();}$('#supplier-status').textContent=(append?supplierResults.length+' бараа харуулж байна · ':'')+e.message;}
  finally{if(request===supplierLoadSequence){supplierBusy=false;$('#supplier-search button').disabled=false;$('#supplier-grid').removeAttribute('aria-busy');supplierLoadMoreControl(failure?page:null,append);}}
}
function showSupplier(id){location.assign('/v/'+encodeURIComponent(id.replace(/^abb-/,'')));}
function openSupplierOrder(p,sku,qty){
 if(!customerAccount.require())return;
 supplierSelected=p;
 openModal('Захиалгын мэдээлэл',`<p class="checkout-step">Сонголт ✓ <span>→ Мэдээллээ оруулах → Үнийн санал авах</span></p><div class="checkout-product">${/^https:\/\//i.test(p.image||'')?`<img src="${esc(p.image)}" alt="" referrerpolicy="no-referrer">`:''}<h3>${esc(p.name)}</h3></div><form id="supplier-order-form"><div class="form-grid"><label class="field full">Өнгө / хэмжээ<select name="sku" required>${p.variants.map(v=>`<option value="${esc(v.id)}" ${v.id===sku?'selected':''} ${v.stock===0||v.cny===null?'disabled':''}>${esc(v.label)} · ${v.cny===null?'Үнэ тодорхойгүй':money(Math.ceil(v.cny*(storeServer.shipping?.cny_rate||0)))}</option>`).join('')}</select></label><label class="field">Тоо ширхэг<input type="number" name="qty" min="${p.min_qty}" step="${p.step}" max="9999" value="${qty}" required></label>${requestFields()}<label class="field full">Нэмэлт хүсэлт<textarea name="notes" maxlength="1000"></textarea></label></div><p id="supplier-item-price" class="product-price"></p>${requestNotice()}<button class="button blue" type="submit">Захиалгын хүсэлт илгээх</button></form>`);supplierPrice();
}
function supplierPrice(){const f=$('#supplier-order-form');if(!f||!supplierSelected)return;const v=supplierSelected.variants.find(v=>v.id===f.elements.sku.value);$('#supplier-item-price').textContent=v?`Барааны урьдчилсан дүн: ${money(Math.ceil(v.cny*(storeServer.shipping?.cny_rate||0))*Number(f.elements.qty.value))} · хүргэлт нэмэгдэнэ`:'';}
document.addEventListener('input',e=>{if(e.target.closest('#supplier-order-form'))supplierPrice();});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-supplier-reset')||b.id==='supplier-reset'){supplierSort='default';$('#supplier-search [name=sort]').value='default';supplierPriceRange={min:'',max:''};$('#supplier-search [name=price_min]').value='';$('#supplier-search [name=price_max]').value='';filters.category='all';renderCategories();if(window.brandStorefront)loadSupplier(1);else window.supplierBrowse('__all__',false,'all');$('#supplier-query').value='';$('#search').value='';return;}if(b.dataset.supplierId)showSupplier(b.dataset.supplierId);if(b.hasAttribute('data-supplier-more'))loadSupplier(supplierPage+1,true);if(b.dataset.supplierRetry)loadSupplier(Number(b.dataset.supplierRetry),b.dataset.append==='true');if(b.dataset.supplierQuery){window.supplierBrowse(b.dataset.supplierQuery,false,b.closest('#catalog-refinements')?supplierCategory:null);if(b.closest('#quick-categories'))scrollCatalog();}if(b.dataset.supplierFavorite){const id=b.dataset.supplierFavorite,saved=supplierFavoriteItems(),found=supplierResults.find(p=>p.id===id);const next=saved.some(p=>p.id===id)?saved.filter(p=>p.id!==id):found?[found,...saved].slice(0,100):saved;try{localStorage.setItem(SUPPLIER_FAVORITES_KEY,JSON.stringify(next));renderSupplierCards(supplierSaved?next:supplierResults);updateCounts();$('[data-supplier-favorite="'+id+'"]')?.focus({preventScroll:true});}catch{toast('Хөтөч бараа хадгалах боломжгүй байна.');}}});
$('#supplier-search').addEventListener('submit',e=>{e.preventDefault();if(matchMedia('(max-width:760px)').matches)$('#supplier-query').blur();supplierSort=e.target.elements.sort.value;
  const min=e.target.elements.price_min.value.replace(/\D/g,''),max=e.target.elements.price_max.value.replace(/\D/g,'');
  if(min&&max&&Number(min)>Number(max)){toast('Доод үнэ дээд үнээс их байна.');return;}
  supplierPriceRange={min:min.slice(0,9),max:max.slice(0,9)};if(supplierBrand)loadSupplier(1);else window.supplierBrowse($('#supplier-query').value);});
document.addEventListener('submit',async e=>{if(e.target.id!=='supplier-order-form')return;e.preventDefault();const f=e.target,button=f.querySelector('[type="submit"]');button.disabled=true;try{await window.catalogReady;if(!storeServer.ready)throw Error('Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.');if(!customerAccount.require())return;const b=Object.fromEntries(new FormData(f));b.type='supplier';b.product_id=supplierSelected.id;b.title=supplierSelected.name.slice(0,120);b.qty=Number(b.qty);b.require_account=true;f.dataset.requestToken||=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');b.token=f.dataset.requestToken;const r=await shopApi('order-create',b);if(!window.customerAccount?.user){const requests=savedRequests().filter(x=>x.id!==r.order.id);requests.unshift({id:r.order.id,token:b.token,title:r.order.title});localStorage.setItem(REQUESTS_KEY,JSON.stringify(requests.slice(0,100)));}toast('Захиалгын хүсэлт илгээгдлээ');await storeServer.orders();}catch(err){const error=f.querySelector('#request-error');if(error)error.textContent=err.message;}finally{button.disabled=false;}});
(async()=>{if(document.documentElement.matches('.product-view,.account-view,.store-page-view'))return;try{if(!window.brandStorefront&&initialFilters.get('category'))supplierQuery=supplierCategoryQuery(initialFilters.get('category'));$('#supplier-query').value=(initialFilters.has('q')||initialFilters.has('category'))&&supplierQuery!=='__all__'?supplierQuery:'';$('#search').value=$('#supplier-query').value;$('#supplier-search [name=sort]').value=supplierSort;$('#supplier-search [name=price_min]').value=supplierPriceRange.min;$('#supplier-search [name=price_max]').value=supplierPriceRange.max;if(!window.brandStorefront&&initialFilters.get('filter')==='saved')window.supplierBrowse(null,true);else await loadSupplier(Math.min(100,Math.max(1,parseInt(initialFilters.get('page'),10)||1)));}catch{$('#supplier-status').textContent='Барааны каталогтой холбогдож чадсангүй. Дахин оролдоно уу.';}})();

$('#supplier-search [name=sort]').addEventListener('change',e=>{supplierSort=e.target.value;loadSupplier(1);});
window.addEventListener('storage',e=>{if(e.key===SUPPLIER_FAVORITES_KEY){updateCounts();if(!document.documentElement.matches('.product-view,.account-view,.store-page-view'))renderSupplierCards(supplierSaved?supplierFavoriteItems():supplierResults);}});
updateCounts();

// Image search: downscale in the browser, publish via the server, then page through Taobao matches.
async function supplierImageFile(file){
  if(!/^image\/(?:jpeg|png|webp)$/.test(file.type))throw Error('JPEG, PNG, WebP зураг сонгоно уу.');
  try{
    const bitmap=await createImageBitmap(file),scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(blob)return blob;
  }catch{/* The server re-encodes the original when the browser cannot decode it. */}
  if(file.size>5*1024*1024)throw Error('5 MB хүртэл зураг сонгоно уу.');
  return file;
}
async function supplierImageSearch(file){
  const buttons=document.querySelectorAll('[data-image-search]');buttons.forEach(b=>b.disabled=true);toast('Зургаар хайж байна…');
  try{
    await window.catalogReady;if(!storeServer.ready)throw Error('Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.');
    const form=new FormData();form.append('image',await supplierImageFile(file),'search.jpg');
    const response=await fetch('/api/index.php?action=supplier-image-upload',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':shopCsrf},body:form}),result=await response.json();
    if(!response.ok)throw Error(result.error||'Зураг илгээж чадсангүй.');
    if(document.documentElement.matches('.product-view,.account-view,.store-page-view,.brand-page-view')){location.assign('/?image='+result.image+'#supplier-catalog');return;}
    supplierBrand='';supplierImage=result.image;$('#supplier-query').value='';$('#search').value='';filters.category='all';renderCategories();loadSupplier(1);scrollCatalog();
  }catch(e){toast(e.message);}
  finally{buttons.forEach(b=>b.disabled=false);}
}
document.addEventListener('click',e=>{if(e.target.closest('[data-image-search]')){$('#image-search-input').value='';$('#image-search-input').click();}});
$('#image-search-input').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)supplierImageSearch(file);});
