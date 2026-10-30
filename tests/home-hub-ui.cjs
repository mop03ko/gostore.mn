const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Marketplace first screen (category rows + flyout, popular searches, customer panel, phone
// category grid, five-tab bar) and the shop-grouped cart with per-line selection.
const line=(n,vendor,shop,cny)=>({id:'tb-'+(700000+n),sku:'s'+n,qty:1,name:'Бараа '+n,image:'',variant:'Хар',cny,min_qty:1,step:1,stock:20,vendor_id:vendor,vendor_name:shop});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/index.php?action=supplier-search*',r=>{calls.push(new URL(r.request().url()).searchParams.get('q'));return r.fulfill({json:{products:[],shipping:{},fetched:new Date().toISOString(),more:false,stale:false,cache_ttl:600}});});
 await page.goto(base+'/');await page.locator('#hub-cats li').first().waitFor();
 assert.equal(await page.locator('#hub-cats [data-hub-category]').count(),25,'Every department has a row link');
 assert.equal(await page.locator('#hub-channels').isVisible(),false,'Phone grid is hidden on desktop');
 assert.equal(await page.locator('.hub-user-guest').isVisible(),true,'Guests see sign-in and registration');
 for(const el of await page.locator('#hub-cats li').all())assert.ok(await el.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Category row fits: '+await el.innerText());
 // Hover opens the subcategory flyout; a subcategory browses the catalog without reloading.
 await page.locator('#hub-cats li').first().hover();await page.locator('#hub-flyout').waitFor();
 assert.equal(await page.locator('#hub-flyout section').count(),2);
 const before=calls.length;await page.locator('#hub-flyout [data-hub-query="dress"]').click();
 await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='dress');assert.equal(calls.at(-1),'dress');assert.ok(calls.length>before);
 assert.equal(await page.locator('#hub-flyout').isHidden(),true,'Choosing closes the flyout');
 // Keyboard: focus opens the row, Escape closes and returns focus to the row link.
 await page.evaluate(()=>scrollTo(0,0));await page.locator('#hub-cats [data-hub-category=tech]').focus();await page.locator('#hub-flyout').waitFor();
 assert.ok((await page.locator('#hub-flyout h3').first().innerText()).includes('Электроник'));
 await page.keyboard.press('Escape');await page.locator('#hub-flyout').waitFor({state:'hidden'});
 await page.locator('#hub-hot [data-hub-query="headphones"]').click();await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='headphones');
 await page.evaluate(()=>scrollTo(0,0));await page.locator('[data-hub-register]').click();await page.locator('#customer-register-form').waitFor();await page.locator('#close-modal').click();
 for(const width of [1024,1280])assert.ok(await page.setViewportSize({width,height:900}).then(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)),'Hub fits '+width);
 await page.setViewportSize({width:1024,height:900});assert.equal(await page.locator('.hub-user').isVisible(),false,'Narrow desktops drop the customer panel');
 // Phones: category grid and five tabs instead of the side list.
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Home fits '+width);
  assert.equal(await page.locator('#hub-cats').isVisible(),false);assert.equal(await page.locator('#hub-channels > *').count(),10);
  for(const el of await page.locator('#hub-channels > *').all()){const box=await el.boundingBox();assert.ok(box.width>=44&&box.height>=44,'Grid tile is a touch target');}
  assert.equal(await page.locator('.mobile-nav [data-mobile-tab]').count(),5);
 }
 await page.locator('#hub-channels [data-hub-category=shoes]').click();await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='men shoes');
 await page.evaluate(()=>scrollTo(0,0));await page.locator('[data-hub-all-categories]').click();await page.locator('#category-menu').waitFor({state:'visible'});
 assert.equal(await page.locator('.mobile-nav [data-mobile-tab=categories]').getAttribute('aria-current'),'page');await page.keyboard.press('Escape');

 // Cart: one card per shop; lines without a shop ID stand alone; unchecked lines are not estimated.
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(items=>localStorage.setItem('gostore-taobao-cart-v1',JSON.stringify(items)),[line(0,'111','Hangzhou Store',10),line(1,'222','Shenzhen Audio',20),line(2,'111','Hangzhou Store',30),line(3,'','',40)]);
 await page.goto(base+'/cart');await page.locator('.store-cart-shop').first().waitFor();
 assert.deepEqual(await page.locator('.store-cart-shop > header .cart-check span').allInnerTexts(),['Hangzhou Store','Shenzhen Audio','Нийлүүлэгчийн дэлгүүр']);
 assert.equal(await page.locator('.store-cart-shop').first().locator('.store-cart-line').count(),2);
 assert.equal(await page.locator('.store-cart-summary [data-tb-checkout]').count(),1,'Everything selected orders the whole cart');
 const goods=async()=>Number((await page.locator('.store-cart-summary .commerce-estimate div').first().locator('dd').innerText()).replace(/[^\d]/g,''));
 const all=await goods();
 await page.locator('[data-cart-shop="v:111"]').uncheck();
 assert.equal(await page.locator('.store-cart-picked').innerText(),'Сонгосон: 2 / 4 бараа');
 assert.equal(await page.locator('[data-cart-all]').first().evaluate(e=>e.indeterminate),true,'Partial selection shows a mixed state');
 assert.ok(await goods()<all,'Estimate covers only the selected lines');
 assert.equal(await page.locator('.store-cart-summary [data-cart-checkout-picked]').count(),1);assert.equal(await page.locator('.store-cart-checkout').count(),1,'One summary order button');
 await page.locator('[data-cart-pick="0"]').check();assert.equal(await page.locator('[data-cart-shop="v:111"]').evaluate(e=>e.indeterminate),true);
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.cartPick),'0','Focus stays on the toggled checkbox');
 // Removing a line keeps the other choices.
 await page.locator('[data-cart-remove="1"]').click();assert.equal(await page.locator('.store-cart-picked').innerText(),'Сонгосон: 2 / 3 бараа');
 await page.locator('[data-cart-all]').first().check();assert.equal(await page.locator('.store-cart-picked').innerText(),'Сонгосон: 3 / 3 бараа','A mixed box selects everything');await page.locator('[data-cart-all]').first().uncheck();assert.equal(await page.locator('.store-cart-summary .store-cart-checkout').isDisabled(),true,'Nothing selected cannot be ordered');
 await page.locator('[data-cart-all]').first().check();
 // Guests ordering a subset are asked to sign in first.
 await page.locator('[data-cart-pick="2"]').uncheck();await page.locator('.store-cart-summary [data-cart-checkout-picked]').click();await page.locator('#modal .account-form, #modal #customer-login-form').first().waitFor();await page.locator('#close-modal').click();
 // Phones: the total and order button stay pinned above the tab bar.
 await page.setViewportSize({width:390,height:844});
 const bar=await page.locator('.store-cart-bar').boundingBox(),nav=await page.locator('.mobile-nav').boundingBox();
 assert.ok(bar&&bar.y+bar.height<=nav.y+1,'Cart bar sits above the tab bar');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Cart fits 390');
 assert.equal(await page.locator('.mobile-nav [data-mobile-tab=cart]').getAttribute('aria-current'),'page');
 await page.screenshot({path:'tmp/home-hub-cart-390.png'});
 assert.deepEqual(errors,[]);
 // index.html serves every route; the first screen belongs to the home page only.
 for(const path of ['/brands/nike','/account','/cart']){await page.goto(base+path);await page.waitForLoadState('load');assert.equal(await page.locator('#home-hub').isVisible(),false,'Hub hidden on '+path);}
 console.log('PASS home hub: category rows and flyout (hover, keyboard, Escape), popular searches, guest panel, phone category grid and tabs, shop-grouped cart selection, estimate, mixed states and pinned phone bar.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
