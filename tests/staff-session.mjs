import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
const base=process.env.TEST_BASE;assert.equal(new URL(base).hostname,'127.0.0.1');
const name='gostore_session';
function client(initial={}){const jar=new Map(Object.entries(initial));let csrf='';return {jar,get csrf(){return csrf},async call(action,body){const r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});const cookies=r.headers.getSetCookie();for(const c of cookies){const pair=c.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;return {...d,status:r.status,cookies};}};}
const manager=client();await manager.call('session');const login=await manager.call('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json')));assert.equal(login.status,200);
assert.ok(login.cookies.some(c=>c.startsWith(name+'=')&&/expires=/i.test(c)&&/HttpOnly/i.test(c)&&/SameSite=Lax/i.test(c)));
const id=manager.jar.get(name);assert.match(id,/^[A-Za-z0-9,-]+$/);
const file=path.join(process.env.GOSTORE_DATA_DIR,'admin-sessions','sess_'+id);
assert.ok(fs.existsSync(file),'Admin session stored outside short host GC directory');
let data=fs.readFileSync(file,'utf8');fs.writeFileSync(file,data.replace(/last\|i:\d+;/,'last|i:'+Math.floor(Date.now()/1000-86400*60)+';').replace(/cookie_at\|i:\d+;/,'cookie_at|i:0;'));
const restarted=client({[name]:id});let r=await restarted.call('session');assert.equal(r.authenticated,true,'60-day idle session survives app restart');assert.equal(r.csrf,login.csrf);
assert.ok(r.cookies.some(c=>c.startsWith(name+'=')&&/expires=/i.test(c)),'Daily sliding expiry renewed');
// Migration preserves a currently signed-in legacy browser and removes its replayable old file.
const old=path.join(process.env.GOSTORE_DATA_DIR,'sessions','sess_'+id);fs.renameSync(file,old);
r=await restarted.call('session');assert.equal(r.authenticated,true);assert.equal(r.csrf,login.csrf);assert.ok(fs.existsSync(file));assert.equal(fs.existsSync(old),false);
assert.equal((await client({[name]:id}).call('warehouse-session')).authenticated,false);
assert.equal((await client({[name]:id}).call('customer-me')).customer,null);
assert.equal((await restarted.call('logout',{})).status,200);assert.equal((await client({[name]:id}).call('session')).authenticated,false,'Logout invalidates copied persistent session cookie');
await manager.call('session');await manager.call('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json')));
const expiredId=manager.jar.get(name),expiredFile=path.join(process.env.GOSTORE_DATA_DIR,'admin-sessions','sess_'+expiredId);
fs.writeFileSync(expiredFile,fs.readFileSync(expiredFile,'utf8').replace(/last\|i:\d+;/,'last|i:'+Math.floor(Date.now()/1000-86400*366)+';'));
assert.equal((await manager.call('session')).authenticated,false,'Inactive sessions still have an upper retention bound');
console.log('PASS persistent admin session: private storage, cold restart, 60-day idle, sliding cookie, live legacy migration, logout replay, realm separation and expiry.');
