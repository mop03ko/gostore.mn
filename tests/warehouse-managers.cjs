const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('../tmp/tooling/node_modules/playwright');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(initial={}){const jar=new Map(Object.entries(initial));let csrf='';return {jar,async call(action,body,bad=false){const r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json','X-CSRF-Token':bad?'bad':csrf}:{})},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;return {...d,status:r.status};}};}
(async()=>{
 const admin=client(),primary=client(),second=client(),third=client(),auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')),password='Manager-isolation-2026!';
 await admin.call('session');assert.equal((await admin.call('login',auth)).status,200);
 const first={location:'ulaanbaatar',email:'primary@example.test',password,enabled:true};
 assert.equal((await admin.call('warehouse-account-save',first)).status,200);
 const added={location:'ulaanbaatar',manager_id:'new',name:'Second manager',email:'second@example.test',password,enabled:true};
 assert.equal((await admin.call('warehouse-account-save',added,true)).status,403);
 let result=await admin.call('warehouse-account-save',added);assert.equal(result.status,200,JSON.stringify(result));
 const id=result.account.managers.find(m=>m.email===added.email).id;
 assert.match(id,/^wm-[a-f0-9]{24}$/);assert.equal(result.account.managers.length,2);
 assert.ok(!/password_hash|"version"/.test(JSON.stringify(result.account)));
 assert.equal((await admin.call('warehouse-account-save',{...added,email:'SECOND@example.test'})).status,409);
 assert.equal((await admin.call('warehouse-account-save',{...first,email:added.email})).status,409);
 assert.equal((await admin.call('warehouse-account-save',{...added,manager_id:id,location:'erenhot'})).status,404);
 for(const [c,a] of [[primary,first],[second,added]]){await c.call('warehouse-session');assert.equal((await c.call('warehouse-login',a)).status,200);assert.equal((await c.call('warehouse-orders')).email,a.email);}
 const token=second.jar.get('gostore_warehouse_device'),restored=client({gostore_warehouse_device:token});
 assert.equal((await restored.call('warehouse-session')).authenticated,true);
 assert.equal((await restored.call('warehouse-orders')).email,added.email);
 assert.notEqual((await second.call('warehouse-account-save',{...added,email:'intruder@example.test'})).status,200);
 const wrong=client();await wrong.call('warehouse-session');assert.equal((await wrong.call('warehouse-login',{...added,location:'erenhot'})).status,401);
 // Each push subscription is tied to its own manager version, not the primary manager.
 const registrations=[];
 for(const [i,c] of [primary,second].entries()){
   const config=await c.call('warehouse-push-config');
   const sub=await c.call('warehouse-push-subscribe',{public_key:config.public_key,endpoint:'https://fcm.googleapis.com/fcm/send/manager-test-'+i});
   assert.equal(sub.status,200,JSON.stringify(sub));registrations.push(sub);
 }
 const push=async t=>(await fetch(base+'/api/index.php?action=warehouse-push-delivery',{headers:{'X-Gostore-Push-Token':t}})).status;
 assert.equal(await push(registrations[1].token),200);
 result=await admin.call('warehouse-account-save',{...added,manager_id:id,password:'',enabled:false});assert.equal(result.status,200);
 assert.equal((await second.call('warehouse-orders')).status,401);
 assert.equal((await client({gostore_warehouse_device:token}).call('warehouse-session')).authenticated,false);
 assert.equal(await push(registrations[1].token),401);assert.equal(await push(registrations[0].token),200);
 assert.equal((await primary.call('warehouse-orders')).status,200);
 const updated={...added,manager_id:id,password:'Changed-manager-password-2026',enabled:true};await admin.call('warehouse-account-save',updated);
 await third.call('warehouse-session');assert.equal((await third.call('warehouse-login',added)).status,401);assert.equal((await third.call('warehouse-login',updated)).status,200);
 await admin.call('warehouse-account-save',{...first,password:'Primary-updated-password-2026'});
 assert.equal((await primary.call('warehouse-orders')).status,401);assert.equal((await third.call('warehouse-orders')).status,200);
 const operator=client(),op={email:'manager-operator@example.test',name:'Operator',role:'operator',active:true,password};
 assert.equal((await admin.call('admin-user-save',op)).status,200);await operator.call('session');assert.equal((await operator.call('login',op)).status,200);
 assert.equal((await operator.call('warehouse-account-save',added)).status,403,'Ordinary admins cannot grant warehouse access');
 const branch={role:'ulaanbaatar',city:'Test branch',name:'Managers isolated branch',address:'Test address',phone:'99112233',hours:'09:00–18:00',email:'branch-primary@example.test',password};
 const created=await admin.call('warehouse-create',branch);assert.equal(created.status,201);
 const location=created.warehouse.location,extra={...added,location,email:'branch-extra@example.test'};
 assert.equal((await admin.call('warehouse-account-save',extra)).status,200);
 const branchClient=client();await branchClient.call('warehouse-session');assert.equal((await branchClient.call('warehouse-login',extra)).status,200);
 assert.equal((await branchClient.call('warehouse-order&id=GS-TEST-001')).status,404,'Managers cannot read another warehouse order');
 const branchToken=branchClient.jar.get('gostore_warehouse_device');
 for(const active of [false,true])assert.equal((await admin.call('warehouse-profile-save',{...branch,location,active})).status,200);
 assert.equal((await client({gostore_warehouse_device:branchToken}).call('warehouse-session')).authenticated,false,'Reopening a branch must not revive revoked manager sessions');
 // Real admin UI adds and disables a third account without replacing existing managers.
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
   const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/admin/');await page.locator('[name=email]').fill(auth.email);await page.locator('[name=password]').fill(auth.password);await page.locator('#login-form button').click();await page.locator('#app').waitFor({state:'visible'});
   await page.locator('nav button').filter({hasText:'Агуулах'}).click();
   await page.locator('[data-manager-add="ulaanbaatar"]').click();
   await page.setViewportSize({width:390,height:844});
   const form=page.locator('#warehouse-manager-form');await form.locator('[name=name]').fill('UI Manager');await form.locator('[name=email]').fill('ui-manager@example.test');await form.locator('[name=password]').fill(password);await form.locator('button').click();await page.locator('#editor').waitFor({state:'hidden'});
   const card=page.locator('[data-warehouse-card="ulaanbaatar"]');await card.locator('li').filter({hasText:'ui-manager@example.test'}).waitFor();
   assert.equal(await card.locator('.warehouse-managers li').count(),3);
   await card.locator('li').filter({hasText:'ui-manager@example.test'}).locator('button').click();await form.locator('[name=enabled]').uncheck();await form.locator('button').click();await page.locator('#editor').waitFor({state:'hidden'});
   await page.waitForFunction(()=>[...document.querySelectorAll('.warehouse-managers li')].some(e=>e.textContent.includes('ui-manager@example.test')&&e.textContent.includes('Эрх хаасан')));
   for(const width of [390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
   assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 console.log('PASS multiple warehouse managers: admin UI add/edit/disable, duplicate and cross-warehouse guards, CSRF, separate passwords/sessions/device restore/push revocation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
