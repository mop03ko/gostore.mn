const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const products=Array.from({length:8},(_,i)=>({id:'tb-'+(810000+i),name:'Everyday category product '+i,image:'',approx_mnt:15000+i}));
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let free='unavailable';
 await page.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({json:{products,more:false,shipping:{},cache_ttl:600}}));
 await page.route('**/api/index.php?action=supplier-free-shipping*',r=>r.fulfill({json:{products:free==='available'?products.slice(0,2):[],status:free,scope:'china_to_erenhot'}}));
 await page.goto(base+'/');await page.locator('.discovery-home').waitFor();
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+width);}
 await page.setViewportSize({width:390,height:844});await page.locator('.discovery-free-banner').click();await page.getByText('Үнэгүй хүргэлттэй барааны мэдээлэл түр боломжгүй байна.',{exact:true}).waitFor();
 assert.equal(await page.locator('.discovery-home .discovery-product').count(),0,'No invented free shipping cards');assert.match(await page.locator('.discovery-note').innerText(),/Монгол хүртэлх тээвэр тусдаа/);
 await page.locator('[role=tab][data-discovery-tab=explore]').click();free='available';await page.locator('.discovery-free-banner').click();await page.locator('.discovery-home .discovery-product').first().waitFor();assert.equal(await page.locator('.discovery-home .discovery-product').count(),2);
 await page.locator('[role=tab][data-discovery-tab=fashion]').click();await page.locator('.discovery-home .discovery-product').first().waitFor();assert.equal(await page.locator('.discovery-home .discovery-product').count(),8);
 await page.evaluate(()=>scrollTo(0,0));await page.locator('#category-trigger').evaluate(e=>e.click());await page.locator('.category-photo-link').first().waitFor();
 assert.equal(await page.locator('.category-photo-link:visible').count(),6);assert.ok(await page.locator('.category-photo-link img').count()>0,'Category photos present');
 await page.locator('.category-recommendations .discovery-product').first().waitFor();
 const more=page.locator('#category-suggestions > .discovery-more');if(await more.count()){await more.click();assert.equal(await more.getAttribute('aria-expanded'),'true');assert.ok(await page.locator('.category-photo-link:visible').count()>6);}
 await page.locator('[data-department=tech]').click();await page.locator('.category-recommendations .discovery-product').first().waitFor();assert.match(await page.locator('.category-suggestion-heading').innerText(),/Электроник/);
 fs.mkdirSync('output/discovery',{recursive:true});await page.screenshot({path:'output/discovery/web-categories.png'});await page.keyboard.press('Escape');await page.locator('[role=tab][data-discovery-tab=explore]').click();await page.locator('.discovery-home').scrollIntoViewIfNeeded();await page.screenshot({path:'output/discovery/web-home.png'});
 assert.deepEqual(errors,[]);console.log('PASS shared web discovery: photo categories, expansion, navigation, scoped free/unknown results, phone/desktop layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
