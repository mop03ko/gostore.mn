const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Catalog pages: categories (/c/<id>), sub-categories (/c/<id>/<sub>), search (/search?q=…), all products
// (/products), saved items (/saved) and the 11.11 collection (/11-11) are pages of their own: only the
// list, a breadcrumb and a title; Back/Forward move between them without reloading; old links still work.
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'}),page=await context.newPage(),searches=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://img.alicdn.com/**',r=>r.abort());
 await context.route('**/api/index.php?action=supplier-search*',r=>{const p=new URL(r.request().url()).searchParams;if(p.get('limit')==='50')searches.push(p.get('q'));return r.fulfill({json:{products:[{id:'tb-123456789',name:'Бараа '+p.get('q'),image:'',mnt:5500}],shipping:{cny_rate:550},more:false,stale:false,cache_ttl:600}});});
 const path=()=>{const u=new URL(page.url());return decodeURIComponent((u.pathname+u.search).replace(/\+/g," "));};
 const listing=()=>page.evaluate(()=>document.documentElement.classList.contains('listing-view'));
 const title=()=>page.locator('#catalog-title').innerText(),crumbs=()=>page.locator('#catalog-breadcrumb').innerText();
 const settle=q=>page.waitForFunction(q=>[...document.querySelectorAll('.supplier-card h3')].some(h=>h.textContent==='Бараа '+q),q);
 // Home: the home sections and the recommendations.
 await page.goto(base+'/');await settle('__all__');await page.evaluate(()=>{window.samePage=true;});
 assert.equal(await listing(),false);assert.equal(await page.locator('#home-hub').isVisible(),true);assert.equal(await page.locator('#catalog-breadcrumb').isVisible(),false);
 // Category → its own page.
 await page.locator('#catalog-category-nav [data-catalog-category=women]').click();await settle('women clothing');
 assert.equal(path(),'/c/women');assert.equal(await listing(),true);assert.equal(await page.locator('#home-hub').isVisible(),false);assert.equal(await page.locator('#discovery-home').isVisible(),false);
 assert.equal(await title(),'Эмэгтэй хувцас');assert.match(await crumbs(),/Нүүр\s*\/\s*Эмэгтэй хувцас/);assert.equal(await page.title(),'Эмэгтэй хувцас · gostore.mn');
 assert.ok(await page.evaluate(()=>scrollY<5),'A new page starts at the top');
 // Sub-category → /c/<category>/<sub>; the category stays selected and links back.
 await page.locator('#catalog-refinements [data-supplier-query=dress]').click();await settle('dress');
 assert.equal(path(),'/c/women/dress');assert.equal(await title(),'Даашинз');assert.match(await crumbs(),/Эмэгтэй хувцас\s*\/\s*Даашинз/);
 assert.equal(await page.locator('#catalog-breadcrumb a[href="/c/women"]').count(),1);assert.equal(await page.locator('#catalog-category-nav [aria-pressed=true]').innerText(),'Эмэгтэй хувцас');
 // Sorting stays on the page (no new history entry).
 const depth=await page.evaluate(()=>history.length);await page.locator('#supplier-search [name=sort]').selectOption('price');await page.waitForFunction(()=>location.search.includes('sort=price'));
 assert.equal(path(),'/c/women/dress?sort=price');assert.equal(await page.evaluate(()=>history.length),depth);
 // Search → /search?q=…
 await page.locator('#search').fill('цүнх');await page.locator('#search-form [type=submit]').click();await settle('цүнх');
 assert.equal(path(),'/search?sort=price&q=цүнх');assert.equal(await title(),'«цүнх» хайлт');
 // Back/Forward walk the pages in place.
 await page.goBack();await settle('dress');assert.equal(path(),'/c/women/dress?sort=price');assert.equal(await title(),'Даашинз');
 await page.goBack();await settle('women clothing');assert.equal(path(),'/c/women');assert.equal(await page.locator('#supplier-search [name=sort]').inputValue(),'default','Each page keeps its own sorting');
 await page.goBack();await settle('__all__');assert.equal(path(),'/');assert.equal(await listing(),false);assert.equal(await page.locator('#home-hub').isVisible(),true);assert.notEqual(await page.title(),'Эмэгтэй хувцас · gostore.mn');
 await page.goForward();await settle('women clothing');assert.equal(path(),'/c/women');
 // Header «Бараанууд» and the breadcrumb open pages in place.
 await page.locator('.header-browse').click();await settle('__all__');assert.equal(path(),'/products');assert.equal(await title(),'Бүх бараа');
 await page.locator('#catalog-breadcrumb a[href="/"]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('listing-view'));assert.equal(path(),'/');
 assert.equal(await page.evaluate(()=>window.samePage),true,'No page reloads');
 // Direct links, reloads and older addresses.
 for(const [url,expected,heading,q] of [['/c/home/storage-box','/c/home/storage-box','Хадгалах хайрцаг','storage box'],['/search?q=red%20lamp','/search?q=red lamp','«red lamp» хайлт','red lamp'],['/?category=bags#catalog','/c/bags','Цүнх, үүргэвч','bag'],['/?q=desk%20lamp','/c/lighting/desk-lamp','Ширээний гэрэл','desk lamp'],['/c/nope','/products','Бүх бараа','__all__'],['/c/home/nope','/c/home','Гэр ахуй','home storage']]){
  await page.goto(base+url);await settle(q);assert.equal(path(),expected,url);assert.equal(await title(),heading,url);assert.equal(await listing(),true,url);assert.equal(await page.locator('#home-hub').isVisible(),false,url);
 }
 await page.goto(base+'/saved');await page.locator('#catalog-title').getByText('Хадгалсан бараа').waitFor();assert.equal(path(),'/saved');
 // Phone: the categories tab is current on category pages; nothing overflows.
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/c/women/dress');await settle('dress');
 await page.waitForFunction(()=>document.querySelector('.mobile-nav [data-mobile-tab=categories]')?.getAttribute('aria-current')==='page');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'tmp/catalog-page-390.png'});
 // 11.11: /11-11 is the collection page (old /?sale=11.11 links move there); after the campaign it goes home.
 const sale=await context.newPage();sale.on('pageerror',e=>errors.push(e.message));await sale.clock.setFixedTime(new Date('2026-11-05T05:00:00Z'));
 const expires=Date.parse('2026-11-05T06:00:00Z')/1000;
 await sale.route('**/api/index.php?action=supplier-deals*',r=>r.fulfill({json:{products:[{id:'tb-555555',name:'Хямдралтай бараа',image:'',mnt:10000,sellable:true,offers:{expires,promotions:[]},card_discount:{expires,current_mnt:10000,was_mnt:20000,percent:50}}],more:false}}));
 const before=searches.length;await sale.goto(base+'/?sale=11.11');await sale.locator('.eleven-sale-card').first().waitFor();
 assert.equal(new URL(sale.url()).pathname,'/11-11');assert.equal(await sale.locator('#catalog').isVisible(),false);assert.equal(await sale.locator('#home-hub').isVisible(),false);
 await sale.goto(base+'/11-11');await sale.locator('.eleven-sale-card').first().waitFor();assert.equal(searches.length,before,'The 11.11 page does not load the catalog');
 await sale.clock.setFixedTime(new Date('2026-11-12T01:00:00+08:00'));await sale.goto(base+'/11-11');await sale.waitForURL(base+'/');
 assert.deepEqual(errors,[]);
 console.log('PASS catalog pages: /c/<category>, /c/<category>/<sub>, /search, /products, /saved and /11-11 as pages; breadcrumbs and titles; sort keeps the page; Back/Forward in place; direct links, old /?q= /?category= /?sale= links and unknown categories; phone tab and width.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
