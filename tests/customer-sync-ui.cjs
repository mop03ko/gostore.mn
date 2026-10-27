const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),register=require('./customer-ui-helper.cjs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const CART='gostore-taobao-cart-v1',FAV='gostore-taobao-favorites-v1';
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const errors=[];
 const device=async()=>{const c=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await c.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;};
 const list=(p,key)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),key);
 const saved=p=>p.waitForResponse(r=>r.url().includes('action=customer-state-save'));
 const line=(id,name)=>({id,sku:'555',qty:1,name,image:'',variant:'Хар',cny:10,min_qty:1,step:1,stock:null,vendor_id:''});

 // Device A: a new account pushes its cart and saved product.
 const a=await device(),customer=await register(a,base);
 await a.goto(base+'/');await a.locator('.supplier-card').first().waitFor();await a.waitForFunction(()=>localStorage.getItem('gostore-state-sync-v1'));
 let save=saved(a);await a.evaluate(l=>taobaoCart.save([l]),line('tb-123456789','Device A bag'));assert.equal((await save).status(),200);
 save=saved(a);await a.evaluate(k=>{localStorage.setItem(k,JSON.stringify([{id:'tb-123456789',name:'Saved bag',image:'https://img.alicdn.com/x.jpg',mnt:5500,min_qty:1,step:1,sellable:true,variants:[]}]));window.dispatchEvent(new Event('gostore-favorites-changed'));},FAV);assert.equal((await save).status(),200);

 // Device B: a guest cart line is kept and merged with the account on sign-in.
 const b=await device();await b.goto(base+'/');await b.locator('.supplier-card').first().waitFor();
 await b.evaluate(l=>taobaoCart.save([l]),line('tb-987654321','Device B guest bag'));
 const me=await(await b.request.get(base+'/api/index.php?action=customer-me')).json();
 assert.equal((await b.request.post(base+'/api/index.php?action=customer-login',{headers:{'X-CSRF-Token':me.csrf},data:{email:customer.email,password:'Ui-test-password-2026'}})).status(),200);
 save=saved(b);await b.reload();await save;
 assert.deepEqual((await list(b,CART)).map(i=>i.id),['tb-987654321','tb-123456789'],'Guest line first, account line merged');
 assert.deepEqual((await list(b,FAV)).map(p=>p.id),['tb-123456789'],'Saved product reaches the other device');

 // A removal on B must not be resurrected by A's older copy.
 save=saved(b);await b.evaluate(()=>taobaoCart.save(taobaoCart.items().filter(i=>i.id!=='tb-123456789')));await save;
 await a.reload();await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'[]').length===1,CART);
 assert.deepEqual((await list(a,CART)).map(i=>i.id),['tb-987654321'],'Unchanged device takes the newer account cart');
 await a.waitForTimeout(1200);
 const server=await(await b.request.get(base+'/api/index.php?action=customer-state')).json();
 assert.deepEqual(server.cart.map(i=>i.id),['tb-987654321'],'Server keeps the removal');

 // An edit made while a save is in flight must still reach the server.
 await b.route(/action=customer-state-save/,async route=>{await new Promise(r=>setTimeout(r,1500));await route.continue();});
 const first=saved(b);await b.evaluate(l=>taobaoCart.save([...taobaoCart.items(),l]),line('tb-555555555','In-flight bag'));
 await b.waitForRequest(r=>r.url().includes('action=customer-state-save'));
 const second=b.waitForResponse(r=>r.url().includes('action=customer-state-save')&&r.request().postData().includes('"cart":[{"id":"tb-987654321"')&&!r.request().postData().includes('tb-555555555'));
 await b.evaluate(()=>taobaoCart.save(taobaoCart.items().filter(i=>i.id!=='tb-555555555')));await first;await second;await b.unroute(/action=customer-state-save/);
 assert.deepEqual((await(await b.request.get(base+'/api/index.php?action=customer-state')).json()).cart.map(i=>i.id),['tb-987654321'],'In-flight edit is pushed afterwards');

 // Explicit logout leaves synced lists in the account, not on the device.
 await a.goto(base+'/account');const logout=a.locator('.account-logout');await logout.waitFor();await logout.click();
 await a.waitForFunction(()=>!customerAccount.user);
 assert.deepEqual([await list(a,CART),await list(a,FAV)],[[],[]],'Device cleared after logout');
 assert.equal(await a.evaluate(()=>localStorage.getItem('gostore-state-sync-v1')),null);
 assert.equal((await(await b.request.get(base+'/api/index.php?action=customer-state')).json()).favorites.length,1,'Account keeps saved products');

 // An unpaid checkout is reminded on every page until paid or dismissed.
 await b.goto(base+'/v/tb-123456789');await b.locator('[data-pd-submit]').click();await b.locator('#taobao-checkout-form [name=family_name]').fill('Тест');
 const created=b.waitForResponse(r=>r.url().includes('action=order-create'));await b.locator('#taobao-checkout-form [type=submit]').click();
 const order=(await(await created).json()).order;
 await b.goto(base+'/');const bar=b.locator('.pending-pay');await bar.waitFor();
 assert.ok((await bar.innerText()).includes(order.id),'Reminder names the unpaid order');
 const box=await bar.boundingBox();assert.ok(box.y+box.height<=900&&box.height<=90,'Reminder floats inside the viewport');
 await bar.locator('[data-pending-dismiss]').click();await b.reload();await b.locator('.supplier-card').first().waitFor();await b.waitForTimeout(800);
 assert.equal(await b.locator('.pending-pay').count(),0,'Dismissed reminder stays hidden in this tab');

 // Once the QPay callback marks the order paid, the open invoice turns into a confirmation.
 let paid=false;
 await b.route(/action=order-get/,async route=>{const response=await route.fetch(),body=await response.json();
  if(paid){body.order.paid=true;body.order.status='confirmed';delete body.order.invoice;}else{body.order.paid=false;body.order.invoice={state:'ready',qr_image:'',urls:[]};}
  await route.fulfill({response,json:body});});
 await b.evaluate(id=>viewServerOrder(id),order.id);await b.locator('#modal .cargo-detail').waitFor();
 paid=true;const success=b.locator('#modal .payment-success');await success.waitFor({timeout:12000});
 assert.ok((await success.innerText()).includes(order.id),'Confirmation names the order');
 await success.locator('[data-payment-done]').click();await b.waitForFunction(()=>!document.querySelector('#modal').open);
 assert.deepEqual(errors,[],'No JavaScript errors');
 console.log('PASS customer sync: cross-device cart/saved merge, guest merge, removal propagation, logout clearing, unpaid reminder and dismissal, automatic payment confirmation.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
