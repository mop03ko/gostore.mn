const {chromium}=require('../tmp/tooling/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const admin=await browser.newContext();let csrf='';
  async function api(action,data){const r=await admin.request.fetch(base+'/api/index.php?action='+action,{method:data?'POST':'GET',headers:data?{'X-CSRF-Token':csrf}:{},data});const d=await r.json();if(d.csrf)csrf=d.csrf;assert.ok(r.ok(),JSON.stringify(d));return d;}
  await api('session');await api('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));
  for(const location of ['erenhot','ulaanbaatar'])await api('warehouse-account-save',{location,email:location+'@example.test',password:'Warehouse-ui-test-2026',enabled:true});
  await api('warehouse-create',{role:'ulaanbaatar',name:'Баянзүрх салбар',city:'Улаанбаатар',address:'БЗД, 1 хороо',phone:'99112233',hours:'09:00–18:00',email:'branch@example.test',password:'Branch-ui-pass-2026!'});
  const directory=await (await admin.request.get(base+'/api/index.php?action=warehouse-session')).json();
  const branch=directory.warehouses.find(w=>w.name==='Баянзүрх салбар').location;
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  async function visit(path){await page.goto(base+path);await page.waitForFunction(()=>document.querySelector('#login-location').options.length===3);}
  async function login(location){await page.locator('[name=email]').fill(location+'@example.test');await page.locator('[name=password]').fill('Warehouse-ui-test-2026');await page.locator('#login-form button[type=submit]').click();await page.locator('#app').waitFor({state:'visible'});}
  await visit('/warehouse/');assert.ok(await page.locator('#login-location').isVisible());assert.equal(await page.locator('#warehouse-entry').isVisible(),false);
  await visit('/warehouse/erenhot/?location=ulaanbaatar');assert.equal(await page.locator('#login-location').isVisible(),false);assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
  // Manipulating the hidden selector cannot change the entry's warehouse.
  await page.evaluate(()=>document.querySelector('#login-location').value='ulaanbaatar');
  const request=page.waitForRequest(r=>r.url().includes('action=warehouse-login'));
  await login('erenhot');assert.equal((await request).postDataJSON().location,'erenhot');
  await page.reload();await page.locator('#app').waitFor({state:'visible'});
  await page.locator('#scan-code').fill('GS-TEST-010');await page.locator('#scan-form button').click();await page.locator('#editor').waitFor({state:'visible'});
  // Another tab changes the browser's warehouse session while a detail dialog is open.
  let session=await (await context.request.get(base+'/api/index.php?action=warehouse-session')).json();
  await context.request.post(base+'/api/index.php?action=warehouse-logout',{headers:{'X-CSRF-Token':session.csrf},data:{}});
  session=await (await context.request.get(base+'/api/index.php?action=warehouse-session')).json();
  const changed=await context.request.post(base+'/api/index.php?action=warehouse-login',{headers:{'X-CSRF-Token':session.csrf},data:{location:'ulaanbaatar',email:'ulaanbaatar@example.test',password:'Warehouse-ui-test-2026'}});assert.ok(changed.ok());
  await page.evaluate(()=>refresh());await page.locator('#editor').waitFor({state:'hidden'});assert.equal(await page.locator('#records').innerText(),'');assert.equal(await page.evaluate(()=>window.warehouseAuthState),false);
  await page.locator('#warehouse-entry-switch').click();await page.waitForFunction(()=>!document.querySelector('#login-form button[type=submit]').disabled);await login('erenhot');
  await visit('/warehouse/ulaanbaatar/');assert.ok(await page.locator('#login-screen').isVisible());assert.equal(await page.locator('#app').isVisible(),false);assert.ok(await page.locator('#warehouse-entry-switch').isVisible());assert.ok(await page.locator('#login-form button[type=submit]').isDisabled());
  await page.locator('#warehouse-entry-switch').click();await page.waitForFunction(()=>!document.querySelector('#login-form button[type=submit]').disabled);
  await login('ulaanbaatar');assert.equal(await page.locator('html').getAttribute('lang'),'mn');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile dashboard fits');
  await page.locator('#logout').click();await page.locator('#login-screen').waitFor({state:'visible'});
  await visit('/warehouse/'+branch+'/');assert.equal(await page.locator('#warehouse-entry-name').innerText(),'Баянзүрх салбар');assert.equal(await page.locator('html').getAttribute('lang'),'mn');
  await page.locator('[name=email]').fill('branch@example.test');await page.locator('[name=password]').fill('Branch-ui-pass-2026!');await page.locator('#login-form button[type=submit]').click();await page.locator('#app').waitFor({state:'visible'});assert.match(await page.locator('#warehouse-title').innerText(),/Баянзүрх/);
  await page.locator('#logout').click();await page.locator('#login-screen').waitFor({state:'visible'});
  await visit('/warehouse/wh-000000000000/');assert.ok(await page.locator('#login-form button[type=submit]').isDisabled());assert.match(await page.locator('#warehouse-entry-name').innerText(),/олдсонгүй/);
  await visit('/warehouse/ulaanbaatar');assert.equal(await page.locator('html').getAttribute('lang'),'mn');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile login fits');
  assert.ok(await page.locator('.login-brand img').evaluate(e=>e.complete&&e.naturalWidth>0),'deep-link assets load');
  await page.screenshot({path:'tmp/warehouse-entry-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('Warehouse entry links: fixed/general/branch/session mismatch/assets/mobile passed');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
