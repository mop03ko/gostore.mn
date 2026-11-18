const {chromium}=require('../tmp/tooling/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],id='GS-TEST-031';let csrf='';
 const api=async(action,body)=>{const r=await context.request.fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:body?{'X-CSRF-Token':csrf}:{},data:body});const d=await r.json();if(d.csrf)csrf=d.csrf;assert.ok(r.ok(),JSON.stringify(d));return d;};
 await api('session');await api('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));const login={location:'erenhot',email:'split-ui@example.test',password:'Warehouse-split-ui-2026',enabled:true};await api('warehouse-account-save',login);await api('warehouse-session');await api('warehouse-login',login);
 for(const number of ['SF1000000000001','SF1000000000002'])await api('warehouse-inbound-add',{id,number,company:'SF'});
 await api('warehouse-parcel-arrive',{id,number:'SF1000000000001'});
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/warehouse/');await page.locator('#app').waitFor({state:'visible'});
 await page.evaluate(async id=>showOrder((await api('warehouse-order&id='+id)).order),id);
 await page.locator('[data-split-open]').click();let f=page.locator('[data-split-form]');
 assert.equal(await f.locator('button[type=submit]').isDisabled(),true);assert.equal(await f.locator('[value=SF1000000000002]').isDisabled(),true);
 await f.locator('[value=SF1000000000001]').check();assert.match(await f.locator('[data-split-preview]').innerText(),/新分件: 1 包裹.*剩余: 1 包裹/);
 for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:844});assert.ok(await f.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Split form fits '+width);}
 await page.setViewportSize({width:390,height:844});await f.locator('[name=reason]').fill('先发已到包裹');await f.locator('[name=checked]').check();
 const pending=page.waitForResponse(r=>r.url().includes('action=warehouse-order-split'));await f.locator('button[type=submit]').click();const response=await pending,d=await response.json();assert.equal(response.status(),200,JSON.stringify(d));
 await page.locator('[data-print-split]').waitFor();assert.match(await page.locator('.shipment-part-list').innerText(),new RegExp(d.part.id));assert.equal(await page.locator('[data-split-open]').count(),0,'New part cannot be split again');
 assert.equal(await page.locator('[data-receive-form] [name=pieces]').inputValue(),'1');
 await page.evaluate(()=>window.print=()=>{});await page.locator('[data-print-split]').click();assert.match(await page.locator('#print-area').innerHTML(),new RegExp(d.part.id));assert.equal(await page.locator('#print-area .batch-qr-code').count(),1);
 await page.locator('#editor').screenshot({path:'tmp/warehouse-split-part.png'});
 // Item count form uses the remaining SKU quantity and requires a nonempty remainder.
 await page.evaluate(async()=>showOrder((await api('warehouse-order&id=GS-TEST-032')).order));await page.locator('[data-split-open]').click();f=page.locator('[data-split-form]');
 await f.locator('[name=mode]').selectOption('items');await f.locator('[data-split-qty]').fill('2');assert.equal(await f.locator('button[type=submit]').isDisabled(),true);
 await f.locator('[data-split-qty]').fill('1');assert.equal(await f.locator('button[type=submit]').isEnabled(),true);assert.equal(await f.locator('[data-split-parcels]').isHidden(),true);
 await f.locator('[name=reason]').fill('先发一个商品');await f.locator('[name=checked]').check();
 const saved=page.waitForResponse(r=>r.url().includes('action=warehouse-order-split'));await f.locator('button[type=submit]').click();assert.equal((await saved).status(),200);
 await page.locator('[data-print-split]').waitFor();await page.locator('#editor').screenshot({path:'tmp/warehouse-split-items.png'});
 assert.deepEqual(errors,[]);console.log('Split UI: Chinese parcel/item selection, validation, new GS QR printing and responsive layout passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
