const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-02T05:00:00Z'));
 const expires=Date.parse('2026-11-02T05:05:00Z')/1000;
 const p={id:'tb-123456',name:'Жишиг бараа',image:'',mnt:10000,sellable:true,offers:{expires,promotions:[]},card_discount:{expires,current_mnt:10000,was_mnt:20000,percent:50}};
 let calls=0,mode='offers';
 await page.route('**/api/index.php?action=supplier-deals*',r=>{calls++;return mode==='error'?r.fulfill({status:503,json:{error:'unavailable'}}):mode==='many'?r.fulfill({json:{products:Array.from({length:14},(_,i)=>({...p,id:'tb-2000'+(10+i)})),more:false}}):r.fulfill({json:{products:mode==='empty'?[]:[p,p,{...p,id:'tb-123457',card_discount:null,offers:{expires,coupon_mnt:8000,coupon_base_mnt:10000,coupon_percent:20,promotions:[{name:'Coupon conditions'}]}},{...p,id:'tb-123458',offers:{expires:1},card_discount:{...p.card_discount,expires:1}},{...p,id:'tb-123459',sellable:false},{...p,id:'tb-123460',card_discount:null,offers:{expires,promotions:[]}}],more:false}});});
 await page.goto(base+'/');await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.locator('.eleven-sale-card').first().waitFor();
 assert.equal(await page.locator('.eleven-sale-card').count(),1,'Deduplicates and excludes coupon, promotion-only, expired, unavailable and regular-price items');
 assert.equal(await page.locator('.eleven-sale-card').first().getAttribute('href'),'/v/tb-123456');assert.match(await page.locator('#eleven-sale').innerText(),/−50%/);assert.equal(await page.locator('.eleven-sale-card').first().locator('.supplier-discount-badge').innerText(),'−50%');assert.doesNotMatch(await page.locator('#eleven-sale').innerText(),/купон/i,'No coupon wording');assert.doesNotMatch(await page.locator('.hero-banner').innerText(),/купон/i,'Hero has no coupon wording');
 for(const width of [320,390,760,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+width);}
 await page.locator('#eleven-sale').screenshot({path:'tmp/eleven-sale-desktop.png'});
 await page.setViewportSize({width:390,height:1000});await page.locator('#eleven-sale').screenshot({path:'tmp/eleven-sale-mobile.png'});
 await page.reload();await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.locator('.eleven-sale-card').first().waitFor();assert.equal(calls,1,'Reuses recent results on return visit');
 await page.evaluate(()=>sessionStorage.clear());mode='empty';await page.reload();await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.getByText('Одоогоор хүчинтэй хямдралын мэдээлэл олдсонгүй.',{exact:false}).waitFor();assert.equal(await page.locator('.eleven-sale-card').count(),0);
 await page.evaluate(()=>sessionStorage.clear());mode='error';await page.reload();await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.locator('.eleven-sale-retry').waitFor();mode='offers';await page.locator('.eleven-sale-retry').click();await page.locator('.eleven-sale-card').first().waitFor();
 // Twelve cards on the home page: six a row on wide screens, four on tablets, two rows of two (first eight) on phones.
 await page.evaluate(()=>sessionStorage.clear());mode='many';await page.setViewportSize({width:1440,height:1000});await page.reload();await page.locator('#eleven-sale').scrollIntoViewIfNeeded();await page.locator('.eleven-sale-card').first().waitFor();
 assert.equal(await page.locator('.eleven-sale-card').count(),12,'Two rows of six');
 const perRow=()=>page.locator('.eleven-sale-card:visible').evaluateAll(cards=>{const top=cards[0].getBoundingClientRect().top;return [cards.filter(c=>Math.abs(c.getBoundingClientRect().top-top)<2).length,cards.length];});
 assert.deepEqual(await perRow(),[6,12],'Six a row at 1440');await page.locator('#eleven-sale').screenshot({path:'tmp/eleven-sale-six.png'});
 await page.setViewportSize({width:1024,height:1000});assert.deepEqual(await perRow(),[4,12],'Four a row at 1024');
 await page.setViewportSize({width:390,height:1000});assert.deepEqual(await perRow(),[2,8],'Two a row, eight cards on phones');
 for(const width of [320,1100,1280]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+width);}
 mode='offers';await page.setViewportSize({width:1440,height:1000});
 await page.clock.setFixedTime(new Date('2026-11-12T00:00:00+08:00'));const before=calls;await page.reload();assert.equal(await page.locator('#eleven-sale').isVisible(),false,'Automatically ends after Nov 11 Ulaanbaatar time');assert.equal(await page.locator('#eleven-sale').innerHTML(),'','The placeholder stays empty after the campaign');assert.equal(calls,before);
 await page.clock.setFixedTime(new Date('2026-11-02T05:00:00Z'));await page.goto(base+'/cart');assert.equal(await page.locator('#eleven-sale').isVisible(),false,'Homepage only');assert.equal(await page.locator('#eleven-sale').innerHTML(),'');
 assert.deepEqual(errors,[]);console.log('PASS 11.11 homepage: real price cuts only, no coupons, expiry, cache reuse, retry, six/four/two cards a row, mobile and desktop.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
