const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Add-to-cart flyout, full cart page (quantity, save for later, compare, remove, clear, summary) and help page.
const cache=path.join(process.env.GOSTORE_DATA_DIR,'supplier-cache');assert.ok(path.resolve(cache).startsWith(path.resolve('tmp')+path.sep));fs.mkdirSync(cache,{recursive:true});
const product=(id,cny)=>({Item:{Id:id,ProviderType:'Taobao',Title:'Бараа '+id,MainPictureUrl:'https://img.alicdn.com/'+id+'.jpg',VendorId:'s'+id,IsSellAllowed:true,Price:{OriginalPrice:cny,OriginalCurrencyCode:'CNY'},FirstLotQuantity:1,NextLotQuantity:1,Attributes:[{Pid:'c',Vid:'a',PropertyName:'Өнгө',Value:'Хар'},...[38,39,40,41,42,43,44,45].map(n=>({PropertyName:'Хэмжээ',Value:String(n)})),...Array.from({length:12},(_,i)=>({PropertyName:'Үзүүлэлт '+(i+1),Value:'Утга '+(i+1)}))],ConfiguredItems:[{Id:'a',Quantity:9,Configurators:[{Pid:'c',Vid:'a'}],Price:{OriginalPrice:cny,OriginalCurrencyCode:'CNY'}}]}});
for(const [id,cny] of [['711111111',10],['722222222',30]])fs.writeFileSync(path.join(cache,crypto.createHash('sha256').update('/v1/taobao/product/'+id+'?language=mn').digest('hex')+'.json'),JSON.stringify({data:product(id,cny),fetched:new Date().toISOString(),expires:Math.floor(Date.now()/1000)+3600,stale:false}));
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 await page.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({json:{products:[],page:1,more:false,total:0,pages:1,fetched:new Date().toISOString(),stale:false,cache_ttl:0,shipping:{cny_rate:550}}}));
 await require('./customer-ui-helper.cjs')(page,base);
 const open=async id=>{await page.goto(base+'/v/tb-'+id);await page.locator('#pd-options').waitFor();await page.waitForFunction(()=>storeServer.ready);};
 await open('711111111');assert.equal(await page.locator('.float-help').count(),1,'Floating help on product pages');
 // Variant attributes are merged into one row each; only the first 10 rows show before «Бүх үзүүлэлт».
 const specRows=await page.locator('#pd-specifications > dl.pd-spec-list > div').allInnerTexts();assert.equal(specRows.length,10);assert.ok(specRows[1].includes('38, 39, 40, 41, 42, 43, 44, 45'),specRows[1]);
 assert.equal(await page.locator('.pd-more-specs dl > div').count(),4);assert.ok((await page.locator('.pd-more-specs summary').innerText()).includes('+4'));
 await page.locator('[data-pd-add]').click();await page.locator('#cart-flyout.visible').waitFor();
 assert.ok((await page.locator('#cart-flyout').innerText()).includes('Сагсанд нэмэгдлээ'));
 await page.locator('#pd-options [name=variant]').first().waitFor();await page.locator('[data-pd-delta="1"]').click();assert.equal(await page.locator('#pd-qty').inputValue(),'2','Flyout does not block the page');
 await page.locator('[data-flyout-close]').click();await page.waitForFunction(()=>!document.querySelector('#cart-flyout').classList.contains('visible'));
 await open('722222222');await page.locator('[data-pd-add]').click();await page.locator('#cart-flyout a[href="/cart"]').click();await page.waitForURL(u=>u.pathname==='/cart');
 await page.locator('.store-cart-line').first().waitFor();assert.equal(await page.locator('.store-cart-line').count(),2);
 assert.equal(await page.locator('#catalog').isVisible(),false,'Catalog hidden on the cart page');
 let summary=await page.locator('.store-cart-summary').innerText();assert.ok(summary.includes('Одоо төлөх · урьдчилсан')&&summary.includes('22,000'),summary);
 await page.locator('[data-cart-qty="0"][data-delta="1"]').click();await page.waitForFunction(()=>document.querySelector('.store-cart-summary').textContent.includes('27,500'));
 await page.locator('.store-cart-line [data-compare-toggle]').first().click();await page.waitForFunction(()=>document.querySelector('[data-compare-open] .count')?.textContent==='1');
 await page.locator('[data-cart-save="1"]').click();await page.waitForFunction(()=>document.querySelectorAll('.store-cart-line').length===1);
 assert.equal(await page.locator('#favorite-count').innerText(),'1','Saved for later moves the item to favorites');assert.equal(await page.locator('#cart-count').innerText(),'1');
 // The modal cart links to the full page; checkout from the page uses the same priced flow.
 await page.locator('.header-actions [data-action=cart]').click();await page.locator('#modal a[href="/cart"]').waitFor();await page.locator('#close-modal').click();
 await page.locator('.store-cart-checkout').click();await page.locator('#taobao-checkout-form').waitFor();assert.ok((await page.locator('.checkout-totals').innerText()).includes('Одоо төлөх'));await page.locator('#close-modal').click();
 page.once('dialog',d=>d.accept());await page.locator('[data-cart-clear]').click();await page.locator('#store-page .account-empty').waitFor();assert.equal(await page.locator('#cart-count').innerText(),'0');
 // Help page: header link, FAQ search, delivery section with live tariff, no floating button on itself.
 await page.goto(base+'/');await page.locator('.service-strip [data-action=help]').click();await page.waitForURL(u=>u.pathname==='/help');
 await page.locator('.store-faq details').first().waitFor();assert.equal(await page.locator('.store-faq details').count(),9);assert.equal(await page.locator('.float-help').count(),0);
 await page.locator('#help-search').fill('карго');await page.waitForFunction(()=>[...document.querySelectorAll('.store-faq details')].filter(d=>!d.hidden).length>=1&&[...document.querySelectorAll('.store-faq details')].some(d=>d.hidden));
 assert.ok(await page.locator('.store-faq details:not([hidden])').first().getAttribute('open')!==null,'Matching answers open');
 await page.locator('#help-search').fill('zzzz');await page.locator('#help-empty').waitFor();
 assert.ok((await page.locator('#delivery .store-tariff').innerText()).includes('кг тутам'));assert.equal(await page.locator('#delivery .store-route li').count(),4);
 await page.goto(base+'/help#delivery');await page.waitForFunction(()=>document.querySelector('#delivery').getBoundingClientRect().top<innerHeight);
 for(const url of ['/cart','/help']){await page.setViewportSize({width:390,height:844});await page.goto(base+url);await page.locator('#store-page h1').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile fit '+url);await page.screenshot({path:'tmp/store-page'+url.replace('/','-')+'-390.png',fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS store pages: non-blocking add-to-cart flyout, cart page quantity/summary/compare/save for later/checkout/clear, modal link, help FAQ search, delivery tariff and anchor, floating help, mobile.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
