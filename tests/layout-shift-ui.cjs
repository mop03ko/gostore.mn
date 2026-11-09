const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Content filled in after first paint (hub, 11.11 banner and section, discovery, store/account pages)
// must not push visible content down: cumulative layout shift stays near zero at desktop and phone
// widths, both during the 11.11 campaign and after it.
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const assets=['backpack','headphones','chair','watch','sneakers','lamp','skincare'],expires=Math.floor(Date.parse('2026-11-30T00:00:00Z')/1000);
 const list={products:Array.from({length:24},(_,i)=>({id:'tb-'+(123456789+i),name:'Item '+i,image:'https://img.alicdn.com/'+i+'.jpg',mnt:15500+i*100,cny:30,price_status:'available',price_expires:expires,card_discount:i%2?{current_mnt:15500+i*100,was_mnt:31000,percent:50,expires}:null})),shipping:{cny_rate:550},fetched:new Date().toISOString(),more:false,stale:false,cache_ttl:600};
 for(const [day,campaign] of [['2026-11-07T12:00:00+08:00',true],['2026-11-15T12:00:00+08:00',false]])for(const [width,height] of [[1440,900],[1024,800],[390,844],[320,700]])for(const route of ['/','/?q=headphones','/c/tech','/search?q=red%20lamp','/help','/cart','/account','/official-stores']){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date(day));
  await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/'+assets[(Number(new URL(r.request().url()).pathname.slice(1).split('.')[0])||0)%7]+'.jpg',contentType:'image/jpeg'}));
  // Slow catalog replies make late content arrive well after first paint.
  await page.route('**/api/index.php?action=supplier-*',async r=>{await new Promise(res=>setTimeout(res,400));await r.fulfill({json:list});});
  await page.addInitScript(()=>{window.__cls=[];new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls.push(e.value);}).observe({type:'layout-shift',buffered:true});});
  await page.goto(base+route,{waitUntil:'load'});await page.waitForTimeout(2000);
  const cls=await page.evaluate(()=>window.__cls.reduce((a,b)=>a+b,0));
  assert.ok(cls<0.02,`Layout shift ${cls.toFixed(3)} on ${route} at ${width}px (${campaign?'11.11':'after 11.11'})`);
  if(route==='/'){
   assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('eleven-active')),campaign,'Campaign class follows the Ulaanbaatar date');
   assert.equal(await page.locator('#eleven-sale').isVisible(),campaign,'Sale section only during the campaign');
   if(campaign)assert.ok(await page.evaluate(()=>{const s=document.getElementById('eleven-sale'),d=document.querySelector('.discovery-home');return !d||!!(s.compareDocumentPosition(d)&Node.DOCUMENT_POSITION_FOLLOWING);}),'Discovery stays below the sale section');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 // Catalog pages when the app script arrives well after first paint (slow phone or network): the subcategory row,
 // reset button and breadcrumb it adds must not push visible content down. Without the waiting rule in styles.css
 // these pages measure 0.02–0.06; before, the main loop above only caught it when the script happened to be late.
 for(const [width,height] of [[1440,900],[390,844],[320,700]])for(const route of ['/c/tech','/c/tech/headphones','/search?q=red%20lamp','/search?q=headphones','/?q=headphones','/products']){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-15T12:00:00+08:00'));
  await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/'+assets[(Number(new URL(r.request().url()).pathname.slice(1).split('.')[0])||0)%7]+'.jpg',contentType:'image/jpeg'}));
  await page.route('**/api/index.php?action=supplier-*',async r=>{await new Promise(res=>setTimeout(res,400));await r.fulfill({json:list});});
  await page.route(/\/app\.js(\?|$)/,async r=>{await new Promise(res=>setTimeout(res,600));await r.continue();});
  await page.addInitScript(()=>{window.__cls=[];new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls.push(e.value);}).observe({type:'layout-shift',buffered:true});});
  await page.goto(base+route,{waitUntil:'load'});await page.waitForTimeout(2500);
  const cls=await page.evaluate(()=>window.__cls.reduce((a,b)=>a+b,0));
  assert.ok(cls<0.02,`Layout shift ${cls.toFixed(3)} on ${route} at ${width}px with a late app script`);
  assert.ok(await page.locator('#supplier-status').isVisible()&&await page.locator('#supplier-grid .supplier-card').first().isVisible(),'Catalog shows once drawn: '+route);
  assert.deepEqual(errors,[]);await page.close();
 }
 // If the app script never runs, the waiting catalog part shows again after 2 s instead of staying blank.
 {const page=await browser.newPage({viewport:{width:390,height:844}});await page.route(/\/app\.js(\?|$)/,r=>r.abort());
  await page.goto(base+'/c/tech',{waitUntil:'load'});assert.equal(await page.locator('#supplier-status').evaluate(e=>getComputedStyle(e).visibility),'hidden','Waiting while the script may still come');
  await page.waitForTimeout(2300);assert.equal(await page.locator('#supplier-status').evaluate(e=>getComputedStyle(e).visibility),'visible','Shown again without the script');await page.close();}
 console.log('PASS layout shift: home, search, help, cart, account and official stores stay below 0.02 CLS at 1440/1024/390/320 px during and after 11.11; sale section placement and campaign class; catalog pages with a late app script (category, subcategory, search, legacy and all-products routes) and the 2 s fallback without it.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
