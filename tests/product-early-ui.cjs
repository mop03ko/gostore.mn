const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const images=[];await context.route('https://img.alicdn.com/**',r=>{images.push(r.request().url());return r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'});});
 const reads=[];page.on('request',r=>{if(r.url().includes('action=supplier-product'))reads.push(r.url());});
 await page.goto(base+'/v/tb-123456789');await page.locator('#pd-options').waitFor();
 assert.equal(reads.length,1,'The early product request is adopted, not repeated');
 assert.equal(await page.evaluate(()=>window.earlySupplierProduct),null,'supplierApi consumed the early response');
 const main=await page.locator('#pd-main-image').getAttribute('src');
 assert.ok(images.indexOf(main)===0,'The main image is requested first, before scripts render it');
 // The inline resize rule must match supplierImageUrl() so the prefetched image is reused.
 const samples=['https://img.alicdn.com/imgextra/i2/1/O1CN01a_!!0-item_pic.jpg','https://gd3.alicdn.com/bao/uploaded/i4/x.png','https://img.alicdn.com/imgextra/i1/a.jpg_400x400.jpg','https://img.alicdn.com/imgextra/i1/a.jpg?x=1','https://example.com/a.jpg','http://img.alicdn.com/imgextra/a.jpg','not a url'];
 assert.ok(await page.evaluate(s=>s.every(u=>window.earlySupplierImageUrl(u)===supplierImageUrl(u,800)),samples),'Inline and shared image rules agree');
 // A cached product skips the early request entirely.
 reads.length=0;await page.reload();await page.locator('#pd-options').waitFor();
 assert.equal(reads.length,0,'Cached product makes no API request');assert.equal(await page.evaluate(()=>window.earlySupplierProduct),undefined);
 // Other routes never start a product request.
 reads.length=0;await page.goto(base+'/');await page.locator('.supplier-card').first().waitFor();assert.equal(reads.length,0);
 assert.deepEqual(errors,[]);
 console.log('PASS early product load: single adopted request, main image first, matching resize rule, cache skip, home untouched.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
