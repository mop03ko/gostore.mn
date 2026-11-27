const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('gostore-warehouse-reminded-v1','1'));
 await page.route('**/api/index.php?action=promo-popup*',r=>r.fulfill({json:{popup:null}}));
 const expiry=Math.floor(Date.now()/1000)+3600,p={id:'tb-123456789',name:'Verified discount product',image:'https://img.alicdn.com/card-test.jpg',sellable:true,mnt:15500,approx_mnt:15500,price_status:'available',price_expires:expiry,sold_count:3000,card_discount:{current_mnt:15500,was_mnt:31000,percent:50,expires:expiry}};
 // Older cached responses may still carry coupon fields; they must never show.
 const coupon={...p,id:'tb-123456790',card_discount:null,offers:{expires:expiry,promotions:[],coupon_mnt:12400,coupon_base_mnt:15500,coupon_percent:20}};
 const promotion={...p,id:'tb-123456780',card_discount:null,offers:{expires:expiry,promotions:[{name:'2-оос дээш авахад 10% хямд'}]}};
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 await page.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({json:{products:[p,coupon],more:false,shipping:{cny_rate:550},cache_ttl:60}}));
 await page.goto(base+'/?q=bag');await page.locator('#supplier-grid .supplier-card').first().waitFor();
 const rows=[{...p,offers:coupon.offers},coupon,{...p,id:'tb-123456791',card_discount:{...p.card_discount,expires:1}},{...p,id:'tb-123456792',card_discount:{...p.card_discount,current_mnt:1}},{...p,id:'tb-123456793',sellable:false},{...p,id:'tb-123456794',approx_mnt:0,mnt:0},{...p,id:'tb-123456799',price_status:'unavailable'},{...p,id:'tb-123456797',price_status:'unverified',mnt:null,approx_mnt:12999}];
 await page.evaluate(rows=>renderSupplierCards(rows),rows);
 const cards=page.locator('#supplier-grid .supplier-card'),first=cards.first(),second=cards.nth(1);
 assert.equal(await first.locator('.supplier-discount-badge').innerText(),'−50%','A real sale shows its own percentage, never a coupon');assert.equal(await first.locator('.supplier-hot').count(),0);assert.equal(await first.locator('del').innerText(),'31,000 ₮');
 assert.equal(await second.locator('.supplier-discount-badge').count(),0,'Coupon-only product has no badge');assert.equal(await second.locator('del').count(),0);assert.doesNotMatch(await second.innerText(),/Купон|12,400/i,'No coupon text or coupon price');assert.equal(await second.locator('.supplier-card-price strong').innerText(),'15,500 ₮');
 for(let i=2;i<rows.length;i++)assert.equal(await cards.nth(i).locator('.supplier-discount-badge').count(),0,'No invalid/expired/mismatched/unavailable badge '+i);
 assert.equal(await cards.last().locator('.supplier-card-price strong').innerText(),'≈ 12,999 ₮','An estimate is visibly distinct from a verified price');
 fs.mkdirSync('output/discount-cards',{recursive:true});
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await first.evaluate(e=>e.scrollWidth<=e.clientWidth));const badge=await first.locator('.supplier-discount-badge').boundingBox(),favorite=await first.locator('.favorite-button').first().boundingBox();assert.ok(badge.x+badge.width<=favorite.x,'Badge leaves favorite control clear');if(width===390)await first.screenshot({path:'output/discount-cards/sale-mobile.png'});}
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await first.screenshot({path:'output/discount-cards/sale-dark.png'});
 await page.evaluate(rows=>{const grid=document.createElement('div');grid.id='discount-recommend-test';document.body.append(grid);renderSupplierCards(rows,false,grid);},[p,coupon]);assert.equal(await page.locator('#discount-recommend-test .supplier-discount-badge').count(),1);
 await page.evaluate(p=>{document.querySelector('#discount-recommend-test').remove();renderSupplierCards([{...p,card_discount:{...p.card_discount,expires:Date.now()/1000+.7}}]);},p);await first.locator('.supplier-discount-badge').waitFor();await first.locator('.supplier-discount-badge').waitFor({state:'detached'});assert.equal(await first.locator('.supplier-discount').count(),0);
 await page.evaluate(p=>renderSupplierCards([{...p,card_discount:{...p.card_discount,was_mnt:15510,percent:0}}]),p);assert.match(await first.locator('.supplier-discount-badge').innerText(),/<1%/,'Small genuine savings must not become zero or disappear');
 // Named promotions still render on recommendation cards.
 await page.evaluate(product=>{const grid=document.createElement('div');grid.id='promotion-test';document.body.append(grid);renderSupplierCards([product],false,grid);},promotion);
 assert.equal(await page.locator('#promotion-test .supplier-promotion').innerText(),'Урамшуулалтай · нөхцөлтэй');
 // A category tab can contain the same product as the home grid and duplicate IDs in its own response.
 await page.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({json:{products:[p,p,coupon,coupon],more:false,shipping:{cny_rate:550}}}));
 // The Deals tab links to the verified catalog without duplicating it or fetching the same page twice.
 let dealRequests=0;
 await page.route('**/api/index.php?action=supplier-deals*',r=>{dealRequests++;return r.fulfill({json:{products:[p,coupon,promotion],more:false}});});
 await page.goto(base+'/');await page.locator('#supplier-grid .supplier-card').first().waitFor();
 await page.locator('[data-discovery-tab="fashion"]').click();
 const fashion=page.locator('.discovery-panel .discovery-product');
 await fashion.first().waitFor();
 assert.deepEqual(await fashion.evaluateAll(links=>links.map(a=>a.getAttribute('href'))),['/v/'+coupon.id]);
 await page.locator('[data-discovery-tab="deals"]').click();
 const dealsLink=page.locator('.discovery-panel a[href="#catalog"]');
 await dealsLink.waitFor();
 assert.equal(await page.locator('.discovery-panel .discovery-product').count(),0);
 await dealsLink.click();
 assert.equal(new URL(page.url()).hash,'#catalog');
 assert.equal(dealRequests,1);
 assert.equal(await page.locator('#supplier-grid .supplier-discount-badge').innerText(),'−50%');
 assert.deepEqual(errors,[]);console.log('PASS discount cards: real sales only, coupon fields ignored, expiry, unavailable data, recommendations, sub-1%, named promotions and 320–1440px controls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
