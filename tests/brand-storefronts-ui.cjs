const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),{seed,vendors}=require('./brand-fixture.cjs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);seed();
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('action=supplier-search'))requests.push(new URL(r.url()).searchParams);});
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 const ready=()=>page.waitForFunction(()=>document.querySelectorAll('.supplier-card').length===50&&!document.querySelector('#supplier-grid').hasAttribute('aria-busy'));
 await page.goto(base+'/');await page.locator('#brands .brand-card').first().waitFor();
 for(const width of [1920,1440,1024,760,390,320]){
  await page.setViewportSize({width,height:1000});
  const layout=await page.locator('#brands .brand-grid').evaluate(grid=>({count:grid.children.length,rows:new Set([...grid.children].map(c=>Math.round(c.getBoundingClientRect().top))).size,fits:grid.scrollWidth<=grid.clientWidth,logos:[...grid.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)}));
  assert.equal(layout.count,12);assert.ok(layout.fits,'All brands fit without horizontal scrolling at '+width);if(width>=1024)assert.equal(layout.rows,2,'Exactly two desktop rows');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.waitForFunction(()=>[...document.querySelectorAll('#brands img')].every(i=>i.complete&&i.naturalWidth>0));
  if([1440,390].includes(width))await page.locator('#brands').screenshot({path:'tmp/twelve-brands-'+width+'.png'});
 }
 for(const [index,[id,[name]]] of Object.entries(vendors).entries()){
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/');const card=page.locator('#brands [data-brand='+id+']');assert.equal(await card.getAttribute('href'),'/brands/'+id);await card.click();await ready();
  assert.equal(new URL(page.url()).pathname,'/brands/'+id);assert.equal(await page.title(),name+' — Брэндийн дэлгүүр | GOStore');assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://gostore.mn/brands/'+id);assert.equal(await page.locator('.storefront-store-identity strong').innerText(),name);assert.equal(await page.locator('.storefront-logo-tile img').getAttribute('src'),'/assets/brands/'+id+'.svg');assert.equal(requests.at(-1).get('brand'),id);assert.equal(await page.locator('#main h1:visible').count(),1);
  const titles=await page.locator('.supplier-card h3').allTextContents();assert.ok(titles.every(s=>s.toLowerCase().startsWith(name.toLowerCase())),id+': '+JSON.stringify(titles));assert.ok(!/taobao|tmall/i.test(await page.locator('body').innerText()));
  await page.waitForFunction(()=>[...document.querySelectorAll('#brand-storefront img')].every(i=>i.complete&&i.naturalWidth>0));
  if(['hm','thenorthface'].includes(id))await page.screenshot({path:'tmp/storefront-'+id+'-desktop.png'});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' mobile overflow at '+width);assert.ok(await page.locator('#storefront-title').evaluate(e=>e.scrollWidth<=e.clientWidth),id+' clipped hero text');}
  if(['newbalance','lego','ikea'].includes(id)){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/storefront-'+id+'-mobile.png'});}
  await page.locator('.supplier-photo').nth(index).click();await page.locator('.pd-brand-store a').waitFor();assert.equal(await page.locator('.pd-brand-store a').getAttribute('href'),'/brands/'+id);await page.locator('.pd-brand-store a').click();await ready();
 }
 await page.goto(base+'/brands/ikea/?brand=nike&category=bags&filter=saved');await ready();assert.equal(await page.locator('#catalog-title').innerText(),'IKEA бараанууд');assert.equal(new URL(page.url()).search,'');
 await page.locator('.storefront-catalog-tabs [data-storefront-sort="-updated_time"]').click();await ready();assert.equal(requests.at(-1).get('brand'),'ikea');assert.equal(requests.at(-1).get('sort'),'-updated_time');
 await page.locator('[data-supplier-more]').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('.supplier-card').length===100);await page.evaluate(()=>scrollTo(0,0));await page.reload();await ready();assert.equal(new URL(page.url()).searchParams.get('page'),null);
 await page.locator('#supplier-search [name=price_min]').fill('5500');await page.locator('.price-apply').click();await ready();assert.equal(requests.at(-1).get('brand'),'ikea');assert.equal(requests.at(-1).get('price_min'),'5500');assert.equal(requests.at(-1).get('page'),'1');await page.locator('#supplier-reset').click();await ready();assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('#catalog-title').innerText(),'IKEA бараанууд');
 for(const id of ['apple','samsung','unknown'])assert.equal((await page.request.get(base+'/brands/'+id)).status(),404);
 // A failed supplier response leaves the correct storefront visible and supports retry.
 await page.evaluate(()=>sessionStorage.clear());await page.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({status:503,json:{error:'Түр хүлээгээд дахин оролдоно уу.'}}));await page.goto(base+'/brands/sony');await page.locator('#supplier-paging button').waitFor();assert.equal(await page.locator('.storefront-store-identity strong').innerText(),'Sony');assert.equal(await page.locator('.supplier-card').count(),0);await page.unroute('**/api/index.php?action=supplier-search*');await page.locator('#supplier-paging button').click();await ready();
 assert.equal(page.context().pages().length,1);assert.deepEqual(errors,[]);console.log('PASS: all 12 storefront home links, exact brand API, metadata/logos/products/detail return, 1440/390/320px layout, IKEA sort/page/price/reset/reload scope, unknown 404, Sony error/retry, no JS errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
