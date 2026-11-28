'use strict';
// Taobao cart and instant checkout. The browser keeps only a selection; the server re-prices every item.
window.taobaoCart=(()=>{
  const KEY='gostore-taobao-cart-v1',MAX=30;
  const valid=i=>i&&!window.productPolicyBlocked(i)&&/^(?:tb|abb)-[0-9]{5,20}$/.test(i.id)&&typeof i.sku==='string'&&i.sku.length>0&&i.sku.length<=150&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=9999&&Number.isInteger(i.min_qty)&&i.min_qty>0&&Number.isInteger(i.step)&&i.step>0;
  const read=()=>{try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(saved)?saved.filter(valid).slice(0,MAX):[];}catch{return [];}};
  const write=items=>{try{localStorage.setItem(KEY,JSON.stringify(items));}catch{toast('Таны хөтөч сагсыг хадгалж чадсангүй.');return false;}updateCounts();window.dispatchEvent(new Event('gostore-cart-changed'));return true;};
  const rate=()=>Number(window.storeServer?.shipping?.cny_rate)||0;
  const lineMnt=i=>rate()&&Number(i.cny)>0?Math.ceil(Number((i.cny*rate()*i.qty).toFixed(8))):null;
  let quote=null,quoteItems=[],checkoutToken='',selected=null,pickupLocation='ulaanbaatar';
  const pickupLocations=()=>storeServer.shipping?.pickup_locations||[{...storeServer.shipping?.pickup,location:'ulaanbaatar',city:'Улаанбаатар'}];
  const pickupProfile=()=>pickupLocations().find(p=>p.location===pickupLocation);
  const item=(p,variant,qty)=>({id:p.id,sku:variant.id,qty,name:p.name,image:p.image,variant:variant.label,cny:variant.cny,min_qty:p.min_qty,step:p.step,stock:variant.stock??null,vendor_id:p.vendor_id??'',vendor_name:String(p.vendor_name??'').slice(0,200)});
  function add(p,variant,qty){
    if(window.productPolicyBlocked(p)||window.productPolicyBlocked(variant)){toast('Энэ бараа худалдаанд байхгүй байна.');return false;}
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
    el.innerHTML=`<div class="cart-flyout-head"><strong>${icon('check')} Сагсанд нэмэгдлээ</strong><button type="button" class="icon-button" data-flyout-close aria-label="Хаах">${icon('close')}</button></div><div class="cart-flyout-item">${/^https:\/\//i.test(i.image||'')?`<img src="${esc(i.image)}" alt="" referrerpolicy="no-referrer">`:''}<div><p>${esc(i.name)}</p><small>${esc(i.variant)} · ${i.qty}ш${mnt?' · '+money(mnt):''}</small></div></div><div class="cart-flyout-actions"><a class="button outline" href="/cart">Сагс харах (${read().length})</a><button type="button" class="button blue" data-flyout-checkout>Төлбөр тооцох</button></div>`;
    el.classList.add('visible');clearTimeout(flyTimer); // Keep the cart action available until dismissed or navigation.
  }
  const hideFlyout=()=>document.querySelector('#cart-flyout')?.classList.remove('visible');
  function breakdown(q){return `<div class="checkout-totals">${commerceUI.calculationHtml(q,quoteItems)}</div>`;}
  // «Худалдан авах» orders only the shown item; the cart button orders the saved cart.
  const ordering=()=>selected||read();
  const payload=()=>ordering().map(i=>({id:i.id,sku:i.sku,qty:i.qty}));
  async function checkout(message='',only){
    if(only!==undefined){selected=only;checkoutToken='';}
    if(!customerAccount.user){await customerAccount.forCheckout(()=>checkout());return;}
    if(!ordering().length)return showCart();
    document.querySelector('[data-cart-error]')?.remove();
    try{
      await window.catalogReady;await window.warehousePreference?.ready;if(window.warehousePreference)pickupLocation=window.warehousePreference.selected()?.location||'';if(!storeServer.ready)throw Error('Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.');
      const priced=await shopApi('checkout-quote',{items:payload()});quote=priced.quote;quoteItems=priced.items;
    }catch(e){
      const summary=document.querySelector('.store-cart-summary');
      if(!summary){openModal('Захиалга',`<p class="form-error" role="alert">${esc(e.message)}</p>`);return;}
      summary.querySelector('.store-cart-checkout').insertAdjacentHTML('afterend',`<p class="form-error" role="alert" data-cart-error>${esc(e.message)}</p>`);
      toast(e.message);return;
    }
    checkoutToken||=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    if(!pickupProfile())pickupLocation=window.warehousePreference?'':(pickupLocations()[0]?.location||'ulaanbaatar');
    openModal('Захиалга баталгаажуулах',`<p class="checkout-step">Сагс ✓ <span>→ Мэдээлэл ба төлбөр → QPay</span></p><form id="taobao-checkout-form"><div class="form-grid">${requestFields(true)}<fieldset class="field full fulfillment-choice"><legend>Хүлээн авах хэлбэр</legend><label><input type="radio" name="fulfillment" value="pickup" checked> Салбараас авах</label><label><input type="radio" name="fulfillment" value="delivery"> Улаанбаатарт хүргүүлэх · төлбөрийг эцсийн тооцоонд нэмнэ</label></fieldset><label class="field full" data-pickup-choice>Авах салбар<select name="pickup_location" required><option value="" disabled ${!pickupLocation?'selected':''}>Авах салбараа сонгоно уу</option>${pickupLocations().map(p=>`<option value="${esc(p.location)}" ${p.location===pickupLocation?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label class="field full" data-delivery-address hidden>Хүргэлтийн хаяг<textarea name="address" maxlength="500" autocomplete="street-address" placeholder="Дүүрэг, хороо, байр, орц, тоот">${esc(customerAccount.user?.address||'')}</textarea></label><label class="field full">Нэмэлт хүсэлт<textarea name="notes" maxlength="1000"></textarea></label></div>${breakdown(quote)}<div data-pickup-info>${(pickupProfile()?pickupHtml(pickupProfile()):'<p>Авах салбараа сонгоно уу.</p>')}</div><div class="info-box">Захиалсны дараа QPay нэхэмжлэл гарна. Нэхэмжлэл гарснаас хойш 15 минутын дотор төлөөгүй захиалга автоматаар цуцлагдана. ${quote.domestic_later?'Хятад доторх хүргэлт болон олон улсын каргоны төлбөрийг':'Олон улсын каргоны төлбөрийг'} сонгосон салбарт ирэхэд бодит дүнгээр тооцож тусад нь төлнө.</div><p id="request-error" class="form-error" role="alert">${esc(message)}</p><div class="form-actions">${selected?'':'<button type="button" class="button outline" data-action="cart">Сагс руу буцах</button>'}<button class="button blue" type="submit">Төлөх · ${money(quote.total)}</button></div></form>`);
  }
  document.addEventListener('submit',async e=>{
    const f=e.target;if(f.id!=='taobao-checkout-form')return;e.preventDefault();
    const button=f.querySelector('[type="submit"]');button.disabled=true;
    try{
      if(!customerAccount.require())return;
      const ordered=ordering(),fields=Object.fromEntries(new FormData(f));if(fields.fulfillment!=='delivery')delete fields.address;else fields.pickup_location='ulaanbaatar';const b={...fields,type:'checkout',title:'GOStore захиалга',items:ordered.map(i=>({id:i.id,sku:i.sku,qty:i.qty})),expected_total:quote.total,token:checkoutToken,require_account:true};
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
    if(!e.target.closest('#taobao-checkout-form'))return;
    if(e.target.name==='pickup_location'){pickupLocation=e.target.value;try{window.warehousePreference?.save(pickupLocation);}catch{toast('Сонголтыг дараагийн удаад хадгалж чадсангүй.');}e.target.form.querySelector('[data-pickup-info]').innerHTML=(pickupProfile()?pickupHtml(pickupProfile()):'<p>Авах салбараа сонгоно уу.</p>');return;}
    if(e.target.name!=='fulfillment')return;
    const f=e.target.form,delivery=f.elements.fulfillment.value==='delivery',address=f.querySelector('[data-delivery-address]');
    f.querySelector('[data-pickup-choice]').hidden=delivery;f.elements.pickup_location.disabled=delivery;
    f.querySelector('[data-address-pick]')?.closest('label').toggleAttribute('hidden',!delivery);
    address.hidden=!delivery;f.elements.address.required=delivery;f.querySelector('[data-pickup-info]').hidden=delivery;
    // Saved addresses from the account page can be picked instead of typing again.
    if(delivery&&!f.dataset.addressesLoaded){f.dataset.addressesLoaded='1';shopApi('customer-addresses').then(({addresses})=>{if(!addresses.length||!f.isConnected)return;const pick=document.createElement('label');pick.className='field full';pick.innerHTML=`Хадгалсан хаяг<select data-address-pick>${addresses.map(a=>`<option value="${esc(a.id)}" ${a.is_default?'selected':''}>${esc(a.label)} · ${esc(a.address.slice(0,60))}</option>`).join('')}<option value="">Шинэ хаяг бичих</option></select>`;pick.hidden=f.elements.fulfillment.value!=='delivery';address.before(pick);pick.querySelector('select').addEventListener('change',e=>{const a=addresses.find(x=>x.id===e.target.value);f.elements.address.value=a?a.address:'';if(a&&a.phone&&f.elements.phone&&!f.elements.phone.value)f.elements.phone.value=a.phone;});const current=addresses.find(a=>a.is_default)||addresses[0];if(!f.elements.address.value.trim())f.elements.address.value=current.address;}).catch(()=>{});}
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-flyout-close')){hideFlyout();return;}
    if(b.hasAttribute('data-flyout-checkout')){hideFlyout();checkout('',null);return;}
    if(b.hasAttribute('data-tb-checkout')){hideFlyout();checkout('',null);return;}
  });
  window.addEventListener('storage',e=>{if(e.key===KEY)updateCounts();});
  return {add,checkout,buyNow:(p,variant,qty)=>checkout('',[item(p,variant,qty)]),count:()=>read().length,items:read,save:write,unitMnt:i=>rate()&&Number(i.cny)>0?Math.ceil(i.cny*rate()):null,key:KEY};
})();
updateCounts();
