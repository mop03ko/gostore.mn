import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_BASE;
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){let cookie='',csrf='';return async(action,body,wrongCsrf=false)=>{const r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json','X-CSRF-Token':wrongCsrf?'bad':csrf}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const j=await r.json();if(j.csrf)csrf=j.csrf;return {status:r.status,...j};};}
const anonymous=client(),admin=client(),customer=client();
await anonymous('session');await customer('catalog');
for(const action of ['ot-operator-connect','ot-operator-check','ot-operator-authorize','ot-operator-disconnect']){
    assert.equal((await anonymous(action,{})).status,401);
    assert.equal((await customer(action,{})).status,403,'Customer CSRF cannot access admin realm');
}
await admin('session');assert.equal((await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')))).status,200);
let d=await admin('dashboard');assert.equal(d.ot_operator.configured,false);assert.equal(d.ot_operator.purchasing_enabled,false);
assert.equal((await admin('ot-operator-connect',{},true)).status,403);
assert.equal((await admin('ot-operator-connect',{login:'test',password:''})).status,400);
assert.equal((await admin('ot-operator-check',{})).status,409);
assert.equal((await admin('ot-operator-authorize',{})).status,409);
assert.equal((await admin('ot-operator-disconnect',{})).status,200);
assert.equal((await customer('catalog')).ot_operator,undefined);
assert.equal((await fetch(base+'/server/ot-operator.php')).status,404);
assert.equal((await fetch(base+'/server/ot-operator-http.php')).status,404);
console.log('PASS: operator endpoints require admin + CSRF; no customer exposure; input checks; disconnected checks; private source files. No external API calls.');
