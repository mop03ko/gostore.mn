const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Site footer: link columns, app download (App Store link and QR, Android announced), hours, contact, and every
// pickup warehouse. The static copy in index.html is replaced from the same settings checkout uses.
const APP='https://apps.apple.com/mn/app/gostore-mn/id6828991827';
const places=[{name:'Улаанбаатар агуулах',address:'Улаанбаатар хот, 14б байр.\nШуудангийн код: 14252-0024',phone:'8607-9077',hours:'Өдөр бүр 10:00 - 19:00',location:'ulaanbaatar',city:'Улаанбаатар'},{name:'Замын-Үүд салбар',address:'1-р баг, 117-р байр',phone:'91117189',hours:'',location:'wh-a',city:'Замын-Үүд'},{name:'<b>Сайншанд</b> салбар',address:'Билэг дугуй сервис',phone:'',hours:'',location:'wh-b',city:'Сайншанд'}];
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 // Without JavaScript the footer already carries the company name, the app link and the pickup addresses.
 {const ctx=await browser.newContext({viewport:{width:1440,height:900},javaScriptEnabled:false});const page=await ctx.newPage();await page.goto(base+'/');
  const footer=page.locator('body > footer');const text=await footer.innerText();
  for(const part of ['«Арвис транс Ки Эл Ти Си» ХХК','Arvis Trans KLTC LLC','Улаанбаатар агуулах','Замын-Үүд салбар','Сайншанд салбар','Эрээн агуулах','App Store','Тун удахгүй','shop@gostore.mn'])assert.ok(text.includes(part),'Static footer has '+part);
  assert.equal(await footer.locator('a[href="'+APP+'"]').count(),2,'QR and button link to the App Store listing');await ctx.close();}
 for(const [width,height] of [[1440,900],[1024,800],[390,844],[320,700]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/index.php?action=catalog*',async r=>{const res=await r.fetch(),j=await res.json();j.shipping.pickup_locations=places;await r.fulfill({response:res,json:j});});
  await page.goto(base+'/help',{waitUntil:'networkidle'});const footer=page.locator('body > footer');
  // Pickup points follow the settings; markup in a name stays text; the Erenhot entry is kept.
  await page.waitForFunction(()=>document.querySelectorAll('[data-footer-places] li').length===4&&document.querySelector('[data-footer-hours]').textContent.includes('10:00'));
  assert.deepEqual(await footer.locator('[data-footer-places] li strong').allInnerTexts(),['Улаанбаатар агуулах','Замын-Үүд салбар','<b>Сайншанд</b> салбар','Эрээн агуулах · БНХАУ']);
  assert.equal(await footer.locator('[data-footer-places] b').count(),0,'Names are escaped');
  assert.deepEqual(await footer.locator('[data-footer-places] a').evaluateAll(a=>a.map(x=>x.getAttribute('href'))),['tel:86079077','tel:91117189','/self-cargo.html'],'Phones become tel links; a place without a phone has none');
  assert.equal(await footer.locator('[data-footer-phone]').getAttribute('href'),'tel:86079077');assert.equal(await footer.locator('[data-footer-phone]').innerText(),'Утас: 8607-9077');
  // App download: iOS is a real link, Android is announced and is not a link.
  const ios=footer.locator('.sf-store-ios');assert.equal(await ios.getAttribute('href'),APP);assert.equal(await ios.getAttribute('rel'),'noopener');
  assert.equal(await footer.locator('.sf-store-soon').evaluate(e=>e.tagName+':'+!!e.closest('a')+':'+e.innerText.replace(/\s+/g,' ').trim()),'P:false:Android апп Тун удахгүй');
  const qr=footer.locator('.sf-qr');
  if(width>760){assert.ok(await qr.isVisible());await qr.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.sf-qr img').naturalWidth>0);}else assert.ok(!(await qr.isVisible()),'A QR code is no use on the phone that would scan it');
  // One self-cargo link: self-cargo.js must not add a second one.
  assert.equal(await footer.locator('a[href="/self-cargo.html"]').count(),2,'Shopping column and the Erenhot entry');
  assert.equal(await footer.locator('.sf-shop a[href="/self-cargo.html"]').count(),1);
  assert.equal(await page.locator('#year').innerText(),String(new Date().getFullYear()));
  // Layout: no overflow, nothing clipped, 44 px targets on phones.
  const layout=await footer.evaluate(e=>{const small=[],out=[];for(const el of e.querySelectorAll('a,button')){if(!el.offsetParent)continue;const r=el.getBoundingClientRect();if(innerWidth<=760&&r.height<43.5)small.push(el.textContent.trim().slice(0,24)+' '+Math.round(r.height));if(r.left<-0.5||r.right>innerWidth+0.5)out.push(el.textContent.trim().slice(0,24));}return {overflow:document.documentElement.scrollWidth>innerWidth,small,out,columns:new Set([...e.querySelectorAll('.sf-grid>*')].map(x=>Math.round(x.getBoundingClientRect().left))).size};});
  assert.deepEqual([layout.overflow,layout.small,layout.out],[false,[],[]],'Footer layout at '+width);
  assert.equal(layout.columns,width>1180?4:width>760?3:2,'Column count at '+width);
  // Existing behaviour: help links open the help page.
  await footer.locator('[data-action=shipping]').click();await page.waitForURL(/\/help#delivery$/);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS footer: static company, app and warehouse content without JavaScript; pickup points from settings with escaping and tel links; App Store link and QR, Android announced; single self-cargo link; 4/3/2 columns, no overflow and 44 px targets at 1440/1024/390/320 px; help links.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
