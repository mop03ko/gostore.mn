'use strict';
// Taobao cart and instant checkout. The browser keeps only a selection; the server re-prices every item.
window.taobaoCart=(()=>{
  const KEY='gostore-taobao-cart-v1',MAX=30;
  const valid=i=>i&&/^(?:tb|abb)-[0-9]{5,20}$/.test(i.id)&&typeof i.sku==='string'&&i.sku.length>0&&i.sku.length<=150&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=9999&&Number.isInteger(i.min_qty)&&i.min_qty>0&&Number.isInteger(i.step)&&i.step>0;
  const read=()=>{try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(saved)?saved.filter(valid).slice(0,MAX):[];}catch{return [];}};
  const write=items=>{try{localStorage.setItem(KEY,JSON.stringify(items));}catch{toast('Хөтөч сагс хадгалах боломжгүй байна.');return false;}updateCounts();window.dispatchEvent(new Event('gostore-cart-changed'));return true;};
  const rate=()=>Number(window.storeServer?.shipping?.cny_rate)||0;
  const lineMnt=i=>rate()&&Number(i.cny)>0?Math.ceil(i.cny*rate())*i.qty:null;
  let quote=null,checkoutToken='',selected=null;
  const item=(p,variant,qty)=>({id:p.id,sku:variant.id,qty,name:p.name,image:p.image,variant:variant.label,cny:variant.cny,min_qty:p.min_qty,step:p.step,stock:variant.stock??null});
  function add(p,variant,qty){
    const items=read(),existing=items.find(i=>i.id===p.id&&i.sku===variant.id),next=(existing?.qty||0)+qty;
    if(next>9999||(Number.isInteger(variant.stock)&&next>variant.stock)){toast('Үлдэгдлээс их тоо сонгох боломжгүй.');return false;}
    if(existing)existing.qty=next;
    else{if(items.length>=MAX){toast('Сагсанд '+MAX+' хүртэл бараа нэмнэ.');return false;}items.push(item(p,variant,qty));}
    if(write(items))flyout(existing||items[items.length-1]);return true;
  }
  // Non-blocking confirmation (like a mini cart) so the customer can keep choosing options.
  let flyTimer;
  function flyout(i){
    let el=document.querySelector('#cart-flyout');
    if(!el){el=document.createElement('div');el.id='cart-flyout';el.className='cart-flyout';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el);}
    const mnt=lineMnt(i);
    el.innerHTML=`<div class="cart-flyout-head"><strong>${icon('check')} Сагсанд нэмэгдлээ</strong><button type="button" class="icon-button" data-flyout-close aria-label="Хаах">${icon('close')}</button></div><div class="cart-flyout-item">${/^https:\/\//i.test(i.image||'')?`<img src="${esc(i.image)}" alt="" referrerpolicy="no-referrer">`:''}<div><p>${esc(i.name)}</p><small>${esc(i.variant)} · ${i.qty} ширхэг${mnt?' · '+money(mnt):''}</small></div></div><div class="cart-flyout-actions"><a class="button outline" href="/cart">Сагс харах (${read().length})</a><button type="button" class="button blue" data-flyout-checkout>Төлбөр тооцох</button></div>`;
    el.classList.add('visible');clearTimeout(flyTimer);flyTimer=setTimeout(()=>el.classList.remove('visible'),7000);
  }
  const hideFlyout=()=>document.querySelector('#cart-flyout')?.classList.remove('visible');
  function row(i,index){
    const mnt=lineMnt(i);
    return `<div class="cart-row">${/^https:\/\//i.test(i.image||'')?`<img src="${esc(i.image)}" alt="" referrerpolicy="no-referrer">`:'<span></span>'}<div><h3><a href="/v/${esc(i.id.replace(/^abb-/,''))}">${esc(i.name)}</a></h3><small>${esc(i.variant)} · ${i.id.startsWith('abb-')?'1688':'Taobao'}</small><div class="quantity-controls"><button data-tb-qty="${index}" data-delta="-1" aria-label="${esc(i.name)} тоог бууруулах" ${i.qty-i.step<i.min_qty?'disabled':''}>−</button><span>${i.qty}</span><button data-tb-qty="${index}" data-delta="1" aria-label="${esc(i.name)} тоог нэмэх" ${i.qty+i.step>Math.min(9999,i.stock??9999)?'disabled':''}>+</button></div></div><div><strong>${mnt===null?'Үнэ тооцоолно':money(mnt)}</strong><button class="remove-item" data-tb-remove="${index}">Хасах</button></div></div>`;
  }
  function show(){
    const items=read();
    if(!items.length){openModal('Миний сагс',`<div class="empty-state">${icon('bag')}<h3>Сагс тань хоосон байна</h3><p>Taobao каталогоос бараагаа сонгоод сагсандаа нэмээрэй.</p><button class="button blue" data-action="browse">Бараа үзэх</button></div>`);return;}
    const known=items.map(lineMnt),subtotal=known.every(v=>v!==null)?known.reduce((s,v)=>s+v,0):null;
    openModal('Миний сагс',items.map(row).join('')+`<div class="cart-totals"><div><span>Барааны дүн</span><strong>${subtotal===null?'Тооцоолно':money(subtotal)}</strong></div><div><span>Хятад доторх хүргэлт, үйлчилгээ</span><span>Дараагийн алхамд</span></div><div><span>Олон улсын карго</span><span>УБ-д ирэхэд жингээр</span></div><div><span>Хүлээн авах</span><span>УБ каргоны хаягаас</span></div></div><div class="cart-footer"><a class="button outline" href="/cart">Сагс харах</a><button class="button blue" data-tb-checkout>Төлбөр тооцох ${icon('arrow')}</button></div>`);
  }
  function breakdown(q){const b=q.breakdown;return `<div class="cart-totals checkout-totals"><div><span>Барааны үнэ</span><strong>${money(b.goods_mnt)}</strong></div><div><span>Хятад доторх хүргэлт · ${q.vendors} дэлгүүр</span>${q.domestic_later?'<span>УБ-д ирэхэд бодит дүнгээр</span>':`<strong>${money(b.domestic_mnt)}</strong>`}</div><div><span>Үйлчилгээний хураамж</span><strong>${money(b.service_mnt)}</strong></div><div><span>Олон улсын карго</span><span>УБ-д ирэхэд бодит жингээр</span></div><div class="total"><span>Одоо төлөх</span><strong>${money(q.total)}</strong></div></div>`;}
  // «Худалдан авах» orders only the shown item; the cart button orders the saved cart.
  const ordering=()=>selected||read();
  const payload=()=>ordering().map(i=>({id:i.id,sku:i.sku,qty:i.qty}));
  async function checkout(message='',only){
    if(only!==undefined){selected=only;checkoutToken='';}
    if(!customerAccount.require())return;
    if(!ordering().length)return show();
    try{
      await window.catalogReady;if(!storeServer.ready)throw Error('Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.');
      quote=(await shopApi('checkout-quote',{items:payload()})).quote;
    }catch(e){if(selected){openModal('Захиалга',`<p class="form-error" role="alert">${esc(e.message)}</p>`);return;}show();const footer=$('.cart-footer');if(footer)footer.insertAdjacentHTML('beforebegin',`<p class="form-error" role="alert">${esc(e.message)}</p>`);return;}
    checkoutToken||=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    openModal('Захиалга баталгаажуулах',`<p class="checkout-step">Сагс ✓ <span>→ Мэдээлэл ба төлбөр → QPay</span></p><form id="taobao-checkout-form"><div class="form-grid">${requestFields(true)}<fieldset class="field full fulfillment-choice"><legend>Хүлээн авах хэлбэр</legend><label><input type="radio" name="fulfillment" value="pickup" checked> Улаанбаатар агуулахаас авах</label><label><input type="radio" name="fulfillment" value="delivery"> Хүргэлтээр авах · төлбөрийг эцсийн тооцоонд нэмнэ</label></fieldset><label class="field full" data-delivery-address hidden>Хүргэлтийн хаяг<textarea name="address" maxlength="500" autocomplete="street-address" placeholder="Дүүрэг, хороо, байр, орц, тоот">${esc(customerAccount.user?.address||'')}</textarea></label><label class="field full">Нэмэлт хүсэлт<textarea name="notes" maxlength="1000"></textarea></label></div>${breakdown(quote)}<div data-pickup-info>${pickupHtml()}</div><div class="info-box">Захиалсны дараа QPay нэхэмжлэл гарна. ${quote.payment_window_hours} цагийн дотор төлөөгүй захиалга автоматаар цуцлагдана. ${quote.domestic_later?'Хятад доторх хүргэлт болон олон улсын каргог':'Олон улсын каргог'} Улаанбаатарт ирэхэд бодит дүнгээр тооцож тусад нь төлнө.</div><p id="request-error" class="form-error" role="alert">${esc(message)}</p><div class="form-actions">${selected?'':'<button type="button" class="button outline" data-action="cart">Сагс руу буцах</button>'}<button class="button blue" type="submit">Захиалах · ${money(quote.total)}</button></div></form>`);
  }
  document.addEventListener('submit',async e=>{
    const f=e.target;if(f.id!=='taobao-checkout-form')return;e.preventDefault();
    const button=f.querySelector('[type="submit"]');button.disabled=true;
    try{
      if(!customerAccount.require())return;
      const ordered=ordering(),fields=Object.fromEntries(new FormData(f));if(fields.fulfillment!=='delivery')delete fields.address;const b={...fields,type:'checkout',title:'Taobao сагс',items:ordered.map(i=>({id:i.id,sku:i.sku,qty:i.qty})),expected_total:quote.total,token:checkoutToken,require_account:true};
      const r=await shopApi('order-create',b);
      checkoutToken='';write(read().filter(i=>!ordered.some(o=>o.id===i.id&&o.sku===i.sku)));
      selected=null;toast('Захиалга үүслээ · '+r.order.id);
      if(qpayEnabled)await viewServerOrder(r.order.id,true);else await storeServer.orders();
    }catch(err){
      // Prices or stock may have changed: show the refreshed total before the customer retries.
      if(/Үнэ шинэчлэгдсэн/.test(err.message)){checkoutToken='';await checkout(err.message);return;}
      const error=f.querySelector('#request-error');if(error)error.textContent=err.message;
    }finally{button.disabled=false;}
  });
  document.addEventListener('change',e=>{
    if(e.target.name!=='fulfillment'||!e.target.closest('#taobao-checkout-form'))return;
    const f=e.target.form,delivery=f.elements.fulfillment.value==='delivery',address=f.querySelector('[data-delivery-address]');
    address.hidden=!delivery;f.elements.address.required=delivery;f.querySelector('[data-pickup-info]').hidden=delivery;
    // Saved addresses from the account page can be picked instead of typing again.
    if(delivery&&!f.dataset.addressesLoaded){f.dataset.addressesLoaded='1';shopApi('customer-addresses').then(({addresses})=>{if(!addresses.length||!f.isConnected)return;const pick=document.createElement('label');pick.className='field full';pick.innerHTML=`Хадгалсан хаяг<select data-address-pick>${addresses.map(a=>`<option value="${esc(a.id)}" ${a.is_default?'selected':''}>${esc(a.label)} · ${esc(a.address.slice(0,60))}</option>`).join('')}<option value="">Шинэ хаяг бичих</option></select>`;address.before(pick);pick.querySelector('select').addEventListener('change',e=>{const a=addresses.find(x=>x.id===e.target.value);f.elements.address.value=a?a.address:'';if(a&&a.phone&&f.elements.phone&&!f.elements.phone.value)f.elements.phone.value=a.phone;});const current=addresses.find(a=>a.is_default)||addresses[0];if(!f.elements.address.value.trim())f.elements.address.value=current.address;}).catch(()=>{});}
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-flyout-close')){hideFlyout();return;}
    if(b.hasAttribute('data-flyout-checkout')){hideFlyout();checkout('',null);return;}
    if(b.hasAttribute('data-tb-checkout')){hideFlyout();checkout('',null);return;}
    if(b.dataset.tbRemove!==undefined){const items=read();items.splice(Number(b.dataset.tbRemove),1);write(items);show();return;}
    if(b.dataset.tbQty!==undefined){const items=read(),i=items[Number(b.dataset.tbQty)];if(!i)return;const qty=i.qty+Number(b.dataset.delta)*i.step;if(qty<i.min_qty||qty>Math.min(9999,i.stock??9999))return;i.qty=qty;write(items);show();}
  });
  window.addEventListener('storage',e=>{if(e.key===KEY)updateCounts();});
  return {add,show,checkout,buyNow:(p,variant,qty)=>checkout('',[item(p,variant,qty)]),count:()=>read().length,items:read,save:write,unitMnt:i=>rate()&&Number(i.cny)>0?Math.ceil(i.cny*rate()):null,key:KEY};
})();
updateCounts();
