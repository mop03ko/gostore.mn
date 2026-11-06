const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Admin composes a message (preview, then confirm), the customer sees it in the bell and the account
// page, reading clears the badge, and the promotional-push choice persists. Text is escaped.
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const errors=[],auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));
 const shopper=await browser.newPage({viewport:{width:390,height:844}});shopper.on('pageerror',e=>errors.push(e.message));
 await shopper.goto(base+'/');await shopper.waitForFunction(()=>typeof shopApi==='function'&&window.customerAccount);
 const email='messages-'+Date.now()+'@example.test';
 await shopper.evaluate(async email=>{await shopApi('customer-me');const r=await shopApi('customer-register',{name:'Мэдэгдэл тест',email,password:'long-enough-pass-1',password_confirm:'long-enough-pass-1',phone:'99118877'});customerAccount.setUser(r.customer);},email);

 const admin=await browser.newPage({viewport:{width:1440,height:1000}});admin.on('pageerror',e=>errors.push(e.message));
 await admin.goto(base+'/admin/');await admin.locator('[name=email]').fill(auth.email);await admin.locator('[name=password]').fill(auth.password);await admin.locator('#login-form button').click();await admin.locator('#app').waitFor({state:'visible'});
 const previews=[];admin.on('request',r=>{if(r.url().includes('action=admin-message-preview'))previews.push([r.method(),r.url(),r.postData()||'']);});await admin.locator('nav [data-page=messages]').click();const form=admin.locator('#message-form');await form.waitFor();
 await admin.locator('#admin-message-history').getByText('Одоогоор мэдэгдэл илгээгээгүй').waitFor();
 // One customer by phone: the field appears only for that audience; an unknown number is refused.
 assert.equal(await form.locator('[data-message-phone]').isVisible(),false);
 await form.locator('[name=audience]').selectOption('customer');assert.equal(await form.locator('[data-message-phone]').isVisible(),true);
 await form.locator('[name=phone]').fill('88000000');await form.locator('[name=title]').fill('Туршилт');await form.locator('[name=body]').fill('Текст');
 await form.locator('button[type=submit]').click();await form.locator('.error').getByText('олдсонгүй').waitFor();assert.ok(previews.length&&previews.every(([m,u,body])=>m==='POST'&&!u.includes('88000000')&&body.includes('88000000')),'Preview sends the phone in a POST body, never the URL');
 await form.locator('[name=audience]').selectOption('all');assert.equal(await form.locator('[data-message-phone]').isVisible(),false);
 const title='Баярын амралт <img src=x onerror=window.pwned=1>';
 await form.locator('[name=title]').fill(title);await form.locator('[name=body]').fill('Ачаа 2 хоног удаашрана.\nУучлаарай.');await form.locator('[name=link]').fill('https://gostore.mn/help');
 let sends=0;admin.on('request',r=>{if(r.url().includes('action=admin-message-send'))sends++;});
 await form.locator('button[type=submit]').click();await admin.locator('#message-preview').getByText('1 хэрэглэгчид очно').waitFor();
 assert.equal(sends,0,'The first click only previews recipients');assert.equal(await form.locator('button[type=submit]').innerText(),'Баталгаажуулж илгээх');
 await form.locator('[name=body]').fill('Ачаа 2 хоног удаашрана.\nУучлаарай!');assert.equal(await admin.locator('#message-preview').innerText(),'','Editing asks for a new preview');
 await form.locator('button[type=submit]').click();await admin.locator('#message-preview').getByText('1 хэрэглэгчид очно').waitFor();
 const sent=admin.waitForResponse(r=>r.url().includes('action=admin-message-send'));await form.locator('button[type=submit]').click();assert.equal((await sent).status(),201);
 const row=admin.locator('#admin-message-history tbody tr');await row.first().waitFor();assert.equal(await row.count(),1);
 assert.match(await row.first().innerText(),/Үйлчилгээний мэдээлэл[\s\S]*Бүх хэрэглэгч · 1[\s\S]*Баярын амралт <img[\s\S]*0\/1/);
 assert.equal(await form.locator('[name=title]').inputValue(),'','Form resets after sending');
 await admin.setViewportSize({width:390,height:844});assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Admin messages page fits a phone');

 // Customer: bell badge, modal, account page, read state and the promotional push choice.
 await shopper.reload();await shopper.locator('[data-notification-count]').first().getByText('1').waitFor({timeout:8000});
 await shopper.locator('button.mobile-notifications').click();const notice=shopper.locator('.customer-message');await notice.waitFor();
 assert.match(await notice.innerText(),/Баярын амралт <img src=x onerror=window.pwned=1>[\s\S]*Ачаа 2 хоног удаашрана\.\nУучлаарай!/);
 assert.equal(await notice.locator('a').getAttribute('href'),'/help');assert.equal(await shopper.evaluate(()=>window.pwned),undefined);
 await shopper.goto(base+'/account/notifications');const item=shopper.locator('.account-message');await item.waitFor();
 assert.match(await item.innerText(),/GOStore мэдээлэл/);await shopper.waitForFunction(()=>[...document.querySelectorAll('[data-notification-count]')].every(n=>n.textContent===''));
 const promo=shopper.locator('[data-promo-push]');assert.equal(await promo.isChecked(),false);
 const saved=shopper.waitForResponse(r=>r.url().includes('action=customer-message-settings-save'));await promo.check();assert.ok((await saved).ok());
 await shopper.reload();await shopper.locator('.account-message').waitFor();assert.equal(await shopper.locator('[data-promo-push]').isChecked(),true);
 assert.equal(await shopper.locator('.account-notices .unread').count(),0,'Read messages stay read');
 await admin.reload();await admin.locator('#app').waitFor({state:'visible'});await admin.locator('#admin-message-history tbody tr').first().waitFor();assert.match(await admin.locator('#admin-message-history tbody tr').first().innerText(),/1\/1/);
 assert.ok(await shopper.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS customer messages UI: admin preview/confirm/send, phone audience, history and read counts, customer bell badge, modal, account page, read state, promo choice, escaping, phone widths.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
