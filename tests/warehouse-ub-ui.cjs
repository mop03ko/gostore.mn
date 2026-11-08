const {chromium}=require('../tmp/tooling/node_modules/playwright'),fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Ulaanbaatar screens: batch check-in by camera (scanner stays open) and partial receipt, one-step sorting with the
// bill preview, waiting cards and tags, counter handover by phone and pickup code, courier run and its printout.
function client(){const jar=new Map();let csrf='';return async(action,body)=>{const form=body instanceof FormData,r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'X-CSRF-Token':csrf,...(!form?{'Content-Type':'application/json'}:{})}:{})},body:body?(form?body:JSON.stringify(body)):undefined});for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;assert.ok(r.ok,action+' '+JSON.stringify(d));return d;};}
const fixture=(...args)=>{const r=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','-d','extension=mbstring','tests/warehouse-ub-fixture.php',...args.map(String)],{encoding:'utf8',env:process.env});assert.equal(r.status,0,r.stderr+r.stdout);};
const receipt=()=>{const f=new FormData();f.set('image',new Blob([fs.readFileSync('assets/chair.jpg')],{type:'image/jpeg'}),'receipt.jpg');return f;};
(async()=>{
 const [A,B,C,D]=['GS-TEST-050','GS-TEST-051','GS-TEST-052','GS-TEST-053'];
 const admin=client(),cn=client(),ub=client(),owner=client();await admin('session');await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));
 const ubLogin={location:'ulaanbaatar',email:'ub-ui@example.test',password:'Warehouse-ub-ui-2026',enabled:true},cnLogin={location:'erenhot',email:'cn-ub-ui@example.test',password:'Warehouse-ub-ui-2026',enabled:true};
 for(const [login,c] of [[cnLogin,cn],[ubLogin,ub]]){await admin('warehouse-account-save',login);await c('warehouse-session');await c('warehouse-login',login);}
 fixture('setup');await owner('catalog');const password='Ub-ui-customer-2026';await owner('customer-register',{email:crypto.randomBytes(5).toString('hex')+'@example.test',name:'Ану',phone:'99115050',password,password_confirm:password});
 await owner('customer-claim-order',{id:A,token:crypto.createHash('sha256').update('warehouse-fixture-50').digest('hex')});
 // Erenhot (API): receive with freight, pack and dispatch; A pays its early freight bill on the way.
 for(const id of [A,B,C,D]){let o=(await cn('warehouse-order&id='+id)).order;const f=receipt();f.set('id',id);f.set('expected_version',String(o.logistics.version));o=(await cn('warehouse-photo-upload',f)).order;await cn('warehouse-receive',{id,expected_status:o.status,expected_version:o.logistics.version,weight_kg:2,volume_input:'dimensions',length_cm:10,width_cm:10,height_cm:10,pieces:2,checked:true});}
 let batch=(await cn('warehouse-outbound-pack',{token:crypto.randomBytes(32).toString('hex'),order_ids:[A,B,C,D],codes:[A,B,C,D]})).batch;batch=(await cn('warehouse-batch-dispatch',{id:batch.id,expected_version:batch.version,checked:true})).batch;fixture('pay',A);
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.print=()=>{window.printed=(window.printed||0)+1;};});
  await page.goto(base+'/warehouse/?location=ulaanbaatar');await page.locator('[name=email]').fill(ubLogin.email);await page.locator('[name=password]').fill(ubLogin.password);await page.locator('#login-form button').click();await page.locator('#app').waitFor({state:'visible'});
  const post=async(name,fn)=>{const pending=page.waitForResponse(r=>r.url().includes('action='+name+'&')&&r.request().method()==='POST');await fn();const r=await pending;assert.equal(r.status(),200,await r.text());return r.json();};
  for(const id of ['#handover-open','#delivery-open','#unpaid-stat','#stale-stat'])assert.equal(await page.locator(id).isVisible(),true,id);assert.equal(await page.locator('#create-batch').isVisible(),false);
  // Batch check-in: one label by camera (the scanner stays open), two by the scanner gun; the fourth is missing.
  await page.locator('#scan-code').fill(batch.id);await page.locator('#scan-form button').click();await page.waitForFunction(b=>document.querySelector('#editor-title')?.textContent===b,batch.id);
  await page.locator('#editor-body [data-scan-camera]').click();await page.locator('#qr-scanner[open]').waitFor();
  const label=await page.evaluate(async code=>{const q=qrcode(0,'M');q.addData(code);q.make();const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(q.createSvgTag({cellSize:8,margin:32,scalable:true}));await img.decode();const c=document.createElement('canvas');c.width=c.height=480;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,480,480);x.drawImage(img,0,0,480,480);return c.toDataURL('image/png').split(',')[1];},A);
  await page.locator('#qr-file').setInputFiles({name:'label.png',mimeType:'image/png',buffer:Buffer.from(label,'base64')});
  await page.waitForFunction(()=>/Тулгасан 1 \/ 4/.test(document.querySelector('#qr-status').textContent));assert.equal(await page.locator('#qr-scanner').evaluate(e=>e.open),true,'Scanner stays open');await page.locator('#qr-close').click();
  for(const [i,id] of [[2,B],[3,C]]){await page.locator('[data-batch-scan] [name=order_id]').fill(id);await post('warehouse-batch-scan',()=>page.locator('[data-batch-scan] [name=order_id]').press('Enter'));await page.waitForFunction(n=>new RegExp('Тулгасан: '+n+' / 4').test(document.querySelector('#editor-body .scan-panel')?.innerText||''),i);}
  const receive=page.locator('[data-operation=batch-receive]');assert.match(await receive.innerText(),/уншигдаагүй 1 захиалгад/);await receive.locator('[name=partial]').check();
  let d=await post('warehouse-batch-receive',()=>receive.locator('button').click());assert.equal(d.batch.status,'received');
  // One-step sorting: A paid early (bill and method locked); B shows the live bill with the amount due.
  await page.locator(`.manifest [data-order="${A}"]`).click();await page.waitForFunction(id=>document.querySelector('#editor-title').textContent===id,A);
  let f=page.locator('[data-ub-sort]');assert.equal(await page.locator('[data-photo-upload],[data-logistics=warehouse-shelf]').count(),0,'Photo and shelf are part of the sorting form');
  assert.equal(await f.locator('[name=method]').isDisabled(),true);assert.match(await f.locator('[data-ub-bill]').innerText(),/үлдэгдэл 0₮/);
  await f.locator('[name=image]').setInputFiles('assets/chair.jpg');await f.locator('[name=shelf]').fill('A-01');await f.locator('[name=checked]').check();
  await page.setViewportSize({width:390,height:2200});await page.locator('#editor').screenshot({path:'tmp/warehouse-ub-sort.png'});await page.setViewportSize({width:390,height:844});
  d=await post('warehouse-sort',()=>f.locator('button.primary').click());assert.equal(d.order.status,'ready_pickup');await page.locator(`[data-ub-handover-open="${A}"]`).waitFor();
  await page.locator(`#editor-body .batch-link[data-batch="${batch.id}"]`).first().click();await page.waitForFunction(b=>document.querySelector('#editor-title').textContent===b,batch.id);
  await page.locator(`.manifest [data-order="${B}"]`).click();await page.waitForFunction(id=>document.querySelector('#editor-title').textContent===id,B);f=page.locator('[data-ub-sort]');
  assert.match(await f.locator('[data-ub-bill]').innerText(),/^Нийт .*карго .*үлдэгдэл [1-9][\d,]*₮$/);
  await f.locator('[name=method]').selectOption('delivery');assert.equal(await f.locator('[data-ub-address]').isVisible(),true);await f.locator('[name=delivery_mnt]').fill('5000');assert.match(await f.locator('[data-ub-bill]').innerText(),/УБ хүргэлт 5,000₮/);await f.locator('[name=method]').selectOption('pickup');
  await f.locator('[name=image]').setInputFiles('assets/chair.jpg');await f.locator('[name=shelf]').fill('A-02');await f.locator('[name=checked]').check();d=await post('warehouse-sort',()=>f.locator('button.primary').click());assert.ok(d.order.billing.due>0);
  // C is sorted for delivery and paid (API); waiting cards and tags in the list.
  let o=(await ub('warehouse-order&id='+C)).order;const fc=receipt();fc.set('id',C);fc.set('expected_version',String(o.logistics.version));o=(await ub('warehouse-photo-upload',fc)).order;
  await ub('warehouse-sort',{id:C,expected_status:o.status,expected_version:o.logistics.version,shelf:'D-01',method:'delivery',address:'Хан-Уул, 3-р хороо',delivery_mnt:5000,contact_phone:'88001122',checked:true});fixture('pay',C);
  await page.locator('#close-editor').click();await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#unpaid-count').textContent==='1');
  await page.locator('#unpaid-stat').click();await page.waitForFunction(()=>document.querySelectorAll('#records .order-card').length===1);assert.match(await page.locator('#records .order-card').innerText(),/Тавиур A-02[\s\S]*Төлбөр хүлээж буй/);
  await page.screenshot({path:'tmp/warehouse-ub-list.png',fullPage:true});
  // Counter handover: phone search lists both orders (B unpaid); A's pickup code completes it.
  await page.locator('#handover-open').click();await page.waitForFunction(()=>document.querySelector('#editor-title').textContent==='Хүлээлгэн өгөх');
  await page.locator('[data-ub-find] [name=q]').fill('9911 5050');await page.locator('[data-ub-find] button').click();await page.waitForFunction(()=>document.querySelectorAll('.ub-handover-list li').length===2);
  assert.match(await page.locator('.ub-handover-list').innerText(),/A-01[\s\S]*GS-TEST-050[\s\S]*A-02[\s\S]*GS-TEST-051[\s\S]*Үлдэгдэл .* төлөөгүй/);assert.equal(await page.locator('[data-ub-handover]').isDisabled(),true);
  const code=(await owner('order-get',{id:A})).order.cargo.pickup_code;assert.match(code,/^\d{8}$/);
  await page.locator(`[data-ub-code="${A}"]`).fill(code);assert.equal(await page.locator('[data-ub-handover]').innerText(),'Хүлээлгэн өгөх (1)');
  await page.locator('[data-ub-handover]').click();await page.waitForFunction(()=>/хүлээн авсан хүний нэр/i.test(document.querySelector('#editor-body .error').textContent));
  await page.locator('[data-ub-received]').fill('Ану');await page.setViewportSize({width:390,height:1400});await page.locator('#editor').screenshot({path:'tmp/warehouse-ub-handover.png'});await page.setViewportSize({width:390,height:844});
  d=await post('warehouse-handover',()=>page.locator('[data-ub-handover]').click());assert.deepEqual(d.orders.map(x=>[x.id,x.status]),[[A,'completed']]);await page.waitForFunction(()=>document.querySelectorAll('.ub-handover-list li').length===0);
  // Courier run: the paid delivery order goes with a courier; the list prints.
  await page.locator('#close-editor').click();await page.locator('#delivery-open').click();await page.waitForFunction(()=>document.querySelector('#editor-title').textContent==='Хүргэлтэд гаргах');
  assert.equal(await page.locator(`[data-ub-pick="${C}"]`).isChecked(),true);await page.locator('[data-ub-courier-name]').fill('Бат');await page.locator('[data-ub-courier-phone]').fill('95001122');
  d=await post('warehouse-delivery-dispatch',()=>page.locator('[data-ub-dispatch]').click());assert.equal(d.orders[0].status,'out_for_delivery');
  await page.locator('[data-ub-print-run]').click();assert.equal(await page.evaluate(()=>window.printed),1);assert.match(await page.locator('#print-area').innerText(),/Хүргэлтийн жагсаалт[\s\S]*Бат · 95001122[\s\S]*GS-TEST-052[\s\S]*D-01[\s\S]*Хан-Уул/);
  // Admin refund: B is paid, then its bill goes down; the admin records the refund from the order screen.
  fixture('pay',B);o=(await ub('warehouse-order&id='+B)).order;const sb=o.settlement.breakdown;
  await ub('warehouse-settlement',{id:B,expected_version:o.logistics.version,goods_mnt:sb.goods_mnt-7000,domestic_mnt:sb.domestic_mnt,service_mnt:sb.service_mnt,delivery_mnt:0,cargo_method:o.logistics.transport.method,note:'Нэг бараа гэмтсэн'});
  const adminPage=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage(),auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));adminPage.on('pageerror',e=>errors.push(e.message));
  await adminPage.goto(base+'/admin/');await adminPage.locator('[name=email]').fill(auth.email);await adminPage.locator('[name=password]').fill(auth.password);await adminPage.locator('#login-form button').click();await adminPage.locator('#app').waitFor({state:'visible'});
  await adminPage.evaluate(id=>editOrder(id),B);const rf=adminPage.locator('#refund-form');await rf.waitFor();assert.match(await adminPage.locator('#editor-body').innerText(),/Буцаах: 7,000 ₮/);
  await rf.locator('[name=note]').fill('Хаан банк · 123');const refunded=adminPage.waitForResponse(r=>r.url().includes('action=order-refund'));await rf.locator('button').click();assert.equal((await refunded).status(),200);
  await adminPage.waitForFunction(()=>!document.querySelector('#refund-form')&&/буцаасан 7,000 ₮/.test(document.querySelector('#editor-body').innerText));await adminPage.locator('#editor').screenshot({path:'tmp/admin-refund.png'});
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow '+width);assert.ok(await page.locator('#editor').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No dialog overflow '+width);}
  assert.deepEqual(errors,[]);console.log('PASS Ulaanbaatar UI: camera batch check-in (scanner stays open) and partial receipt, one-step sorting (locked early bill, live bill with delivery fee), waiting card and tags, counter handover by phone and pickup code, courier run and printout, admin refund form, 320–1440px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
