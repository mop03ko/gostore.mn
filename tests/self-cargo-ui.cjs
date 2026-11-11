const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('../tmp/tooling/node_modules/playwright');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/self-cargo.html');await page.getByRole('heading',{name:'Эхлээд нэвтэрнэ үү'}).waitFor();
  await page.getByText('Эрээн агуулахтай холбогдох · Orgil / WeChat',{exact:true}).click();
  const qr=page.getByAltText('Orgil-ийн WeChat холбоо барих QR код');await qr.waitFor();
  await page.waitForFunction(()=>document.querySelector('.sc-contact-qr')?.naturalWidth>0);
  assert.deepEqual(await (await page.request.get(base+'/assets/erenhot-wechat-orgil.jpg')).body(),fs.readFileSync('assets/erenhot-wechat-orgil.jpg'),'Serves the original QR without transformation');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Expanded contact fits mobile');
  await page.getByRole('link',{name:'QR зураг татах'}).waitFor();
  await require('./customer-ui-helper.cjs')(page,base);await page.reload();
  await page.getByLabel('Барааны нэр',{exact:true}).fill('Гутал <script>window.BAD=true</script>');
  await page.getByLabel('Нийт барааны тоо ширхэг').fill('2');
  await page.getByRole('button',{name:'Код болон агуулахын хаяг авах'}).click();
  const card=page.locator('[data-order]');await card.waitFor();const id=await card.getAttribute('data-order');assert.match(id,/^GS-[A-F0-9]{6}$/);
  assert.match(await card.locator('pre').innerText(),new RegExp(id));assert.equal(await page.evaluate(()=>window.BAD),undefined);
  await card.getByText('Хүргэлтийн дугаар нэмэх',{exact:true}).click();
  await card.getByLabel('Хятадын хүргэлтийн дугаар').fill('YT1234567890000');await card.getByLabel('Хүргэлтийн компани').fill('圆通');
  await card.getByRole('button',{name:'Дугаар хадгалах'}).click();await card.getByText('Эрээн рүү хүргэгдэж байна',{exact:true}).waitFor();
  assert.match(await card.innerText(),/YT1234567890000/);
  for(const width of [360,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);}
  fs.mkdirSync('tmp/self-cargo-work',{recursive:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/self-cargo-work/mobile.png',fullPage:true});
  await page.goto(base+'/');await page.getByRole('link',{name:'Өөрөө захиалах →'}).waitFor();
  await page.goto(base+'/account/orders');await page.getByRole('link',{name:'Өөрөө захиалах →'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: guest gate, real customer registration/create/tracking, escaped content, warehouse label, homepage/account entry, responsive 360/390/1280px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
