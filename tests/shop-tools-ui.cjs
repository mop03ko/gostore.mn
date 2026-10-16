const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Catalog price filter, numbered pages, comparison and search suggestions with mocked supplier data.
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],searches=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/lamp.jpg',contentType:'image/jpeg'}));
 const product=(i)=>({id:'tb-'+(300000000+i),name:'Бараа '+i,image:'https://img.alicdn.com/'+i+'.jpg',mnt:11000+i*1000,price_status:'available',price_expires:Math.floor(Date.now()/1000)+3600,sold_count:i*10});
 await page.route('**/api/index.php?action=supplier-search*',r=>{const p=new URL(r.request().url()).searchParams;searches.push(Object.fromEntries(p));const n=Number(p.get('page'));return r.fulfill({json:{products:Array.from({length:12},(_,i)=>product((n-1)*12+i+1)),page:n,more:n<21,total:250,pages:21,fetched:new Date().toISOString(),stale:false,cache_ttl:0,shipping:{cny_rate:550,weight_step_kg:.5,weight_step_mnt:1500,volume_threshold:1,volume_small_cny:599,volume_large_cny:399}}});});
 await page.route('**/api/index.php?action=supplier-product*',r=>{const id=new URL(r.request().url()).searchParams.get('id'),n=Number(id.slice(3))-300000000;return r.fulfill({json:{product:{...product(n),cny:20+n,variants:[{id:'a',label:'Улаан',cny:20+n,stock:5}],vendor_name:'Дэлгүүр '+n,brand:n===1?'Xiaomi':'',location:['Zhejiang'],attributes:[{name:'Материал',value:n===1?'Хөвөн':'Арьс'},{name:'Өнгө',value:'Улаан'}],related:[]},fetched:new Date().toISOString(),stale:false,cache_ttl:0,shipping:{cny_rate:550}}});});
 await page.goto(base+'/');await page.locator('.supplier-card').first().waitFor();
 assert.match(await page.locator('#supplier-status').innerText(),/нийт 250 үр дүн/);
 assert.deepEqual(await page.locator('#supplier-paging button').allInnerTexts(),['1','2','21','Дараах'],'Numbered pages around the current one');
 await page.locator('#catalog').screenshot({path:'tmp/shop-tools-catalog-1440.png',clip:undefined});
 await page.locator('#supplier-paging [data-supplier-page="21"]').click();await page.waitForFunction(()=>document.querySelector('#supplier-paging [aria-current=page]')?.textContent==='21');
 assert.deepEqual(await page.locator('#supplier-paging button').allInnerTexts(),['Өмнөх','1','20','21']);
 // Price range in MNT is sent to the server and kept in the URL.
 await page.locator('#supplier-search [name=price_min]').fill('10 000');await page.locator('#supplier-search [name=price_max]').fill('50000');await page.locator('#supplier-search .price-apply').click();
 await page.waitForFunction(()=>new URL(location.href).searchParams.get('price_max')==='50000');
 assert.equal(searches.at(-1).price_min,'10000');assert.equal(searches.at(-1).price_max,'50000');assert.equal(searches.at(-1).page,'1');
 await page.waitForFunction(()=>document.querySelector('#supplier-status').textContent.includes('Үнэ: 10,000'));
 await page.locator('#supplier-search [name=sort]').selectOption('-updated_time');await page.waitForFunction(()=>new URL(location.href).searchParams.get('sort')==='-updated_time');
 assert.equal(searches.at(-1).sort,'-updated_time');assert.equal(searches.at(-1).price_min,'10000','Sort keeps the price filter');
 await page.reload();await page.locator('.supplier-card').first().waitFor();assert.equal(await page.locator('#supplier-search [name=price_min]').inputValue(),'10000','Filter restored from URL');
 await page.locator('#supplier-reset').click();await page.waitForFunction(()=>!new URL(location.href).searchParams.has('price_min'));assert.equal(searches.at(-1).price_min,undefined);
 // Comparison: header counter, table with shared attributes, removal.
 assert.equal(await page.locator('[data-compare-open]').isVisible(),false);
 const toggles=page.locator('.supplier-card [data-compare-toggle]');await toggles.nth(0).click();await toggles.nth(1).click();
 await page.waitForFunction(()=>document.querySelector('[data-compare-open] .count').textContent==='2');assert.equal(await toggles.nth(0).getAttribute('aria-pressed'),'true');
 await page.locator('[data-compare-open]').click();await page.locator('.compare-table').waitFor();
 assert.equal(await page.locator('.compare-table thead th').count(),3);await page.locator('#modal').screenshot({path:'tmp/shop-tools-compare.png'});const table=await page.locator('.compare-table').innerText();
 assert.ok(table.includes('Материал')&&table.includes('Хөвөн')&&table.includes('Арьс')&&table.includes('Дэлгүүр 1')&&table.includes('11,550'),table);
 await page.locator('[data-compare-remove]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.compare-table thead th').length===2);
 await page.locator('#close-modal').click();assert.equal(await page.locator('[data-compare-open] .count').innerText(),'1');
 await page.goto(base+'/v/tb-300000002');await page.locator('.pd-foot-actions [data-compare-toggle]').waitFor();
 assert.equal(await page.locator('.pd-foot-actions [data-compare-toggle]').getAttribute('aria-pressed'),'true','Product page reflects the comparison list');
 // Search suggestions: categories while typing, recent searches when empty, keyboard selection.
 await page.goto(base+'/');await page.locator('.supplier-card').first().waitFor();
 await page.locator('#search').fill('гутал');await page.locator('#search-suggest').waitFor();
 const labels=await page.locator('#search-suggest [role=option]').allInnerTexts();assert.ok(labels[0].includes('«гутал» гэж хайх')&&labels.some(l=>l.includes('Эрэгтэй гутал')),labels.join('|'));
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='гутал');
 await page.locator('#search').fill('');await page.locator('#search').focus();await page.locator('#search-suggest').waitFor();assert.ok((await page.locator('#search-suggest').innerText()).includes('гутал'),'Recent search remembered');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#search-suggest').isVisible(),false);
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/');await page.locator('.supplier-card').first().waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow on mobile');
 for(const name of ['price_min','price_max']){const box=await page.locator('#supplier-search [name='+name+']').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,'Price input inside the screen: '+name);}
 await page.locator('#supplier-search').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,-200));await page.screenshot({path:'tmp/shop-tools-filter-390.png'});
 assert.deepEqual(errors,[]);console.log('PASS shop tools: price filter (URL, sort, reset), totals and numbered pages, compare list/table/removal/product page, search suggestions and recent searches, mobile layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
