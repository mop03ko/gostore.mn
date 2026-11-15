const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),{chromium}=require('../tmp/tooling/node_modules/playwright');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(mobile=false){const jar=new Map();let csrf='',token='';return async(action,body,bad=false)=>{const r=await fetch(base+'/api/'+(mobile?'mobile':'index')+'.php?action='+action,{method:body?'POST':'GET',headers:{...(mobile?{'X-GOStore-Mobile-Token':token}:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}),...(body?{'Content-Type':'application/json','X-CSRF-Token':bad?'bad':csrf}:{})},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}token=r.headers.get('X-GOStore-Mobile-Token')||token;const d=await r.json();csrf=d.csrf||csrf;return {...d,status:r.status};};}
(async()=>{
 execFileSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','tests/phone-auth-fixtures.php'],{env:process.env});
 const owner=client(),user=client(),mobile=client(true),other=client(),op=client(),auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));
 await owner('session');assert.equal((await owner('login',auth)).status,200);
 const login={email:'reset@example.test',name:'Reset Test',password:'Original-password-2026',password_confirm:'Original-password-2026'};
 await user('customer-me');const registered=await user('customer-register',login);assert.equal(registered.status,201);const id=registered.customer.id;
 await mobile('customer-me');assert.equal((await mobile('customer-login',login)).status,200);
 await other('customer-me');const otherLogin={...login,email:'other@example.test'};assert.equal((await other('customer-register',otherLogin)).status,201);
 const detail=async target=>(await owner('admin-customer&id='+target)).customer;
 const make=async(target,kind,secret)=>{const c=await detail(target);return {id:target,operation:'reset-credential',kind,expected_version:c.credential_version,expected_login:kind==='pin'?c.login_phone:c.email,new_password:secret,password_confirm:secret};};
 const reset=await make(id,'password','Replacement-password-2026');
 assert.equal((await owner('admin-customer-save',reset,true)).status,403);
 const operator={email:'reset-operator@example.test',name:'Operator',role:'operator',active:true,password:'Operator-password-2026'};assert.equal((await owner('admin-user-save',operator)).status,200);await op('session');await op('login',operator);
 assert.equal((await op('admin-customer-save',reset)).status,403);
 assert.equal((await user('admin-customer-save',reset)).status,403);
 assert.equal((await owner('admin-customer-save',{...reset,password_confirm:'mismatch'})).status,400);
 assert.equal((await owner('admin-customer-save',{...reset,new_password:'short',password_confirm:'short'})).status,400);
 // A successful reset clears the target's credential lockout, not shared IP limits.
 execFileSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','-r',"require 'server/bootstrap.php';db()->prepare('INSERT OR REPLACE INTO limits VALUES (?,?,?)')->execute([hash('sha256','customer-login-email:reset@example.test'),10,time()+900]);"],{env:process.env});
 let r=await owner('admin-customer-save',reset);assert.equal(r.status,200,JSON.stringify(r));assert.ok(!JSON.stringify(r).includes(reset.new_password));
 assert.equal((await user('customer-me')).customer,null);assert.equal((await mobile('customer-me')).customer,null);
 assert.ok((await other('customer-me')).customer,'Other users stay signed in');
 assert.equal((await user('customer-login',login)).status,401);assert.equal((await user('customer-login',{...login,password:reset.new_password})).status,200);
 assert.equal((await owner('admin-customer-save',reset)).status,409,'A stale reset form cannot overwrite new credentials');
 const pinClient=client();await pinClient('customer-me');assert.equal((await pinClient('customer-pin-login',{phone:'99112233',pin:'0123'})).status,200);
 const pinReset=await make('pin-fixture','pin','9876');assert.equal((await owner('admin-customer-save',{...pinReset,new_password:'bad!',password_confirm:'bad!'})).status,400);
 assert.equal((await owner('admin-customer-save',pinReset)).status,200);assert.equal((await pinClient('customer-me')).customer,null);
 assert.equal((await pinClient('customer-pin-login',{phone:'99112233',pin:'0123'})).status,401);assert.equal((await pinClient('customer-pin-login',{phone:'99112233',pin:'9876'})).status,200);
 const unavailable=await make('pin-fixture','password','Unavailable-password-2026');assert.equal((await owner('admin-customer-save',{...unavailable,expected_login:'not-real@example.test'})).status,409);
 const audit=await owner('admin-audit');assert.ok(audit.rows.some(a=>a.target===id&&a.detail.includes('reset-credential')));assert.ok(!JSON.stringify(audit).includes(reset.new_password));assert.ok(!JSON.stringify(audit).includes('9876'));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/admin/');await page.locator('[name=email]').fill(auth.email);await page.locator('[name=password]').fill(auth.password);await page.locator('#login-form button').click();await page.locator('#app').waitFor({state:'visible'});
   await page.locator('nav [data-page=customers]').click();await page.locator(`[data-customer="${id}"]`).click();await page.locator('.customer-security summary').click();
   const f=page.locator('[data-customer-reset][data-kind=password]');await f.locator('[name=new_password]').fill('UI-reset-password-2026');await f.locator('[name=password_confirm]').fill('UI-reset-password-2026');
   await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#editor').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   await f.locator('button').click();await page.waitForFunction(()=>document.querySelector('[data-customer-reset] [name=new_password]')?.value==='');
   assert.equal((await user('customer-login',{...login,password:'UI-reset-password-2026'})).status,200);
   assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 assert.equal((await user('customer-delete',{password:'UI-reset-password-2026',confirmation:'DELETE'})).status,200);
 const deleted=await make(id,'password','Deleted-reset-2026');assert.equal((await owner('admin-customer-save',{...deleted,expected_login:login.email})).status,409);
 console.log('PASS admin credential reset: email/PIN login, web/mobile session revocation, other-user isolation, owner/CSRF guards, audit redaction, stale/deleted/type checks and mobile admin UI.');
})().catch(e=>{console.error(e);process.exitCode=1;});
