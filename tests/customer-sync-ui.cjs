const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),register=require('./customer-ui-helper.cjs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const CART='gostore-taobao-cart-v1',FAV='gostore-taobao-favorites-v1',MARK='gostore-state-sync-v2',OLD_MARK='gostore-state-sync-v1';
// The sync script runs on every page; /help needs no catalog, so these checks do not depend on the home feed.
const HOME='/help',STATE=base+'/api/index.php?action=customer-state&sync=2';
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const errors=[];
 const device=async()=>{const c=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await c.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;};
 const list=(p,key)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),key);
 const mark=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),MARK);
 const saved=p=>p.waitForResponse(r=>r.url().includes('action=customer-state-save'));
 const ready=p=>p.waitForFunction(()=>window.taobaoCart&&window.customerAccount);
 const account=async p=>(await p.request.get(STATE)).json();
 const login=async(p,customer)=>{const me=await(await p.request.get(base+'/api/index.php?action=customer-me')).json();assert.equal((await p.request.post(base+'/api/index.php?action=customer-login',{headers:{'X-CSRF-Token':me.csrf},data:{email:customer.email,password:'Ui-test-password-2026'}})).status(),200);};
 const line=(id,name)=>({id,sku:'555',qty:1,name,image:'',variant:'Хар',cny:10,min_qty:1,step:1,stock:null,vendor_id:''});
 const card=(id,name)=>({id,name,image:'https://img.alicdn.com/x.jpg',mnt:5500,min_qty:1,step:1,sellable:true,variants:[]});
 const down=p=>p.route(/action=customer-state-save/,r=>r.fulfill({status:503,json:{error:'down'}}));

 // Device A: a new account pushes its cart and saved product.
 const a=await device(),customer=await register(a,base);
 await a.goto(base+HOME);await a.waitForFunction(k=>localStorage.getItem(k),MARK);
 let save=saved(a);await a.evaluate(l=>taobaoCart.save([l]),line('tb-123456789','Device A bag'));assert.equal((await save).status(),200);
 save=saved(a);await a.evaluate(([k,c])=>{localStorage.setItem(k,JSON.stringify([c]));window.dispatchEvent(new Event('gostore-favorites-changed'));},[FAV,card('tb-123456789','Saved bag')]);assert.equal((await save).status(),200);

 // Device B: a guest cart line is kept and merged with the account on sign-in.
 const b=await device();await b.goto(base+HOME);await ready(b);
 await b.evaluate(l=>taobaoCart.save([l]),line('tb-987654321','Device B guest bag'));
 await login(b,customer);
 save=saved(b);await b.reload();await save;
 assert.deepEqual((await list(b,CART)).map(i=>i.id),['tb-987654321','tb-123456789'],'Guest line first, account line merged');
 assert.deepEqual((await list(b,FAV)).map(p=>p.id),['tb-123456789'],'Saved product reaches the other device');

 // A removal on B must not be resurrected by A's older copy.
 save=saved(b);await b.evaluate(()=>taobaoCart.save(taobaoCart.items().filter(i=>i.id!=='tb-123456789')));await save;
 await a.reload();await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'[]').map(i=>i.id).join()==='tb-987654321',CART);
 assert.deepEqual((await list(a,CART)).map(i=>i.id),['tb-987654321'],'Unchanged device takes the newer account cart');
 await a.waitForTimeout(1200);
 assert.deepEqual((await account(b)).cart.map(i=>i.id),['tb-987654321'],'Server keeps the removal');

 // An edit made while a save is in flight must still reach the server.
 await b.route(/action=customer-state-save/,async route=>{await new Promise(r=>setTimeout(r,1500));await route.continue();});
 const first=saved(b);await b.evaluate(l=>taobaoCart.save([...taobaoCart.items(),l]),line('tb-555555555','In-flight bag'));
 await b.waitForRequest(r=>r.url().includes('action=customer-state-save'));
 const second=b.waitForResponse(r=>r.url().includes('action=customer-state-save')&&r.request().postData().includes('"cart":[{"id":"tb-987654321"')&&!r.request().postData().includes('tb-555555555'));
 await b.evaluate(()=>taobaoCart.save(taobaoCart.items().filter(i=>i.id!=='tb-555555555')));await first;await second;await b.unroute(/action=customer-state-save/);
 assert.deepEqual((await account(b)).cart.map(i=>i.id),['tb-987654321'],'In-flight edit is pushed afterwards');

 // A push that fails must not be recorded as synced: the list is sent again on the next sync.
 await down(b);
 let failed=saved(b);await b.evaluate(l=>taobaoCart.save([...taobaoCart.items(),l]),line('tb-444444444','Offline bag'));assert.equal((await failed).status(),503);
 failed=saved(b);await b.reload();assert.equal((await failed).status(),503);
 await b.waitForFunction(([k,c])=>JSON.parse(localStorage.getItem(k)||'null')?.[c]==='',[MARK,CART]);
 assert.notEqual((await mark(b))[FAV],'','A list that needed no push stays marked as synced');
 assert.deepEqual((await account(b)).cart.map(i=>i.id),['tb-987654321'],'Nothing reached the account while saves failed');
 await b.unroute(/action=customer-state-save/);save=saved(b);await b.reload();assert.equal((await save).status(),200);
 assert.deepEqual((await account(b)).cart.map(i=>i.id),['tb-987654321','tb-444444444'],'The unsynced list is pushed once saves work again');
 await b.waitForFunction(([k,c])=>(JSON.parse(localStorage.getItem(k)||'null')?.[c]||'')!=='',[MARK,CART]);

 // Explicit logout leaves synced lists in the account, not on the device.
 await a.goto(base+'/account');const logout=a.locator('.account-logout');await logout.waitFor();await logout.click();
 await a.waitForFunction(()=>!customerAccount.user);
 assert.deepEqual([await list(a,CART),await list(a,FAV)],[[],[]],'Device cleared after logout');
 assert.equal(await a.evaluate(k=>localStorage.getItem(k),MARK),null);
 assert.equal((await account(b)).favorites.length,1,'Account keeps saved products');

 // A browser that lived through the 27 October – 19 November outage: the old script marked its lists as synced at
 // version 0 although every save failed. Its lists must be merged with the account, never replaced by it.
 const c=await device();await c.goto(base+HOME);await ready(c);
 await c.evaluate(([cartKey,favKey,oldMark,cart,fav,id])=>{const hash=v=>{const s=JSON.stringify(v);let h=5381;for(let i=0;i<s.length;i++)h=(Math.imul(h,33)^s.charCodeAt(i))>>>0;return h.toString(36)+':'+s.length;};
  localStorage.setItem(cartKey,JSON.stringify(cart));localStorage.setItem(favKey,JSON.stringify(fav));localStorage.setItem(oldMark,JSON.stringify({customer:id,version:0,[cartKey]:hash(cart),[favKey]:hash(fav)}));},
  [CART,FAV,OLD_MARK,[line('tb-222222222','Outage bag')],[card('tb-333333333','Outage saved')],customer.id]);
 await login(c,customer);save=saved(c);await c.reload();assert.equal((await save).status(),200);
 assert.equal(await c.evaluate(k=>localStorage.getItem(k),OLD_MARK),null,'The outage mark is dropped');
 assert.deepEqual((await list(c,CART)).map(i=>i.id),['tb-222222222','tb-987654321','tb-444444444'],'Its own cart line is kept and the account lines are added');
 assert.deepEqual((await list(c,FAV)).map(p=>p.id),['tb-333333333','tb-123456789'],'Its own saved product is kept');
 await c.waitForFunction(([k,x,y])=>{const m=JSON.parse(localStorage.getItem(k)||'null');return m&&m[x]&&m[y];},[MARK,CART,FAV]);
 const merged=await account(c);
 assert.deepEqual([merged.cart.map(i=>i.id),merged.favorites.map(p=>p.id)],[['tb-222222222','tb-987654321','tb-444444444'],['tb-333333333','tb-123456789']],'The account receives the merged lists');

 // A page still running the pre-fix script (no sync=2) keeps seeing an empty account and cannot overwrite it.
 const legacy=await(await c.request.get(base+'/api/index.php?action=customer-state')).json();
 assert.deepEqual([legacy.cart,legacy.favorites,legacy.version],[[],[],0],'Old pages see no account change, so they keep their own lists');
 const csrf=(await(await c.request.get(base+'/api/index.php?action=customer-me')).json()).csrf;
 assert.equal((await c.request.post(base+'/api/index.php?action=customer-state-save',{headers:{'X-CSRF-Token':csrf},data:{cart:[]}})).status(),426,'Old pages cannot save a stale list over the account');
 assert.equal((await account(c)).cart.length,3,'The refused save changed nothing');

 // Logging out while a list could not be saved keeps it on the device instead of clearing it.
 await down(c);failed=saved(c);await c.evaluate(l=>taobaoCart.save([...taobaoCart.items(),l]),line('tb-666666666','Unsaved bag'));assert.equal((await failed).status(),503);
 failed=saved(c);await c.goto(base+'/account');assert.equal((await failed).status(),503);
 const out=c.locator('.account-logout');await out.waitFor();await out.click();await c.waitForFunction(()=>!customerAccount.user);
 assert.ok((await list(c,CART)).some(i=>i.id==='tb-666666666'),'An unsaved cart line survives logout');
 assert.equal((await list(c,FAV)).length,2,'Lists are not cleared when one of them is unsaved');

 // An unpaid checkout is reminded on every page until paid or dismissed.
 await b.goto(base+'/v/tb-123456789');await b.locator('[data-pd-submit]').click();await b.locator('#taobao-checkout-form [name=family_name]').fill('Тест');
 await b.locator('#taobao-checkout-form [name=pickup_location]').selectOption({index:1});
 const created=b.waitForResponse(r=>r.url().includes('action=order-create'));await b.locator('#taobao-checkout-form [type=submit]').click();
 const order=(await(await created).json()).order;
 await b.goto(base+HOME);const bar=b.locator('.pending-pay');await bar.waitFor();
 assert.ok((await bar.innerText()).includes(order.id),'Reminder names the unpaid order');
 const box=await bar.boundingBox();assert.ok(box.y+box.height<=900&&box.height<=90,'Reminder floats inside the viewport');
 const again=b.waitForResponse(r=>r.url().includes('action=customer-state&sync=2'));await bar.locator('[data-pending-dismiss]').click();await b.reload();await again;await b.waitForTimeout(800);
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
 console.log('PASS customer sync: cross-device cart/saved merge, guest merge, removal propagation, failed pushes retried and never marked synced, outage marks merged not replaced, old pages gated, logout clearing only saved lists, unpaid reminder and dismissal, automatic payment confirmation.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
