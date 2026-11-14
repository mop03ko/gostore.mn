// Run against Expo web (MOBILE_WEB_BASE), with all backend calls mocked locally.
const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
const base=process.env.MOBILE_WEB_BASE||'http://localhost:8093';
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const locations=[{location:'ulaanbaatar',city:'Улаанбаатар',name:'Улаанбаатар агуулах',address:'Улаанбаатар тест хаяг',phone:'86079077',hours:''},{location:'wh-898220f69688',city:'Замын-Үүд',name:'Замын-Үүд салбар',address:'1-р баг Захиргааны замын эсрэг талд 117-р байр 3-р подваль',phone:'91117189',hours:''},{location:'wh-9348267dc33a',city:'Сайншанд',name:'Сайншанд салбар',address:'Цахилгаан түгээхийн баруун талд Билэг дугуй сервис',phone:'88563280',hours:''}];
const key='gostore-pickup-warehouse-v1',line={id:'tb-123456789',sku:'blue',name:'Test bag',image:'',variant:'blue',qty:2,cny:10,min_qty:2,step:2,stock:10};
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{latitude:47.92,longitude:106.91,accuracy:50}});
 const page=await context.newPage(),errors=[],calls=[],bodies=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.geoReads=0;const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);navigator.geolocation.getCurrentPosition=(...args)=>{window.geoReads++;return original(...args);};});
 await page.route('**/api/mobile.php?**',async route=>{
  const a=new URL(route.request().url()).searchParams.get('action');calls.push(a);
  let json={products:[],more:false,orders:[],messages:[],unread:0,addresses:[],csrf:'test'};
  if(a==='catalog')json={customer:{id:'fixture',name:'Test',phone:'99112233',email:'fixture@example.test',address:''},shipping:{pickup_locations:locations,pickup:locations[0],cny_rate:550,service_percent:0,service_fee_mnt:0,image_search_enabled:false},qpay:false,csrf:'test'};
  if(a==='promo-popup')json={popup:null};
  if(a==='checkout-quote')json={items:[{...line,unit_cny:10,goods_cny:20}],quote:{total:11000,breakdown:{goods_mnt:11000},goods_cny:20,domestic_cny:0,vendors:1,cny_rate:550,service_percent:0,service_fee_mnt:0,domestic_later:false,payment_window_hours:24}};
  if(a==='order-create'){bodies.push(route.request().postDataJSON());return route.fulfill({status:409,json:{error:'Test captured. No real order.'}});}
  return route.fulfill({json});
 });
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});const picker=page.getByTestId('warehouse-picker');await picker.waitFor({timeout:120000});
 assert.equal(await picker.getByRole('radio').count(),3);assert.equal(await page.evaluate(()=>window.geoReads),0,'Opening app must not access location');assert.equal(calls.includes('promo-popup'),false,'Warehouse picker precedes promotion');
 await page.getByTestId('warehouse-option-wh-9348267dc33a').click();await page.getByTestId('warehouse-confirm').click();await picker.waitFor({state:'hidden'});
 assert.match(await page.getByTestId('warehouse-preference').innerText(),/Сайншанд/);
 assert.deepEqual(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key)),{version:1,location:'wh-9348267dc33a'});
 await page.reload();await picker.waitFor();assert.equal(await page.getByTestId('warehouse-option-wh-9348267dc33a').getAttribute('aria-checked'),'true');
 await page.getByTestId('warehouse-locate').click();await picker.getByText('Байршлаар санал болгож байна',{exact:true}).waitFor();
 assert.equal(await page.getByTestId('warehouse-option-wh-9348267dc33a').getAttribute('aria-checked'),'true','Location recommendation never switches saved choice');
 assert.match(await page.getByTestId('warehouse-option-ulaanbaatar').innerText(),/санал болгож/);
 await page.screenshot({path:'tmp/warehouse-picker-light.png'});
 await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'tmp/warehouse-picker-dark.png'});
 await page.setViewportSize({width:320,height:568});assert.ok(await picker.evaluate(e=>e.scrollWidth<=e.clientWidth),'No horizontal overflow');const confirmBox=await page.getByTestId('warehouse-confirm').boundingBox();assert.ok(confirmBox.y>=0&&confirmBox.y+confirmBox.height<=568,'Confirm remains visible without scrolling');await page.screenshot({path:'tmp/warehouse-picker-small.png'});await page.getByTestId('warehouse-confirm').click();
 await page.setViewportSize({width:390,height:844});await page.getByTestId('warehouse-preference').click();await page.getByTestId('warehouse-option-wh-898220f69688').click();await page.getByTestId('warehouse-confirm').click();
 await page.evaluate(({line})=>localStorage.setItem('gostore-cart-fixture',JSON.stringify([line])),{line});await page.goto(base+'/checkout');await page.getByTestId('warehouse-preference').waitFor();assert.equal(await picker.count(),0,'Deep linked checkout not interrupted');assert.match(await page.getByTestId('warehouse-preference').innerText(),/Замын-Үүд/);
 await page.getByTestId('warehouse-preference').click();await page.getByTestId('warehouse-option-wh-9348267dc33a').click();await page.getByTestId('warehouse-confirm').click();
 await page.getByRole('textbox',{name:'Овог',exact:true}).fill('Fixture');await page.getByRole('button',{name:'Үнэ, хүргэлтийг шалгах',exact:true}).click();await page.getByRole('button',{name:/Захиалга үүсгэх/}).click();await page.getByText('Test captured. No real order.',{exact:true}).waitFor();assert.equal(bodies[0].pickup_location,'wh-9348267dc33a');assert.equal(bodies[0].fulfillment,'pickup');
 assert.deepEqual(errors,[]);console.log('PASS Expo warehouse picker: startup, saved reminder, no automatic GPS, optional recommendation without switching, manual change, small/dark layouts, deep links and checkout destination payload.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
