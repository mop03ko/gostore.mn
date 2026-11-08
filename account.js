'use strict';
window.customerAccount={user:window.storeServer.customer||null};
customerAccount.setUser=user=>{
  customerAccount.user=user;
  document.documentElement.classList.toggle('customer-signed-in',!!user);
  window.syncMobileNav?.();
  if(!user&&document.querySelector('#modal').open&&document.querySelector('#modal #cargo-search,#modal .cargo-detail,#modal .cargo-notice,#supplier-order-form,#server-cart-form,#taobao-checkout-form,#modal .account-summary'))accountForm();
  document.querySelectorAll('[data-account-label]').forEach(el=>el.textContent=user?(String(user.name||'').trim().split(/\s+/)[0].slice(0,14)||'Профайл'):'Нэвтрэх');
};
customerAccount.require=()=>{if(customerAccount.user)return true;customerAccount.open();return false;};
function notifyAccountChange(){try{localStorage.setItem('gostore-account-changed-v1',String(Date.now())+Math.random());}catch{}}
window.addEventListener('storage',e=>{if(e.key==='gostore-account-changed-v1')customerAccount.refresh().catch(()=>{});});
customerAccount.refresh=async()=>{const result=await shopApi('customer-me');customerAccount.setUser(result.customer);return result.customer;};
const accountField=(label,name,value='',extra='')=>`<label class="field">${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;
const passwordField=(label,name,autocomplete)=>accountField(label,name,'',`type="password" autocomplete="${autocomplete}" minlength="${name==='current_password'?1:10}" maxlength="72" required`);
// Sign-in works as in the app: phone + 4-digit PIN. New accounts and forgotten PINs verify the phone by
// SMS (verify.mn) and then set a PIN; older e-mail accounts can still sign in with e-mail and password.
const pinField=(label,name,autocomplete,required=true)=>accountField(label,name,'',`type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="${autocomplete}"${required?' required':''}`);
const phoneField=(value='')=>accountField('Утасны дугаар','phone',value,'type="tel" inputmode="tel" autocomplete="tel" maxlength="20" required');
const accountError='<p class="form-error" data-account-error role="alert"></p>';
// Registration (register), forgotten PIN (reset) and adding a phone to an e-mail account (link): the
// phone is verified by SMS first, then the PIN fields appear.
function pinSetupForm(purpose,phone=''){
  return `<form id="customer-pin-setup-form" class="account-form" data-purpose="${purpose}">${purpose==='register'?accountField('Таны нэр','name','','autocomplete="name" maxlength="100" required'):''}${phoneField(phone)}<div data-pin-step hidden>${pinField('4 оронтой PIN','pin','new-password',false)}${pinField('PIN давтах','pin_confirm','new-password',false)}</div><p class="account-hint" data-pin-hint>Утасны дугаарыг verify.mn-д дамжуулж баталгаажуулна. Та 144773 дугаарт SMS илгээнэ. Операторын SMS төлбөр үйлчилж болно.</p>${purpose==='register'?'<p class="account-hint">Өмнө нь имэйлээр бүртгүүлсэн бол тэр бүртгэлээрээ нэвтэрч, профайлаасаа утсаа холбоорой. Үргэлжлүүлснээр үйлчилгээний нөхцөл, нууцлалын бодлогыг зөвшөөрнө.</p>':''}${accountError}<button class="button blue" type="submit">SMS-ээр баталгаажуулах</button></form>`;
}
function accountForm(mode='login'){
  const register=mode==='register',links=(...items)=>`<div class="account-links">${items.map(([m,label])=>`<button type="button" class="text-button" data-account-mode="${m}">${label}</button>`).join('')}</div>`;
  const body=mode==='email'?`<form id="customer-login-form" class="account-form">${accountField('Имэйл хаяг','email','','type="email" autocomplete="username" maxlength="200" required')}${passwordField('Нууц үг','password','current-password')}<p class="account-hint">Өмнө нь имэйлээр бүртгүүлсэн бол. Нэвтэрсний дараа профайлаасаа утас, PIN холбоорой.</p>${accountError}<button class="button blue" type="submit">Нэвтрэх</button></form>${links(['login','Утас + PIN-ээр нэвтрэх'])}`
    :mode==='register'||mode==='reset'?pinSetupForm(mode)+(mode==='reset'?links(['login','Утас + PIN-ээр нэвтрэх']):'')
    :`<form id="customer-pin-login-form" class="account-form">${phoneField()}${pinField('4 оронтой PIN','pin','current-password')}<p class="account-hint">Нэвтэрсэн хэвээр үлдэнэ. Нийтийн компьютер дээр ажилласны дараа бүртгэлээс гарна уу.</p>${accountError}<button class="button blue" type="submit">PIN-ээр нэвтрэх</button></form>${links(['reset','PIN мартсан'],['email','Өмнөх имэйлээр нэвтрэх'])}`;
  openModal(register?'GOStore-д бүртгүүлэх':mode==='reset'?'PIN сэргээх':'Тавтай морил',`<p class="modal-intro">Захиалгаа нэг дороос хянаж, хүргэлтийн мэдээллээ хадгалаарай.</p><div class="account-tabs"><button class="button ${register?'outline':'blue'}" data-account-mode="login" aria-pressed="${!register}">Нэвтрэх</button><button class="button ${register?'blue':'outline'}" data-account-mode="register" aria-pressed="${register}">Бүртгүүлэх</button></div>${body}`);
}
let checkoutResume=null;
customerAccount.forCheckout=async resume=>{
  checkoutResume=resume;
  try{await customerAccount.refresh();}catch(e){checkoutResume=null;toast(e.message);return;}
  if(customerAccount.user){const next=checkoutResume;checkoutResume=null;await next?.();return;}
  accountForm();
  const intro=document.querySelector('#modal .modal-intro');
  if(intro)intro.textContent='Захиалгаа үргэлжлүүлэхийн тулд нэвтэрнэ үү. Таны сонголт хадгалагдана; нэвтэрсний дараа захиалгын мэдээлэл рүү буцна.';
};
document.querySelector('#modal').addEventListener('close',()=>{checkoutResume=null;});
function profileForm(mode='profile'){
  const user=customerAccount.user;if(!user)return accountForm();
  const tab=(m,label)=>`<button class="button ${mode===m?'blue':'outline'}" data-account-mode="${m}">${label}</button>`;
  const tabs=tab('profile','Профайл')+(user.email_login?tab('password','Нууц үг'):'')+(user.pin_enabled?tab('pin','PIN солих'):tab('link','Утас, PIN холбох'));
  const content=mode==='password'&&user.email_login?`<form id="customer-password-form" class="account-form">${passwordField('Одоогийн нууц үг','current_password','current-password')}${passwordField('Шинэ нууц үг','password','new-password')}${passwordField('Шинэ нууц үг давтах','password_confirm','new-password')}<p class="account-hint">Нууц үг солиход бусад төхөөрөмжөөс дахин нэвтрэх шаардлагатай болно.</p>${accountError}<button class="button blue" type="submit">Нууц үг солих</button></form>`
    :mode==='pin'&&user.pin_enabled?`<form id="customer-pin-change-form" class="account-form">${pinField('Одоогийн PIN','current_pin','current-password')}${pinField('Шинэ PIN','pin','new-password')}${pinField('Шинэ PIN давтах','pin_confirm','new-password')}<p class="account-hint">PIN солиход бусад төхөөрөмж дээрх нэвтрэлт хаагдана. PIN мартсан бол гараад «PIN мартсан»-аар SMS-ээр сэргээнэ.</p>${accountError}<button class="button blue" type="submit">PIN солих</button></form>`
    :mode==='link'&&!user.pin_enabled?pinSetupForm('link',user.phone||'')
    :`<form id="customer-profile-form" class="account-form"><div class="form-grid">${accountField('Таны нэр','name',user.name,'autocomplete="name" maxlength="100" required')}${accountField('Утасны дугаар','phone',user.phone,'type="tel" autocomplete="tel" maxlength="25"')}<label class="field full">Хүргэлтийн хаяг<textarea name="address" autocomplete="street-address" maxlength="500" placeholder="Хот, дүүрэг, хороо, байр, тоот">${esc(user.address)}</textarea></label></div>${accountError}<button class="button outline" type="button" data-verify-phone>Утас баталгаажуулах</button><button class="button blue" type="submit">Мэдээлэл хадгалах</button></form>`;
  openModal('Миний бүртгэл',`<div class="account-summary"><span class="account-avatar" aria-hidden="true">${esc(Array.from(user.name)[0]||'G')}</span><div><h3>${esc(user.name)}</h3><p>${esc(user.email||user.login_phone||user.phone||'')}</p></div></div><div class="form-actions account-shortcuts"><button class="button blue" data-action="browse">Бараа захиалах</button><button class="button outline" data-action="orders">Миний ачаа</button></div><div class="account-tabs">${tabs}</div>${content}<div class="account-footer"><button class="text-button" data-customer-logout>Бүртгэлээс гарах</button></div>`);
}
customerAccount.open=async(mode)=>{
  // Signed-in customers get the full account page; the modal keeps login and registration.
  try{await customerAccount.refresh();if(customerAccount.user&&!mode&&window.accountPage){closeModal();accountPage.go('orders');return;}customerAccount.user?profileForm(mode):accountForm(mode==='register'?'register':'login');}
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
  const form=e.target;if(!/^customer-(login|pin-login|pin-setup|pin-change|profile|password)-form$/.test(form.id))return;
  e.preventDefault();const button=form.querySelector('[type="submit"]'),error=form.querySelector('[data-account-error]');button.disabled=true;error.textContent='';
  const action=form.id.replace(/-form$/,''),signIn=['customer-login','customer-pin-login','customer-pin-setup'].includes(action);
  try{
    const payload=Object.fromEntries(new FormData(form));
    if(action==='customer-pin-setup'){
      if(!form.dataset.challenge){
        // Step 1: the shopper sends the verification SMS; the PIN fields appear once our server sees it.
        const verified=await window.verifyPhone(payload.phone,form.dataset.purpose);
        if(!verified||!verified.challenge)throw Error('Утас баталгаажсангүй. Дахин оролдоно уу.');
        form.dataset.challenge=verified.challenge;form.dataset.phone=verified.phone;form.elements.phone.readOnly=true;
        form.querySelector('[data-pin-step]').hidden=false;form.elements.pin.required=form.elements.pin_confirm.required=true;
        form.querySelector('[data-pin-hint]').textContent=verified.phone+' дугаар баталгаажлаа. Нэвтрэхдээ ашиглах 4 оронтой PIN-ээ оруулна уу.';
        button.textContent='PIN хадгалж нэвтрэх';form.elements.pin.focus();return;
      }
      Object.assign(payload,{phone:form.dataset.phone,purpose:form.dataset.purpose,challenge:form.dataset.challenge});
    }
    if(payload.pin_confirm!==undefined&&payload.pin!==payload.pin_confirm)throw Error('PIN давталт таарахгүй байна.');
    if(payload.password_confirm!==undefined&&payload.password!==payload.password_confirm)throw Error('Нууц үгийн давталт таарахгүй байна.');
    const result=await shopApi(action,payload);if(result.customer){customerAccount.setUser(result.customer);if(signIn||action==='customer-pin-change')notifyAccountChange();}
    if(signIn&&checkoutResume){const resume=checkoutResume;checkoutResume=null;await resume();toast('Захиалгаа үргэлжлүүлээрэй');return;}
    if(action==='customer-password'){form.reset();toast('Нууц үг шинэчлэгдлээ');}
    else if(action==='customer-pin-change'){profileForm();toast('PIN шинэчлэгдлээ');}
    else{const linked=action==='customer-pin-setup'&&form.dataset.purpose==='link';if(signIn&&!linked&&(document.documentElement.classList.contains('product-view')||window.accountPage?.active))closeModal();else profileForm();toast(action==='customer-profile'?'Мэдээлэл хадгалагдлаа':linked?'Утас, PIN холбогдлоо':form.dataset.purpose==='register'?'Таны бүртгэл үүслээ':'Амжилттай нэвтэрлээ');}
  }catch(err){error.textContent=err.message;}finally{button.disabled=false;}
});
customerAccount.setUser(customerAccount.user);
