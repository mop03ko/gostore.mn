'use strict';
window.customerAccount={user:window.storeServer.customer||null};
customerAccount.setUser=user=>{
  customerAccount.user=user;
  document.documentElement.classList.toggle('customer-signed-in',!!user);
  window.syncMobileNav?.();
  if(!user&&document.querySelector('#modal').open&&document.querySelector('#modal #cargo-search,#modal .cargo-detail,#modal .cargo-notice,#supplier-order-form,#server-cart-form,#modal .account-summary'))accountForm();
  document.querySelectorAll('[data-account-label]').forEach(el=>el.textContent=user?'Профайл':'Нэвтрэх');
};
customerAccount.require=()=>{if(customerAccount.user)return true;customerAccount.open();return false;};
function notifyAccountChange(){try{localStorage.setItem('gostore-account-changed-v1',String(Date.now())+Math.random());}catch{}}
window.addEventListener('storage',e=>{if(e.key==='gostore-account-changed-v1')customerAccount.refresh().catch(()=>{});});
customerAccount.refresh=async()=>{const result=await shopApi('customer-me');customerAccount.setUser(result.customer);return result.customer;};
const accountField=(label,name,value='',extra='')=>`<label class="field">${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;
const passwordField=(label,name,autocomplete)=>accountField(label,name,'',`type="password" autocomplete="${autocomplete}" minlength="${name==='current_password'?1:10}" maxlength="72" required`);
function accountForm(mode='login'){
  const register=mode==='register';
  openModal(register?'GOStore-д бүртгүүлэх':'Тавтай морил',`<p class="modal-intro">Захиалгаа нэг дороос хянаж, хүргэлтийн мэдээллээ хадгалаарай.</p><div class="account-tabs"><button class="button ${register?'outline':'blue'}" data-account-mode="login" aria-pressed="${!register}">Нэвтрэх</button><button class="button ${register?'blue':'outline'}" data-account-mode="register" aria-pressed="${register}">Бүртгүүлэх</button></div><form id="customer-${mode}-form" class="account-form">${register?accountField('Таны нэр','name','','autocomplete="name" maxlength="100" required'):''}${accountField('Имэйл хаяг','email','','type="email" autocomplete="username" maxlength="200" required')}${register?accountField('Утасны дугаар (заавал биш)','phone','','type="tel" autocomplete="tel" maxlength="25"'):''}${passwordField('Нууц үг','password',register?'new-password':'current-password')}${register?passwordField('Нууц үг давтах','password_confirm','new-password'):''}<p class="account-hint">${register?'10-аас доошгүй тэмдэгттэй нууц үг сонгоорой.':'Нэвтрэхэд тусламж хэрэгтэй бол <a href="mailto:shop@gostore.mn">shop@gostore.mn</a>-д хандана уу.'}</p><p class="form-error" data-account-error role="alert"></p><button class="button blue" type="submit">${register?'Бүртгэл үүсгэх':'Нэвтрэх'}</button></form>`);
}
function profileForm(mode='profile'){
  const user=customerAccount.user;if(!user)return accountForm();
  openModal('Миний бүртгэл',`<div class="account-summary"><span class="account-avatar" aria-hidden="true">${esc(Array.from(user.name)[0]||'G')}</span><div><h3>${esc(user.name)}</h3><p>${esc(user.email)}</p></div></div><div class="form-actions account-shortcuts"><button class="button blue" data-action="browse">Бараа захиалах</button><button class="button outline" data-action="orders">Миний ачаа</button></div><div class="account-tabs"><button class="button ${mode==='profile'?'blue':'outline'}" data-account-mode="profile">Профайл</button><button class="button ${mode==='password'?'blue':'outline'}" data-account-mode="password">Нууц үг</button></div>${mode==='password'?`<form id="customer-password-form" class="account-form">${passwordField('Одоогийн нууц үг','current_password','current-password')}${passwordField('Шинэ нууц үг','password','new-password')}${passwordField('Шинэ нууц үг давтах','password_confirm','new-password')}<p class="account-hint">Нууц үг солиход бусад төхөөрөмжөөс дахин нэвтрэх шаардлагатай болно.</p><p class="form-error" data-account-error role="alert"></p><button class="button blue" type="submit">Нууц үг солих</button></form>`:`<form id="customer-profile-form" class="account-form"><div class="form-grid">${accountField('Таны нэр','name',user.name,'autocomplete="name" maxlength="100" required')}${accountField('Утасны дугаар','phone',user.phone,'type="tel" autocomplete="tel" maxlength="25"')}<label class="field full">Хүргэлтийн хаяг<textarea name="address" autocomplete="street-address" maxlength="500" placeholder="Хот, дүүрэг, хороо, байр, тоот">${esc(user.address)}</textarea></label></div><p class="form-error" data-account-error role="alert"></p><button class="button blue" type="submit">Мэдээлэл хадгалах</button></form>`}<div class="account-footer"><button class="text-button" data-customer-logout>Бүртгэлээс гарах</button></div>`);
}
customerAccount.open=async(mode)=>{
  try{await customerAccount.refresh();customerAccount.user?profileForm(mode):accountForm(mode==='register'?'register':'login');}
  catch(e){toast(e.message);}
};
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.accountMode){customerAccount.user?profileForm(button.dataset.accountMode):accountForm(button.dataset.accountMode);return;}
  if(button.hasAttribute('data-customer-logout')){
    button.disabled=true;try{await shopApi('customer-logout',{});customerAccount.setUser(null);notifyAccountChange();accountForm();toast('Бүртгэлээс гарлаа');}catch(error){toast(error.message);}finally{button.disabled=false;}
  }
});
document.addEventListener('submit',async e=>{
  const form=e.target;if(!/^customer-(login|register|profile|password)-form$/.test(form.id))return;
  e.preventDefault();const button=form.querySelector('[type="submit"]'),error=form.querySelector('[data-account-error]');button.disabled=true;error.textContent='';
  const action=form.id.replace(/-form$/,'');
  try{
    const payload=Object.fromEntries(new FormData(form));
    if(payload.password_confirm!==undefined&&payload.password!==payload.password_confirm)throw Error('Нууц үгийн давталт таарахгүй байна.');
    const result=await shopApi(action,payload);if(result.customer){customerAccount.setUser(result.customer);if(['customer-login','customer-register'].includes(action))notifyAccountChange();}
    if(action==='customer-password'){form.reset();toast('Нууц үг шинэчлэгдлээ');}
    else{if(['customer-login','customer-register'].includes(action)&&document.documentElement.classList.contains('product-view'))closeModal();else profileForm();toast(action==='customer-profile'?'Мэдээлэл хадгалагдлаа':action==='customer-register'?'Таны бүртгэл үүслээ':'Амжилттай нэвтэрлээ');}
  }catch(err){error.textContent=err.message;}finally{button.disabled=false;}
});
customerAccount.setUser(customerAccount.user);
