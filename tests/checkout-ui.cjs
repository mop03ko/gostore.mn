const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Cart → instant checkout against cached synthetic Taobao products; QPay stays disabled.
const cache=path.join(process.env.GOSTORE_DATA_DIR,'supplier-cache');assert.ok(path.resolve(cache).startsWith(path.resolve('tmp')+path.sep));fs.mkdirSync(cache,{recursive:true});
const product=(id,vendor,variants)=>({Item:{Id:id,ProviderType:'Taobao',Title:'Бараа '+id,MainPictureUrl:'https://img.alicdn.com/'+id+'.jpg',VendorId:vendor,IsSellAllowed:true,Price:{OriginalPrice:10,OriginalCurrencyCode:'CNY'},FirstLotQuantity:1,NextLotQuantity:1,Attributes:variants.map(([v])=>({Pid:'c',Vid:v,PropertyName:'Өнгө',Value:v})),ConfiguredItems:variants.map(([v,cny])=>({Id:v,Quantity:20,Configurators:[{Pid:'c',Vid:v}],Price:{OriginalPrice:cny,OriginalCurrencyCode:'CNY'}}))}});
function cached(key,data){fs.writeFileSync(path.join(cache,crypto.createHash('sha256').update(key).digest('hex')+'.json'),JSON.stringify({data,fetched:new Date().toISOString(),expires:Math.floor(Date.now()/1000)+3600,stale:false}));}
cached('/v1/taobao/product/511111111?language=mn',product('511111111','shop-a',[['red',10],['blue',12]]));
cached('/v1/taobao/product/522222222?language=mn',product('522222222','shop-b',[['one',30]]));
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await require('./customer-ui-helper.cjs')(page,base);
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 const open=async id=>{await page.goto(base+'/v/tb-'+id);await page.locator('#pd-options').waitFor();await page.waitForFunction(()=>storeServer.ready);};
 await open('511111111');await page.locator('[data-pd-add]').click();
 await page.locator('#pd-options [name=variant]').selectOption('blue');await page.locator('[data-pd-delta="1"]').click();await page.locator('[data-pd-add]').click();
 await open('522222222');await page.locator('[data-pd-add]').click();
 assert.equal(await page.locator('#cart-count').innerText(),'3','Header counts cart lines');
 await page.locator('.header-actions [data-action=cart]').click();await page.locator('.cart-row').first().waitFor();
 assert.equal(await page.locator('.cart-row').count(),3);
 await page.locator('[data-tb-qty="0"][data-delta="1"]').click();await page.waitForFunction(()=>document.querySelector('.cart-row .quantity-controls span').textContent==='2');
 await page.locator('[data-tb-remove="2"]').click();await page.waitForFunction(()=>document.querySelectorAll('.cart-row').length===2);
 await open('522222222');await page.locator('[data-pd-add]').click();
 await page.locator('.header-actions [data-action=cart]').click();await page.locator('[data-tb-checkout]').click();await page.locator('#taobao-checkout-form').waitFor();
 // Goods 2×10 + 2×12 + 30 = 74 CNY = 40,700₮ (shown only in MNT); two sellers; domestic shipping is billed at cost on arrival by default.
 const totals=await page.locator('.checkout-totals').innerText();assert.ok(totals.includes('40,700')&&!totals.includes('¥')&&totals.includes('2 дэлгүүр')&&totals.includes('УБ-д ирэхэд бодит дүнгээр'),totals);
 assert.ok(await page.locator('#taobao-checkout-form [data-action=cart]').isVisible(),'Cart checkout can return to the cart');
 assert.equal(await page.locator('#taobao-checkout-form [name=address]').isVisible(),false,'Pickup is the default');
 for(const box of [await page.locator('.fulfillment-choice input').first().boundingBox(),await page.locator('.fulfillment-choice label').first().boundingBox()])assert.ok(box);const radio=await page.locator('.fulfillment-choice input').first().boundingBox(),label=await page.locator('.fulfillment-choice label').first().boundingBox();assert.ok(radio.width<=24&&radio.x-label.x<30,'Radio keeps native size at the start of its label');await page.locator('.fulfillment-choice').screenshot({path:'tmp/checkout-fulfillment.png'});
 await page.locator('#taobao-checkout-form [name=fulfillment][value=delivery]').check();assert.ok(await page.locator('#taobao-checkout-form [name=address]').isVisible()&&await page.locator('#taobao-checkout-form [name=address]').evaluate(e=>e.required),'Delivery requires an address');assert.equal(await page.locator('#taobao-checkout-form [data-pickup-info]').isVisible(),false);
 await page.locator('#taobao-checkout-form [name=fulfillment][value=pickup]').check();assert.ok((await page.locator('#taobao-checkout-form .pickup-info').innerText()).includes('14б байр, 4 тоот'),'Pickup address shown at checkout');
 await page.locator('#taobao-checkout-form [name=family_name]').fill('Тест');
 const created=page.waitForResponse(r=>r.url().includes('action=order-create'));await page.locator('#taobao-checkout-form [type=submit]').click();
 const response=await created,order=(await response.json()).order;assert.equal(response.status(),201);
 assert.equal(order.type,'checkout');assert.equal(order.fulfillment_request.method,'pickup');assert.equal(order.delivery_address,'');assert.equal(order.status,'quoted');assert.equal(order.items.length,3);assert.equal(order.quote.breakdown.cargo_mnt,0);assert.ok(order.amount>0&&order.payment_due);
 await page.waitForFunction(()=>document.querySelector('#cart-count').textContent==='0');
 assert.ok((await page.locator('.cargo-card').innerText()).includes('Төлбөр хүлээж байна'));await page.locator('.cargo-card [data-server-order]').first().click();await page.locator('.cargo-detail').waitFor();assert.ok((await page.locator('.cargo-detail').innerText()).includes('Төлөх хугацаа'));assert.equal(await page.locator('.cargo-items li').count(),3);assert.ok((await page.locator('.cargo-detail').innerText()).includes('Шуудангийн код: 14252-0024'),'Order shows the pickup address');
 assert.ok((await page.locator('#modal').innerText()).includes('Улаанбаатарт ирэхэд бодит жингээр'),'Cargo is billed later');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#modal').evaluate(e=>e.scrollWidth<=e.clientWidth));
 assert.deepEqual(errors,[]);console.log('PASS checkout: product add/buy-now buttons, cart lines/quantity/remove, seller-based domestic fee, upfront total, order with cargo later, 24 h due date, cart cleared, mobile modal.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
