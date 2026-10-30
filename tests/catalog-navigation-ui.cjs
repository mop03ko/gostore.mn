const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1692,height:950},reducedMotion:'reduce'}),calls=[],requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://img.alicdn.com/**',r=>r.abort());
 await page.route('**/api/index.php?action=supplier-search*',r=>{const params=new URL(r.request().url()).searchParams,q=params.get('q');calls.push(q);requests.push(Object.fromEntries(params));return r.fulfill({json:{products:[{id:'tb-123456789',name:q,image:'',mnt:5500}],shipping:{cny_rate:550},more:q==='nike'&&params.get('page')==='1',stale:false,cache_ttl:600}});});
 await page.goto(base+'/');await page.locator('.supplier-card').waitFor();
 const nav=page.locator('#catalog-category-nav'),row=page.locator('.catalog-category-list'),active=nav.locator('[aria-pressed=true]');
 assert.equal(await row.locator('button').count(),26);assert.equal(await active.innerText(),'Бүгд');assert.equal(calls[0],'__all__');assert.equal(calls.length,1,'Rendering categories adds no API calls');
 await nav.locator('[data-catalog-scroll="1"]').click();assert.ok(await row.evaluate(e=>e.scrollLeft)>0);assert.equal(calls.length,1,'Scrolling adds no API calls');
 await row.locator('button').first().focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.catalogCategory),'health');assert.ok(await row.evaluate(e=>e.scrollLeft)>100);
 await row.locator('[data-catalog-category=men]').click();await page.waitForFunction(()=>document.querySelector('.supplier-card h3')?.textContent==='men clothing');assert.equal(await active.innerText(),'Эрэгтэй хувцас');assert.equal(calls.at(-1),'men clothing');assert.equal(new URL(page.url()).searchParams.get('category'),'men');
 await page.reload();await page.locator('.supplier-card').waitFor();assert.equal(await active.innerText(),'Эрэгтэй хувцас','Reload preserves category selection');
 await row.locator('[data-catalog-category=bags]').click();await page.waitForFunction(()=>document.querySelector('.supplier-card h3')?.textContent==='bag');assert.equal(await active.innerText(),'Цүнх, үүргэвч');await page.reload();await page.locator('.supplier-card').waitFor();assert.equal(await active.innerText(),'Цүнх, үүргэвч','Default query does not lose explicit bag category');
 await row.locator('[data-catalog-category=all]').click();assert.equal(await active.innerText(),'Бүгд');assert.equal(new URL(page.url()).searchParams.has('category'),false);
 await page.evaluate(()=>document.querySelector('.catalog-category-list').scrollLeft=0);await nav.screenshot({path:'tmp/catalog-navigation-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
 await row.evaluate(e=>e.scrollLeft=300);assert.ok(await row.evaluate(e=>e.scrollLeft)>0);await row.locator('[data-catalog-category=women]').click();assert.equal(await active.innerText(),'Эмэгтэй хувцас');assert.ok((await row.locator('button').first().boundingBox()).height>=44);await nav.screenshot({path:'tmp/catalog-navigation-mobile.png'});
 await page.evaluate(()=>window.supplierBrowse(null,true));assert.equal(await active.count(),0,'Saved view does not claim an active catalog category');
 // Brand cards remain internal and use an explicit brand query parameter.
 const brands=page.locator('#brands'),expected=['nike','adidas','puma','newbalance','uniqlo','zara','hm','thenorthface','sony','xiaomi','lego','ikea'];
 assert.deepEqual(await brands.locator('[data-brand]').evaluateAll(links=>links.map(a=>a.dataset.brand)),expected);
 for(const id of expected){const link=brands.locator('[data-brand='+id+']');assert.equal(await link.getAttribute('href'),'/brands/'+id);assert.equal(await link.getAttribute('target'),null);}
 await page.waitForFunction(()=>[...document.querySelectorAll('.brand-logo img')].every(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await brands.locator('[data-brand=apple],[data-brand=samsung]').count(),0);
 assert.ok(!/taobao/i.test(await brands.innerText()));
 await page.setViewportSize({width:1440,height:1000});assert.equal(await brands.locator('.brand-grid').evaluate(e=>getComputedStyle(e).display),'grid');assert.ok(await brands.evaluate(e=>e.previousElementSibling?.id==='home-hub'&&e.parentElement.firstElementChild.id==='home-hub'),'Brands follow the marketplace first screen');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await brands.locator('.brand-grid').evaluate(e=>e.scrollWidth<=e.clientWidth),'Mobile brand grid fits the viewport');for(const id of expected){await brands.locator('[data-brand='+id+']').scrollIntoViewIfNeeded();assert.ok(await brands.locator('[data-brand='+id+']').isVisible());}
 assert.deepEqual(errors,[]);console.log('PASS: category navigation, URL/reload, mobile overflow; 12 loaded logos, internal brand links, accessible responsive grid after the marketplace first screen.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
