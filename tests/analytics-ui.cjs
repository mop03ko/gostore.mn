const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// GTM, gtag.js and Meta Pixel load only after the page's load event; calls made earlier stay queued
// for them, and GTM receives its gtm.js start event. Tag hosts are intercepted, never contacted.
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),tags=[];
 await page.route(/googletagmanager\.com|connect\.facebook\.net/,r=>{tags.push({url:r.request().url(),at:Date.now()});return r.fulfill({contentType:'application/javascript',body:''});});
 await page.route('**/api/index.php?action=supplier-*',r=>r.fulfill({json:{products:[],shipping:{},more:false,stale:false,cache_ttl:600}}));
 await page.goto(base+'/',{waitUntil:'load'});const loaded=Date.now();
 assert.equal(tags.length,0,'No tag script before the load event');
 const queued=await page.evaluate(()=>({gtm:dataLayer.some(e=>e&&e.event==='gtm.js'&&e['gtm.start']>0),config:dataLayer.some(e=>e&&e[0]==='config'&&e[1]==='G-WLC1E39628'),pixel:(fbq.queue||[]).map(a=>[...a].slice(0,2).join(':'))}));
 assert.ok(queued.gtm&&queued.config,'GTM start event and GA config are queued');assert.deepEqual(queued.pixel,['init:1649469149899328','track:PageView']);
 await page.waitForFunction(n=>performance.getEntriesByType('resource').filter(r=>/googletagmanager|facebook/.test(r.name)).length>=n,3,{timeout:5000});
 assert.deepEqual(tags.map(t=>new URL(t.url).pathname).sort(),['/en_US/fbevents.js','/gtag/js','/gtm.js']);
 assert.ok(tags.every(t=>t.at-loaded>=1000),'Tag scripts wait about 1.2 s after load');
 console.log('PASS analytics: GTM, gtag.js and Meta Pixel load after the page, with gtm.js, GA config and PageView queued.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
