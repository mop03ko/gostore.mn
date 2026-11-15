const {chromium}=require('../tmp/tooling/node_modules/playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),apiRequests=[],errors=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+'/warehouse/ulaanbaatar/?demo=1');
  assert.match(response.headers()['content-security-policy'],/connect-src 'none'/);
  await page.locator('#app').waitFor({state:'visible'});
  assert.equal(await page.locator('#records .order-card').count(),6);
  assert.ok(await page.locator('#demo-banner').isVisible());
  await page.locator('body.ub-dashboard').waitFor();
  await page.evaluate(()=>language('erenhot'));
  await page.waitForFunction(()=>!document.body.classList.contains('ub-dashboard'));
  assert.ok(await page.locator('.ub-workbench').isHidden());
  assert.equal(await page.locator('.warehouse-tabs #handover-open').count(),1);
  await page.evaluate(()=>language('ulaanbaatar'));
  await page.locator('body.ub-dashboard').waitFor();
  // Primary work stays reachable on phones/tablets, and shortcuts use the real filters.
  for(const width of [320,390,768,1032,1440]){
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No dashboard overflow at '+width);
    for(const selector of ['[data-ub-shortcut="scan"]','[data-ub-shortcut="sort"]','#handover-open','#delivery-open']){
      assert.ok(await page.locator('.ub-workbench '+selector).isVisible(),selector);
      const box=await page.locator(selector).boundingBox();assert.ok(box.height>=44,'Touch target '+selector);
    }
  }
  await page.locator('[data-ub-shortcut="scan"]').click();
  assert.equal(await page.locator('#scan-code').evaluate(e=>e===document.activeElement),true);
  await page.locator('[data-ub-shortcut="sort"]').click();
  await page.waitForFunction(()=>document.querySelector('#status-filter').value==='pending_sort');
  await page.locator('#status-filter').selectOption('all');
  await page.waitForFunction(()=>document.querySelectorAll('#records .order-card').length===6);
  const fs=require('node:fs');fs.mkdirSync('output/warehouse-dashboard',{recursive:true});
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:'output/warehouse-dashboard/ub-'+width+'.png',fullPage:true});
  }
  // The shared admin sidebar CSS must not make the demo banner sticky/full-height.
  for(const viewport of [{width:390,height:844},{width:1032,height:1376}]){
    await page.setViewportSize(viewport);
    const banner=await page.locator('#demo-banner').boundingBox();
    assert.ok(banner.height<viewport.height/2,'Demo banner must leave room for the warehouse dashboard');
    assert.equal(await page.locator('#demo-banner').evaluate(e=>getComputedStyle(e).position),'static');
  }
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.warehouse-notifications').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  async function scan(code){await page.locator('#scan-code').fill(code);await page.locator('#scan-form button').click();await page.locator('#editor').waitFor({state:'visible'});await page.waitForFunction(code=>document.querySelector('#editor-title').textContent===code,code);}
  async function upload(){await page.locator('[data-photo-upload] input[name=image]').setInputFiles('staff-ios/assets/warehouse.png');await page.locator('[data-photo-upload] button').click();await page.locator('.warehouse-photos img').waitFor();assert.match(await page.locator('.warehouse-photos img').first().getAttribute('src'),/^blob:/);}
  await scan('GS-DEMO03');await upload();await page.locator('#close-editor').click();
  await scan('GB-DEMO01');await page.locator('[data-batch-scan] input').fill('GS-DEMO03');await page.locator('[data-batch-scan] button').click();
  await page.waitForFunction(()=>document.querySelector('[data-batch-scan]')?.dataset.version==='2');
  await page.locator('[data-operation=batch-receive] button').click();
  await page.locator('[data-operation=batch-receive]').waitFor({state:'detached'});
  await page.locator('.manifest [data-order]').click();
  // One-step sorting, then the counter handover window with the demo pickup code.
  await page.locator('[data-ub-sort] input[name=shelf]').fill('A-01');await page.locator('[data-ub-sort] input[name=checked]').check();await page.locator('[data-ub-sort] button.primary').click();
  await page.locator('[data-ub-handover-open]').click();await page.locator('[data-ub-code="GS-DEMO03"]').fill('12345678');await page.locator('[data-ub-received]').fill('Demo recipient');await page.locator('[data-ub-handover]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.ub-handover-list li').length===0);
  assert.equal(await page.evaluate(async()=>{const r=await fetch('/api/index.php?action=warehouse-order&id=GS-DEMO03');return (await r.json()).order.status;}),'completed');
  await page.reload();await page.locator('#app').waitFor({state:'visible'});
  const reset=await page.evaluate(async()=>{const r=await fetch('/api/index.php?action=warehouse-order&id=GS-DEMO03');return (await r.json()).order;});
  assert.equal(reset.status,'erenhot_dispatched');assert.equal(reset.logistics.photos.length,0);
  const blocked=await page.evaluate(async()=>{const r=await fetch('/api/index.php?action=warehouse-order&id=GS-REAL01');return {status:r.status,...await r.json()};});assert.equal(blocked.status,400);
  assert.deepEqual(apiRequests,[]);
  // Independent CSP blocks XHR even if callers bypass the demo fetch shim.
  const failure=page.waitForEvent('requestfailed',r=>r.url().includes('warehouse-shelf'));
  assert.equal(await page.evaluate(()=>new Promise(resolve=>{const x=new XMLHttpRequest();x.open('POST','/api/index.php?action=warehouse-shelf');x.onerror=()=>resolve(true);x.onload=()=>resolve(false);x.send('{}');})),true);
  assert.match((await failure).failure().errorText,/CSP|ERR_FAILED|BLOCKED/i);assert.deepEqual(errors,[]);
  await page.locator('#demo-banner a').click();await page.locator('#login-screen').waitFor({state:'visible'});
  await page.locator('#warehouse-demo-link').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>!!window.GOStoreWarehouseDemo),false);
  console.log('Warehouse demo: receipt photo, batch scan/receive, sort, completion, reset and network isolation passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
