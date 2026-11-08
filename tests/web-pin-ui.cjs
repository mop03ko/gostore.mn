const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE,data=process.env.GOSTORE_DATA_DIR;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(data);
const {seedPinCustomer,pinLogin,phone}=require('./pin-login-helper.cjs');
// Web sign-in matches the app: phone + PIN, SMS-verified registration that then sets a PIN, PIN change
// for PIN accounts, e-mail login kept for older accounts; shoppers stay signed in for 30 days (web) and
// 90 days (app) after their last visit, while staff sessions keep the 30-minute limit.
const age=(dir,id,seconds)=>{const file=path.join(data,dir,'sess_'+id);let s=fs.readFileSync(file,'utf8');assert.match(s,/last\|i:\d+;/);s=s.replace(/last\|i:\d+;/,'last|i:'+(Math.floor(Date.now()/1000)-seconds)+';');fs.writeFileSync(file,s);};
(async()=>{seedPinCustomer();const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');await page.waitForFunction(()=>window.customerAccount&&typeof shopApi==='function');
 await page.evaluate(()=>customerAccount.open());const form=page.locator('#customer-pin-login-form');await form.waitFor();
 assert.equal(await page.locator('#customer-register-form').count(),0,'No e-mail registration form');
 assert.equal(await page.locator('[data-account-mode=email]').count(),1,'Older e-mail accounts can still sign in');
 await form.locator('[name=phone]').fill(phone);await form.locator('[name=pin]').fill('9999');await form.locator('[type=submit]').click();
 await form.locator('[data-account-error]').getByText('PIN буруу').waitFor();
 await pinLogin(page);await page.waitForFunction(()=>customerAccount.user?.pin_enabled===true);
 // Persistent cookie and server session: still signed in after two idle hours, not after 31 days.
 const cookie=(await context.cookies()).find(c=>c.name==='gostore_customer');assert.ok(cookie&&cookie.expires*1000>Date.now()+29*86400e3,'Customer cookie lasts 30 days');
 age('customer-sessions',cookie.value,7200);await page.reload();await page.waitForFunction(()=>window.customerAccount);
 assert.equal(await page.evaluate(async()=>(await shopApi('customer-me')).customer?.login_phone),phone,'Still signed in after two idle hours');
 // Profile: PIN accounts change their PIN (no password tab).
 await page.evaluate(()=>customerAccount.open('profile'));await page.locator('[data-account-mode=pin]').waitFor();
 assert.equal(await page.locator('[data-account-mode=password]').count(),0);await page.locator('[data-account-mode=pin]').click();await page.locator('#customer-pin-change-form').waitFor();
 // «Миний бүртгэл» page: the login phone and a PIN form, no password form; a mismatched repeat never reaches the server.
 await page.goto(base+'/account/profile');const pinForm=page.locator('#account-pin-form');await pinForm.waitFor();
 assert.equal(await page.locator('#account-password-form').count(),0);assert.equal(await page.locator('#account-profile-form input[disabled]').inputValue(),phone);
 let pinChanges=0;await page.route('**/api/index.php?action=customer-pin-change',r=>{pinChanges++;return r.continue();});
 await pinForm.locator('[name=current_pin]').fill('0123');await pinForm.locator('[name=pin]').fill('1111');await pinForm.locator('[name=pin_confirm]').fill('2222');await pinForm.locator('[type=submit]').click();
 await pinForm.locator('[data-account-error]').getByText('PIN давталт таарахгүй').waitFor();assert.equal(pinChanges,0);await page.unroute('**/api/index.php?action=customer-pin-change');
 age('customer-sessions',cookie.value,31*86400);assert.equal(await page.evaluate(async()=>(await shopApi('customer-me')).customer),null,'Signed out after 31 idle days');
 // Registration: SMS verification first (verify.mn stubbed in the page), then the PIN step, then setup.
 let setup=null;await page.route('**/api/index.php?action=customer-pin-setup',async r=>{setup=JSON.parse(r.request().postData());await r.fulfill({json:{customer:{id:'new',name:'Шинэ хэрэглэгч',email:'',login_phone:'99001122',phone:'99001122',address:'',pin_enabled:true,email_login:false},csrf:'c'.repeat(64)}});});
 await page.evaluate(()=>{window.verifyPhone=async(p,purpose)=>(window.verifiedFor=[p,purpose],{challenge:'a'.repeat(48),phone:'99001122'});customerAccount.open('register');});
 const reg=page.locator('#customer-pin-setup-form[data-purpose=register]');await reg.waitFor();assert.equal(await reg.locator('[data-pin-step]').isVisible(),false);
 await reg.locator('[name=name]').fill('Шинэ хэрэглэгч');await reg.locator('[name=phone]').fill('99001122');await reg.locator('[type=submit]').click();
 await reg.locator('[data-pin-step]').waitFor();assert.deepEqual(await page.evaluate(()=>window.verifiedFor),['99001122','register']);assert.equal(await reg.locator('[name=phone]').getAttribute('readonly'),'');
 await reg.locator('[name=pin]').fill('4321');await reg.locator('[name=pin_confirm]').fill('4321');await reg.locator('[type=submit]').click();
 await page.waitForFunction(()=>customerAccount.user?.id==='new');
 assert.deepEqual({phone:setup.phone,purpose:setup.purpose,challenge:setup.challenge,name:setup.name,pin:setup.pin,pin_confirm:setup.pin_confirm},{phone:'99001122',purpose:'register',challenge:'a'.repeat(48),name:'Шинэ хэрэглэгч',pin:'4321',pin_confirm:'4321'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 // App: the bearer session survives two idle hours and ends after 91 idle days.
 let token='',csrf='';const mobile=async(action,body)=>{const r=await fetch(base+'/api/mobile.php?action='+action,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'X-GOStore-Mobile-Token':token}:{}),...(body?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();token=r.headers.get('X-GOStore-Mobile-Token')||token;csrf=d.csrf||csrf;return d;};
 await mobile('customer-me');assert.ok((await mobile('customer-pin-login',{phone,pin:'0123'})).customer);
 age('mobile-sessions',token,7200);assert.equal((await mobile('customer-me')).customer?.login_phone,phone,'App stays signed in after two idle hours');
 age('mobile-sessions',token,91*86400);assert.equal((await mobile('customer-me')).customer,null,'App session ends after 91 idle days');
 console.log('PASS web PIN: phone + PIN sign-in, wrong PIN, SMS-then-PIN registration, PIN change tab, e-mail fallback, 30-day web and 90-day app sessions.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
