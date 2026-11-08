const {chromium}=require('../tmp/tooling/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Erenhot screens: arrival alerts, courier scan check-in, one-step receipt (partial, then complete),
// automatic batch, one-step shipping, item photos with Chinese titles, phone widths.
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],id='GS-TEST-031';let csrf='';
 const api=async(action,body)=>{const r=await context.request.fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:body?{'X-CSRF-Token':csrf}:{},data:body});const d=await r.json();if(d.csrf)csrf=d.csrf;assert.ok(r.ok(),JSON.stringify(d));return d;};
 await api('session');await api('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));const login={location:'erenhot',email:'flow-ui@example.test',password:'Warehouse-flow-ui-2026',enabled:true};await api('warehouse-account-save',login);await api('warehouse-session');await api('warehouse-login',login);
 for(const number of ['SF1000000000001','SF1000000000002'])await api('warehouse-inbound-add',{id,number,company:'顺丰'});
 const seed=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','-d','extension=mbstring','tests/warehouse-flow-fixture.php'],{encoding:'utf8',env:process.env});assert.equal(seed.status,0,seed.stderr+seed.stdout);
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/warehouse/');await page.locator('#app').waitFor({state:'visible'});
 const post=async(name,fn)=>{const pending=page.waitForResponse(r=>r.url().includes('action='+name+'&')&&r.request().method()==='POST');await fn();const r=await pending;assert.equal(r.status(),200,await r.text());return r.json();};
 // Alerts card: late and courier-delivered parcels.
 assert.equal(await page.locator('#alerts-stat').isVisible(),true);await page.waitForFunction(()=>document.querySelector('#alerts-count').textContent==='2');assert.match(await page.locator('#alerts-stat').getAttribute('class'),/has-alerts/);
 await page.locator('#alerts-stat').click();await page.waitForFunction(()=>document.querySelectorAll('#records .order-card').length===2);const tags=(await page.locator('#records .warehouse-alert-tag').allInnerTexts()).join(' ');assert.match(tags,/超过5天未到仓/);assert.match(tags,/快递显示已签收/);
 await page.screenshot({path:'tmp/warehouse-alerts-mobile.png',fullPage:true});
 // Scanning a courier waybill checks that parcel in and opens the order.
 await page.locator('#scan-code').fill('SF1000000000001');await post('warehouse-parcel-arrive',()=>page.locator('#scan-form button').click());await page.locator('#editor[open]').waitFor();assert.equal(await page.locator('#editor-title').innerText(),id);
 assert.match(await page.locator('.parcel-check').innerText(),/包裹 1 \/ 2 已到/);assert.equal(await page.locator('.parcel-check [data-parcel-arrive]').count(),1);
 let f=page.locator('[data-receive-form]');assert.equal(await f.locator('[data-partial-row]').isVisible(),true,'Missing parcel asks for partial receipt');assert.equal(await f.locator('[name=partial]').evaluate(e=>e.required),true);
 const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);return c.toDataURL('image/jpeg').split(',')[1];});
 await f.locator('[name=camera_image]').setInputFiles({name:'parcel.jpg',mimeType:'image/jpeg',buffer:Buffer.from(photo,'base64')});for(const [n,v] of Object.entries({weight_kg:'1',length_cm:'20',width_cm:'20',height_cm:'20'}))await f.locator('[name='+n+']').fill(v);
 await f.locator('[name=partial]').check();await f.locator('[name=checked]').check();
 await page.setViewportSize({width:390,height:2600});await page.locator('#editor').screenshot({path:'tmp/warehouse-receive-form.png'});await page.setViewportSize({width:390,height:844});
 let d=await post('warehouse-receive',()=>f.locator('button.primary').click());
 assert.equal(d.order.status,'erenhot');assert.equal(d.order.batch_id,undefined);await page.locator('#editor-body details[open] .receipt-info').first().waitFor();assert.match(await page.locator('#editor-body').innerText(),/未到包裹/);
 // The second parcel arrives; receiving again approves the freight and puts the order into an automatic batch.
 await post('warehouse-parcel-arrive',()=>page.locator('.parcel-check [data-parcel-arrive]').click());await page.waitForFunction(()=>/包裹 2 \/ 2 已到/.test(document.querySelector('.parcel-check')?.innerText||''));
 f=page.locator('[data-receive-form]');assert.equal(await f.locator('[data-partial-row]').isHidden(),true);assert.equal(await f.locator('[name=weight_kg]').inputValue(),'1','Previous measurement prefilled');assert.match(await f.locator('[data-cargo-preview]').innerText(),/1,000 ₮/);
 await f.locator('[name=checked]').check();d=await post('warehouse-receive',()=>f.locator('button.primary').click());const batch=d.order.batch_id;assert.match(batch,/^GB-/);
 assert.ok(!/[\u0400-\u04ff]/.test((await page.locator('#editor-body button,#editor-body summary,#editor-body label').allTextContents()).join(' ')),'Erenhot controls are Chinese');
 await page.locator('#editor-body button[data-batch="'+batch+'"]').first().click();await page.waitForFunction(b=>document.querySelector('#editor-title').textContent===b,batch);
 assert.match(await page.locator('.batch-heading').innerText(),/自动装包/);assert.equal(await page.locator('[data-operation=batch-ready]').count(),0);
 let scan=page.locator('[data-batch-scan]');await scan.locator('[name=order_id]').fill(id);await post('warehouse-batch-scan',()=>scan.locator('button').click());
 const ship=page.locator('[data-operation=batch-ship]');await ship.locator('[name=checked]').check();d=await post('warehouse-batch-ship',()=>ship.locator('button').click());assert.equal(d.batch.status,'dispatched');assert.match(await page.locator('.batch-heading .tag').first().innerText(),/已出库/);await page.locator('#close-editor').click();
 // Item photo and the supplier's Chinese title/options.
 await page.locator('#scan-code').fill('GS-TEST-043');await page.locator('#scan-form button').click();await page.locator('.warehouse-items img').waitFor();
 assert.match(await page.locator('.warehouse-items img').getAttribute('src'),/_160x160q80\.jpg_\.webp$/);assert.match(await page.locator('.warehouse-items').innerText(),/双肩包 大容量 旅行[\s\S]*颜色: 黑色/);assert.match(await page.locator('.warehouse-items small').innerText(),/Тест үүргэвч/);
 await page.screenshot({path:'tmp/warehouse-receive-mobile.png',fullPage:true});
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow '+width);assert.ok(await page.locator('#editor').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No dialog overflow '+width);}
 assert.deepEqual(errors,[]);console.log('PASS Erenhot flow UI: alerts card and tags, courier scan check-in, partial receipt with automatic issue, late parcel, one-step receipt and freight, automatic batch, one-step shipping, item photo with Chinese title, Chinese controls, 320–1440px.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
