const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('gostore-warehouse-reminded-v1','1'));
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.route('**/api/index.php?action=supplier-search*',r=>{const q=new URL(r.request().url()).searchParams.get('q');calls.push(q);return r.fulfill({json:{products:[{id:'tb-7777777',name:'Fishing '+q,image:'',mnt:20000,cny:10}],shipping:{},page:1,more:false,stale:false,cache_ttl:600}});});
 await page.goto(base+'/');
 await page.locator('[data-discovery-tab=fishing]').click();await page.locator('.discovery-results .discovery-product').waitFor();assert.equal(calls.at(-1),'fishing tackle');assert.equal(await page.locator('.discovery-subcategory-links a').count(),11);assert.ok((await page.locator('.discovery-results').innerText()).includes('20,000'));
 await page.locator('[data-discovery-category=fishing][data-discovery-query="fishing tackle"]').click();await page.waitForFunction(()=>location.pathname==='/c/fishing');assert.equal(await page.locator('[data-catalog-category=fishing]').getAttribute('aria-pressed'),'true');
 await page.reload();await page.waitForFunction(()=>document.querySelector('[data-catalog-category=fishing]')?.getAttribute('aria-pressed')==='true');assert.equal(calls.at(-1),'fishing tackle');
 await page.goto(base+'/');
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.locator('[data-discovery-tab=fishing]').click();await page.locator('.discovery-results .discovery-product').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.discovery-subcategory-links [data-discovery-query="fishing reel"]').click();await page.waitForFunction(()=>location.pathname==='/c/fishing/fishing-reel');await page.waitForFunction(()=>document.querySelector('.supplier-card h3')?.textContent==='Fishing fishing reel');assert.ok(calls.includes('fishing reel'));await page.goBack();await page.waitForFunction(()=>!document.documentElement.classList.contains('listing-view'));}
 await page.locator('[data-mobile-tab=categories]').click();await page.locator('[data-department=fishing]').click();assert.equal(await page.locator('.category-suggestion-heading h3').innerText(),'Загасчлалын хэрэгсэл');assert.equal(await page.locator('#category-suggestions [data-menu-query]').count(),11);
 await page.goto(base+'/');
 await page.locator('[data-discovery-tab=building]').click();
 await page.locator('.discovery-results .discovery-product').waitFor();
 assert.equal(calls.at(-1),'building materials');
 await page.getByRole('link',{name:'PVC хоолойн булан',exact:true}).click();
 await page.waitForURL('**/c/building/pvc-pipe-elbows');
 await page.getByRole('heading',{name:'PVC хоолойн булан',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.supplier-card h3')?.textContent==='Fishing pvc pipe elbows');
 assert.equal(calls.at(-1),'pvc pipe elbows');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS discovery: fishing and building tabs, subcategory queries and routes, price, reload, 320/390px, category picker.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
