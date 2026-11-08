'use strict';
window.customerAccount={user:window.storeServer.customer||null};
customerAccount.setUser=user=>{
  customerAccount.user=user;
  document.documentElement.classList.toggle('customer-signed-in',!!user);
  window.syncMobileNav?.();
  if(!user&&(document.querySelector('#modal').open&&document.querySelector('#modal #cargo-search,#modal .cargo-detail,#modal .cargo-notice,#supplier-order-form,#server-cart-form,#taobao-checkout-form')||authMode==='link'))accountForm();
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
// Sign-in, registration, PIN reset, e-mail sign-in and phone linking are pages (/login, /register,
// /login/reset, /login/email, /login/link) drawn in place over the current page, so the page underneath
// keeps its state and an interrupted checkout resumes after sign-in. Back returns to where it started.
const authPaths={login:'/login',register:'/register',reset:'/login/reset',email:'/login/email',link:'/login/link'};
const authModeFor=path=>Object.keys(authPaths).find(m=>authPaths[m]===path.replace(/(.)\/$/,'$1'))||null;
let authOpen=false,authMode=null,authPushed=false,authReturn=null,authTitle=document.title,checkoutResume=null;
function authView(mode,title,intro,html){
  if(document.querySelector('#modal').open){closeModal();document.querySelector('#modal-body')?.replaceChildren();}
  let root=document.querySelector('#auth-view');
  if(!root){root=document.createElement('section');root.id='auth-view';root.className='container auth-view';root.setAttribute('aria-labelledby','auth-view-title');document.querySelector('#main').prepend(root);}
  const path=authPaths[mode];
  if(!authOpen){
    authOpen=true;authTitle=document.title;
    if(location.pathname===path){}else if(authModeFor(location.pathname))history.replaceState({authView:mode},'',path);
    else{authReturn=location.pathname+location.search+location.hash;history.pushState({authView:mode},'',path);authPushed=true;}
  }else if(location.pathname!==path)history.replaceState({authView:mode},'',path);
  authMode=mode;document.documentElement.classList.add('auth-view-open');
  root.innerHTML=`<nav class="pd-breadcrumb" aria-label="Байршил"><a href="/">Нүүр</a><span>/</span><span>${esc(title)}</span></nav><div class="auth-card"><h1 id="auth-view-title" tabindex="-1">${esc(title)}</h1><p class="modal-intro">${esc(intro)}</p>${html}</div>`;
  document.title=title+' · gostore.mn';scrollTo(0,0);root.querySelector('h1').focus({preventScroll:true});window.syncMobileNav?.();
}
// Hides the page. back: also step back over the history entry the page added (when it added one).
function closeAuthView(back=true){
  if(!authOpen)return;
  authOpen=false;authMode=null;checkoutResume=null;document.documentElement.classList.remove('auth-view-open');
  document.querySelector('#auth-view')?.replaceChildren();document.title=authTitle;
  const pushed=authPushed;authPushed=false;if(back&&pushed)history.back();window.syncMobileNav?.();
}
// After signing in: back to the page it was opened from, or (opened directly) to ?next= or the account.
function finishAuthView(){
  if(authPushed){closeAuthView();return;}
  const next=authReturn;closeAuthView(false);location.assign(next||'/account');
}
function accountForm(mode='login',intro=''){
  const register=mode==='register',links=(...items)=>`<div class="account-links">${items.map(([m,label])=>`<button type="button" class="text-button" data-account-mode="${m}">${label}</button>`).join('')}</div>`;
  const body=mode==='email'?`<form id="customer-login-form" class="account-form">${accountField('Имэйл хаяг','email','','type="email" autocomplete="username" maxlength="200" required')}${passwordField('Нууц үг','password','current-password')}<p class="account-hint">Өмнө нь имэйлээр бүртгүүлсэн бол. Нэвтэрсний дараа профайлаасаа утас, PIN холбоорой.</p>${accountError}<button class="button blue" type="submit">Нэвтрэх</button></form>${links(['login','Утас + PIN-ээр нэвтрэх'])}`
    :mode==='register'||mode==='reset'?pinSetupForm(mode)+(mode==='reset'?links(['login','Утас + PIN-ээр нэвтрэх']):'')
    :`<form id="customer-pin-login-form" class="account-form">${phoneField()}${pinField('4 оронтой PIN','pin','current-password')}<p class="account-hint">Нэвтэрсэн хэвээр үлдэнэ. Нийтийн компьютер дээр ажилласны дараа бүртгэлээс гарна уу.</p>${accountError}<button class="button blue" type="submit">PIN-ээр нэвтрэх</button></form>${links(['reset','PIN мартсан'],['email','Өмнөх имэйлээр нэвтрэх'])}`;
  const tabs=mode==='reset'||mode==='email'?'':`<div class="account-tabs"><button class="button ${register?'outline':'blue'}" data-account-mode="login" aria-pressed="${!register}">Нэвтрэх</button><button class="button ${register?'blue':'outline'}" data-account-mode="register" aria-pressed="${register}">Бүртгүүлэх</button></div>`;
  const view=['register','reset','email'].includes(mode)?mode:'login';
  authView(view,register?'GOStore-д бүртгүүлэх':mode==='reset'?'PIN сэргээх':mode==='email'?'Имэйлээр нэвтрэх':'Нэвтрэх',intro||'Захиалгаа нэг дороос хянаж, хүргэлтийн мэдээллээ хадгалаарай.',tabs+body);
}
customerAccount.forCheckout=async resume=>{
  checkoutResume=resume;
  try{await customerAccount.refresh();}catch(e){checkoutResume=null;toast(e.message);return;}
  if(customerAccount.user){const next=checkoutResume;checkoutResume=null;await next?.();return;}
  const pending=checkoutResume;accountForm('login','Захиалгаа үргэлжлүүлэхийн тулд нэвтэрнэ үү. Таны сонголт хадгалагдана; нэвтэрсний дараа захиалгын мэдээлэл рүү буцна.');checkoutResume=pending;
};
// Signed-in customers manage their details on the account page (/account/profile); only adding a phone
// and PIN to an older e-mail account is its own page, because it needs SMS verification first.
function profileForm(mode='profile'){
  const user=customerAccount.user;if(!user)return accountForm();
  if(mode==='link'&&!user.pin_enabled){authView('link','Утас, PIN холбох','Утсаа SMS-ээр баталгаажуулаад 4 оронтой PIN үүсгэвэл апп, вэбд утас + PIN-ээр нэвтэрнэ.',pinSetupForm('link',user.phone||''));return;}
  closeAuthView(false);window.accountPage?accountPage.go('profile'):location.assign('/account/profile');
}
customerAccount.open=async(mode)=>{
  try{await customerAccount.refresh();}catch(e){toast(e.message);return;}
  if(!customerAccount.user){accountForm(mode==='register'?'register':'login');return;}
  if(mode==='link'){profileForm('link');return;}
  closeAuthView(false);window.accountPage?accountPage.go(['profile','pin','password'].includes(mode)?'profile':'orders'):location.assign('/account');
};
// The header search, tab bar and other controls act on the page underneath, so using them leaves the
// sign-in page first (the account button and the theme toggle keep it open).
function leaveAuthView(){
  if(!authOpen)return;
  const back=authReturn||'/';authPushed=false;closeAuthView(false);
  if(location.pathname+location.search+location.hash!==back)history.replaceState(null,'',back);
}
document.addEventListener('click',e=>{if(!authOpen)return;const c=e.target.closest('a,button');if(!c||c.closest('#auth-view,dialog,#toast')||c.matches('[data-action=account],[data-theme-toggle]'))return;leaveAuthView();},true);
document.addEventListener('submit',e=>{if(authOpen&&!e.target.closest('#auth-view,dialog'))leaveAuthView();},true);
window.addEventListener('popstate',()=>{
  const mode=authModeFor(location.pathname);
  if(!mode){if(authOpen){authPushed=false;closeAuthView(false);}return;}
  if(mode==='link'?customerAccount.user&&!customerAccount.user.pin_enabled:!customerAccount.user)mode==='link'?profileForm('link'):accountForm(mode);
});
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.accountMode){customerAccount.user?profileForm(button.dataset.accountMode):accountForm(button.dataset.accountMode);return;}
  if(button.hasAttribute('data-customer-logout')){
    button.disabled=true;try{await shopApi('customer-logout',{});customerAccount.setUser(null);notifyAccountChange();toast('Бүртгэлээс гарлаа');}catch(error){toast(error.message);}finally{button.disabled=false;}
  }
});
document.addEventListener('submit',async e=>{
  const form=e.target;if(!/^customer-(login|pin-login|pin-setup)-form$/.test(form.id))return;
  e.preventDefault();const button=form.querySelector('[type="submit"]'),error=form.querySelector('[data-account-error]');button.disabled=true;error.textContent='';
  const action=form.id.replace(/-form$/,''),linked=action==='customer-pin-setup'&&form.dataset.purpose==='link';
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
    const result=await shopApi(action,payload);if(result.customer){customerAccount.setUser(result.customer);notifyAccountChange();}
    if(linked){toast('Утас, PIN холбогдлоо');closeAuthView(false);location.replace('/account/profile');return;}
    if(checkoutResume){const resume=checkoutResume;checkoutResume=null;finishAuthView();await resume();toast('Захиалгаа үргэлжлүүлээрэй');return;}
    toast(form.dataset.purpose==='register'?'Таны бүртгэл үүслээ':form.dataset.purpose==='reset'?'PIN шинэчлэгдлээ':'Амжилттай нэвтэрлээ');finishAuthView();
  }catch(err){error.textContent=err.message;}finally{button.disabled=false;}
});
customerAccount.setUser(customerAccount.user);
// /login, /register… opened directly (typed, bookmarked or reloaded): show that page, or move on when
// the visitor is already signed in.
{
  const mode=authModeFor(location.pathname);
  if(mode){
    const next=new URLSearchParams(location.search).get('next')||'';
    authReturn=/^\/(?!\/)/.test(next)&&!authModeFor(next.split(/[?#]/)[0])?next:null;
    const show=user=>{
      if(mode!=='link'){if(user)location.replace(authReturn||'/account');else accountForm(mode);return;}
      if(!user)accountForm('login');else if(user.pin_enabled)location.replace('/account/profile');else profileForm('link');
    };
    let known=!!customerAccount.user;show(customerAccount.user);
    customerAccount.refresh().then(user=>{if(!!user!==known&&authOpen){known=!!user;show(user);}}).catch(()=>{});
  }
}
