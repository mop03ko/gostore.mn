'use strict';
(()=>{
  const match=location.pathname.match(/^\/(v|p)\/([a-z0-9-]+)\/?$/);
  if(!match)return;
  const supplier=match[1]==='v',id=supplier?(match[2].startsWith('tb-')?match[2]:'abb-'+match[2]):match[2];
  const root=document.createElement('section');root.id='product-page';root.className='container pd-page';
  document.querySelector('#main').prepend(root);
  let product,details,images=[],photo=0;
  function stateMessage(title,message,retry=false){root.innerHTML=`<div class="pd-state"><span class="section-kicker">GOSTORE / БАРАА</span><h1>${esc(title)}</h1><p>${esc(message)}</p>${retry?'<button class="button blue" data-pd-retry>Дахин оролдох</button>':''}<a class="button outline" href="/#supplier-catalog">Каталог руу буцах</a></div>`;}
  function selection(){
    const form=document.querySelector('#pd-options');if(!form)return null;
    const variant=product.variants.find(v=>(supplier?v.id:v)===form.elements.variant.value),qty=Number(form.elements.qty.value);
    const min=supplier?product.min_qty:1,step=supplier?product.step:1;
    const price=supplier?variant?.cny:product.price;
    const stock=supplier?variant?.stock:product.type==='local'?product.stock:null;
    const valid=!!variant&&Number.isInteger(qty)&&qty>=min&&qty<=(supplier?9999:99)&&(qty-min)%step===0&&(stock==null||qty<=stock)&&price!=null&&price>0;
    return {variant,qty,price,stock,valid};
  }
  function update(){
    const value=selection();if(!value)return;
    const rate=details.shipping?.cny_rate||1;
    document.querySelector('#pd-unit-price').textContent=value.price==null?'Үнэ тодорхойгүй':money(supplier?Math.ceil(value.price*rate):value.price);
    document.querySelector('#pd-original-price').textContent=supplier&&value.price!=null?`${value.price} ¥ / ширхэг`:'';
    document.querySelector('#pd-total').textContent=value.valid?money(supplier?Math.ceil(value.price*value.qty*rate):value.price*value.qty):'Сонголтоо шалгана уу';
    document.querySelector('#pd-stock').textContent=value.stock==null?'Үлдэгдлийг захиалгын үед баталгаажуулна':`Үлдэгдэл: ${value.stock} ширхэг`;
    document.querySelector('#pd-selection-error').textContent=value.valid?'':`Хувилбар, доод тоо болон үлдэгдлээ шалгана уу. Доод тоо ${supplier?product.min_qty:1}, алхам ${supplier?product.step:1}.`;
    root.querySelector('[data-pd-delta="-1"]').disabled=value.qty<=Number(root.querySelector('#pd-qty').min);
    root.querySelector('[data-pd-delta="1"]').disabled=value.qty+Number(root.querySelector('#pd-qty').step)>Math.min(Number(root.querySelector('#pd-qty').max),value.stock??Infinity);
    root.querySelectorAll('[data-pd-submit]').forEach(b=>b.disabled=!value.valid||(supplier&&(details.stale||!product.sellable)));
  }
  function gallery(index){
    photo=index;const main=root.querySelector('#pd-main-image');if(!main)return;
    main.src=images[index];main.alt=product.name+' · '+(index+1);
    root.querySelector('#pd-image-count').textContent=`${index+1} / ${images.length}`;
    root.querySelectorAll('[data-pd-photo]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.pdPhoto)===index)));
  }
  function extraInfo(p){
    const rows=[['Брэнд',p.brand],['Барааны төлөв',p.condition==='New'?'Шинэ':p.condition==='Used'?'Хуучин':p.condition],['Илгээх байршил',p.location?.join(', ')],['Нийт үлдэгдэл',p.stock==null?'':p.stock+' ширхэг'],['Доод захиалга',p.min_qty+' ширхэг'],['Нэмэх алхам',p.step+' ширхэг'],['Жин',p.weight_kg? p.weight_kg+' кг'+(p.weight_type?' · '+p.weight_type:''):''],['Нийлүүлэгчийн ангилал',p.category_path?.join(' / ')],['Эх нэр',p.original_name],['Шинэчилсэн',details.fetched?new Date(details.fetched).toLocaleString('mn-MN'):'']].filter(([,v])=>v);
    return '<dl class="pd-facts">'+rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';
  }
  function mediaInfo(p){
    return (p.videos?.length?'<div class="pd-videos">'+p.videos.map(v=>'<video controls playsinline preload="none"'+(v.poster?' poster="'+esc(v.poster)+'"':'')+' src="'+esc(v.url)+'" aria-label="Барааны танилцуулга видео"></video>').join('')+'</div>':'')+(p.description_images?.length?'<details class="pd-description-photos"><summary>Нийлүүлэгчийн дэлгэрэнгүй зураг ('+p.description_images.length+')</summary><div>'+p.description_images.map((src,i)=>'<img data-description-src="'+esc(src)+'" alt="Барааны тайлбар · '+(i+1)+'" loading="lazy" referrerpolicy="no-referrer">').join('')+'</div></details>':'');
  }
  function render(){
    const p=product,variants=p.variants;
    const available=supplier?variants.find(v=>v.cny!==null&&v.stock!==0)?.id:variants[0];
    images=supplier?[...new Set([...(p.images?.length?p.images:p.image?[p.image]:[]),...variants.map(v=>v.image).filter(Boolean)])]:['/assets/'+p.image+'.jpg'];
    const specs=supplier?p.attributes||[]:[{name:'Ангилал',value:categories.find(c=>c.id===p.category)?.name||p.category},{name:'Төрөл',value:p.type==='local'?'Бэлэн бараа':'Хятадаас захиалах'}];
    document.title=p.name+' · GOStore';
    document.querySelector('meta[name=description]').content=p.name+' — GOStore. Барааны сонголт, үнэ, хүргэлтийн мэдээлэл.';
    let canonical=document.querySelector('link[rel=canonical]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=location.origin+'/'+match[1]+'/'+match[2];
    root.innerHTML=`<nav class="pd-breadcrumb" aria-label="Хуудасны зам"><a href="/">Нүүр</a><span>/</span><a href="/${supplier?'#supplier-catalog':'#catalog'}">${supplier?esc(p.provider_label||'1688')+' каталог':'Бараа бүтээгдэхүүн'}</a><span>/</span><span>${esc(match[2])}</span></nav>
    <div class="pd-layout"><div class="pd-gallery"><div class="pd-image-stage">${images.length?`<button type="button" class="pd-zoom" data-pd-zoom aria-label="Зургийг томруулж харах"><img id="pd-main-image" src="${esc(images[0])}" alt="${esc(p.name)}" referrerpolicy="no-referrer" fetchpriority="high"></button><span id="pd-image-count" class="pd-image-count">1 / ${images.length}</span>`:`<div class="pd-no-image">${icon('box')}<p>Зураг оруулаагүй байна</p></div>`}<span class="pd-source">${supplier?esc(p.provider_label||'1688'):'GOStore'}</span></div>
    ${images.length>1?`<div class="pd-thumbnails" aria-label="Барааны зургууд">${images.map((url,i)=>`<button type="button" data-pd-photo="${i}" aria-label="${i+1}-р зураг" aria-pressed="${i===0}"><img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`:''}
    <div class="pd-gallery-foot"><span>Барааны код: <strong>${esc(match[2])}</strong></span><button type="button" class="text-button" data-pd-share>Холбоос хуулах ↗</button></div></div>
    <div class="pd-summary"><span class="section-kicker">${supplier?'ХЯТАДААС ЗАХИАЛАХ':'GOSTORE СОНГОЛТ'}</span><h1>${esc(p.name)}</h1>${supplier&&p.vendor_name?`<p class="pd-vendor">Дэлгүүр: ${esc(p.vendor_name)}</p>`:''}
    ${supplier?`<div class="pd-sales">${p.sold_count?`<span>${esc(p.sold_count.toLocaleString())} зарагдсан</span>`:''}${p.sales_30_days?`<span>Сүүлийн 30 хоног: ${esc(p.sales_30_days.toLocaleString())}</span>`:''}</div>`:''}
    <div class="pd-price-box"><span>Барааны үнэ</span><strong id="pd-unit-price"></strong><small id="pd-original-price"></small><p>Хүргэлтийн төлбөр нэмэгдэнэ</p></div>
    ${!supplier&&p.demo?'<p class="pd-warning">Жишээ бараа · Бодит худалдааны санал биш.</p>':''}
    ${supplier&&(details.stale||!p.sellable)?'<div class="pd-warning" role="alert">Барааны үнэ, худалдаалах нөхцөлийг дахин шалгах шаардлагатай. Захиалга түр боломжгүй.<br><button type="button" class="text-button" data-pd-retry>Мэдээлэл шинэчлэх ↻</button></div>':''}
    <form id="pd-options"><label class="field">Өнгө / хэмжээ / загвар<select name="variant" required>${variants.map(v=>supplier?`<option value="${esc(v.id)}" ${v.id===available?'selected':''} ${v.stock===0||v.cny===null?'disabled':''}>${esc(v.label)}${v.stock===0?' · Дууссан':''}</option>`:`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>
    <div class="pd-quantity-row"><label for="pd-qty">Тоо ширхэг</label><div class="pd-quantity"><button type="button" data-pd-delta="-1" aria-label="Тоо бууруулах">−</button><input id="pd-qty" name="qty" type="number" inputmode="numeric" min="${supplier?p.min_qty:1}" step="${supplier?p.step:1}" max="${supplier?9999:99}" value="${supplier?p.min_qty:1}" required><button type="button" data-pd-delta="1" aria-label="Тоо нэмэх">+</button></div></div><p class="pd-muted" id="pd-stock"></p><p class="form-error" id="pd-selection-error" role="alert"></p>
    <div class="pd-buybar"><div><small>Барааны дүн · хүргэлт нэмэгдэнэ</small><strong id="pd-total"></strong></div><button class="button blue" type="submit" data-pd-submit>${supplier?'Үргэлжлүүлэх':'Сагсанд нэмэх'} ${icon('arrow')}</button><button type="button" class="button blue" data-action="account" data-guest-only>Нэвтэрч захиалах</button></div></form>
    <div class="pd-delivery">${icon('truck')}<div><strong>Эрээн → Замын-Үүд → Улаанбаатар</strong><p>Хятад доторх хүргэлт, каргоны дүнг баталгаажуулсны дараа төлнө. Одоо төлбөр суутгахгүй.</p></div></div>
    ${supplier&&p.tiers?.length?`<div class="pd-tiers"><strong>Тоо ширхгээс хамаарах лавлах үнэ</strong>${p.tiers.map(t=>`<span>${t.qty}+ ширхэг <b>${esc(t.cny)} ¥</b></span>`).join('')}<small>Сонгосон хувилбарын эцсийн үнийг баталгаажуулна.</small></div>`:''}
    ${supplier?`<a class="text-button" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.provider_label||'1688')} дээр харах ↗</a>`:''}</div></div>
    <nav class="pd-section-links" aria-label="Барааны мэдээлэл"><a href="#pd-description">Тайлбар</a><a href="#pd-specifications">Үзүүлэлт</a><a href="#pd-shipping">Хүргэлт</a></nav>
    <div class="pd-details"><section id="pd-description"><span class="section-kicker">БАРААНЫ ТУХАЙ</span><h2>Дэлгэрэнгүй тайлбар</h2><p class="pd-description">${esc(p.description||(p.description_images?.length?'Дэлгэрэнгүй мэдээллийг доорх зургаас үзнэ үү.':'Нийлүүлэгч дэлгэрэнгүй тайлбар оруулаагүй байна.'))}</p>${supplier?mediaInfo(p):''}</section>
    <section id="pd-specifications"><h2>Барааны үзүүлэлт</h2>${supplier?extraInfo(p):''}${specs.length?`<dl>${specs.map(a=>`<div><dt>${esc(a.name)}</dt><dd>${esc(a.value)}</dd></div>`).join('')}</dl>`:'<p>Үзүүлэлтийн мэдээлэл хараахан ирээгүй байна.</p>'}</section>
    <section id="pd-shipping"><h2>Хүргэлт ба төлбөр</h2><div class="pd-steps"><div><b>01</b><strong>Сонголтоо батлах</strong><p>Хувилбар, тоо ширхэгээ сонгон захиалгын мэдээллээ оруулна.</p></div><div><b>02</b><strong>Үнийн санал авах</strong><p>Бараа, хүргэлтийн дүн баталгаажсаны дараа QPay-ээр төлнө.</p></div><div><b>03</b><strong>Ачаагаа хянах</strong><p>Өөрийн GS кодоор “Миний ачаа” хэсгээс явцыг харна.</p></div></div></section></div>`;
    const descriptionPhotos=root.querySelector('.pd-description-photos');
    descriptionPhotos?.addEventListener('toggle',()=>{if(descriptionPhotos.open)descriptionPhotos.querySelectorAll('[data-description-src]').forEach(img=>{img.src=img.dataset.descriptionSrc;delete img.dataset.descriptionSrc;});});
    if(supplier&&p.related?.length){const section=document.createElement('section');section.className='pd-related';section.innerHTML='<h2>Танд сонирхолтой байж болох бараа</h2><div class="pd-related-grid">'+p.related.map(item=>'<a href="/v/'+esc(item.id.startsWith('tb-')?item.id:item.id.replace(/^abb-/,''))+'">'+(item.image?'<img src="'+esc(item.image)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'')+'<span>'+esc(item.name)+'</span><strong>'+(item.mnt?money(item.mnt):'Үнэ лавлах')+'</strong></a>').join('')+'</div>';root.append(section);}
    update();
  }
  async function load(){
    const preview=supplier?window.supplierApi.previewProduct?.(id):null;
    if(preview){root.innerHTML=`<div class="pd-preview" aria-busy="true">${preview.image&&/^https:\/\//.test(preview.image)?`<img src="${esc(preview.image)}" alt="${esc(preview.name)}" referrerpolicy="no-referrer" fetchpriority="high">`:''}<div><span class="section-kicker">БАРААНЫ МЭДЭЭЛЭЛ</span><h1>${esc(preview.name)}</h1>${preview.mnt?`<p class="product-price">${money(preview.mnt)}</p>`:''}<p role="status">Өнгө, хэмжээ, үнэ, үлдэгдлийг шалгаж байна…</p><p class="pd-muted">Сонголтууд ачаалсны дараа захиалах боломжтой.</p></div></div>`;}
    else stateMessage('Барааны мэдээлэл ачаалж байна…','Үнэ, сонголт, зургуудыг авч байна.');
    try{
      if(supplier){details=await supplierApi('supplier-product',{id});product=details.product;}
      else{await window.catalogReady;if(!storeServer.ready)throw Error('Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.');product=products.find(p=>p.id===id);details={};if(!product){stateMessage('Бараа олдсонгүй','Энэ бараа устгагдсан эсвэл худалдаанд байхгүй байна.');return;}}
      render();
    }catch(error){stateMessage('Мэдээлэл авах боломжгүй',error.message,true);}
  }
  root.addEventListener('input',e=>{if(e.target.closest('#pd-options'))update();});
  root.addEventListener('change',e=>{if(e.target.closest('#pd-options')){update();if(supplier&&e.target.name==='variant'){const image=selection()?.variant?.image,index=images.indexOf(image);if(index>=0)gallery(index);}}});
  root.addEventListener('submit',e=>{if(e.target.id!=='pd-options')return;e.preventDefault();if(!customerAccount.require())return;const value=selection();if(!value?.valid)return; if(supplier){if(details.stale||!product.sellable)return;openSupplierOrder(product,value.variant.id,value.qty);}else addToCart(id,value.variant,value.qty);});
  root.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-pd-retry'))return storeServer.ready?load():location.reload();
    if(b.hasAttribute('data-pd-photo'))gallery(Number(b.dataset.pdPhoto));
    if(b.hasAttribute('data-pd-zoom'))openModal('Барааны зураг',`<img class="pd-full-image" src="${esc(images[photo])}" alt="${esc(product.name)}" referrerpolicy="no-referrer">`);
    if(b.hasAttribute('data-pd-delta')){const input=root.querySelector('#pd-qty'),min=Number(input.min),step=Number(input.step);input.value=String(Math.min(Number(input.max),Math.max(min,(Number(input.value)||min)+Number(b.dataset.pdDelta)*step)));update();}
    if(b.hasAttribute('data-pd-share')){const url=location.origin+'/'+match[1]+'/'+match[2];try{await navigator.clipboard.writeText(url);toast('Барааны холбоосыг хууллаа');}catch{openModal('Барааны холбоос',`<label class="field">Холбоос<input value="${esc(url)}" readonly></label>`);}}
  });
  document.addEventListener('submit',e=>{if(e.target.id==='search-form'){e.preventDefault();e.stopImmediatePropagation();location.assign('/?q='+encodeURIComponent(document.querySelector('#search').value.trim())+'#supplier-catalog');}},true);
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&(b.hasAttribute('data-filter')||b.hasAttribute('data-category')||['browse','favorites'].includes(b.dataset.action))){e.preventDefault();e.stopImmediatePropagation();const query=b.dataset.action==='favorites'?'?filter=saved':b.dataset.category?'?category='+encodeURIComponent(b.dataset.category):'';location.assign('/'+query+'#'+(b.dataset.filter==='china'?'supplier-catalog':'catalog'));}},true);
  load();
})();
