const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE,data=process.env.GOSTORE_DATA_DIR;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(data);
const {seedPinCustomer,pinLogin,phone}=require('./pin-login-helper.cjs');
// Web sign-in matches the app: phone + PIN, SMS-verified registration that then sets a PIN, e-mail login
// kept for older accounts. Sign-in, registration and PIN reset are pages (/login, /register, /login/reset)
// drawn over the current page, which returns after sign-in; the profile lives on /account/profile.
// Shoppers stay signed in for 30 days (web) and 90 days (app) after their last visit.
// Windows locks a session file while PHP serves a request on it; retry briefly.
const retry=fn=>{for(let i=0;;i++){try{return fn();}catch(e){if(e.code!=='EBUSY'||i>50)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);}}};
const age=(dir,id,seconds)=>{const file=path.join(data,dir,'sess_'+id);let s=retry(()=>fs.readFileSync(file,'utf8'));assert.match(s,/last\|i:\d+;/);s=s.replace(/last\|i:\d+;/,'last|i:'+(Math.floor(Date.now()/1000)-seconds)+';');retry(()=>fs.writeFileSync(file,s));};
(async()=>{seedPinCustomer();const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.customerAccount&&typeof shopApi==='function');
 const heading=()=>page.locator('#auth-view h1').innerText();
 const homeVisible=()=>page.locator('#home-hub').isVisible();
 await page.goto(base+'/');await ready();
 // The account button opens /login as a page over the home page; Back returns to it.
 await page.evaluate(()=>customerAccount.open());const form=page.locator('#customer-pin-login-form');await form.waitFor();
 assert.equal(new URL(page.url()).pathname,'/login');assert.equal(await heading(),'Нэвтрэх');assert.equal(await page.locator('#modal').evaluate(d=>d.open),false,'Not a popup');
 assert.equal(await homeVisible(),false,'The page replaces the home content');assert.match(await page.title(),/^Нэвтрэх · gostore\.mn$/);
 await page.goBack();await page.waitForFunction(()=>!document.documentElement.classList.contains('auth-view-open'));assert.equal(new URL(page.url()).pathname,'/');assert.equal(await homeVisible(),true);
 // The header search acts on the store, leaving the sign-in page.
 await page.evaluate(()=>customerAccount.open());await form.waitFor();await page.locator('#search').fill('цүнх');await page.locator('#search-form [type=submit]').click();
 await page.waitForFunction(()=>!document.documentElement.classList.contains('auth-view-open'));assert.equal(new URL(page.url()).pathname,'/');assert.equal(await page.locator('#catalog').isVisible(),true);
 await page.evaluate(()=>customerAccount.open());await form.waitFor();
 assert.equal(await page.locator('#customer-register-form').count(),0,'No e-mail registration form');
 assert.equal(await page.locator('[data-account-mode=email]').count(),1,'Older e-mail accounts can still sign in');
 await form.locator('[name=phone]').fill(phone);await form.locator('[name=pin]').fill('9999');await form.locator('[type=submit]').click();
 await form.locator('[data-account-error]').getByText('PIN буруу').waitFor();
 // Signing in returns to the page it was opened from.
 await pinLogin(page);await page.waitForFunction(()=>customerAccount.user?.pin_enabled===true&&!document.documentElement.classList.contains('auth-view-open'));
 await page.waitForFunction(()=>location.pathname==='/');assert.equal(new URL(page.url()).searchParams.get('q'),'цүнх','Back on the search it was opened from');assert.equal(await page.locator('#catalog').isVisible(),true);
 // Opening /login while signed in goes to the account page.
 await page.goto(base+'/login');await page.waitForURL(base+'/account');await ready();
 // Persistent cookie and server session: still signed in after two idle hours, not after 31 days.
 const cookie=(await context.cookies()).find(c=>c.name==='gostore_customer');assert.ok(cookie&&cookie.expires*1000>Date.now()+29*86400e3,'Customer cookie lasts 30 days');
 await page.waitForLoadState('networkidle');age('customer-sessions',cookie.value,7200);await page.reload();await ready();
 assert.equal(await page.evaluate(async()=>(await shopApi('customer-me')).customer?.login_phone),phone,'Still signed in after two idle hours');
 // Profile is the «Миний бүртгэл» page: the login phone and a PIN form, no password form; a mismatched repeat never reaches the server.
 await page.evaluate(()=>customerAccount.open('profile'));const pinForm=page.locator('#account-pin-form');await pinForm.waitFor();assert.equal(new URL(page.url()).pathname,'/account/profile');
 assert.equal(await page.locator('#account-password-form').count(),0);assert.equal(await page.locator('#account-profile-form input[disabled]').inputValue(),phone);
 let pinChanges=0;await page.route('**/api/index.php?action=customer-pin-change',r=>{pinChanges++;return r.continue();});
 await pinForm.locator('[name=current_pin]').fill('0123');await pinForm.locator('[name=pin]').fill('1111');await pinForm.locator('[name=pin_confirm]').fill('2222');await pinForm.locator('[type=submit]').click();
 await pinForm.locator('[data-account-error]').getByText('PIN давталт таарахгүй').waitFor();assert.equal(pinChanges,0);await page.unroute('**/api/index.php?action=customer-pin-change');
 await page.waitForLoadState('networkidle');age('customer-sessions',cookie.value,31*86400);assert.equal(await page.evaluate(async()=>(await shopApi('customer-me')).customer),null,'Signed out after 31 idle days');
 // Direct links and reloads show the page itself: PIN reset, e-mail sign-in, registration.
 for(const [url,title,selector] of [['/login/reset','PIN сэргээх','#customer-pin-setup-form[data-purpose=reset]'],['/login/email','Имэйлээр нэвтрэх','#customer-login-form'],['/register','GOStore-д бүртгүүлэх','#customer-pin-setup-form[data-purpose=register]']]){
  await page.goto(base+url);await page.locator(selector).waitFor();assert.equal(await heading(),title);assert.equal(new URL(page.url()).pathname,url);assert.equal(await homeVisible(),false);
 }
 await page.reload();await page.locator('#customer-pin-setup-form[data-purpose=register]').waitFor();
 await page.locator('#auth-view [data-account-mode=login]').click();await form.waitFor();assert.equal(new URL(page.url()).pathname,'/login','Tabs switch the page');
 // Registration from the home page: SMS verification first (verify.mn stubbed in the page), then the PIN step, then back home.
 await page.goto(base+'/');await ready();
 let setup=null;await page.route('**/api/index.php?action=customer-pin-setup',async r=>{setup=JSON.parse(r.request().postData());await r.fulfill({json:{customer:{id:'new',name:'Шинэ хэрэглэгч',email:'',login_phone:'99001122',phone:'99001122',address:'',pin_enabled:true,email_login:false},csrf:'c'.repeat(64)}});});
 await page.evaluate(()=>{window.verifyPhone=async(p,purpose)=>(window.verifiedFor=[p,purpose],{challenge:'a'.repeat(48),phone:'99001122'});customerAccount.open('register');});
 const reg=page.locator('#customer-pin-setup-form[data-purpose=register]');await reg.waitFor();assert.equal(new URL(page.url()).pathname,'/register');assert.equal(await reg.locator('[data-pin-step]').isVisible(),false);
 await reg.locator('[name=name]').fill('Шинэ хэрэглэгч');await reg.locator('[name=phone]').fill('99001122');await reg.locator('[type=submit]').click();
 await reg.locator('[data-pin-step]').waitFor();assert.deepEqual(await page.evaluate(()=>window.verifiedFor),['99001122','register']);assert.equal(await reg.locator('[name=phone]').getAttribute('readonly'),'');
 await reg.locator('[name=pin]').fill('4321');await reg.locator('[name=pin_confirm]').fill('4321');await reg.locator('[type=submit]').click();
 await page.waitForFunction(()=>customerAccount.user?.id==='new'&&!document.documentElement.classList.contains('auth-view-open'));await page.waitForURL(base+'/');
 assert.deepEqual({phone:setup.phone,purpose:setup.purpose,challenge:setup.challenge,name:setup.name,pin:setup.pin,pin_confirm:setup.pin_confirm},{phone:'99001122',purpose:'register',challenge:'a'.repeat(48),name:'Шинэ хэрэглэгч',pin:'4321',pin_confirm:'4321'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 // App: the bearer session survives two idle hours and ends after 91 idle days.
 let token='',csrf='';const mobile=async(action,body)=>{const r=await fetch(base+'/api/mobile.php?action='+action,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'X-GOStore-Mobile-Token':token}:{}),...(body?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();token=r.headers.get('X-GOStore-Mobile-Token')||token;csrf=d.csrf||csrf;return d;};
 await mobile('customer-me');assert.ok((await mobile('customer-pin-login',{phone,pin:'0123'})).customer);
 age('mobile-sessions',token,7200);assert.equal((await mobile('customer-me')).customer?.login_phone,phone,'App stays signed in after two idle hours');
 age('mobile-sessions',token,91*86400);assert.equal((await mobile('customer-me')).customer,null,'App session ends after 91 idle days');
 console.log('PASS web sign-in pages: /login over the current page with Back, phone + PIN, return after sign-in, direct /login /register /login/reset /login/email, profile on /account/profile, SMS-then-PIN registration, 30-day web and 90-day app sessions.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
