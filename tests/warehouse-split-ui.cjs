const {chromium}=require('../tmp/tooling/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],id='GS-TEST-031';let csrf='';
 const api=async(action,body)=>{const r=await context.request.fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:body?{'X-CSRF-Token':csrf}:{},data:body});const d=await r.json();if(d.csrf)csrf=d.csrf;assert.ok(r.ok(),JSON.stringify(d));return d;};
 await api('session');await api('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));const login={location:'erenhot',email:'split-ui@example.test',password:'Warehouse-split-ui-2026',enabled:true};await api('warehouse-account-save',login);await api('warehouse-session');await api('warehouse-login',login);
 const numbers=['SF1000000000001','SF1000000000002','SF1000000000003','SF1000000000004'];
 for(const number of numbers)await api('warehouse-inbound-add',{id,number,company:'SF'});
 for(const number of numbers.slice(0,3))await api('warehouse-parcel-arrive',{id,number});
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/warehouse/');await page.locator('#app').waitFor({state:'visible'});
 await page.evaluate(async id=>showOrder((await api('warehouse-order&id='+id)).order),id);
 await page.locator('[data-split-open]').click();let f=page.locator('[data-split-form]');
 assert.equal(await f.locator('button[type=submit]').isDisabled(),true);assert.equal(await f.locator('[value=SF1000000000004]').isDisabled(),true);
 await page.locator('[data-split-cancel]').click();assert.equal(await page.locator('[data-split-parcel]').count(),3);
 assert.equal(await page.locator('[data-split-parcel="SF1000000000004"]').count(),0,'Missing code has no split action');
 await page.locator('[data-split-parcel="SF1000000000001"]').click();f=page.locator('[data-split-form]');
 assert.equal(await f.locator('[name=mode]').isDisabled(),true);assert.equal(await f.locator('[value=SF1000000000001]').isChecked(),true);
 assert.equal(await f.locator('[name=number]:checked').count(),1);assert.equal(await f.locator('[name=number]:enabled').count(),0,'Single-code shortcut cannot accidentally move other parcels');
 assert.match(await f.locator('[data-split-preview]').innerText(),/新分件: 1 包裹.*剩余: 3 包裹/);
 for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:844});assert.ok(await f.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Split form fits '+width);}
 await page.setViewportSize({width:390,height:844});await f.locator('[name=reason]').fill('先发已到包裹');await f.locator('[name=checked]').check();
 const pending=page.waitForResponse(r=>r.url().includes('action=warehouse-order-split'));await f.locator('button[type=submit]').click();const response=await pending,d=await response.json();assert.equal(response.status(),200,JSON.stringify(d));
 await page.locator('[data-print-split]').waitFor();assert.match(await page.locator('.shipment-part-list').innerText(),new RegExp(d.part.id));assert.equal(await page.locator('[data-split-open]').count(),0,'New part cannot be split again');
 assert.equal(await page.locator('[data-receive-form] [name=pieces]').inputValue(),'1');
 const receipt=page.locator('[data-receive-form]');
 assert.equal(await receipt.locator('[name=cargo_method]').inputValue(),'');
 await receipt.locator('[name=weight_kg]').fill('1');await receipt.locator('[name=volume_input]').selectOption('direct');await receipt.locator('[name=volume_m3]').fill('2');
 await receipt.locator('[name=cargo_method]').selectOption('weight');
 assert.match(await receipt.locator('[data-cargo-preview]').innerText(),/按重量.*2,000/);
 const weightText=await receipt.locator('[data-cargo-preview]').innerText();
 await receipt.locator('[name=cargo_method]').selectOption('volume');
 assert.match(await receipt.locator('[data-cargo-preview]').innerText(),/按体积/);
 assert.notEqual(await receipt.locator('[data-cargo-preview]').innerText(),weightText);
 await page.evaluate(()=>window.print=()=>{});await page.locator('[data-print-split]').click();assert.match(await page.locator('#print-area').innerHTML(),new RegExp(d.part.id));assert.equal(await page.locator('#print-area .batch-qr-code').count(),1);
 await page.locator('#editor').screenshot({path:'tmp/warehouse-split-part.png'});
 assert.match(await page.locator('.shipment-part-list [data-order="'+d.part.id+'"]').innerText(),/SF1000000000001/);
 for(const number of numbers.slice(1,3)){
  await page.locator('.shipment-part-list [data-order="'+id+'"]').click();await page.locator('[data-split-parcel="'+number+'"]').click();f=page.locator('[data-split-form]');
  await f.locator('[name=reason]').fill('按运单独立发货');await f.locator('[name=checked]').check();
  const next=page.waitForResponse(r=>r.url().includes('action=warehouse-order-split'));await f.locator('button[type=submit]').click();assert.equal((await next).status(),200);await page.locator('[data-print-split]').waitFor();
 }
 await page.locator('.shipment-part-list [data-order="'+id+'"]').click();await page.waitForFunction(id=>activeLogisticsOrder?.id===id,id);
 assert.match(await page.locator('.parcel-check').innerText(),/包裹 0 \/ 1 已到/);assert.equal(await page.locator('[data-split-parcel],[data-split-open]').count(),0);
 assert.match(await page.locator('.parcel-check').innerText(),/SF1000000000004/);
 // Item count form uses the remaining SKU quantity and requires a nonempty remainder.
 await page.evaluate(async()=>showOrder((await api('warehouse-order&id=GS-TEST-032')).order));await page.locator('[data-split-open]').click();f=page.locator('[data-split-form]');
 await f.locator('[name=mode]').selectOption('items');await f.locator('[data-split-qty]').fill('2');assert.equal(await f.locator('button[type=submit]').isDisabled(),true);
 await f.locator('[data-split-qty]').fill('1');assert.equal(await f.locator('button[type=submit]').isEnabled(),true);assert.equal(await f.locator('[data-split-parcels]').isHidden(),true);
 await f.locator('[name=reason]').fill('先发一个商品');await f.locator('[name=checked]').check();
 const saved=page.waitForResponse(r=>r.url().includes('action=warehouse-order-split'));await f.locator('button[type=submit]').click();assert.equal((await saved).status(),200);
 await page.locator('[data-print-split]').waitFor();await page.locator('#editor').screenshot({path:'tmp/warehouse-split-items.png'});
 assert.deepEqual(errors,[]);console.log('Split UI: Chinese parcel/item selection, validation, new GS QR printing and responsive layout passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
