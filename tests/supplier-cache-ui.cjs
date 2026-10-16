const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage(),calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 await page.route('**/api/index.php?action=supplier-search*',async r=>{
   const b=({...Object.fromEntries(new URL(r.request().url()).searchParams),page:Number(new URL(r.request().url()).searchParams.get('page'))});calls.push(b);
   if(b.q==='error')return r.fulfill({status:503,json:{error:'Unavailable'}});
   return r.fulfill({json:{products:[{id:'tb-123456789',name:b.q+' '+b.page+' '+b.sort,image:'https://img.alicdn.com/test.jpg',mnt:5500,cny:10}],page:b.page,more:b.page===1,shipping:{cny_rate:550},stale:b.q==='stale',cache_ttl:b.q==='short'?1:21600,fetched:new Date().toISOString(),csrf:'must-not-persist',customer:{email:'must-not-persist'}}});
 });
 await page.goto(base+'/?filter=saved');await page.evaluate(()=>window.catalogReady);
 const query={q:'bag',page:1,sort:'default'};
 const get=q=>page.evaluate(p=>supplierApi('supplier-search',p),q);
 await page.evaluate(async p=>{const [a,b]=await Promise.all([supplierApi('supplier-search',p),supplierApi('supplier-search',p)]);a.products[0].name='mutated';if(b.products[0].name==='mutated')throw Error('Shared mutable data');},query);
 assert.equal(calls.length,1,'Concurrent identical searches share one request');
 assert.equal((await get(query)).products[0].name,'bag 1 default');assert.equal(calls.length,1,'Warm request uses memory');
 const saved=await page.evaluate(()=>sessionStorage.getItem('gostore-supplier-cache-v3-taobao'));assert.ok(!saved.includes('must-not-persist'),'No CSRF/customer fields persisted');
 await get({...query,page:2});await get({...query,sort:'price'});await get({...query,q:'shoes'});assert.equal(calls.length,4,'Query/page/sort are independent keys');
 await page.goto(base+'/');await page.locator('.supplier-card').waitFor();assert.equal(calls.length,4,'Navigation restores cached search');
 await page.locator('[data-supplier-page="2"]').click();await page.waitForFunction(()=>document.querySelector('#supplier-status').textContent.startsWith('2-'));assert.equal(calls.length,4,'Visited next page needs no request');
 await page.reload();await page.waitForFunction(()=>document.querySelector('#supplier-status').textContent.startsWith('2-'));assert.equal(calls.length,4,'Reload restores page two from cache');
 for(let i=0;i<2;i++){await get({...query,q:'error'}).then(()=>assert.fail('Expected error'),()=>{});await get({...query,q:'stale'});}
 assert.equal(calls.filter(x=>x.q==='error').length,2,'Errors are not cached');assert.equal(calls.filter(x=>x.q==='stale').length,2,'Stale responses are not cached as fresh');
 await get({...query,q:'short'});await page.evaluate(()=>{window.cacheTestNow=Date.now;Date.now=()=>cacheTestNow()+2000;});await get({...query,q:'short'});assert.equal(calls.filter(x=>x.q==='short').length,2,'Server freshness caps browser lifetime');
 await page.evaluate(()=>{Date.now=()=>cacheTestNow()+601000;});await get(query);assert.equal(calls.filter(x=>x.q==='bag'&&x.page===1&&x.sort==='default').length,2,'Search expires after ten minutes');await page.evaluate(()=>{Date.now=cacheTestNow;});
 for(let i=0;i<43;i++)await get({...query,q:'limit'+i});
 assert.ok(await page.evaluate(()=>{const s=sessionStorage.getItem('gostore-supplier-cache-v3-taobao');return JSON.parse(s).length<=40&&s.length*2<=1500000;}),'Cache is bounded');
 await page.evaluate(()=>sessionStorage.setItem('gostore-supplier-cache-v3-taobao','broken-json'));await page.goto(base+'/?filter=saved');await get(query);assert.equal((await get(query)).products.length,1,'Corrupt storage recovers');
 await page.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===sessionStorage)throw new DOMException('Full','QuotaExceededError');return set.call(this,k,v);};});
 await page.evaluate(()=>sessionStorage.removeItem('gostore-supplier-cache-v3-taobao'));await page.goto(base+'/?filter=saved');const before=calls.length;await get(query);await get(query);assert.equal(calls.length,before+1,'Storage disabled still supports memory caching');
 // Use a separate page without the storage fault for real product data and slow bootstrap.
 const detail=await browser.newPage();await detail.route('https://img.alicdn.com/**',r=>r.abort());let productCalls=0;detail.on('request',r=>{if(r.url().includes('action=supplier-product'))productCalls++;});
 await detail.goto(base+'/v/123456789');await detail.locator('#pd-options').waitFor();assert.equal(productCalls,1);
 let releaseCatalog;const gate=new Promise(r=>releaseCatalog=r);await detail.route('**/api/index.php?action=catalog',async r=>{await gate;await r.continue();});
 await detail.reload({waitUntil:'domcontentloaded'});await detail.locator('#pd-options').waitFor();assert.equal(productCalls,1,'Product revisit needs no detail API call');assert.equal(await detail.evaluate(()=>storeServer.ready),false,'Cached product paints before slow catalog/session bootstrap');releaseCatalog();await detail.evaluate(()=>window.catalogReady);await detail.unroute('**/api/index.php?action=catalog');
 await detail.evaluate(()=>{const original=Date.now;Date.now=()=>original()+301000;});await detail.evaluate(()=>supplierApi('supplier-product',{id:'abb-123456789'}));assert.equal(productCalls,2,'Detail expires after five minutes');
 // A new visitor with no browser cache also reads shared server data before login bootstrap.
 const fresh=await browser.newPage();let releaseFresh;const freshGate=new Promise(r=>releaseFresh=r);await fresh.route('**/api/index.php?action=catalog',async r=>{await freshGate;await r.continue();});
 await fresh.goto(base+'/v/123456789',{waitUntil:'domcontentloaded'});await fresh.locator('#pd-options').waitFor();assert.equal(await fresh.evaluate(()=>storeServer.ready),false,'First visit no longer waits for session/bootstrap');releaseFresh();await fresh.evaluate(()=>window.catalogReady);
 assert.deepEqual(errors,[]);console.log('PASS: concurrent dedup, navigation/reload/page cache hits, query isolation, TTL and server expiry, stale/error exclusion, field whitelist, bounded/corrupt/disabled storage, product paints before bootstrap. Warm search/detail navigation: 0 repeat supplier API calls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
