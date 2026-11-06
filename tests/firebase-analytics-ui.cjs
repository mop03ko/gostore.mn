const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage();await page.addInitScript(()=>{window.__GOSTORE_FIREBASE_TEST__=true;});const imports=[];
 await page.route(/googletagmanager\.com|connect\.facebook\.net/,r=>r.fulfill({contentType:'application/javascript',body:''}));
 await page.route('**/api/index.php?action=supplier-*',r=>r.fulfill({json:{products:[],shipping:{},more:false}}));
 await page.route('https://www.gstatic.com/firebasejs/13.2.0/*',r=>{imports.push(Date.now());return r.fulfill({contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:r.request().url().endsWith('firebase-app.js')?'export const getApps=()=>[];export const initializeApp=(config,name)=>({config,name});':'export const isSupported=async()=>true;export const initializeAnalytics=(app,options)=>{window.firebaseTest={app,options,events:[]};return app;};export const logEvent=(a,event,data)=>window.firebaseTest.events.push({event,data});'});});
 await page.goto(base+'/?private_test=do-not-collect',{waitUntil:'load'});const loaded=Date.now();assert.equal(imports.length,0);
 assert.equal(await page.evaluate(()=>window.gostoreFirebaseReady),true);
 let result=await page.evaluate(()=>window.firebaseTest);assert.equal(result.app.config.measurementId,'G-44TMZT4X1E');assert.equal(result.options.config.send_page_view,false);assert.equal(result.events.length,1);assert.equal(result.events[0].event,'page_view');assert.equal(result.events[0].data.page_location,base+'/');assert.ok(imports.every(t=>t-loaded>=1000));
 await page.addScriptTag({url:base+'/firebase-web.js'});assert.equal((await page.evaluate(()=>window.firebaseTest)).events.length,1);
 await page.route('https://www.gstatic.com/firebasejs/13.2.0/*',r=>r.abort());await page.reload({waitUntil:'load'});assert.equal(await page.evaluate(()=>window.gostoreFirebaseReady),false);assert.ok(await page.locator('body').isVisible());
 console.log('PASS Firebase Analytics: deferred, exact stream, single page view, query omitted, duplicate-load guard and SDK failure isolation.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
