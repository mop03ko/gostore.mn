const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const seed=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','tests/phone-auth-fixtures.php'],{encoding:'utf8',windowsHide:true});assert.equal(seed.status,0,seed.stdout+seed.stderr);
function client(){let token='',csrf='';return async(action,body)=>{const r=await fetch(base+'/api/mobile.php?action='+action,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'X-GOStore-Mobile-Token':token}:{}),...(body?{'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();token=r.headers.get('X-GOStore-Mobile-Token')||token;csrf=d.csrf||csrf;return {status:r.status,data:d};};}
(async()=>{
 const a=client(),b=client();assert.equal((await a('phone-verification-config')).status,200);await b('customer-me');
 assert.equal((await a('customer-pin-setup',{phone:'99112233',purpose:'reset',challenge:'0'.repeat(48),pin:'1234',pin_confirm:'1234',verified:true})).status,403);
 assert.equal((await a('customer-pin-login',{phone:'99112233',pin:'9999'})).status,401);
 const login=await a('customer-pin-login',{phone:'+976 99112233',pin:'0123'});assert.equal(login.status,200);assert.equal(login.data.customer.pin_enabled,true);assert.equal(login.data.customer.email,'');assert(!JSON.stringify(login.data).includes('pin_hash'));
 assert.equal((await b('customer-pin-login',{phone:'99112233',pin:'0123'})).status,200);
 assert.equal((await a('customer-profile',{name:'Test',phone:'88112233'})).status,409,'Unverified phone changes rejected');
 assert.equal((await a('customer-pin-change',{current_pin:'0123',pin:'5678',pin_confirm:'5678'})).status,200);
 assert.equal((await b('customer-me')).data.customer,null,'Old token revoked');
 assert.equal((await b('customer-pin-login',{phone:'99112233',pin:'0123'})).status,401);
 assert.equal((await a('customer-delete',{pin:'0000',confirmation:'DELETE'})).status,400);
 assert.equal((await a('customer-delete',{pin:'5678',confirmation:'DELETE'})).status,200);
 assert.equal((await a('customer-me')).data.customer,null);
 assert.equal((await b('customer-pin-login',{phone:'99112233',pin:'5678'})).status,401,'Deleted PIN cannot log in');
 console.log('PASS mobile PIN API: CSRF/session transport, forged proof rejected, login, phone integrity, revocation, PIN-authorized deletion.');
})().catch(e=>{console.error(e);process.exitCode=1;});