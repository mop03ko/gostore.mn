const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[],operatorCalls=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('action=ot-operator-'))operatorCalls.push(r.url());});
 const s=await(await context.request.get(base+'/api/index.php?action=session')).json();assert.ok((await context.request.post(base+'/api/index.php?action=login',{headers:{'X-CSRF-Token':s.csrf},data:JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'))})).ok());
 await page.goto(base+'/admin/');await page.locator('#app').waitFor({state:'visible'});await page.locator('nav [data-page=integrations]').click();await page.getByRole('heading',{name:'Taobao · OT Commerce',exact:true}).waitFor();
 assert.equal(await page.locator('#ot-operator-form,[data-ot-action]').count(),0,'Taobao catalog never offers Alibaba1688 buyer authorization');assert.ok((await page.locator('#app').innerText()).includes('Taobao худалдан авалт → Эрээн'));
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'tmp/taobao-admin-mobile.png',fullPage:true});
 await page.locator('#mobile-admin-page').selectOption('shipping');await page.locator('#shipping-form').waitFor();assert.ok((await page.locator('#shipping-form').innerText()).includes('Taobao каталог идэвхтэй'));assert.ok((await page.locator('#shipping-form').innerText()).includes('Taobao API'));
 assert.deepEqual(operatorCalls,[]);assert.deepEqual(errors,[]);console.log('PASS: Taobao integration status, explicit manual purchasing flow, no legacy 1688 authorization, catalog/budget controls and mobile layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
