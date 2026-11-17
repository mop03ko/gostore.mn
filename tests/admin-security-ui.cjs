const {chromium}=require('../tmp/tooling/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.GOSTORE_ADMIN_SECURITY_ENFORCED,'1');
function totp(secret,step){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(step));const h=crypto.createHmac('sha1',Buffer.from(bytes)).update(msg).digest(),o=h[19]&15;return String((h.readUInt32BE(o)&0x7fffffff)%1e6).padStart(6,'0');}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));
 await page.goto(base+'/admin/');await page.locator('[name=email]').fill(auth.email);await page.locator('[name=password]').fill(auth.password);await page.locator('#login-form button').click();
 await page.locator('#totp-panel').waitFor();assert.equal(new URL(page.url()).hash,'#security');
 assert.equal(await page.evaluate(async()=> (await fetch('../api/index.php?action=dashboard')).status),428);
 assert.equal(await page.evaluate(async()=> (await fetch('../api/index.php?action=admin-users')).status),428);
 assert.equal(await page.evaluate(async()=> (await fetch('../api/taoworld/connect.php?action=session')).status),428,'Standalone endpoint cannot spoof a recovery action');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 const password='Fresh-Admin-Password-2026!';const form=page.locator('#admin-password-form');
 await form.locator('[name=current_password]').fill(auth.password);await form.locator('[name=new_password]').fill(password);await form.locator('[name=password_confirm]').fill(password);await form.locator('button').click();
 await page.getByText('Нууц үг шинэчлэх хугацаа:',{exact:false}).waitFor();
 assert.equal(await page.evaluate(async()=> (await fetch('../api/index.php?action=dashboard')).status),428,'MFA still required');
 await page.locator('[data-totp-start]').click();await page.locator('.totp-secret').waitFor();const secret=(await page.locator('.totp-secret').innerText()).replace(/\s/g,'');
 const step=Math.floor(Date.now()/30000);await page.locator('#totp-enable-form [name=code]').fill(totp(secret,step));await page.locator('#totp-enable-form button').click();
 await page.getByText('Энэ дансны нэвтрэх хамгаалалт тохирсон.').waitFor();
 assert.equal(await page.evaluate(async()=> (await fetch('../api/index.php?action=dashboard')).status),200);
 assert.equal(await page.locator('#totp-disable-form').count(),0,'Enforced MFA cannot be disabled');
 await page.reload();await page.locator('#totp-panel').waitFor();
 assert.equal(await page.evaluate(async()=>{const s=await (await fetch('../api/index.php?action=session')).json();return (await fetch('../api/index.php?action=admin-totp-disable',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrf},body:'{}'})).status;}),403);
 // Owner password rotation with MFA must preserve this session's MFA binding.
 const f2=page.locator('#admin-password-form');await f2.locator('[name=current_password]').fill(password);await f2.locator('[name=new_password]').fill(password+'x');await f2.locator('[name=password_confirm]').fill(password+'x');
 const changed=page.waitForResponse(r=>r.url().includes('action=admin-password-change'));await f2.locator('button').click();assert.equal((await changed).status(),200);
 await page.waitForFunction(async()=> (await fetch('../api/index.php?action=dashboard')).status===200);
 fs.mkdirSync('output/admin-security',{recursive:true});await page.screenshot({path:'output/admin-security/mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('admin-security-ui: restricted login, password rotation, MFA enrollment, reload, disable guard and phone layout passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
