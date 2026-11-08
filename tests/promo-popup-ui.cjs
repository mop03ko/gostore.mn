const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Promotional popup: edited on the admin «Мэдэгдэл илгээх» page (image upload, link and date checks),
// served session-free to the website and the app, shown on the home page once a day per popup.
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let uploaded='';try{
 const admin=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));admin.on('pageerror',e=>errors.push(e.message));
 await admin.goto(base+'/admin/');await admin.locator('[name=email]').fill(auth.email);await admin.locator('[name=password]').fill(auth.password);await admin.locator('#login-form button').click();await admin.locator('#app').waitFor({state:'visible'});
 const publicPopup=async(api='index')=>{const r=await fetch(base+'/api/'+api+'.php?action=promo-popup');assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null,'Session-free');return (await r.json()).popup;};
 assert.equal(await publicPopup(),null,'Nothing until an admin turns it on');
 await admin.locator('nav [data-page=messages]').click();const f=admin.locator('#promo-form');await f.waitFor();await admin.locator('#promo-status').getByText('Идэвхгүй').waitFor();
 const save=async()=>{const p=admin.waitForResponse(r=>new URL(r.url()).searchParams.get('action')==='admin-promo-popup-save');await f.locator('button.primary').click();return p;};
 // Image upload, then the rejected inputs.
 const upload=admin.waitForResponse(r=>new URL(r.url()).searchParams.get('action')==='image-upload');await f.locator('#promo-image-upload').setInputFiles('assets/backpack.jpg');assert.ok((await upload).ok());
 uploaded=await f.locator('[name=image]').inputValue();assert.match(uploaded,/^uploads\/[a-f0-9]{32}$/);assert.ok(await admin.locator('.promo-admin-image img').isVisible());
 await f.locator('[name=enabled]').check();await f.locator('[name=title]').fill('11.11 хямдрал');await f.locator('[name=text]').fill('Бүх цүнх 20% хямд.');await f.locator('[name=button]').fill('Үзэх');
 await f.locator('[name=link]').fill('javascript:alert(1)');assert.equal((await save()).status(),400);assert.match(await f.locator('.error').innerText(),/Холбоос/);
 await f.locator('[name=link]').fill('/official-stores');await f.locator('[name=starts]').fill('2030-01-02T10:00');await f.locator('[name=ends]').fill('2030-01-01T10:00');assert.equal((await save()).status(),400);assert.match(await f.locator('.error').innerText(),/Дуусах/);
 // Scheduled for later: saved but not live yet.
 await f.locator('[name=ends]').fill('2030-01-03T10:00');assert.ok((await save()).ok());await admin.locator('#promo-status').getByText('хугацаа нь болоогүй').waitFor();assert.equal(await publicPopup(),null);
 await f.locator('[name=starts]').fill('');await f.locator('[name=ends]').fill('');assert.ok((await save()).ok());await admin.locator('#promo-status').getByText('Одоо харагдаж байна').waitFor();
 const popup=await publicPopup();assert.deepEqual(Object.keys(popup).sort(),['button','id','image','link','text','title']);assert.equal(popup.title,'11.11 хямдрал');assert.equal(popup.image,'/assets/'+uploaded+'.jpg');assert.equal(popup.link,'/official-stores');
 assert.deepEqual(await publicPopup('mobile'),popup,'The app receives the same popup');
 // Storefront: shown on the home page after load, once a day; not on other pages.
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/cart');await page.waitForTimeout(2200);assert.equal(await page.locator('.promo-popup').count(),0,'Only on the home page');
 await page.goto(base+'/');const dialog=page.locator('dialog.promo-popup');await dialog.waitFor();
 assert.equal(await dialog.locator('h2').innerText(),'11.11 хямдрал');assert.equal(await dialog.locator('img').getAttribute('src'),'/assets/'+uploaded+'.jpg');assert.ok(await dialog.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await dialog.locator('a.button').getAttribute('href'),'/official-stores');assert.equal(await dialog.locator('a.button').innerText(),'Үзэх');
 const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,'Fits a phone');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'tmp/promo-popup-390.png'});
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 await page.reload();await page.waitForTimeout(2500);assert.equal(await page.locator('.promo-popup').count(),0,'Not again today');
 // New content shows again; the close button works; the link opens its page.
 await f.locator('[name=title]').fill('Шинэ урамшуулал');assert.ok((await save()).ok());
 await page.reload();await dialog.waitFor();assert.equal(await dialog.locator('h2').innerText(),'Шинэ урамшуулал');await dialog.locator('.promo-popup-close').click();await dialog.waitFor({state:'detached'});
 await page.evaluate(()=>localStorage.removeItem('gostore-promo-seen-v1'));await page.reload();await dialog.waitFor();await dialog.locator('a.button').click();await page.waitForURL(base+'/official-stores');
 // Turned off: nothing is served.
 await f.locator('[name=enabled]').uncheck();assert.ok((await save()).ok());assert.equal(await publicPopup(),null);
 assert.deepEqual(errors,[]);
 console.log('PASS promo popup: admin image upload, link/date validation, scheduling, session-free web and app API, home page once a day, new content shows again, close/Escape/link, phone width, switched off.');
}finally{await browser.close();if(uploaded)fs.rmSync(path.join('assets',uploaded+'.jpg'),{force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
