const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){const jar=new Map();let csrf='';return async(action,body)=>{const r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;return {status:r.status,...d};};}
(async()=>{
 const admin=client();await admin('session');assert.equal((await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')))).status,200);
 const branches=[];
 for(const [city,address,phone] of [['Замын-Үүд','1-р баг Захиргааны замын эсрэг талд 117-р байр 3-р подваль','91117189'],['Сайншанд','Цахилгаан түгээхийн баруун талд Билэг дугуй сервис','88563280']]){
  const r=await admin('warehouse-create',{role:'ulaanbaatar',city,name:city+' салбар',address,phone,hours:'',email:'branch'+branches.length+'@example.com',password:'Test-branch-2026!'});assert.equal(r.status,201,JSON.stringify(r));branches.push(r.warehouse);
 }
 const publicCatalog=await(await fetch(base+'/api/index.php?action=catalog')).json();
 assert.equal(publicCatalog.shipping.pickup_locations.length,3);assert.equal(publicCatalog.shipping.pickup.name,'Улаанбаатар агуулах');
 assert.ok(publicCatalog.shipping.pickup_locations.every(p=>Object.keys(p).every(k=>['name','address','phone','hours','location','city'].includes(k))),'No accounts or internal profile fields exposed');
 // Inactive destinations vanish from both catalogue and promotion.
 assert.equal((await admin('warehouse-profile-save',{...branches[1],active:false})).status,200);
 const mobile=await(await fetch(base+'/api/mobile.php?action=catalog')).json();assert.equal(mobile.shipping.pickup_locations.length,2);
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await require('./customer-ui-helper.cjs')(p,base);
  const request=async(action,body)=>{const s=await(await p.request.get(base+'/api/index.php?action=customer-me')).json();const r=await p.request.post(base+'/api/index.php?action='+action,{headers:{'X-CSRF-Token':s.csrf},data:body});return{status:r.status(),...await r.json()};};
  assert.equal((await request('customer-self-cargo-create',{request_key:crypto.randomUUID(),title:'Inactive cargo fixture',qty:1,phone:'99112233',pickup_location:branches[1].location})).status,409,'Inactive forwarding destination rejected');
  const items=[{id:'tb-123456789',sku:'blue',qty:2}];const priced=await request('checkout-quote',{items});assert.equal(priced.status,200);
  const orderInput=extra=>({type:'checkout',title:'Branch fixture',family_name:'Тест',customer:'Захиалагч',phone:'99112233',items,expected_total:priced.quote.total,fulfillment:'pickup',token:crypto.randomBytes(32).toString('hex'),...extra});
  for(const location of ['does-not-exist','erenhot',branches[1].location])assert.equal((await request('order-create',orderInput({pickup_location:location}))).status,409);
  assert.equal((await request('order-create',orderInput({pickup_location:branches[0].location,fulfillment:'delivery',address:'UB address'}))).status,400);
  assert.equal((await admin('warehouse-profile-save',{...branches[1],active:true})).status,200);
  const zamyn=await request('order-create',orderInput({pickup_location:branches[0].location}));assert.equal(zamyn.status,201);assert.equal(zamyn.order.pickup_warehouse.location,branches[0].location);
  const legacy=await request('order-create',orderInput({}));assert.equal(legacy.status,201);assert.equal(legacy.order.pickup_warehouse.location,'ulaanbaatar','Older clients retain UB default');
  const delivery=await request('order-create',orderInput({fulfillment:'delivery',address:'UB address'}));assert.equal(delivery.status,201);assert.equal(delivery.order.pickup_warehouse,undefined);
  const fixtures=Array.from({length:4},(_,i)=>({id:'tb-'+(810000+i),name:'Fixture product',image:'/assets/hero-bag.webp',approx_mnt:25000,sellable:true}));
  await p.route('**/api/index.php?action=supplier-search*',r=>r.fulfill({json:{products:fixtures,more:false}}));
  await p.route('**/api/index.php?action=promo-popup*',r=>r.fulfill({json:{popup:null}}));
  await p.addInitScript(()=>sessionStorage.setItem('gostore-warehouse-reminded-v1','1'));await p.goto(base+'/');await p.locator('#branch-promo').waitFor();assert.match(await p.locator('#branch-promo').innerText(),/Улаанбаатар[\s\S]*Замын-Үүд[\s\S]*Сайншанд/);assert.equal(await p.locator('#branch-promo article').count(),3);assert.equal(await p.locator('#branch-promo h2').innerText(),'Хүлээн авах боломжтой агуулах');
  assert.equal(await p.locator('#branch-promo a[href="tel:91117189"]').count(),1);
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow at '+width);}
  await p.locator('#branch-promo').screenshot({path:'tmp/branch-promo-desktop.png'});
  await p.locator('[data-theme-toggle]').click();assert.notEqual(await p.locator('#branch-promo').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');await p.locator('#branch-promo').screenshot({path:'tmp/branch-promo-dark.png'});
  await p.locator('[data-theme-toggle]').click();await p.setViewportSize({width:390,height:844});await p.locator('#branch-promo').screenshot({path:'tmp/branch-promo-mobile.png'});
  await p.locator('#branch-promo .button').click();await p.waitForURL('**/products');assert.equal(await p.locator('#branch-promo').isVisible(),false);
  await p.goto(base+'/');await p.waitForFunction(()=>window.storeServer?.ready);
  await p.evaluate(()=>{window.taobaoCart.save([{id:'tb-123456789',sku:'blue',qty:2,name:'Fixture',variant:'blue',cny:10,min_qty:2,step:2}]);return window.taobaoCart.checkout('',null);});
  const f=p.locator('#taobao-checkout-form');await f.waitFor();assert.equal(await f.locator('[name=pickup_location] option').count(),4);
  await f.locator('[name=pickup_location]').selectOption(branches[1].location);assert.match(await f.locator('[data-pickup-info]').innerText(),/Билэг дугуй сервис[\s\S]*88563280/);
  await f.locator('[value=delivery]').check();assert.ok(await f.locator('[name=pickup_location]').isDisabled());assert.equal(await f.locator('[data-pickup-info]').isVisible(),false);
  await f.locator('[value=pickup]').check();assert.equal(await f.locator('[name=pickup_location]').inputValue(),branches[1].location);
  await f.locator('[name=family_name]').fill('Тест');await f.screenshot({path:'tmp/branch-checkout-mobile.png'});
  const saved=p.waitForResponse(r=>r.url().includes('action=order-create'));await f.locator('[type=submit]').click();const response=await saved;assert.equal(response.status(),201);const sain=(await response.json()).order;assert.equal(sain.pickup_warehouse.location,branches[1].location);assert.equal(sain.delivery_address,'');
  const dashboard=await admin('dashboard');for(const [id,location] of [[zamyn.order.id,branches[0].location],[sain.id,branches[1].location],[legacy.order.id,'ulaanbaatar'],[delivery.order.id,'ulaanbaatar']]){const stored=dashboard.orders.find(o=>o.id===id);assert.equal(stored.warehouse_locations.ulaanbaatar,location);assert.equal(stored.warehouse_locations.erenhot,'erenhot');}
  const forwarding={request_key:crypto.randomUUID(),title:'Branch cargo fixture',qty:1,phone:'99112233',pickup_location:branches[1].location};
  const cargo=await request('customer-self-cargo-create',forwarding);assert.equal(cargo.status,201,JSON.stringify(cargo));
  const repeated=await request('customer-self-cargo-create',{...forwarding,pickup_location:branches[0].location});assert.equal(repeated.order.id,cargo.order.id);
  const updated=await admin('dashboard');assert.equal(updated.orders.find(o=>o.id===cargo.order.id).warehouse_locations.ulaanbaatar,branches[1].location,'Forwarding destination saved and unchanged on idempotent retry');
  for(const location of ['does-not-exist','erenhot'])assert.equal((await request('customer-self-cargo-create',{...forwarding,request_key:crypto.randomUUID(),pickup_location:location})).status,409);
  assert.deepEqual(errors,[]);console.log('PASS branch checkout: three public pickup points, legacy/mobile catalogue, active/role validation, delivery restriction, stored routing, responsive promotion, checkout submission and forwarding routing/idempotency.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
