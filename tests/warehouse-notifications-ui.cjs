const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs'),cp=require('child_process'),path=require('path');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(process.env.GOSTORE_DATA_DIR,/warehouse-test-/);
function seed(id){const php=`require 'server/bootstrap.php';require 'server/shipping.php';require 'server/warehouse.php';$o=order_row('${id}')['order'];$old=$o;$old['status']='reviewing';warehouse_notice_record($o,$old);`;
 cp.execFileSync('tmp/tooling/php/php.exe',['-d','extension_dir='+path.resolve('tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring','-r',php],{windowsHide:true,env:{...process.env,GOSTORE_DISABLE_PUSH:'1'}});
}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const admin=await browser.newContext();let csrf='';async function api(a,b){const r=await admin.request.fetch(base+'/api/index.php?action='+a,{method:b?'POST':'GET',headers:b?{'X-CSRF-Token':csrf}:{},data:b});const d=await r.json();if(d.csrf)csrf=d.csrf;assert.ok(r.ok(),JSON.stringify(d));return d;}
 await api('session');await api('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));for(const location of ['erenhot','ulaanbaatar'])await api('warehouse-account-save',{location,email:location+'@example.test',password:'Warehouse-push-test-2026',enabled:true});seed('GS-TEST-001');
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['notifications']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=await context.newCDPSession(page);let registrations=[];cdp.on('ServiceWorker.workerRegistrationUpdated',e=>registrations=e.registrations);await cdp.send('ServiceWorker.enable');
 await page.addInitScript(()=>{const fake={endpoint:'https://fcm.googleapis.com/fcm/send/fixture',unsubscribe:async()=>true};PushManager.prototype.subscribe=async()=>fake;PushManager.prototype.getSubscription=async()=>null;});
 async function login(location,count=1){await page.goto(base+'/warehouse/?location='+location);await page.locator('[name=email]').fill(location+'@example.test');await page.locator('[name=password]').fill('Warehouse-push-test-2026');await page.locator('#login-form button').click();await page.locator('#app').waitFor({state:'visible'});await page.locator('[data-notices-toggle]').filter({hasText:String(count)}).waitFor();}
 await login('erenhot');await page.locator('[data-notices-toggle]').click();await page.locator('[data-notice-order="GS-TEST-001"]').waitFor();assert.match(await page.locator('.warehouse-notifications').innerText(),/新订单已确认/);
 await page.locator('[data-push-enable]').click();await page.locator('[data-push-status]').filter({hasText:'推送已开启'}).waitFor();
 seed('GS-TEST-002');const registration=registrations.find(r=>r.scopeURL===base+'/warehouse/');assert.ok(registration,'Service worker registered');await cdp.send('ServiceWorker.deliverPushMessage',{origin:base,registrationId:registration.registrationId,data:''});
 await page.waitForFunction(async()=>{const reg=await navigator.serviceWorker.ready;return (await reg.getNotifications()).some(n=>n.body.includes('GS-TEST-002'));});
 await page.locator('[data-notices-toggle]').click();await page.locator('[data-notices-toggle]').click();await page.locator('[data-notice-order="GS-TEST-002"]').waitFor();
 await page.locator('[data-notices-read]').click();await page.locator('[data-notices-toggle]').filter({hasText:'0'}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile fits');
 await page.locator('#logout').click();await page.locator('#login-screen').waitFor({state:'visible'});assert.equal(await page.locator('.warehouse-notifications').isVisible(),false);
 await login('ulaanbaatar',2);await page.locator('[data-notices-toggle]').click();assert.match(await page.locator('.warehouse-notifications').innerText(),/Шинэ захиалга баталгаажлаа/);
 await page.locator('[data-notice-order="GS-TEST-001"]').click();await page.locator('#editor').waitFor({state:'visible'});assert.equal(await page.locator('#editor-title').innerText(),'GS-TEST-001');
 assert.deepEqual(errors,[]);console.log('PASS warehouse notification UI: Chinese/Mongolian inbox, read state isolation, device registration, real service-worker push delivery, logout privacy, order navigation, mobile layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
