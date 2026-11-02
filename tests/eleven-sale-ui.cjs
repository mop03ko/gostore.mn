const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-02T05:00:00Z'));
 const expires=Date.parse('2026-11-02T05:05:00Z')/1000;
 const p={id:'tb-123456',name:'Жишиг бараа',image:'',mnt:10000,sellable:true,offers:{expires,promotions:[]},card_discount:{expires,current_mnt:10000,was_mnt:20000,percent:50}};
 let calls=0,mode='offers';
 await page.route('**/api/index.php?action=supplier-deals*',r=>{calls++;return mode==='error'?r.fulfill({status:503,json:{error:'unavailable'}}):r.fulfill({json:{products:mode==='empty'?[]:[p,p,{...p,id:'tb-123457',card_discount:null,offers:{expires,coupon_mnt:8000,promotions:[{name:'Coupon conditions'}]}},{...p,id:'tb-123458',offers:{expires:1},card_discount:{...p.card_discount,expires:1}},{...p,id:'tb-123459',sellable:false},{...p,id:'tb-123460',card_discount:null,offers:{expires,promotions:[]}}],more:false}});});
 await page.goto(base+'/');await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.locator('.eleven-sale-card').first().waitFor();
 assert.equal(await page.locator('.eleven-sale-card').count(),2,'Deduplicates and excludes expired, unavailable and regular-price items');
 assert.equal(await page.locator('.eleven-sale-card').first().getAttribute('href'),'/v/tb-123456');assert.match(await page.locator('#eleven-sale').innerText(),/−50%/);assert.match(await page.locator('#eleven-sale').innerText(),/Купонтой ≈.*нөхцөлтэй/);
 for(const width of [320,390,760,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+width);}
 await page.locator('#eleven-sale').screenshot({path:'tmp/eleven-sale-desktop.png'});
 await page.setViewportSize({width:390,height:1000});await page.locator('#eleven-sale').screenshot({path:'tmp/eleven-sale-mobile.png'});
 await page.reload();await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.locator('.eleven-sale-card').first().waitFor();assert.equal(calls,1,'Reuses recent results on return visit');
 await page.evaluate(()=>sessionStorage.clear());mode='empty';await page.reload();await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.getByText('Одоогоор хүчинтэй хямдралын мэдээлэл олдсонгүй.',{exact:false}).waitFor();assert.equal(await page.locator('.eleven-sale-card').count(),0);
 await page.evaluate(()=>sessionStorage.clear());mode='error';await page.reload();await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.locator('.eleven-sale-retry').waitFor();mode='offers';await page.locator('.eleven-sale-retry').click();await page.locator('.eleven-sale-card').first().waitFor();
 await page.clock.setFixedTime(new Date('2026-11-12T00:00:00+08:00'));const before=calls;await page.reload();assert.equal(await page.locator('#eleven-sale').count(),0,'Automatically ends after Nov 11 Ulaanbaatar time');assert.equal(calls,before);
 await page.clock.setFixedTime(new Date('2026-11-02T05:00:00Z'));await page.goto(base+'/cart');assert.equal(await page.locator('#eleven-sale').count(),0,'Homepage only');
 assert.deepEqual(errors,[]);console.log('PASS 11.11 homepage: valid offers, conditional coupons, expiry, cache reuse, retry, mobile and desktop.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
