const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Account page: menu sections, orders by stage, ordered products, address book, profile and checkout address pick.
const cache=path.join(process.env.GOSTORE_DATA_DIR,'supplier-cache');assert.ok(path.resolve(cache).startsWith(path.resolve('tmp')+path.sep));fs.mkdirSync(cache,{recursive:true});
const item={Id:'611111111',ProviderType:'Taobao',Title:'Аяллын цүнх',MainPictureUrl:'https://img.alicdn.com/bag.jpg',VendorId:'shop',IsSellAllowed:true,Price:{OriginalPrice:20,OriginalCurrencyCode:'CNY'},FirstLotQuantity:1,NextLotQuantity:1,Attributes:[{Pid:'c',Vid:'black',PropertyName:'Өнгө',Value:'Хар'}],ConfiguredItems:[{Id:'black',Quantity:9,Configurators:[{Pid:'c',Vid:'black'}],Price:{OriginalPrice:20,OriginalCurrencyCode:'CNY'}}]};
fs.writeFileSync(path.join(cache,crypto.createHash('sha256').update('/v1/taobao/product/611111111?language=mn').digest('hex')+'.json'),JSON.stringify({data:{Item:item},fetched:new Date().toISOString(),expires:Math.floor(Date.now()/1000)+3600,stale:false}));
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 await page.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({json:{products:[],page:1,more:false,total:0,pages:1,fetched:new Date().toISOString(),stale:false,cache_ttl:0,shipping:{cny_rate:550}}}));
 // Guests see a sign-in prompt instead of private data.
 await page.goto(base+'/account');await page.locator('#account-page .account-empty').waitFor();assert.ok((await page.locator('#account-page').innerText()).includes('Нэвтэрч орно уу'));
 const customer=await require('./customer-ui-helper.cjs')(page,base);
 // One real checkout order for the orders and products sections.
 const session=await (await page.request.get(base+'/api/index.php?action=catalog')).json(),headers={'X-CSRF-Token':session.csrf};
 const items=[{id:'tb-611111111',sku:'black',qty:2}],quote=(await (await page.request.post(base+'/api/index.php?action=checkout-quote',{headers,data:{items}})).json()).quote;
 const created=await page.request.post(base+'/api/index.php?action=order-create',{headers,data:{type:'checkout',title:'Taobao сагс',items,expected_total:quote.total,token:crypto.randomBytes(32).toString('hex'),family_name:'Тест',customer:'Хэрэглэгч',phone:'99112233',fulfillment:'pickup'}});assert.equal(created.status(),201);
 const orderId=(await created.json()).order.id;
 await page.goto(base+'/account');await page.locator('.account-menu').waitFor();
 assert.equal(await page.locator('.header-actions [data-account-label]').innerText(),customer.name.split(' ')[0],'Header shows the customer name');
 await page.locator('.account-tabs-row').waitFor();
 assert.ok((await page.locator('.account-stats').innerText()).replace(/\s+/g,' ').includes('1 Захиалга 1 Төлбөр хүлээж буй'));
 assert.equal(await page.locator('[data-account-filter=payment] span').innerText(),'1');assert.equal(await page.locator('[data-account-filter=done] span').innerText(),'0');
 await page.locator('[data-account-filter=done]').click();assert.ok((await page.locator('.account-orders').innerText()).includes('Тохирох захиалга алга'));
 await page.locator('[data-account-filter=payment]').click();assert.ok((await page.locator('.account-order').innerText()).includes(orderId));
 await page.locator('#account-order-search').fill('GS-NOPE');assert.equal(await page.locator('.account-order').count(),0);await page.locator('#account-order-search').fill('');
 await page.locator('.account-order [data-server-order]').click();await page.locator('.cargo-detail').waitFor();await page.locator('#close-modal').click();
 await page.locator('[data-account-section=products]').click();await page.waitForURL(u=>u.pathname==='/account/products');await page.locator('.account-product').waitFor();
 assert.ok((await page.locator('.account-product').innerText()).includes('Аяллын цүнх'));assert.equal(await page.locator('.account-product a.button').getAttribute('href'),'/v/tb-611111111');
 // Address book: add, second address as default, edit, delete.
 await page.locator('[data-account-section=addresses]').click();await page.locator('[data-address-new]').click();
 await page.locator('#account-address-form [name=label]').fill('Гэр');await page.locator('#account-address-form [name=address]').fill('БЗД 1-р хороо, 5 байр');await page.locator('#account-address-form [type=submit]').click();
 await page.locator('.account-address').waitFor();assert.ok((await page.locator('.account-address.default').innerText()).includes('Үндсэн'),'First address is default');
 await page.locator('[data-address-new]').click();await page.locator('#account-address-form [name=label]').fill('Ажил');await page.locator('#account-address-form [name=address]').fill('СБД 8-р хороо');await page.locator('#account-address-form [type=submit]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.account-address').length===2);
 await page.locator('.account-address:has-text("Ажил") [data-address-default]').click();await page.waitForFunction(()=>document.querySelector('.account-address.default')?.textContent.includes('Ажил'));
 await page.locator('.account-address:has-text("Гэр") [data-address-edit]').click();await page.locator('#account-address-form [name=address]').fill('БЗД 2-р хороо');await page.locator('#account-address-form [type=submit]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.account-address')].some(a=>a.textContent.includes('БЗД 2-р хороо')));
 page.once('dialog',d=>d.accept());await page.locator('.account-address:has-text("Гэр") [data-address-delete]').click();await page.waitForFunction(()=>document.querySelectorAll('.account-address').length===1);
 // Profile save keeps the email read-only.
 await page.locator('[data-account-section=profile]').click();await page.locator('#account-profile-form').waitFor();
 // A slow orders reply must not replace the section chosen while it was loading.
 await page.locator('[data-account-section=orders]').click();let release;const held=new Promise(r=>release=r);await page.route('**/api/index.php?action=customer-orders*',async r=>{await held;await r.continue();});await page.reload();await page.locator('.account-menu').waitFor();await page.locator('[data-account-section=profile]').click();await page.locator('#account-profile-form').waitFor();release();await page.waitForResponse(r=>r.url().includes('action=customer-orders')).catch(()=>{});await page.waitForTimeout(300);assert.equal(await page.locator('#account-profile-form').count(),1,'Late orders reply keeps the profile view');await page.unroute('**/api/index.php?action=customer-orders*');
 assert.equal(await page.locator('#account-profile-form [disabled]').inputValue(),customer.email);
 await page.locator('#account-profile-form [name=name]').fill('Шинэ Нэр');await page.locator('#account-profile-form [type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('.account-summary h3').textContent==='Шинэ Нэр');
 await page.reload();await page.locator('#account-profile-form').waitFor();assert.equal(await page.locator('#account-profile-form [name=name]').inputValue(),'Шинэ Нэр','Deep link opens the section');
 await page.locator('[data-account-section=saved]').click();await page.locator('.account-empty').waitFor();
 await page.locator('[data-account-section=notifications]').click();await page.locator('#account-content h2').waitFor();
 await page.goBack();await page.waitForURL(u=>u.pathname==='/account/saved');
 // Checkout offers the saved default address for delivery.
 await page.goto(base+'/v/tb-611111111');await page.locator('#pd-options').waitFor();await page.locator('[data-pd-submit]').click();await page.locator('#taobao-checkout-form').waitFor();
 await page.locator('#taobao-checkout-form [name=fulfillment][value=delivery]').check();await page.locator('[data-address-pick]').waitFor();
 assert.equal(await page.locator('#taobao-checkout-form [name=address]').inputValue(),'СБД 8-р хороо','Default address prefilled');await page.locator('#close-modal').click();
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/account');await page.locator('.account-menu').waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Account page fits mobile');await page.screenshot({path:'tmp/account-390.png',fullPage:true});
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'tmp/account-1280.png'});
 await page.locator('.account-menu [data-customer-logout]').click();await page.locator('#account-page .account-empty').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS account: guest prompt, header name, stats and order stage tabs/search/detail, ordered products, address book (default/edit/delete), profile, deep links/back, checkout address pick, mobile, logout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
