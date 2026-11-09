const {chromium}=require('../tmp/tooling/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Erenhot screens: arrival alerts, courier scan check-in, one-step receipt (partial, then complete),
// scan-to-dispatch (scanner gun, GB number on packing, dispatch), item photos with Chinese titles, phone widths.
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
 assert.equal(await page.locator('#status-tabs [data-status=alerts]').isVisible(),true);await page.waitForFunction(()=>document.querySelector('#status-tabs [data-count=alerts]').textContent==='2');assert.match(await page.locator('#status-tabs [data-count=alerts]').getAttribute('class'),/has/);
 await page.locator('#status-tabs [data-status=alerts]').click();await page.waitForFunction(()=>document.querySelectorAll('#records .order-card').length===2);const tags=(await page.locator('#records .warehouse-alert-tag').allInnerTexts()).join(' ');assert.match(tags,/超过5天未到仓/);assert.match(tags,/快递显示已签收/);
 await page.screenshot({path:'tmp/warehouse-alerts-mobile.png',fullPage:true});
 // Scanning a courier waybill checks that parcel in and opens the order.
 await page.locator('#scan-code').fill('SF1000000000001');await post('warehouse-parcel-arrive',()=>page.locator('#scan-form button').click());await page.locator('#editor[open]').waitFor();assert.equal(await page.locator('#editor-title').innerText(),id);
 assert.match(await page.locator('.parcel-check').innerText(),/包裹 1 \/ 2 已到/);assert.equal(await page.locator('.parcel-check [data-parcel-arrive]').count(),1);
 let f=page.locator('[data-receive-form]');assert.equal(await f.locator('[data-partial-row]').isVisible(),true,'Missing parcel asks for partial receipt');assert.equal(await f.locator('[name=partial]').evaluate(e=>e.required),true);
 const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);return c.toDataURL('image/jpeg').split(',')[1];});
 await f.locator('[name=image]').setInputFiles({name:'parcel.jpg',mimeType:'image/jpeg',buffer:Buffer.from(photo,'base64')});for(const [n,v] of Object.entries({weight_kg:'1',length_cm:'20',width_cm:'20',height_cm:'20'}))await f.locator('[name='+n+']').fill(v);
 await f.locator('[name=partial]').check();await f.locator('[name=checked]').check();
 await page.setViewportSize({width:390,height:2600});await page.locator('#editor').screenshot({path:'tmp/warehouse-receive-form.png'});await page.setViewportSize({width:390,height:844});
 let d=await post('warehouse-receive',()=>f.locator('button.primary').click());
 assert.equal(d.order.status,'erenhot');assert.equal(d.order.batch_id,undefined);await page.locator('#editor-body details[open] .receipt-info').first().waitFor();assert.match(await page.locator('#editor-body').innerText(),/未到包裹/);
 // The second parcel arrives; receiving again approves the freight. The order then waits for the scan-out (no batch yet).
 await post('warehouse-parcel-arrive',()=>page.locator('.parcel-check [data-parcel-arrive]').click());await page.waitForFunction(()=>/包裹 2 \/ 2 已到/.test(document.querySelector('.parcel-check')?.innerText||''));
 f=page.locator('[data-receive-form]');assert.equal(await f.locator('[data-partial-row]').isHidden(),true);assert.equal(await f.locator('[name=weight_kg]').inputValue(),'1','Previous measurement prefilled');assert.match(await f.locator('[data-cargo-preview]').innerText(),/1,000 ₮/);
 await f.locator('[name=checked]').check();d=await post('warehouse-receive',()=>f.locator('button.primary').click());assert.equal(d.order.batch_id,undefined);assert.ok(d.order.logistics.transport.confirmed_at);
 await page.locator('#editor-body [data-outbound-open]').waitFor();assert.equal(await page.locator('#editor-body details.remeasure').getAttribute('open'),null,'Re-measuring is folded away');
 assert.ok(!/[Ѐ-ӿ]/.test((await page.locator('#editor-body button,#editor-body summary,#editor-body label').allTextContents()).join(' ')),'Erenhot controls are Chinese');
 // Scan-out: the scanner gun types a waybill and Enter into the focused box; every waybill of the order is needed.
 await page.locator('#editor-body [data-outbound-open]').click();await page.waitForFunction(()=>document.querySelector('#editor-title').textContent==='扫码出库');
 assert.equal(await page.locator('[data-outbound-scan] [name=code]').evaluate(e=>e===document.activeElement),true,'Scan box is focused for the scanner gun');assert.equal(await page.locator('[data-outbound-pack]').isDisabled(),true);
 const gun=async code=>{await page.keyboard.type(code);await page.keyboard.press('Enter');};
 await gun('sf1000000000001');await page.waitForFunction(()=>document.querySelectorAll('.outbound-list li').length===1);
 assert.match(await page.locator('.outbound-list').innerText(),/包裹 1\/2[\s\S]*还差: SF1000000000002/);assert.equal(await page.locator('[data-outbound-pack]').isDisabled(),true,'Incomplete order blocks packing');
 // A parcel still on the way is refused with its reason.
 await gun('ZT8000000000001');await page.waitForFunction(()=>/尚未收货/.test(document.querySelector('#editor-body .error')?.textContent||''));assert.equal(await page.locator('.outbound-list li').count(),1);
 assert.ok(!/[Ѐ-ӿ]/.test((await page.locator('#editor-body button,#editor-body label,#editor-body .note,#editor-body .error,.outbound-list small').allTextContents()).join(' ')),'Scan-out controls are Chinese');
 // Closing the window keeps the list on this device.
 await page.locator('#close-editor').click();assert.equal(await page.locator('#create-batch').innerText(),'扫码出库');await page.locator('#create-batch').click();await page.waitForFunction(()=>document.querySelectorAll('.outbound-list li').length===1);
 // Phone camera: the waybill joins the list and the scanner stays open for the next parcel.
 await page.locator('[data-outbound-camera]').click();await page.locator('#qr-scanner[open]').waitFor();
 const waybill=await page.evaluate(async code=>{const q=qrcode(0,'M');q.addData(code);q.make();const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(q.createSvgTag({cellSize:8,margin:32,scalable:true}));await img.decode();const c=document.createElement('canvas');c.width=c.height=480;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,480,480);x.drawImage(img,0,0,480,480);return c.toDataURL('image/png').split(',')[1];},'SF1000000000002');
 await page.locator('#qr-file').setInputFiles({name:'waybill.png',mimeType:'image/png',buffer:Buffer.from(waybill,'base64')});
 await page.waitForFunction(()=>/已添加 · SF1000000000002/.test(document.querySelector('#qr-status').textContent));assert.equal(await page.locator('#qr-scanner').evaluate(e=>e.open),true,'Scanner stays open');
 await page.locator('#qr-close').click();await page.waitForFunction(()=>/包裹 2\/2/.test(document.querySelector('.outbound-list')?.innerText||''));assert.equal(await page.locator('[data-outbound-pack]').isEnabled(),true);
 await page.locator('[data-outbound-scan] [name=code]').focus();await gun('SF1000000000002');await page.waitForFunction(()=>/已扫描过/.test(document.querySelector('#toast')?.textContent||''));assert.equal(await page.locator('.outbound-list li').count(),1,'A repeated scan adds nothing');
 await page.setViewportSize({width:390,height:1400});await page.locator('#editor').screenshot({path:'tmp/warehouse-scan-out.png'});await page.setViewportSize({width:390,height:844});
 // "确认打包" creates the GB number; its screen prints the label and confirms the departure.
 d=await post('warehouse-outbound-pack',()=>page.locator('[data-outbound-pack]').click());const batch=d.batch.id;assert.match(batch,/^GB-/);assert.equal(d.batch.status,'ready');
 await page.waitForFunction(b=>document.querySelector('#editor-title').textContent===b,batch);assert.equal(await page.locator('.batch-qr-label strong').innerText(),batch);
 assert.equal(await page.evaluate(()=>localStorage.getItem('gostore-outbound-erenhot')),null,'List cleared after packing');
 const dispatch=page.locator('[data-operation=batch-dispatch]');await dispatch.locator('[name=checked]').check();d=await post('warehouse-batch-dispatch',()=>dispatch.locator('button').click());assert.equal(d.batch.status,'dispatched');assert.match(await page.locator('.batch-heading .tag').first().innerText(),/已发货/);await page.locator('#close-editor').click();
 // 已发货 lists GB batch records like the "CK" outbound records: code and time, warehouse, count, status, print and Excel.
 await page.evaluate(()=>{window.print=()=>{window.printed=(window.printed||0)+1;};});
 await page.locator('#status-tabs [data-status=shipped]').click();await page.waitForFunction(b=>[...document.querySelectorAll('#records .batch-record .order-code-link')].some(e=>e.textContent===b),batch);
 assert.equal(await page.locator('#status-tabs [data-status=shipped]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#status-tabs [data-count=shipped_batches]').innerText(),'1');
 const record=page.locator('#records .batch-record').filter({hasText:batch});assert.match(await record.innerText(),/收货仓库: [\s\S]*数量: 1 个订单 · 2 件[\s\S]*已发货/);
 await record.locator('[data-print-batch-id]').click();await page.waitForFunction(()=>window.printed===1);assert.match(await page.locator('#print-area').innerText(),new RegExp(batch));
 const href=await record.locator('a').getAttribute('href');assert.match(href,/action=warehouse-batch-export&id=GB-/);const bytes=Buffer.from(await (await fetch(base+href)).arrayBuffer()),csv=bytes.toString('utf8');assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');assert.ok(csv.includes('包裹编号'));assert.match(csv,new RegExp(batch+','+id+','));
 await page.screenshot({path:'tmp/warehouse-batch-records.png'});
 // A saved list item that changed elsewhere (here: already dispatched) is named with its reason when packing fails.
 await page.evaluate(id=>localStorage.setItem('gostore-outbound-erenhot',JSON.stringify({token:'b'.repeat(64),items:[{id,customer:'x',pieces:2,parcels:[],scanned:[],whole:true,destination:'ulaanbaatar',destination_name:'UB',codes:[id]}]})),id);
 await page.locator('#create-batch').click();const failed=page.waitForResponse(r=>r.url().includes('action=warehouse-outbound-pack&'));await page.locator('[data-outbound-pack]').click();assert.equal((await failed).status(),409);
 await page.waitForFunction(()=>/已出库或已发货/.test(document.querySelector('.outbound-problem')?.textContent||''));assert.match(await page.locator('#editor-body .error').innerText(),/尚不能出库/);
 await page.locator('[data-outbound-clear]').click();assert.equal(await page.locator('.outbound-list li').count(),0);await page.locator('#close-editor').click();
 // Item photo and the supplier's Chinese title/options.
 await page.locator('#scan-code').fill('GS-TEST-043');await page.locator('#scan-form button').click();await page.locator('.warehouse-items img').waitFor();
 assert.match(await page.locator('.warehouse-items img').getAttribute('src'),/_160x160q80\.jpg_\.webp$/);assert.match(await page.locator('.warehouse-items').innerText(),/双肩包 大容量 旅行[\s\S]*颜色: 黑色/);assert.match(await page.locator('.warehouse-items small').innerText(),/Тест үүргэвч/);
 await page.screenshot({path:'tmp/warehouse-receive-mobile.png',fullPage:true});
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow '+width);assert.ok(await page.locator('#editor').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No dialog overflow '+width);}
 assert.deepEqual(errors,[]);console.log('PASS Erenhot flow UI: alerts card and tags, courier scan check-in, partial receipt with automatic issue, late parcel, one-step receipt and freight, scan-out by scanner gun and phone camera (incomplete/not received/repeat, kept after closing), GB packing and dispatch, item photo with Chinese title, Chinese controls, 320–1440px.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
