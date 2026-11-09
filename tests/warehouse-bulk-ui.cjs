const {chromium}=require('../tmp/tooling/node_modules/playwright'),fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Erenhot (owner request 2026-11-10): suggestions after four characters of a code (e.g. a waybill's last four digits)
// in the search and scan boxes, and bulk selection of ready orders in the scan-out window.
function client(){const jar=new Map();let csrf='';return async(action,body)=>{const form=body instanceof FormData,r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'X-CSRF-Token':csrf,...(!form?{'Content-Type':'application/json'}:{})}:{})},body:body?(form?body:JSON.stringify(body)):undefined});for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;return{...d,status:r.status};};}
(async()=>{
 const admin=client(),cn=client(),ub=client();await admin('session');await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));
 const cnLogin={location:'erenhot',email:'bulk-ui@example.test',password:'Warehouse-bulk-ui-2026',enabled:true},ubLogin={location:'ulaanbaatar',email:'bulk-ub@example.test',password:'Warehouse-bulk-ui-2026',enabled:true};
 for(const [login,c] of [[cnLogin,cn],[ubLogin,ub]]){await admin('warehouse-account-save',login);await c('warehouse-session');await c('warehouse-login',login);}
 const ready=['GS-TEST-021','GS-TEST-022','GS-TEST-023'];
 await cn('warehouse-inbound-add',{id:'GS-TEST-021',number:'SF2100000004321',company:'顺丰'});await cn('warehouse-inbound-add',{id:'GS-TEST-022',number:'YT2200000008765',company:'圆通'});
 for(const id of ready){let o=(await cn('warehouse-order&id='+id)).order;for(const no of o.parcels.list.map(p=>p.no))o=(await cn('warehouse-parcel-arrive',{id,number:no})).order;
  const f=new FormData();f.set('id',id);f.set('expected_version',String(o.logistics.version));f.set('image',new Blob([fs.readFileSync('assets/chair.jpg')],{type:'image/jpeg'}),'r.jpg');o=(await cn('warehouse-photo-upload',f)).order;
  const r=await cn('warehouse-receive',{id,expected_status:o.status,expected_version:o.logistics.version,weight_kg:1,volume_input:'dimensions',length_cm:10,width_cm:10,height_cm:10,pieces:2,checked:true});assert.equal(r.status,200,JSON.stringify(r));}
 // API: four characters minimum, endings first, no phone matching in Erenhot; the ready list is Erenhot-only.
 let s=await cn('warehouse-suggest&q=4321');assert.equal(s.status,200);assert.deepEqual(s.items.map(i=>[i.type,i.id,i.field,i.match]),[['order','GS-TEST-021','waybill','SF2100000004321']]);
 assert.deepEqual((await cn('warehouse-suggest&q=432')).items,[],'Fewer than four characters suggest nothing');
 assert.deepEqual((await cn('warehouse-suggest&q=2233')).items,[],'Erenhot never matches customer phones');
 s=await cn('warehouse-suggest&q=TEST-022');assert.equal(s.items[0].id,'GS-TEST-022','An exact ending comes first');
 const list=await cn('warehouse-outbound-ready');assert.deepEqual(list.orders.map(o=>o.id).sort(),ready);assert.ok(list.orders.every(o=>o.reason===''));
 assert.equal((await ub('warehouse-outbound-ready')).status,403);
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
  const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/warehouse/?location=erenhot');await page.locator('[name=email]').fill(cnLogin.email);await page.locator('[name=password]').fill(cnLogin.password);await page.locator('#login-form button').click();await page.locator('#app').waitFor({state:'visible'});
  // Typing a waybill's last four digits suggests the order; arrows and Enter open it.
  await page.locator('#search').click();await page.keyboard.type('432');await page.waitForTimeout(400);assert.equal(await page.locator('#search-suggest').isVisible().catch(()=>false),false,'Nothing before four characters');
  await page.keyboard.type('1');const option=page.locator('#search-suggest [role=option]');await option.first().waitFor();
  assert.equal(await option.count(),1);assert.match(await option.first().innerText(),/GS-TEST-021[\s\S]*运单 SF210000000\s*4321/);assert.equal(await option.first().locator('mark').innerText(),'4321');
  assert.equal(await page.locator('#search').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('ArrowDown');assert.equal(await option.first().getAttribute('aria-selected'),'true');await page.screenshot({path:'tmp/warehouse-suggest.png'});
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#editor-title').textContent==='GS-TEST-021');assert.equal(await page.locator('#search-suggest').isVisible(),false);await page.locator('#close-editor').click();
  // The scan box suggests too; Escape closes the list.
  await page.locator('#scan-code').click();await page.keyboard.type('TEST-02');await page.locator('#scan-code-suggest [role=option]').nth(2).waitFor();
  await page.keyboard.press('Escape');assert.equal(await page.locator('#scan-code-suggest').isVisible(),false);
  // Bulk selection in the scan-out window: tick all ready orders, add them, pack once.
  await page.locator('#create-batch').click();await page.waitForFunction(()=>document.querySelector('#editor-title').textContent==='扫码出库');
  await page.locator('[data-outbound-bulk]').click();await page.locator('[data-bulk-id]').nth(2).waitFor();assert.equal(await page.locator('[data-bulk-id]').count(),3);
  assert.equal(await page.locator('[data-bulk-add]').isDisabled(),true);await page.locator('[data-bulk-id="GS-TEST-022"]').check();assert.equal(await page.locator('[data-bulk-add]').innerText(),'添加所选 (1)');
  await page.locator('[data-bulk-all]').check();assert.equal(await page.locator('[data-bulk-add]').innerText(),'添加所选 (3)');await page.screenshot({path:'tmp/warehouse-bulk.png'});
  await page.locator('[data-bulk-add]').click();await page.waitForFunction(()=>document.querySelectorAll('.outbound-list li').length===3);assert.match(await page.locator('.outbound-list').innerText(),/按 GS 标签/);
  await page.locator('[data-outbound-bulk]').click();await page.locator('.outbound-bulk,.outbound-tools+.empty').first().waitFor();assert.match(await page.locator('#editor-body').innerText(),/没有其他可装包的订单/,'Listed orders are not offered again');
  const packed=page.waitForResponse(r=>r.url().includes('action=warehouse-outbound-pack&'));await page.locator('[data-outbound-pack]').click();const d=await (await packed).json();
  assert.match(d.batch.id,/^GB-/);assert.equal(d.batch.order_count,3);await page.waitForFunction(b=>document.querySelector('#editor-title').textContent===b,d.batch.id);
  for(const width of [320,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow at '+width);}
  assert.deepEqual(errors,[]);console.log('PASS Erenhot search and bulk: suggestions from four characters (waybill ending, endings first, no phone in Erenhot, arrows/Enter/Escape, scan box), bulk selection of ready orders (select all, added as GS, not offered twice, one GB batch), Erenhot-only ready list, 320–1440px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
