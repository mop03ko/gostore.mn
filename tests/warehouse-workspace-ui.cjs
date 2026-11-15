const {chromium}=require('../tmp/tooling/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));let csrf='';
  const api=async(action,body)=>{const r=await context.request.fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:body?{'X-CSRF-Token':csrf}:{},data:body});const d=await r.json();if(d.csrf)csrf=d.csrf;assert.ok(r.ok(),JSON.stringify(d));return d;};
  await api('session');await api('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json')));
  const accounts=['erenhot','ulaanbaatar'].map(location=>({location,email:location+'-workspace@example.test',password:'Warehouse-workspace-2026',enabled:true}));
  for(const account of accounts)await api('warehouse-account-save',account);
  await api('warehouse-session');await api('warehouse-login',accounts[0]);
  fs.mkdirSync('output/warehouse-workspace',{recursive:true});
  for(const [i,account] of accounts.entries()){
   if(i){await page.locator('#logout').click();await page.locator('#login-screen').waitFor({state:'visible'});assert.ok(await page.locator('.warehouse-dock').isHidden());assert.equal(await page.locator('#toast').textContent(),'');assert.equal(await page.locator('.warehouse-tabs #create-batch').count(),1);await page.locator('#login-location').selectOption(account.location);await page.locator('[name=email]').fill(account.email);await page.locator('[name=password]').fill(account.password);await page.locator('#login-form [type=submit]').click();}
   else await page.goto(base+'/warehouse/');
   await page.locator('body.warehouse-workspace').waitFor();await page.waitForFunction(()=>document.querySelector('#records').getAttribute('aria-busy')==='false');
   assert.equal(await page.locator('.erenhot-workbench').isVisible(),i===0);
   assert.equal(await page.locator('.ub-workbench').isVisible(),i===1);
   for(const width of [320,390,768,1032,1440]){
    await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+account.location+' '+width);
    const targets=i?['[data-ub-shortcut="scan"]','#handover-open','#delivery-open']:['[data-workspace-action="receive"]','#create-batch','[data-workspace-action="dispatch"]'];
    for(const target of targets){const box=await page.locator(target).boundingBox();assert.ok(box&&box.height>=44,'Touch target '+target);}
    if(width===390||width===1440){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`output/warehouse-workspace/${account.location}-${width}.png`});}
   }
   await page.setViewportSize({width:390,height:844});
   if(!i){await page.locator('[data-workspace-action="receive"]').click();assert.equal(await page.locator('#scan-code').evaluate(e=>e===document.activeElement),true);await page.locator('[data-workspace-action="dispatch"]').click();await page.waitForFunction(()=>document.querySelector('#status-filter').value==='packed'&&document.querySelector('#records').getAttribute('aria-busy')==='false');assert.equal(await page.locator('#batches-tab').getAttribute('aria-selected'),'true');}
   // The dock reuses real tabs and native/browser scanner entry; it never changes an order state.
   await page.locator('.warehouse-dock [data-workspace-action="orders"]').click();await page.waitForFunction(()=>document.querySelector('#records .order-card')&&!document.querySelector('#records').inert);
   let scanned=false;await page.exposeFunction('workspaceScannerClicked'+i,()=>{scanned=true;});
   await page.evaluate(i=>document.getElementById('qr-open').addEventListener('click',e=>{e.stopImmediatePropagation();window['workspaceScannerClicked'+i]();}, {capture:true,once:true}),i);
   await page.locator('.warehouse-dock [data-workspace-action="camera"]').click();assert.equal(scanned,true);
   // Failed filter loads must not leave previous orders under the new filter heading.
   const pattern='**/api/index.php?action=warehouse-orders&*';await page.route(pattern,r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary test outage'})}));
   await page.locator('#search').fill('GS-NOT-FOUND');await page.locator('#search-form [type=submit]').click();await page.locator('[data-workspace-action="retry"]').waitFor({state:'visible'});assert.equal(await page.locator('#records .order-card').count(),0);assert.equal(await page.locator('#records').evaluate(e=>e.inert),false);assert.ok(await page.locator('#next').isHidden());
   await page.unroute(pattern);await page.locator('[data-workspace-action="retry"]').click();await page.locator('#records .empty').waitFor();assert.ok(await page.locator('[data-workspace-action="retry"]').isHidden());
   await page.locator('#month-filter').fill('2028-02');await page.locator('#month-filter').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#records').getAttribute('aria-busy')==='false');
   await page.locator('[data-workspace-action="reset"]').click();await page.waitForFunction(()=>!!document.querySelector('#records .order-card'));assert.equal(await page.locator('#month-filter').inputValue(),'');assert.equal(await page.locator('#search').inputValue(),'');assert.equal(await page.locator('#status-filter').inputValue(),'all');
   await context.setOffline(true);await page.locator('.workspace-offline').waitFor({state:'visible'});await context.setOffline(false);await page.locator('.workspace-offline').waitFor({state:'hidden'});
  }
  assert.deepEqual(errors,[]);console.log('PASS warehouse workspaces: both roles, shortcuts, touch/320–1440px layout, mobile scanner handoff, failed-list recovery, all-filter reset, offline banner, logout/role isolation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
