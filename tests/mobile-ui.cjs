const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await require('./customer-ui-helper.cjs')(page,base);
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 await page.goto(base+'/');await page.locator('.supplier-card').first().waitFor();
 for(const width of [320,390,430,760]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width);
   assert.equal(await page.locator('.mobile-notifications').isVisible(),true);assert.equal(await page.locator('.header-actions [data-action=account]').isVisible(),false);
   for(const selector of ['.mobile-notifications','#search-form button[type=submit]','.mobile-nav [data-action=orders]']){const box=await page.locator(selector).boundingBox();assert.ok(box.height>=44&&box.width>=44,'Touch target '+selector);}
   assert.ok((await page.locator('#search').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)))>=16,'Input avoids iOS focus zoom');
   await page.locator('.mobile-nav [data-mobile-tab=catalog]').click();await page.waitForFunction(()=>document.querySelector('.mobile-nav [data-mobile-tab=catalog]').getAttribute('aria-current')==='page');
   assert.equal(Math.round((await page.locator('.header').boundingBox()).y),0,'Search header remains reachable');
   const input=await page.locator('#supplier-query').boundingBox(),button=await page.locator('#supplier-search button[type=submit]').boundingBox();assert.ok(Math.abs(input.y-button.y)<2,'Search action stays beside input');
   await page.locator('#supplier-query').fill('bag');await page.locator('#supplier-query').press('Enter');assert.notEqual(await page.evaluate(()=>document.activeElement.id),'supplier-query','Search dismisses the mobile keyboard');await page.locator('.supplier-card').first().waitFor();
   if(width===390)await page.screenshot({path:'tmp/mobile-redesign-catalog.png'});
   await page.locator('.mobile-nav [data-action=orders]').click();await page.locator('#cargo-search').waitFor();
   const modal=await page.locator('#modal').boundingBox();assert.ok(Math.abs(modal.width-width)<=1&&modal.y>=0,'Sheet fits screen');
   assert.ok(await page.locator('#modal').evaluate(e=>e.scrollWidth<=e.clientWidth),'Sheet has no horizontal overflow');
   if(width===390)await page.screenshot({path:'tmp/mobile-redesign-cargo.png'});
   await page.locator('#close-modal').click();assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'orders','Close restores focus');
 }
 await page.setViewportSize({width:390,height:844});await page.locator('.mobile-nav [data-action=favorites]').click();await page.waitForFunction(()=>document.querySelector('.mobile-nav [data-mobile-tab=saved]').getAttribute('aria-current')==='page');
 await page.locator('.mobile-nav [data-mobile-tab=catalog]').click();await page.locator('.supplier-card').first().waitFor();assert.equal(await page.locator('#catalog [data-filter=all]').getAttribute('aria-pressed'),'true','Catalog tab exits saved filter');
 await page.locator('.mobile-nav [data-mobile-tab=home]').click();await page.screenshot({path:'tmp/mobile-redesign-home.png'});
 await page.locator('.mobile-nav [data-action=account]').click();await page.locator('#customer-profile-form').waitFor();await page.screenshot({path:'tmp/mobile-redesign-account.png'});
 await page.setViewportSize({width:320,height:460});await page.locator('#customer-profile-form [name=phone]').focus();await page.locator('#customer-profile-form [type=submit]').scrollIntoViewIfNeeded();assert.equal(await page.locator('#close-modal').isVisible(),true);assert.ok(await page.locator('#modal').evaluate(e=>e.scrollWidth<=e.clientWidth),'Short viewport form fits');await page.keyboard.press('Escape');
 await page.goto(base+'/v/123456789');await page.locator('#pd-options').waitFor();assert.equal(await page.locator('#search-form').isVisible(),false);
 const bar=await page.locator('.pd-buybar').boundingBox();assert.ok(bar.x>=0&&bar.x+bar.width<=320&&bar.y+bar.height<=461,'Buy bar stays inside narrow screen');
 await page.locator('[data-pd-submit]').click();await page.locator('#taobao-checkout-form').waitFor();assert.ok(await page.locator('#modal').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.locator('#close-modal').click();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.querySelector('.pd-summary').scrollIntoView());await page.screenshot({path:'tmp/mobile-redesign-product.png'});
 await page.goto(base+'/');await page.setViewportSize({width:1440,height:1000});assert.equal(await page.locator('.mobile-notifications').isVisible(),false);assert.equal(await page.locator('.header-actions [data-action=account]').isVisible(),true);assert.equal(await page.locator('.mobile-nav').isVisible(),false);assert.deepEqual(errors,[]);
 console.log('PASS mobile: 320/390/430/760 widths, sticky search, touch targets, nav state/saved exit, full-width sheets, focus restoration, short viewport form, compact product header, narrow buy bar and desktop controls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
