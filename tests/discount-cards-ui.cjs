const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const expiry=Math.floor(Date.now()/1000)+3600,p={id:'tb-123456789',name:'Verified discount product',image:'https://img.alicdn.com/card-test.jpg',sellable:true,mnt:15500,approx_mnt:15500,price_status:'available',price_expires:expiry,sold_count:3000,card_discount:{current_mnt:15500,was_mnt:31000,percent:50,expires:expiry}};
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 await page.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({json:{products:[p],more:false,shipping:{cny_rate:550},cache_ttl:60}}));
 await page.goto(base+'/?q=bag');await page.locator('#supplier-grid .supplier-card').waitFor();
 const rows=[p,{...p,id:'tb-123456790',card_discount:null,offers:{expires:expiry,coupon_mnt:1000}},{...p,id:'tb-123456791',card_discount:{...p.card_discount,expires:1}},{...p,id:'tb-123456792',card_discount:{...p.card_discount,current_mnt:1}},{...p,id:'tb-123456793',sellable:false},{...p,id:'tb-123456794',card_discount:null,approx_mnt:0,mnt:0}];
 await page.evaluate(rows=>renderSupplierCards(rows),rows);
 const cards=page.locator('#supplier-grid .supplier-card'),first=cards.first();assert.equal(await first.locator('.supplier-discount-badge').innerText(),'−50%');assert.equal(await first.locator('.supplier-discount-badge').getAttribute('aria-label'),'50% хямдрал');assert.equal(await first.locator('.supplier-hot').count(),0);assert.equal(await first.locator('del').innerText(),'31,000 ₮');
 for(let i=1;i<rows.length;i++)assert.equal(await cards.nth(i).locator('.supplier-discount-badge').count(),0,'Unconfirmed/expired/mismatched/coupon-only card '+i);
 fs.mkdirSync('output/discount-cards',{recursive:true});
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await first.evaluate(e=>e.scrollWidth<=e.clientWidth));const badge=await first.locator('.supplier-discount-badge').boundingBox(),favorite=await first.locator('.favorite-button').first().boundingBox();assert.ok(badge.x+badge.width<=favorite.x,'Badge leaves favorite control clear');if(width===390)await first.screenshot({path:'output/discount-cards/mobile.png'});}
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await first.screenshot({path:'output/discount-cards/dark.png'});
 // Recommendations reuse this renderer and must retain the exact same price validation.
 await page.evaluate(p=>{const grid=document.createElement('div');grid.id='discount-recommend-test';document.body.append(grid);renderSupplierCards([p],false,grid);},p);assert.equal(await page.locator('#discount-recommend-test .supplier-discount-badge').innerText(),'−50%');
 await page.evaluate(p=>{document.querySelector('#discount-recommend-test').remove();renderSupplierCards([{...p,card_discount:{...p.card_discount,expires:Date.now()/1000+.7}}]);},p);await first.locator('.supplier-discount-badge').waitFor();await first.locator('.supplier-discount-badge').waitFor({state:'detached'});assert.equal(await first.locator('.supplier-discount').count(),0,'Expired original price removed too');assert.equal(await first.locator('.supplier-card-price strong').innerText(),'15,500 ₮');
 assert.deepEqual(errors,[]);console.log('PASS discount cards: visible percentage and original price, no coupon-only/expired/mismatched badges, HOT priority, expiry removal, recommendations and 320–1440px controls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
