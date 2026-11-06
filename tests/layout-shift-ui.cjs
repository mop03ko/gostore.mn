const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Content filled in after first paint (hub, 11.11 banner and section, discovery, store/account pages)
// must not push visible content down: cumulative layout shift stays near zero at desktop and phone
// widths, both during the 11.11 campaign and after it.
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const assets=['backpack','headphones','chair','watch','sneakers','lamp','skincare'],expires=Math.floor(Date.parse('2026-11-30T00:00:00Z')/1000);
 const list={products:Array.from({length:24},(_,i)=>({id:'tb-'+(123456789+i),name:'Item '+i,image:'https://img.alicdn.com/'+i+'.jpg',mnt:15500+i*100,cny:30,price_status:'available',price_expires:expires,card_discount:i%2?{current_mnt:15500+i*100,was_mnt:31000,percent:50,expires}:null})),shipping:{cny_rate:550},fetched:new Date().toISOString(),more:false,stale:false,cache_ttl:600};
 for(const [day,campaign] of [['2026-11-07T12:00:00+08:00',true],['2026-11-15T12:00:00+08:00',false]])for(const [width,height] of [[1440,900],[1024,800],[390,844],[320,700]])for(const route of ['/','/?q=headphones','/help','/cart','/account','/official-stores']){
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
 console.log('PASS layout shift: home, search, help, cart, account and official stores stay below 0.02 CLS at 1440/1024/390/320 px during and after 11.11; sale section placement and campaign class.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
