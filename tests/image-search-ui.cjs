const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Enables image search in the disposable data directory; the provider search is mocked.
const data=process.env.GOSTORE_DATA_DIR;assert.ok(data);
const enable=spawnSync(path.resolve('tmp/tooling/php/php.exe'),['-d','extension_dir='+path.resolve('tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring','-r','require "server/bootstrap.php";require "server/shipping.php";$s=shipping_settings();$s["image_search_enabled"]=true;db()->prepare("INSERT OR REPLACE INTO meta VALUES (?,?)")->execute(["shipping_settings",json_encode($s)]);'],{env:process.env,encoding:'utf8'});
assert.equal(enable.status,0,enable.stderr);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/lamp.jpg',contentType:'image/jpeg'}));
  await page.route('**/api/index.php?action=supplier-search*',r=>{const params=new URL(r.request().url()).searchParams,image=params.get('image');calls.push(image?'image:'+image:'q:'+params.get('q'));return r.fulfill({json:{products:Array.from({length:4},(_,i)=>({id:'tb-'+(223456789+i),name:(image?'Зургаар олдсон ':'Бараа ')+i,image:'https://img.alicdn.com/'+i+'.jpg',mnt:15500+i*5500,cny:30+i*10,sold_count:null})),page:1,more:false,fetched:new Date().toISOString(),stale:false,cache_ttl:0,shipping:{cny_rate:550,weight_step_kg:.5,weight_step_mnt:1500,volume_threshold:1,volume_small_cny:599,volume_large_cny:399}}});});
  await page.goto(base+'/');
  const camera=page.locator(viewport.width>760?'#search-form [data-image-search]':'#supplier-search [data-image-search]');
  await camera.waitFor({state:'visible'});
  await page.setInputFiles('#image-search-input','assets/chair.jpg');
  await page.waitForFunction(()=>document.querySelector('#catalog-title').textContent==='Зургаар хайсан бараа'&&document.querySelectorAll('#supplier-grid .supplier-card').length===4);
  const image=new URL(page.url()).searchParams.get('image');assert.match(image,/^[a-f0-9]{32}$/);
  assert.ok(calls.includes('image:'+image));assert.equal(new URL(page.url()).searchParams.get('q'),null);
  assert.equal(await page.locator('#image-search-preview').isVisible(),true);
  assert.match(await page.locator('#image-search-preview img').getAttribute('src'),new RegExp('/assets/uploads/search/'+image+'\\.jpg$'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`tmp/image-search-${viewport.width}.png`});
  await page.reload();await page.waitForFunction(()=>document.querySelector('#catalog-title').textContent==='Зургаар хайсан бараа');
  await page.click('#supplier-reset');await page.waitForFunction(()=>!new URL(location.href).searchParams.has('image')&&document.querySelector('#image-search-preview').hidden);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('image-search-ui ok');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
