const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const releases=[];try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.IntersectionObserver=undefined;});
 const gates=new Map();for(const q of ['cold','stale','navigate','save-partial']){let release;const promise=new Promise(r=>release=r);gates.set(q,{promise,release});releases.push(release);}
 let failCompletion=true;
 await page.route('**/api/index.php?action=supplier-search*',async route=>{
   const b=Object.fromEntries(new URL(route.request().url()).searchParams);calls.push(b);const q=b.q,n=Number(b.page),preview=b.preview==='1',refresh=b.refresh==='1';
   if(['cold','save-partial'].includes(q)&&!preview&&n===1)await gates.get(q).promise;
   if(['stale','navigate'].includes(q)&&refresh)await gates.get(q).promise;
   if(q==='fail'&&!preview&&failCompletion){failCompletion=false;return route.fulfill({status:502,json:{error:'Completion failed'}});}
   if(q==='refresh-error'&&refresh)return route.fulfill({status:502,json:{error:'Refresh failed'}});
   const stale=['stale','navigate','refresh-error'].includes(q)&&!refresh;
   const count=q==='short'?3:preview?20:50,products=Array.from({length:count},(_,i)=>({id:'tb-'+(900000000+(n-1)*50+i),name:q+(refresh?' updated':'')+' '+i,image:'',approx_mnt:refresh?12000:11000,price_status:'unverified'}));
   await route.fulfill({json:{products,page:n,partial:preview&&count===20,more:!preview&&q!=='short'&&n<2,total:null,stale,revalidate:stale,cache_ttl:stale?0:600,cache_expires:Math.floor(Date.now()/1000)+(stale?0:600),shipping:{cny_rate:550,weight_step_kg:.5,weight_step_mnt:1500,volume_threshold:1,volume_small_cny:599,volume_large_cny:399}}});
 });
 const count=n=>page.waitForFunction(n=>document.querySelectorAll('.supplier-card').length===n,n);
 const done=()=>page.waitForFunction(()=>!document.querySelector('#supplier-grid').hasAttribute('aria-busy'));
 await page.goto(base+'/?q=cold');await count(20);assert.equal(await page.locator('[data-supplier-more]').count(),0,'No next page until completion');assert.ok(await page.locator('#supplier-search button').first().isEnabled());await page.evaluate(()=>window.first=document.querySelector('.supplier-card'));
 gates.get('cold').release();await count(50);await done();assert.ok(await page.evaluate(()=>first===document.querySelector('.supplier-card')),'Completion should append without replacing the first 20');
 assert.equal(calls.filter(b=>b.q==='cold').length,2);await page.locator('[data-supplier-more]').click();await count(100);await done();assert.equal(calls.at(-1).page,'2');assert.equal(calls.at(-1).preview,undefined);assert.equal(await page.locator('.supplier-card').evaluateAll(nodes=>new Set(nodes.map(n=>n.querySelector('a').href)).size),100);
 const before=calls.length;await page.evaluate(()=>supplierBrowse('cold'));await count(50);await done();assert.equal(calls.length,before,'Full browser cache bypasses preview and completion reads');
 await page.evaluate(()=>supplierBrowse('short'));await count(3);await done();assert.equal(calls.filter(b=>b.q==='short').length,1,'Short preview needs no second request');
 await page.evaluate(()=>supplierBrowse('fail'));await count(20);await page.locator('[data-supplier-retry="1"]').waitFor();await page.evaluate(()=>window.first=document.querySelector('.supplier-card'));await page.locator('[data-supplier-retry="1"]').click();await count(50);await done();assert.ok(await page.evaluate(()=>first===document.querySelector('.supplier-card')));assert.equal(calls.filter(b=>b.q==='fail'&&b.preview==='1').length,1,'Retry resumes completion without repeating preview');
 await page.evaluate(()=>supplierBrowse('save-partial'));await count(20);await page.locator('[data-supplier-favorite]').first().click();await page.evaluate(()=>supplierBrowse(null,true));await count(1);gates.get('save-partial').release();await page.waitForTimeout(100);assert.equal(await page.locator('.supplier-card').count(),1,'Late completion cannot overwrite saved items');await page.evaluate(()=>supplierBrowse('save-partial'));await count(50);await done();
 await page.evaluate(()=>supplierBrowse('stale'));await count(50);await page.waitForFunction(()=>document.querySelector('#supplier-paging').textContent.includes('шинэчилж'));assert.match(await page.locator('#supplier-status').innerText(),/Хадгалсан мэдээлэл/);assert.ok(await page.locator('#supplier-search button').first().isEnabled());
 assert.ok(await page.evaluate(()=>!JSON.parse(sessionStorage.getItem('gostore-supplier-cache-v6-taoworld')||'[]').some(e=>e.data.stale||e.data.partial)),'Stale and partial data must not enter the fresh browser cache');
 gates.get('stale').release();await done();assert.match(await page.locator('.supplier-card h3').first().innerText(),/updated/);assert.match(await page.locator('.supplier-card-price').first().innerText(),/12,000/);assert.doesNotMatch(await page.locator('#supplier-status').innerText(),/Хадгалсан мэдээлэл/);
 const updated=await page.evaluate(()=>supplierApi('supplier-search',{q:'stale',page:1,limit:50,sort:'default'}));assert.equal(updated.stale,false);assert.match(updated.products[0].name,/updated/);
 await page.evaluate(()=>supplierBrowse('refresh-error'));await count(50);await done();assert.match(await page.locator('#supplier-status').innerText(),/Шинэчилж чадсангүй/);assert.equal(calls.filter(b=>b.q==='refresh-error'&&b.refresh==='1').length,1,'No unbounded failure loop');
 const refreshing=page.waitForRequest(r=>r.url().includes('q=navigate')&&r.url().includes('refresh=1'));await page.evaluate(()=>supplierBrowse('navigate'));await count(50);await refreshing;
 await page.evaluate(()=>supplierBrowse('replacement'));await count(50);await done();gates.get('navigate').release();await page.waitForTimeout(100);assert.ok((await page.locator('.supplier-card h3').allTextContents()).every(s=>s.startsWith('replacement')),'Late revalidation cannot overwrite a new search');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS progressive browser: first 20 before blocked completion, 50/100 offsets, DOM preservation, full-cache reuse, short stop, partial failure/retry, stale-while-refresh, changed prices, cache isolation, failed-refresh retention, navigation guard and mobile fit.');
}finally{releases.forEach(r=>r());await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
