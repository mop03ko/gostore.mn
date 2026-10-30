const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const cases=require('./product-policy-cases.json'),base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://www.googletagmanager.com/**',r=>r.abort());
 const safe={id:'tb-123456789',name:'Cooking pot',image:'',sku:'one',variant:'Standard',qty:1,min_qty:1,step:1,cny:10};
 const knife={...safe,id:'tb-123456788',name:'Kitchen knife'};
 await page.addInitScript(({safe,knife})=>{
  window.IntersectionObserver=undefined;
  for(const key of ['gostore-taobao-favorites-v1','gostore-taobao-cart-v1','gostore-compare-v1'])localStorage.setItem(key,JSON.stringify([safe,knife]));
  localStorage.setItem('gostore-recent-searches-v1',JSON.stringify(['knife','pot']));
  sessionStorage.setItem('gostore-supplier-cache-v4-taobao',JSON.stringify([{key:'supplier-search:'+JSON.stringify([['limit',50],['page',1],['q','__all__'],['sort','default']]),expires:Date.now()+600000,data:{products:[knife],stale:false}}]));
 },{safe,knife});
 await page.route('**/api/index.php?action=supplier-search*',r=>{calls.push(r.request().url());return r.fulfill({json:{products:[safe,knife],shipping:{cny_rate:550},more:false,stale:false,cache_ttl:600}});});
 await page.goto(base+'/');await page.locator('.supplier-card').waitFor();
 for(const [group,texts] of Object.entries(cases))for(const text of texts)assert.equal(await page.evaluate(t=>window.productPolicyBlocked(t),text),group==='blocked',text);
 assert.equal(await page.evaluate(()=>window.productPolicyBlocked({id:'tb-820391759756',name:'Renamed item'})),true);
 assert.equal(await page.locator('.supplier-card').count(),1);assert.ok(calls.some(u=>u.includes('taoworld-catalog1')),'Fresh cache namespace');
 assert.equal(await page.evaluate(()=>JSON.stringify(categories).includes('kitchen knife')),false);
 assert.equal(await page.evaluate(()=>window.taobaoCart.items().length),1);
 await page.evaluate(()=>window.supplierBrowse(null,true));assert.equal(await page.locator('.supplier-card').count(),1);
 assert.doesNotMatch(await page.locator('#supplier-grid').innerText(),/knife/i);
 await page.goto(base+'/cart');await page.locator('.store-cart-line').first().waitFor();assert.doesNotMatch(await page.locator('main').innerText(),/knife/i);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS: category removal, multilingual browser policy, old cache invalidation, favorites/cart filtering, mobile layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
