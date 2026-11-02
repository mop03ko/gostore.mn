const {chromium}=require('../tmp/tooling/node_modules/playwright'),{spawnSync}=require('child_process'),path=require('path'),assert=require('assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const args=['-d','extension_dir='+path.resolve('tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring','-d','extension=curl'];
const seed=spawnSync('tmp/tooling/php/php.exe',[...args,'tests/taoworld-storefront-fixture.php'],{env:process.env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr+seed.stdout);const fixture=JSON.parse(seed.stdout);
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
  let reads=0,mode='error';
  await page.route('**/api/index.php?action=supplier-logistics&*',r=>{reads++;assert.equal(new URL(r.request().url()).searchParams.get('id'),fixture.id);return r.fulfill({status:mode==='error'?503:200,contentType:'application/json',body:JSON.stringify(mode==='error'?{error:'Unavailable'}:{status:'available',fee_cny:mode==='free'?0:10,fee_mnt:mode==='free'?0:5500,checked_at:'2026-11-02T13:40:07Z'})});});
  await page.goto(base+'/v/'+fixture.id);await page.locator('#pd-options').waitFor();
  assert.equal(reads,0,'Product views do not automatically consume logistics API');
  await page.locator('[data-pd-logistics]').click();await page.waitForFunction(()=>document.querySelector('[data-pd-logistics]').textContent==='Дахин шалгах');assert.match(await page.locator('[data-pd-logistics-result]').innerText(),/авах боломжгүй/);
  mode='free';await page.locator('[data-pd-logistics]').click();await page.waitForFunction(()=>document.querySelector('[data-pd-logistics-result]').textContent.includes('¥0'));assert.equal(reads,2);assert.equal(await page.locator('[data-pd-logistics]').isDisabled(),true);
  await page.goto(base+'/v/'+fixture.id);await page.locator('#pd-options').waitFor();assert.equal(reads,2);mode='paid';await page.locator('[data-pd-logistics]').click();await page.waitForFunction(()=>document.querySelector('[data-pd-logistics-result]').textContent.includes('5,500'));
  await page.locator('#pd-qty').fill('2');assert.match(await page.locator('[data-pd-logistics-result]').innerText(),/¥10/);assert.equal(reads,3,'Quantity does not multiply or re-query an item reference');
  await page.locator('.commerce-calculator summary').click();await page.locator('[data-cargo-method]').selectOption('dimensions');
  for(const [k,v] of Object.entries({length:'50',width:'40',height:'30',packages:'2'}))await page.locator('[data-cargo-'+k+']').fill(v);
  assert.match(await page.locator('[data-cargo-estimate]').innerText(),/0\.12 м³/);assert.match(await page.locator('[data-cargo-estimate]').innerText(),/39,534/);assert.equal(await page.locator('[data-cargo-measure]').isHidden(),true);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Shipping calculator fits '+width);}
  await page.setViewportSize({width:390,height:844});await page.locator('.pd-shipping-tools').screenshot({path:'tmp/product-shipping-390.png'});
  await page.locator('[data-cargo-packages]').fill('1.5');assert.match(await page.locator('[data-cargo-estimate]').innerText(),/бүхэл/);
  await page.locator('[data-cargo-method]').selectOption('weight');await page.locator('[data-cargo-measure]').fill('1.001');assert.match(await page.locator('[data-cargo-estimate]').innerText(),/4,500/);
  assert.match(await page.locator('.pd-shipping-tools').innerText(),/жин, хэмжээс мэдээлээгүй/);assert.deepEqual(errors,[]);
  console.log('PASS product logistics UI: on-demand read, failure/retry, known zero, reference is not quantity pricing, packed dimensions, multiple packages, kg rounding, mobile widths, unknown supplier measurement.');
 }finally{await browser.close();require('fs').unlinkSync(path.join('assets/uploads/search',fixture.image+'.jpg'));}
})().catch(e=>{console.error(e);process.exitCode=1;});
