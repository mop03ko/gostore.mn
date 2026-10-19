const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage(),images=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source='https://img.alicdn.com/imgextra/i1/123/photo.jpg';
 await page.route('https://img.alicdn.com/**',r=>{images.push(r.request().url());return r.request().url().includes('broken.jpg_')?r.abort():r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'});});
 await page.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({json:{products:Array.from({length:8},(_,i)=>({id:'tb-'+(123456789+i),name:'Зураг '+i,image:source,mnt:5500})),shipping:{cny_rate:550},more:false,stale:false,cache_ttl:600}}));
 await page.goto(base+'/');await page.locator('.supplier-card').first().waitFor();
 const photo=page.locator('.supplier-photo img').first();await photo.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.supplier-photo img').naturalWidth>0);
 assert.equal(await photo.getAttribute('src'),source+'_400x400q80.jpg_.webp');assert.equal(await photo.getAttribute('loading'),'eager');assert.equal(await page.locator('.supplier-photo img').nth(4).getAttribute('loading'),'lazy');assert.ok(!images.includes(source),'Catalog requests thumbnail, not original');
 assert.equal(await page.locator('[data-compare-toggle]').first().getAttribute('data-image'),source,'Original remains in saved product data');
 for(const url of ['https://evil-alicdn.com/imgextra/x.jpg','https://img.alicdn.com/imgextra/x.jpg?signature=abc','https://img.alicdn.com/imgextra/x.jpg#fragment','https://img.alicdn.com/imgextra/x.jpg_400x400.jpg','https://img.alicdn.com/imgextra/animated.gif','/assets/backpack.jpg'])assert.equal(await page.evaluate(url=>supplierImageUrl(url,400),url),url);
 // One fallback only; switching gallery images must not reuse an earlier fallback.
 await photo.evaluate(img=>{img.dataset.imageOriginal='https://img.alicdn.com/imgextra/broken.jpg';img.src=supplierImageUrl(img.dataset.imageOriginal,400);});
 await page.waitForFunction(()=>document.querySelector('.supplier-photo img').src.endsWith('/broken.jpg')&&document.querySelector('.supplier-photo img').naturalWidth>0);
 assert.equal(await photo.getAttribute('data-image-original'),null);assert.equal(images.filter(x=>x.endsWith('/broken.jpg')).length,1);
 assert.deepEqual(errors,[]);console.log('PASS: sized product photos, eager/lazy priority, original product data preserved, safe URL exclusions, failed resize falls back once.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
