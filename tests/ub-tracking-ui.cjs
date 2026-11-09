const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const admin=await browser.newContext(),ub=await browser.newContext({viewport:{width:390,height:844}}),id='GS-TEST-010',errors=[];
 function client(context){let csrf='';return async(action,body)=>{const r=await context.request.fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:body?{'X-CSRF-Token':csrf}:{},data:body});const d=await r.json();if(d.csrf)csrf=d.csrf;return{status:r.status(),...d};};}
 const a=client(admin),u=client(ub);await a('session');await a('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));
 const account={location:'ulaanbaatar',email:'ub-tracking@example.test',password:'UB-tracking-tests-2026',enabled:true};await a('warehouse-account-save',account);await u('warehouse-session');assert.equal((await u('warehouse-login',account)).status,200);
 const first=await u('warehouse-orders');assert.equal(first.total,55);assert.equal(first.orders.length,50);assert.equal(first.more,true);assert.equal((await u('warehouse-orders&offset=50')).orders.length,5);
 const page=await ub.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/warehouse/?location=ulaanbaatar');await page.locator('#app').waitFor({state:'visible'});
 for(const status of ['confirmed','shipping','erenhot']){
  assert.equal((await a('order-update',{id,status,amount:99000,internal_note:'PRIVATE'})).status,200);
  await page.locator('#search').fill(id);await page.locator('#status-filter').selectOption(status);await page.locator('#search-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#records [data-order]').length===1);await page.locator('#records [data-order="'+id+'"]').click();await page.locator('.tracking-location').waitFor();
  const o=(await u('warehouse-order&id='+id)).order;assert.equal(o.read_only,true);assert.equal(o.next_status,null);assert.equal(o.contact,undefined);assert.equal(o.billing,undefined);
  assert.equal(await page.locator('#editor form').count(),0,'Early orders have no mutation controls');assert.ok(!(await page.locator('#editor').innerText()).includes('PRIVATE'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const action of ['warehouse-measure','warehouse-shelf','warehouse-issue','warehouse-issue-resolve','warehouse-settlement'])assert.equal((await u(action,{id,expected_version:o.logistics.version,kind:'damaged',note:'must not persist'})).status,404,action+' remains denied');
  assert.equal((await u('warehouse-order-update',{id,status:'ulaanbaatar',expected_status:status})).status,404);assert.equal((await u('warehouse-fulfillment-update',{id,operation:'sort',expected_status:status})).status,404);
  const photo=await ub.request.post(base+'/api/index.php?action=warehouse-photo-upload',{headers:{'X-CSRF-Token':(await u('warehouse-session')).csrf},multipart:{id,expected_version:String(o.logistics.version),image:{name:'receipt.jpg',mimeType:'image/jpeg',buffer:fs.readFileSync('assets/chair.jpg')}}});assert.equal(photo.status(),404);
  assert.deepEqual((await u('warehouse-order&id='+id)).order,o,'Denied writes do not mutate the order');if(status==='erenhot'){assert.equal(await page.locator('.tracking-location').innerText(),'Эрээн агуулах');await page.screenshot({path:'tmp/ub-early-tracking.png'});}await page.locator('#close-editor').click();
 }
 assert.deepEqual(errors,[]);console.log('PASS UB tracking: confirmed/shipping/Erenhot search, status filters, pagination, mobile, privacy and early mutation/photo denial.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
