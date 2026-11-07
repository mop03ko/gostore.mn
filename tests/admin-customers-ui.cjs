const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
async function register(name,email,phone){
 let r=await fetch(base+'/api/index.php?action=customer-me');const cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),{csrf}=await r.json(),password='Customer UI '+crypto.randomBytes(4).toString('hex');
 r=await fetch(base+'/api/index.php?action=customer-register',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({email,name,phone,password,password_confirm:password})});assert.equal(r.status,201,await r.text());
}
(async()=>{
 await register('Сараа Ганболд','sara-ui@example.test','99115566');await register('Тэмүүлэн Бат','temuulen-ui@example.test','');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin/');await page.locator('[name=email]').fill(auth.email);await page.locator('[name=password]').fill(auth.password);await page.locator('#login-form button').click();await page.locator('#app').waitFor({state:'visible'});
 const rows=page.locator('.customers-table tbody tr'),rowCount=n=>page.waitForFunction(n=>document.querySelectorAll('.customers-table tbody tr').length===n,n);
 await page.locator('nav [data-page=customers]').click();await page.locator('.customers-table').waitFor();
 assert.equal(await page.locator('#page-title').textContent(),'Хэрэглэгчид');assert.equal(new URL(page.url()).hash,'#customers');
 assert.match(await page.locator('#customer-stats').innerText(),/2\s*бүртгэлтэй/);await rowCount(2);
 await page.locator('#customer-search').fill('САРАА');await rowCount(1);assert.match(await rows.innerText(),/sara-ui@example\.test/);assert.match(await rows.innerText(),/99115566/);
 await page.screenshot({path:'tmp/admin-customers-desktop.png',fullPage:true});
 await rows.locator('[data-customer]').click();const form=page.locator('#customer-form');await form.waitFor();
 assert.equal(await form.locator('[name=email]').inputValue(),'sara-ui@example.test');assert.equal(await form.locator('[name=phone]').getAttribute('readonly'),null);
 assert.match(await page.locator('#editor-body').innerText(),/Хаяг хадгалаагүй/);assert.match(await page.locator('#editor-body').innerText(),/Захиалга хараахан алга/);
 await form.locator('[name=name]').fill('Сараа Админ');await form.locator('[name=phone]').fill('99117788');
 const saved=page.waitForResponse(r=>new URL(r.url()).searchParams.get('action')==='admin-customer-save');await form.locator('button[type=submit]').click();const response=await saved;assert.ok(response.ok(),await response.text());
 await page.locator('#editor').waitFor({state:'hidden'});await page.waitForFunction(()=>/Сараа Админ[\s\S]*99117788/.test(document.querySelector('.customers-table')?.innerText||''));
 await page.locator('#customer-search').fill('');await rowCount(2);
 await page.locator('#customer-filter').selectOption('phone');await page.locator('#admin-customers .empty').waitFor();assert.match(await page.locator('#admin-customers').innerText(),/Тохирох хэрэглэгч алга/);
 await page.locator('#customer-filter').selectOption('active');await rowCount(2);
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal scroll at '+width);}
 await page.screenshot({path:'tmp/admin-customers-mobile.png',fullPage:true});
 await rows.filter({hasText:'Тэмүүлэн'}).locator('[data-customer]').click();await page.locator('#customer-form').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'tmp/admin-customers-editor-mobile.png'});await page.locator('#close-editor').click();
 await page.locator('#mobile-admin-page').selectOption('orders');assert.equal(await page.locator('#page-title').textContent(),'Захиалгууд');await page.locator('#mobile-admin-page').selectOption('customers');await rowCount(2);
 assert.deepEqual(errors,[]);console.log('PASS Chrome admin customers: nav and hash, stats, Cyrillic search, edit dialog save and refresh, filter empty state, 390/320 px without overflow, mobile section switch, no JS errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
