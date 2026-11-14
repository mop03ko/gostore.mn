const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('../tmp/tooling/node_modules/playwright');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/self-cargo.html');await page.getByRole('heading',{name:'Эхлээд нэвтэрнэ үү'}).waitFor();
  await page.getByRole('heading',{name:'Өөрөө захиалах 3 алхам'}).waitFor();
  await page.getByText('Эрээн агуулахтай холбогдох · Orgil / WeChat',{exact:true}).click();
  const qr=page.getByAltText('Orgil-ийн WeChat холбоо барих QR код');await qr.waitFor();
  await page.waitForFunction(()=>document.querySelector('.sc-contact-qr')?.naturalWidth>0);
  assert.deepEqual(await (await page.request.get(base+'/assets/erenhot-wechat-orgil.jpg')).body(),fs.readFileSync('assets/erenhot-wechat-orgil.jpg'),'Serves the original QR without transformation');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Expanded contact fits mobile');
  await page.getByRole('link',{name:'QR зураг татах'}).waitFor();
  await require('./customer-ui-helper.cjs')(page,base);await page.reload();
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.locator('[data-field="cargo_id"]').waitFor();
  const profile=await page.evaluate(async()=>await(await fetch('/api/index.php?action=customer-self-cargo')).json());
  for(const field of ['cargo_id','recipient','phone','address','label']){
   await page.locator('[data-field="'+field+'"]').click();
   await page.waitForFunction(()=>document.getElementById('sc-copy-status').textContent==='Хууллаа ✓');
   await page.waitForFunction(async expected=>(await navigator.clipboard.readText()).replace(/\r\n/g,'\n')===expected,profile.delivery[field]);
  }
  await page.locator('#self-cargo-create [name=pickup_location]').selectOption('ulaanbaatar');
  await page.getByLabel('Барааны нэр',{exact:true}).fill('Гутал <script>window.BAD=true</script>');
  await page.getByLabel('Нийт барааны тоо ширхэг').fill('2');
  await page.getByLabel('Хятадын хүргэлтийн дугаар (байгаа бол)',{exact:true}).fill('YT1234567891111');
  await page.getByRole('button',{name:'Ачаа бүртгэх',exact:true}).click();
  const card=page.locator('[data-order]');await card.waitFor();const id=await card.getAttribute('data-order');assert.match(id,/^GS-[A-F0-9]{6}$/);
  assert.match(await card.innerText(),/YT1234567891111/,'Waybill can be registered in the first step');
  assert.match(await card.locator('pre').innerText(),new RegExp(profile.cargo_id));assert.equal(await page.evaluate(()=>window.BAD),undefined);
  await card.getByText('Хүргэлтийн дугаар нэмэх',{exact:true}).click();
  await card.getByLabel('Хятадын хүргэлтийн дугаар').fill('YT1234567890000');await card.getByLabel('Хүргэлтийн компани').fill('圆通');
  await card.getByRole('button',{name:'Дугаар хадгалах'}).click();await card.getByText('Эрээн рүү хүргэгдэж байна',{exact:true}).waitFor();
  await card.getByText(/Бүртгэсэн хүргэлт:.*YT1234567890000/).waitFor();
  for(const width of [360,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);}
  fs.mkdirSync('tmp/self-cargo-work',{recursive:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/self-cargo-work/mobile.png',fullPage:true});
  await page.addInitScript(()=>sessionStorage.setItem('gostore-warehouse-reminded-v1','1'));await page.goto(base+'/');await page.getByRole('link',{name:'Өөрөө захиалах →'}).waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.sc-entry-link')).display==='flex');
  assert.equal(await page.locator('main > :first-child').getAttribute('id'),'self-cargo-entry');
  for(const width of [360,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Home entry fits '+width);}
  await page.setViewportSize({width:390,height:844});assert.ok((await page.locator('.sc-entry-link').boundingBox()).height<150,'Compact home card');await page.screenshot({path:'tmp/self-cargo-work/home-entry.png'});
  await page.goto(base+'/account/orders');await page.getByRole('link',{name:'Өөрөө захиалах →'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: guest gate, real customer registration/create/tracking, escaped content, warehouse label, homepage/account entry, responsive 360/390/1280px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
