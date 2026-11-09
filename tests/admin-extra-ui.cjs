// Admin additions in the browser: alerts, reports with chart and exports, TaoWorld usage and quota,
// site controls, staff accounts and audit log, two-step sign-in end to end, role-based navigation, phone width.
const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function totp(secret,step){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
  const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
  const msg=Buffer.alloc(8);msg.writeUInt32BE(Math.floor(step/2**32),0);msg.writeUInt32BE(step>>>0,4);
  const h=crypto.createHmac('sha1',Buffer.from(bytes)).update(msg).digest(),o=h[19]&15;
  return String((((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3])%1e6).padStart(6,'0');
}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
const auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')),errors=[];
async function signIn(page,email,password){await page.goto(base+'/admin/');await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill(password);await page.locator('#login-form button').click();}
const owner=await browser.newPage({viewport:{width:1440,height:1000}});owner.on('pageerror',e=>errors.push(e.message));
async function post(page,name,fn){const p=page.waitForResponse(r=>new URL(r.url()).searchParams.get('action')===name&&r.request().method()==='POST');await fn();const r=await p;assert.ok(r.ok(),name+': '+await r.text());await page.waitForTimeout(150);}
await signIn(owner,auth.email,auth.password);await owner.locator('#app').waitFor({state:'visible'});
for(const p of ['reports','taoworld','site','admins'])assert.equal(await owner.locator(`nav [data-page=${p}]`).isVisible(),true,p+' in the menu');
await owner.locator('.alerts .alert').first().waitFor();assert.match(await owner.locator('.alerts').innerText(),/туршилт эхэлсэн огноог/);
assert.match(await owner.locator('.account').innerText(),/Эзэмшигч/);

// Reports: totals, one bar per day with a table view, CSV links.
await owner.locator('nav [data-page=reports]').click();await owner.locator('#report-body .stats').waitFor();
assert.equal(await owner.locator('#report-body .xbar').count(),30,'Thirty days by default');
assert.equal(await owner.locator('#report-body details.data-table').count(),1,'Table view for the chart');
const href=await owner.locator('.export-links a').first().getAttribute('href');assert.match(href,/action=admin-export&kind=orders&from=\d{4}-\d{2}-\d{2}&to=/);
const csv=await owner.evaluate(async h=>{const r=await fetch(h,{credentials:'same-origin'});const b=new Uint8Array(await r.arrayBuffer());return {type:r.headers.get('content-type'),bom:[...b.slice(0,3)].join(','),text:new TextDecoder().decode(b)};},new URL(href,base+'/admin/').href);
assert.ok(csv.type.includes('text/csv'),csv.type);assert.equal(csv.bom,'239,187,191','UTF-8 BOM for Excel');assert.ok(csv.text.startsWith('Захиалга,'),'CSV header');
await owner.locator('#report-range [name=from]').fill('2025-12-30');await owner.locator('#report-range [name=to]').fill('2026-01-02');await owner.locator('#report-range button').click();
await owner.waitForFunction(()=>document.querySelectorAll('#report-body .xbar').length===4);
assert.match(await owner.locator('#report-body').innerText(),/Төлбөр орсон/);
await owner.locator('#search-insights #search-days').waitFor();
await owner.locator('#report-body .xbar').first().hover();assert.equal(await owner.locator('.xtip').isVisible(),true,'Hover tooltip');

// TaoWorld usage and the trial date.
await owner.locator('nav [data-page=taoworld]').click();await owner.locator('#quota-form').waitFor();
assert.equal(await owner.locator('#tw-usage .xbar').count()>=30,true);
await owner.locator('#quota-form [name=trial_started]').fill(new Date(Date.now()+8*3600e3-20*86400e3).toISOString().slice(0,10));
await post(owner,'admin-quota-save',()=>owner.locator('#quota-form button').click());
await owner.waitForFunction(()=>/10 хоног|11 хоног/.test(document.querySelector('#tw-usage').innerText));

// Site controls: hide an item, store list validation.
await owner.locator('nav [data-page=site]').click();await owner.locator('#site-controls-form').waitFor();
assert.equal(await owner.locator('[data-store-row]').count(),12);
await owner.locator('[name=blocked_items]').fill('tb-123456789');await post(owner,'catalog-controls-save',()=>owner.locator('#site-controls-form button[type=submit]').click());
await owner.locator('[name=blocked_items]').waitFor();assert.equal(await owner.locator('[name=blocked_items]').inputValue(),'tb-123456789');
await owner.locator('[data-store-add]').click();assert.equal(await owner.locator('[data-store-row]').count(),13);
await owner.locator('[data-store-save]').click();await owner.waitForFunction(()=>document.querySelector('#stores-error').textContent.length>0);
await owner.locator('[data-store-row]').last().locator('[data-store-remove]').click();assert.equal(await owner.locator('[data-store-row]').count(),12);

// Staff: add a viewer and an operator; the audit log shows it.
await owner.locator('nav [data-page=admins]').click();await owner.locator('[data-admin-new]').waitFor();
for(const [email,role,name] of [['viewer@gostore.mn','viewer','Харагч'],['ops@gostore.mn','operator','Оператор Бат']]){
  await owner.locator('[data-admin-new]').click();const f=owner.locator('#admin-user-form');
  await f.locator('[name=name]').fill(name);await f.locator('[name=email]').fill(email);await f.locator('[name=role]').selectOption(role);await f.locator('[name=password]').fill('staff-password-123');await f.locator('[name=password_confirm]').fill('staff-password-123');
  await post(owner,'admin-user-save',()=>f.locator('button[type=submit]').click());
}
await owner.waitForFunction(()=>document.querySelector('#admin-users').innerText.includes('ops@gostore.mn'));
await owner.waitForFunction(()=>document.querySelector('#audit-body').innerText.includes('Админ данс өөрчилсөн'));
await owner.locator('#audit-search [name=q]').fill('catalog');await owner.locator('#audit-search [name=q]').press('Enter');
await owner.waitForFunction(()=>document.querySelector('#audit-body').innerText.includes('Сайтын тохиргоо өөрчилсөн')&&!document.querySelector('#audit-body').innerText.includes('Админ данс өөрчилсөн'));

// Viewer: read-only navigation.
const viewer=await browser.newPage({viewport:{width:1440,height:1000}});viewer.on('pageerror',e=>errors.push(e.message));
await signIn(viewer,'viewer@gostore.mn','staff-password-123');await viewer.locator('#app').waitFor({state:'visible'});
for(const p of ['admins','customers','messages'])assert.equal(await viewer.locator(`nav [data-page=${p}]`).isHidden(),true,p+' hidden for a viewer');
assert.match(await viewer.locator('.account').innerText(),/Харагч[\s\S]*Зөвхөн харах/);
await viewer.goto(base+'/admin/#admins');await viewer.reload();await viewer.locator('#app').waitFor({state:'visible'});await viewer.waitForFunction(()=>location.hash==='#overview');
await viewer.locator('nav [data-page=site]').click();await viewer.locator('#site-controls-form').waitFor();assert.equal(await viewer.locator('#site-controls-form button[type=submit]').count(),0,'No save for a viewer');

// Operator: turn on two-step sign-in, then sign in again with a code.
const ops=await browser.newPage({viewport:{width:1440,height:1000}});ops.on('pageerror',e=>errors.push(e.message));
await signIn(ops,'ops@gostore.mn','staff-password-123');await ops.locator('#app').waitFor({state:'visible'});
await ops.locator('nav [data-page=security]').click();await ops.locator('#totp-panel').waitFor();assert.match(await ops.locator('#content h2').first().innerText(),/^Нууц үг солих/);
await post(ops,'admin-totp-setup',()=>ops.locator('[data-totp-start]').click());
assert.equal(await ops.locator('.totp-qr svg').count(),1,'QR code shown');
const secret=(await ops.locator('.totp-secret').innerText()).replace(/\s/g,'');assert.match(secret,/^[A-Z2-7]{32}$/);
const s0=Math.floor(Date.now()/30000);await ops.locator('#totp-enable-form [name=code]').fill(totp(secret,s0));
await post(ops,'admin-totp-enable',()=>ops.locator('#totp-enable-form button').click());await ops.locator('#totp-disable-form').waitFor();
await ops.locator('#logout').click();await ops.locator('#login-form').waitFor({state:'visible'});
await ops.locator('[name=email]').fill('ops@gostore.mn');await ops.locator('[name=password]').fill('staff-password-123');await ops.locator('#login-form button').click();
await ops.locator('#login-form [name=code]').waitFor();assert.equal(await ops.locator('#app').isHidden(),true,'Password alone is not enough');
await ops.locator('[name=code]').fill('000000'===totp(secret,s0+1)?'111111':'000000');await ops.locator('#login-form button').click();await ops.waitForFunction(()=>document.querySelector('#login-error').textContent.length>0);
await ops.locator('[name=code]').fill(totp(secret,s0+1));await ops.locator('#login-form button').click();await ops.locator('#app').waitFor({state:'visible'});
assert.equal(await ops.locator('nav [data-page=admins]').isHidden(),true,'Operators do not manage accounts');

// Phone width: no sideways scrolling on the new pages.
await owner.setViewportSize({width:390,height:844});
for(const p of ['reports','taoworld','site','admins']){await owner.goto(base+'/admin/#'+p);await owner.reload();await owner.locator('#app').waitFor({state:'visible'});assert.equal(await owner.evaluate(()=>location.hash),'#'+p);await owner.waitForTimeout(600);
  const over=await owner.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(over<=1,p+' overflows by '+over+'px');}
assert.deepEqual(errors,[]);console.log('admin-extra-ui ok');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
