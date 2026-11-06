import assert from 'node:assert/strict';
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const config=await fetch(base+'/api/index.php?action=phone-verification-config');assert.equal(config.status,200);const data=await config.json();assert.equal(typeof data.enabled,'boolean');assert.equal(typeof data.csrf,'string');assert.deepEqual(Object.keys(data).sort(),['csrf','enabled']);
const cookie=config.headers.get('set-cookie').split(';')[0];
const request=(action,body,csrf)=>fetch(base+'/api/index.php?action='+action,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},body:JSON.stringify(body)});
assert.equal((await request('phone-verification-start',{phone:'99112233'})).status,403);
assert.equal((await request('phone-verification-status',{challenge:'0'.repeat(48)},data.csrf)).status,404);
assert.equal((await request('phone-verification-start',{phone:'99112233'},data.csrf)).status,503,'Isolated test cannot call provider');
console.log('PASS verify.mn API routing, CSRF, opaque session ownership and network isolation.');