'use strict';
(()=>{
  const match=location.pathname.match(/^\/(v|p)\/([a-z0-9-]+)\/?$/);
  if(!match)return;
  const supplier=match[1]==='v',id=supplier?(match[2].startsWith('tb-')?match[2]:'abb-'+match[2]):match[2];
  const root=document.createElement('section');root.id='product-page';root.className='container pd-page';
  document.querySelector('#main').prepend(root);
  let product,details,images=[],photo=0;
  function stateMessage(title,message,retry=false){root.innerHTML=`<div class="pd-state"><span class="section-kicker">GOSTORE / БАРАА</span><h1>${esc(title)}</h1><p>${esc(message)}</p>${retry?'<button class="button blue" data-pd-retry>Дахин оролдох</button>':''}<a class="button outline" href="/#supplier-catalog">Дэлгүүр рүү буцах</a></div>`;}
  function selection(){
    const form=document.querySelector('#pd-options');if(!form)return null;
    const chosen=supplier?form.querySelector('[name=variant]:checked')?.value:form.elements.variant.value,variant=product.variants.find(v=>(supplier?v.id:v)===chosen),qty=Number(form.elements.qty.value);
    const min=supplier?product.min_qty:1,step=supplier?product.step:1;
    const price=supplier?variant?.cny:product.price;
    const stock=supplier?variant?.stock:product.type==='local'?product.stock:null;
    const valid=!!variant&&Number.isInteger(qty)&&qty>=min&&qty<=(supplier?9999:99)&&(qty-min)%step===0&&(stock==null||qty<=stock)&&price!=null&&price>0;
    return {variant,qty,price,stock,valid};
  }
  function update(){
    const value=selection();if(!value)return;
    const rate=details.shipping?.cny_rate||1;
    const label=root.querySelector('#pd-selected-label');if(label)label.textContent=supplier?value.variant?.label||'Сонголтоо сонгоно уу':String(value.variant||'');
    document.querySelector('#pd-unit-price').textContent=value.price==null?'Үнэ тодорхойгүй':money(supplier?Math.ceil(value.price*rate):value.price);
    document.querySelector('#pd-original-price').innerHTML=supplier?supplierPromotionHtml(product,value.price==null?null:Math.ceil(value.price*rate),value.variant?.card_discount??null,true):'';
    document.querySelector('#pd-total').textContent=value.valid?money(supplier?Math.ceil(Number((value.price*value.qty*rate).toFixed(8))):value.price*value.qty):'Сонголтоо шалгана уу';
    document.querySelector('#pd-stock').textContent=value.stock==null?'Үлдэгдлийг захиалгын үед баталгаажуулна':`Үлдэгдэл: ${value.stock}ш`;
    document.querySelector('#pd-selection-error').textContent=value.valid?'':`Хувилбар, доод тоо болон үлдэгдлээ шалгана уу. Доод тоо ${supplier?product.min_qty:1}, алхам ${supplier?product.step:1}.`;
    root.querySelector('[data-pd-delta="-1"]').disabled=value.qty<=Number(root.querySelector('#pd-qty').min);
    root.querySelector('[data-pd-delta="1"]').disabled=value.qty+Number(root.querySelector('#pd-qty').step)>Math.min(Number(root.querySelector('#pd-qty').max),value.stock??Infinity);
    root.querySelectorAll('[data-pd-submit],[data-pd-add]').forEach(b=>b.disabled=!value.valid||(supplier&&(details.stale||!product.sellable)));
  }
  function gallery(index){
    photo=index;const main=root.querySelector('#pd-main-image');if(!main)return;
    const source=images[index],resized=supplierImageUrl(source,800);
    if(resized!==source)main.dataset.imageOriginal=source;else delete main.dataset.imageOriginal;
    main.src=resized;main.alt=product.name+' · '+(index+1);
    root.querySelector('#pd-image-count').textContent=`${index+1} / ${images.length}`;
    root.querySelectorAll('[data-pd-photo]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.pdPhoto)===index)));
  }
  // A few decision-relevant facts replace the supplier's long attribute table.
  function briefInfo(p){
    const attr=re=>(p.attributes||[]).find(a=>re.test(String(a.name).trim())&&a.value&&!/^(other|others|其他|无|бусад)$/i.test(String(a.value).trim()))?.value;
    const groups=new Map();
    for(const v of p.variants||[])for(const part of String(v.label||'').split(' / ')){const at=part.indexOf(': ');if(at<1)continue;const name=part.slice(0,at),values=groups.get(name)||new Set();values.add(part.slice(at+2));groups.set(name,values);}
    const kinds=[...groups].map(([name,values])=>/colou?r|өнгө/i.test(name)?values.size+' өнгө':/size|хэмжээ/i.test(name)?values.size+' хэмжээ':'').filter(Boolean);
    const options=kinds.length?kinds.join(' · '):p.variants?.length>1?p.variants.length+' сонголт':'';
    const rows=[['Брэнд',p.brand||attr(/^(brand|品牌|брэнд)$/i)],['Материал',attr(/material|fabric|材质|面料|материал/i)],['Сонголт',options],['Илгээх газар',p.ship_from||p.location?.join(', ')],['Илгээлт',p.ships_48h?'Нийлүүлэгч 48 цагийн дотор илгээнэ':''],['Хамгийн багадаа',p.min_qty>1?p.min_qty+'ш':'']].filter(([,v])=>v);
    return rows.length?'<dl class="pd-brief">'+rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>':'';
  }
  // Taobao shop rating (DSR, out of 5) from the catalog search that listed this product.
  function ratingHtml(rating){
    if(!(rating>0&&rating<=5))return '';
    const halves=Math.round(rating*2),stars=Array.from({length:5},(_,i)=>`<i class="${halves>=2*i+2?'on':halves===2*i+1?'half':''}">★</i>`).join('');
    return `<span class="pd-rating" role="img" aria-label="Дэлгүүрийн үнэлгээ ${rating.toFixed(1)} / 5"><span class="pd-stars" aria-hidden="true">${stars}</span><b aria-hidden="true">${rating.toFixed(1)}</b></span>`;
  }
  // «Танд санал болгох»: mixed products from every department, loaded when the reader nears it.
  function recommendations(p){
    const section=document.createElement('section');
    section.className='pd-related';section.id='pd-recommend';
    section.innerHTML='<h2>Танд санал болгох</h2><div class="product-grid" id="pd-recommend-grid"></div><p role="status" data-recommend-status></p><button type="button" class="button outline" data-recommend-next>Дараагийн бараа</button>';
    root.append(section);
    const grid=section.querySelector('#pd-recommend-grid');
    const status=section.querySelector('[data-recommend-status]');
    const next=section.querySelector('[data-recommend-next]');
    const seen=new Set([p.id]);
    let page=1,loading=false,more=true,failed=false;
    async function load(){
      if(loading||!more||!section.isConnected)return;
      loading=true;failed=false;next.disabled=true;status.textContent='Ачаалж байна…';
      try{
        const result=await supplierApi('supplier-recommend',{id:p.id,page});
        if(!section.isConnected)return;
        const items=(result.products||[]).filter(item=>{
          const price=item.mnt??item.approx_mnt;
          if(!item.id||seen.has(item.id)||item.sellable===false||!(price>0))return false;
          seen.add(item.id);return true;
        });
        renderSupplierCards(items,true,grid);
        page++;more=result.more===true;
        status.textContent=more?'':seen.size>1?'Бүх санал болгох барааг үзлээ.':'Санал болгох бараа одоогоор алга байна.';
        next.hidden=!more;
      }catch{
        failed=true;status.textContent='Бараа ачаалж чадсангүй.';
        next.textContent='Дахин оролдох';
      }finally{
        loading=false;next.disabled=false;
        if(!failed&&more){
          next.textContent='Дараагийн бараа';
          // Re-observe after appending, including pages with no new priced items.
          watch?.unobserve(next);watch?.observe(next);
        }
      }
    }
    next.onclick=load;
    const watch=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
      if(!section.isConnected){watch.disconnect();return;}
      if(!failed&&entries.some(entry=>entry.isIntersecting))void load();
    },{rootMargin:'0px 0px 800px 0px'}):null;
    if(watch)watch.observe(next);else void load();
    window.addEventListener('pagehide',()=>watch?.disconnect(),{once:true});
  }
  function mediaInfo(p){
    return (p.videos?.length?'<div class="pd-videos">'+p.videos.map(v=>'<video controls playsinline preload="none"'+(v.poster?' poster="'+esc(v.poster)+'"':'')+' src="'+esc(v.url)+'" aria-label="Барааны танилцуулга видео"></video>').join('')+'</div>':'')+(p.description_images?.length?'<details class="pd-description-photos"><summary>Нийлүүлэгчийн дэлгэрэнгүй зураг ('+p.description_images.length+')</summary><div>'+p.description_images.map((src,i)=>'<img data-description-src="'+esc(src)+'" alt="Барааны тайлбар · '+(i+1)+'" loading="lazy" referrerpolicy="no-referrer">').join('')+'</div></details>':'');
  }
  function shippingTools(p){
    const native=supplier&&details.shipping?.catalog_provider==='taoworld';
    return `<section class="pd-shipping-tools" aria-label="Хүргэлтийн тооцоо"><h3>Хүргэлтийн зардлаа шалгах</h3>${native?`<div class="pd-domestic"><strong>Нийлүүлэгч → Эрээн агуулах</strong><p>Барааны хүргэлтийн лавлах үнийг шалгана. Сонголт, тоо ширхэг, нэг дэлгүүрийн нийлүүлсэн захиалгын эцсийн дүнг төлөхийн өмнө дахин тооцно.</p><button type="button" class="button outline" data-pd-logistics>Эрээн хүртэлх үнэ шалгах</button><output data-pd-logistics-result aria-live="polite"></output></div>`:''}<p class="pd-muted">${Number(p.weight_kg)>0?`Нийлүүлэгчийн лавлах жин: ${esc(p.weight_kg)} кг. Савласан нийт жин өөр байж болно.`:'Нийлүүлэгч савласан жин, хэмжээс мэдээлээгүй. Агуулахад ирэхэд хэмжиж, Миний ачаа хэсэгт харуулна.'}</p>${commerceUI.calculator(details.shipping)}</section>`;
  }
  function render(){
    const p=product,variants=p.variants;
    const available=supplier?variants.filter(v=>v.cny>0&&(v.stock===null||v.stock>=product.min_qty)).sort((a,b)=>(a.stock===null)-(b.stock===null)||a.cny-b.cny)[0]?.id:variants[0];
    images=supplier?[...new Set([...(p.images?.length?p.images:p.image?[p.image]:[]),...variants.map(v=>v.image).filter(Boolean)])]:['/assets/'+p.image+'.jpg'];
    document.title=p.name+' · GOStore';
    document.querySelector('meta[name=description]').content=p.name+' — GOStore. Барааны сонголт, үнэ, хүргэлтийн мэдээлэл.';
    let canonical=document.querySelector('link[rel=canonical]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=location.origin+'/'+match[1]+'/'+match[2];
    root.innerHTML=`<nav class="pd-breadcrumb" aria-label="Хуудасны зам"><a href="/">Нүүр</a><span>/</span><a href="/${supplier?'#supplier-catalog':'#catalog'}">${supplier?'Бараанууд':'Бараа бүтээгдэхүүн'}</a><span>/</span><span aria-current="page">${esc(p.name)}</span></nav>
    <div class="pd-layout"><div class="pd-gallery"><div class="pd-image-stage">${images.length?`<button type="button" class="pd-zoom" data-pd-zoom aria-label="Зургийг томруулж харах"><img id="pd-main-image" ${supplierImageAttrs(images[0],800)} alt="${esc(p.name)}" referrerpolicy="no-referrer" fetchpriority="high"></button><span id="pd-image-count" class="pd-image-count">1 / ${images.length}</span>`:`<div class="pd-no-image">${icon('box')}<p>Зураг оруулаагүй байна</p></div>`}<span class="pd-source">${supplier?'QPay-ээр төлнө':'GOStore'}</span></div>
    ${images.length>1?`<div class="pd-thumbnails" aria-label="Барааны зургууд">${images.map((url,i)=>`<button type="button" data-pd-photo="${i}" aria-label="${i+1}-р зураг" aria-pressed="${i===0}"><img ${supplierImageAttrs(url,120)} alt="" loading="lazy" fetchpriority="low" referrerpolicy="no-referrer"></button>`).join('')}</div>`:''}
    <div class="pd-gallery-foot"><span>Барааны код: <strong>${esc(match[2])}</strong></span><span class="pd-foot-actions">${supplier?`<button type="button" class="text-button" data-compare-toggle="${esc(p.id)}" data-name="${esc(p.name)}" data-image="${esc(p.image||'')}" data-label-on="Харьцуулж байна ✓" data-label-off="Харьцуулах ⇄"><span>Харьцуулах ⇄</span></button>`:''}<button type="button" class="text-button" data-pd-share>Холбоос хуулах ↗</button></span></div></div>
    <div class="pd-summary"><span class="section-kicker">${supplier?'GOSTORE ДЭЛГҮҮР':'GOSTORE СОНГОЛТ'}</span><h1>${esc(p.name)}</h1>${supplier&&(p.vendor_name||p.shop_rating)?`<p class="pd-vendor">${p.vendor_name?`<span>Дэлгүүр: ${esc(p.vendor_name)}</span>`:''}${ratingHtml(Number(p.shop_rating))}</p>`:''}
    ${supplier?`<div class="pd-sales">${p.sold_count?`<span>${esc(p.sold_count.toLocaleString('en-US'))} · нийлүүлэгч дээр зарагдсан</span>`:''}${p.min_qty>1?`<span>Хамгийн багадаа ${esc(p.min_qty)}ш</span>`:''}${p.sales_30_days?`<span>Сүүлийн 30 хоног: ${esc(p.sales_30_days.toLocaleString())}</span>`:''}</div>`:''}
    ${supplier&&p.brand_name?`<p class="pd-brand-store"><a href="${esc(window.supplierBrandHref(p.brand_id))}">${esc(p.brand_name)} · эх дэлгүүрийн бусад бараа →</a></p>`:''}
    <div class="pd-price-box"><span>Үнэ</span><strong id="pd-unit-price"></strong><small id="pd-original-price"></small><p>Олон улсын каргог бодит жин эсвэл эзлэхүүнээр тооцно</p></div>
    ${supplier?briefInfo(p):''}
    ${!supplier&&p.demo?'<p class="pd-warning">Жишээ бараа · Бодит худалдааны санал биш.</p>':''}
    ${supplier&&details.stale?'<div class="pd-warning" role="alert">Барааны үнэ, худалдаалах нөхцөлийг дахин шалгах шаардлагатай. Захиалга түр боломжгүй.<br><button type="button" class="text-button" data-pd-retry>Мэдээлэл шинэчлэх ↻</button></div>':supplier&&!p.sellable?'<div class="pd-warning" role="alert">Нийлүүлэгч энэ барааг одоогоор худалдаалахгүй байна. Төстэй бараанаас сонгоно уу.</div>':''}
    ${supplier&&p.brand_id?productOffersHtml(p,details.stale):''}
    <form id="pd-options">${supplier?`<fieldset class="pd-variant-list" data-variants-collapsed><legend>Өнгө / хэмжээ / загвар <small>${variants.length} сонголт</small></legend>${variants.map(v=>{const off=(v.stock!==null&&v.stock<product.min_qty)||v.cny===null;return `<label class="pd-variant${off?' off':''}"><input type="radio" name="variant" value="${esc(v.id)}" ${v.id===available?'checked':''} ${off?'disabled':''} required>${/^https:\/\//i.test(v.image||p.image||'')?`<img ${supplierImageAttrs(v.image||p.image,80)} alt="" loading="lazy" fetchpriority="low" referrerpolicy="no-referrer">`:'<span class="pd-variant-noimg"></span>'}<span class="pd-variant-name">${esc(v.label)}</span><span class="pd-variant-side"><b>${v.cny>0?money(Math.ceil(v.cny*(details.shipping?.cny_rate||0))):'—'}</b><small>${v.stock===0?'Дууссан':v.stock==null?'':'Үлд: '+v.stock+'ш'}</small></span></label>`;}).join('')}</fieldset>${variants.length>4?'<button type="button" class="text-button pd-variants-toggle" data-variants-toggle aria-expanded="false">Бүх сонголтыг харах ('+variants.length+')</button>':''}`:`<label class="field">Өнгө / хэмжээ / загвар<select name="variant" required>${variants.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`}
    <div class="pd-quantity-row"><label for="pd-qty">Тоо ширхэг</label><div class="pd-quantity"><button type="button" data-pd-delta="-1" aria-label="Тоо бууруулах">−</button><input id="pd-qty" name="qty" type="number" inputmode="numeric" min="${supplier?p.min_qty:1}" step="${supplier?p.step:1}" max="${supplier?9999:99}" value="${supplier?p.min_qty:1}" required><button type="button" data-pd-delta="1" aria-label="Тоо нэмэх">+</button></div></div><p class="pd-muted" id="pd-stock"></p><p class="pd-muted">${esc(commerceUI.unitHelp)}</p><p class="form-error" id="pd-selection-error" role="alert"></p>
    <div class="pd-buybar"><div><small>Барааны үнэ · карго тусдаа</small><strong id="pd-total"></strong><span id="pd-selected-label" class="pd-selected-label"></span></div>${supplier?`<button type="button" class="button outline pd-add" data-pd-add aria-label="Сагсанд нэмэх" title="Сагсанд нэмэх">${icon('cart-add')}<span>Сагслах</span></button>`:''}<button class="button blue pd-buy" type="submit" data-pd-submit>${supplier?'Худалдан авах':'Сагсанд нэмэх'}</button></div></form>
    ${supplier?shippingTools(p):''}<div class="pd-assurance"><a href="/help#delivery">Хүргэлт, тариф</a><a href="/help#returns">Гэмтэл, буцаалтын хүсэлт</a><a href="/help#cancellation">Цуцлах нөхцөл</a></div><div class="pd-delivery">${icon('truck')}<div><strong>Эрээн → Замын-Үүд → Улаанбаатар</strong><p>${supplier?esc(commerceUI.paymentText(details.shipping)):'Бараа, хүргэлтийн дүн баталгаажсаны дараа төлнө.'}</p><p>${esc(commerceUI.timingText())}</p></div></div>
    ${supplier&&p.tiers?.length?`<div class="pd-tiers"><strong>Тоо ширхгээс хамаарах лавлах үнэ</strong>${p.tiers.map(t=>`<span>${t.qty}+ ширхэг <b>${money(Math.ceil(t.cny*(details.shipping?.cny_rate||0)))}</b></span>`).join('')}<small>Сонгосон хувилбарын эцсийн үнийг баталгаажуулна.</small></div>`:''}
    ${supplier?`<details class="pd-source-details"><summary>Эх нийлүүлэгчийн мэдээлэл</summary><p>GOStore нь сонгосон барааны захиалга, тээврийн явцыг зохицуулна. Дэлгүүрийн борлуулалт, мэдээлэл нь эх нийлүүлэгчийнх.</p><a class="text-button" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Нийлүүлэгчийн хуудас ↗</a></details>`:''}</div></div>
    <nav class="pd-section-links" aria-label="Барааны мэдээлэл"><a href="#pd-reviews">Үнэлгээ, сэтгэгдэл</a><a href="#pd-description">Тайлбар</a><a href="#pd-shipping">Хүргэлт</a></nav>
    <div class="pd-details"><section id="pd-description"><span class="section-kicker">БАРААНЫ ТУХАЙ</span><h2>Дэлгэрэнгүй тайлбар</h2><p class="pd-description">${esc(p.description||(p.description_images?.length?'Дэлгэрэнгүй мэдээллийг доорх зургаас үзнэ үү.':'Нийлүүлэгч дэлгэрэнгүй тайлбар оруулаагүй байна.'))}</p>${supplier?mediaInfo(p):''}</section>
    <section id="pd-shipping"><h2>Хүргэлт ба төлбөр</h2><div class="pd-steps"><div><b>01</b><strong>Сонголтоо батлах</strong><p>Өнгө, хэмжээ, тоо ширхэгээ сонгоно.</p></div><div><b>02</b><strong>${supplier?'QPay-ээр төлөх':'Үнийн санал авах'}</strong><p>${supplier?esc(commerceUI.paymentText(details.shipping))+' Захиалгын нэхэмжлэлийг '+Number(details.shipping?.payment_window_hours||24)+' цагийн дотор төлнө.':'Бараа, хүргэлтийн дүн баталгаажсаны дараа QPay-ээр төлнө.'}</p></div><div><b>03</b><strong>Ачаагаа хянах</strong><p>Өөрийн GS кодоор “Миний ачаа” хэсгээс явцыг харна.</p></div></div></section></div>`;
    const descriptionPhotos=root.querySelector('.pd-description-photos');
    descriptionPhotos?.addEventListener('toggle',()=>{if(descriptionPhotos.open)descriptionPhotos.querySelectorAll('[data-description-src]').forEach(img=>{img.src=img.dataset.descriptionSrc;delete img.dataset.descriptionSrc;});});
    window.mountProductReviews(root,p);
    if(supplier)recommendations(p);
    root.querySelector('[data-variants-toggle]')?.addEventListener('click',e=>{const field=root.querySelector('.pd-variant-list'),collapsed=field.toggleAttribute('data-variants-collapsed');e.currentTarget.setAttribute('aria-expanded',String(!collapsed));e.currentTarget.textContent=collapsed?'Бүх сонголтыг харах ('+variants.length+')':'Сонголтуудыг хураах';});
    update();
  }
  async function load(){
    const preview=supplier?window.supplierApi.previewProduct?.(id):null;
    if(preview){root.innerHTML=`<div class="pd-preview" aria-busy="true">${preview.image&&/^https:\/\//.test(preview.image)?`<img ${supplierImageAttrs(preview.image,800)} alt="${esc(preview.name)}" referrerpolicy="no-referrer" fetchpriority="high">`:''}<div><span class="section-kicker">БАРААНЫ МЭДЭЭЛЭЛ</span><h1>${esc(preview.name)}</h1>${preview.mnt?`<p class="product-price">${money(preview.mnt)}</p>`:''}<p role="status">Өнгө, хэмжээ, үнэ, үлдэгдлийг шалгаж байна…</p><p class="pd-muted">Сонголтууд ачаалсны дараа худалдан авах боломжтой.</p></div></div>`;}
    else stateMessage('Барааны мэдээлэл ачаалж байна…','Үнэ, сонголт, зургуудыг авч байна.');
    try{
      if(supplier){details=await supplierApi('supplier-product',{id,...(initialFilters.get('shop')?{shop:initialFilters.get('shop')}:{}),...(initialFilters.get('brand')?{brand:initialFilters.get('brand')}:{})});product=details.product;}
      else{await window.catalogReady;if(!storeServer.ready)throw Error('Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.');product=products.find(p=>p.id===id);details={};if(!product){stateMessage('Бараа олдсонгүй','Энэ бараа устгагдсан эсвэл худалдаанд байхгүй байна.');return;}}
      render();
    }catch(error){stateMessage(error.status===404?'Бараа олдсонгүй':'Мэдээлэл авах боломжгүй',error.message,error.status!==404);}
  }
  root.addEventListener('click',e=>{if(!e.target.closest('[data-pd-add]'))return;const value=selection();if(value?.valid&&!details.stale&&product.sellable)taobaoCart.add(product,value.variant,value.qty);});
  root.addEventListener('click',async e=>{
    const button=e.target.closest('[data-pd-logistics]');if(!button||button.disabled)return;
    const output=button.parentElement.querySelector('output');button.disabled=true;output.textContent='Хүргэлтийн үнэ шалгаж байна…';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
    try{
      const response=await fetch('/api/index.php?'+new URLSearchParams({action:'supplier-logistics',id:product.id}),{credentials:'omit',cache:'no-store',signal:controller.signal}),q=await response.json();
      if(!button.isConnected)return;
      if(!response.ok||q.status!=='available'||!Number.isFinite(q.fee_cny)||q.fee_cny<0||!Number.isFinite(q.fee_mnt)||q.fee_mnt<0)throw Error('Unavailable');
      output.textContent=`Эрээн хүртэл: ¥${q.fee_cny.toLocaleString('en-US',{maximumFractionDigits:2})} · ${money(q.fee_mnt)}\nБарааны хүргэлтийн лавлах үнэ · ${new Date(q.checked_at).toLocaleString('sv-SE',{timeZone:'Asia/Ulaanbaatar'})}\nЭнэ нь Эрээн → Улаанбаатар каргоны төлбөрийг агуулаагүй.`;
      button.textContent='Хүргэлтийн лавлах үнэ шалгасан';
    }catch(error){if(button.isConnected){output.textContent='Хүргэлтийн лавлах үнэ одоогоор авах боломжгүй. Захиалга батлах үед бодит дүнг дахин шалгана.';button.textContent='Дахин шалгах';button.disabled=false;}}
    finally{clearTimeout(timer);}
  });
  root.addEventListener('input',e=>{if(e.target.closest('#pd-options'))update();});
  root.addEventListener('change',e=>{if(e.target.closest('#pd-options')){update();if(supplier&&e.target.name==='variant'){const image=selection()?.variant?.image,index=images.indexOf(image);if(index>=0)gallery(index);}}});
  root.addEventListener('submit',e=>{if(e.target.id!=='pd-options')return;e.preventDefault();const value=selection();if(!value?.valid)return; if(supplier){if(details.stale||!product.sellable)return;taobaoCart.buyNow(product,value.variant,value.qty);}else addToCart(id,value.variant,value.qty);});
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
