// Staff admin accounts: roles, audit log, two-step sign-in and session revocation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){let cookie='',csrf='';return async(action,body,query='')=>{const r=await fetch(base+'/api/index.php?action='+action+query,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const j=await r.json();if(j.csrf)csrf=j.csrf;return {status:r.status,...j};};}
function totp(secret,step){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
  const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
  const msg=Buffer.alloc(8);msg.writeUInt32BE(Math.floor(step/2**32),0);msg.writeUInt32BE(step>>>0,4);
  const h=crypto.createHmac('sha1',Buffer.from(bytes)).update(msg).digest(),o=h[19]&15;
  return String((((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3])%1e6).padStart(6,'0');
}
const step=()=>Math.floor(Date.now()/30000);
const auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));
const owner=client(),viewer=client(),operator=client(),anon=client();
await owner('session');assert.equal((await owner('login',auth)).status,200);
let users=await owner('admin-users');assert.equal(users.users.length,1,'Only the built-in owner at first');assert.equal(users.users[0].builtin,true);

// Validation: weak password, owner e-mail and duplicates are refused.
assert.equal((await owner('admin-user-save',{email:'v@gostore.mn',name:'Viewer',role:'viewer',active:true,password:'short'})).status,400);
assert.equal((await owner('admin-user-save',{email:auth.email,name:'X',role:'viewer',active:true,password:'long-enough-pass-1'})).status,409);
assert.equal((await owner('admin-user-save',{email:'v@gostore.mn',name:'Viewer',role:'boss',active:true,password:'long-enough-pass-1'})).status,400);
assert.equal((await owner('admin-user-save',{email:'v@gostore.mn',name:'Viewer',role:'viewer',active:true,password:'viewer-password-1'})).status,200);
users=await owner('admin-user-save',{email:'op@gostore.mn',name:'Operator',role:'operator',active:true,password:'operator-password-1'});
assert.equal(users.users.length,3);
assert.equal((await owner('admin-user-save',{email:'OP@gostore.mn',name:'Dup',role:'viewer',active:true,password:'another-password-1'})).status,409,'E-mail is unique regardless of case');
const opId=users.users.find(u=>u.email==='op@gostore.mn').id,viewerId=users.users.find(u=>u.email==='v@gostore.mn').id;

// Viewer: reads only.
await viewer('session');let r=await viewer('login',{email:'v@gostore.mn',password:'viewer-password-1'});assert.equal(r.status,200);assert.equal(r.admin.role,'viewer');
const dash=await viewer('dashboard');assert.equal(dash.status,200);assert.equal(dash.admin.role,'viewer');
const order=dash.orders.find(o=>o.id==='GS-LOCAL-OLD');assert.ok(order&&!order.invoice&&order.status==='confirmed','A plain confirmed order is seeded');
assert.equal((await viewer('order-update',{id:order.id,status:'shipping',amount:order.amount,internal_note:''})).status,403);
assert.equal((await viewer('admin-users')).status,403);
assert.equal((await viewer('admin-user-save',{email:'x@gostore.mn',name:'X',role:'owner',active:true,password:'long-enough-pass-1'})).status,403);
assert.equal((await viewer('admin-customers')).status,403,'Customer personal data needs an operator');

// Operator: daily work, but not settings or accounts.
await operator('session');assert.equal((await operator('login',{email:'op@gostore.mn',password:'operator-password-1'})).status,200);
r=await operator('order-update',{id:order.id,status:'shipping',amount:order.amount,internal_note:'Checked by operator'});assert.equal(r.status,200);assert.equal(r.order.status,'shipping');
assert.equal((await operator('shipping-save',{})).status,403);
assert.equal((await operator('admin-audit')).status,403);
assert.equal((await operator('admin-customers')).status,200);

// The owner sees who did what, including the order's before → after values.
let audit=await owner('admin-audit');assert.equal(audit.status,200);
const change=audit.rows.find(a=>a.action==='order-update'&&a.target===order.id);assert.ok(change,'Order update is audited');
assert.equal(change.actor,'op@gostore.mn');assert.equal(change.role,'operator');assert.match(change.detail,/status: "confirmed" → "shipping"/);
assert.ok(audit.rows.some(a=>a.action==='login'&&a.actor==='v@gostore.mn'));
assert.ok(audit.rows.some(a=>a.action==='admin-user-save'&&a.actor===auth.email));
assert.ok(!JSON.stringify(audit.rows).includes('operator-password-1'),'Passwords are never written to the audit log');
assert.equal((await anon('admin-audit')).status,401);
audit=await owner('admin-audit',undefined,'&q='+encodeURIComponent('shipping'));assert.ok(audit.rows.length>=1&&audit.rows.every(a=>/shipping/.test(a.detail+a.target+a.action+a.actor)));

// Two-step sign-in for the operator; a used code cannot be replayed.
const setup=await operator('admin-totp-setup',{});assert.equal(setup.status,200);assert.match(setup.secret,/^[A-Z2-7]{32}$/);assert.match(setup.uri,/^otpauth:\/\/totp\/GOStore%3Aop%40gostore\.mn\?secret=/);
assert.equal((await operator('admin-totp-enable',{code:'000000'===totp(setup.secret,step())?'111111':'000000'})).status,422);
const enabledStep=step();r=await operator('admin-totp-enable',{code:totp(setup.secret,enabledStep)});assert.equal(r.status,200);assert.equal(r.admin.totp,true);
const second=client();await second('session');
r=await second('login',{email:'op@gostore.mn',password:'operator-password-1'});assert.equal(r.status,401);assert.equal(r.totp_required,true);
r=await second('login',{email:'op@gostore.mn',password:'operator-password-1',code:totp(setup.secret,enabledStep)});assert.equal(r.status,401,'The code used to enable cannot be reused');
r=await second('login',{email:'op@gostore.mn',password:'operator-password-1',code:totp(setup.secret,enabledStep+1)});assert.equal(r.status,200);
const third=client();await third('session');
assert.equal((await third('login',{email:'op@gostore.mn',password:'operator-password-1',code:totp(setup.secret,enabledStep+1)})).status,401,'Replay is refused');
assert.equal((await second('admin-totp-disable',{password:'wrong-password',code:totp(setup.secret,enabledStep+1)})).status,422);

// Staff change their own password; the owner's password is untouched.
r=await viewer('admin-password-change',{current_password:'viewer-password-1',new_password:'viewer-password-2',password_confirm:'viewer-password-2'});assert.equal(r.status,200);
assert.equal((await viewer('dashboard')).status,200,'The changing session stays signed in');
const fresh=client();await fresh('session');assert.equal((await fresh('login',{email:'v@gostore.mn',password:'viewer-password-2'})).status,200);
assert.equal((await owner('dashboard')).status,200);

// Deactivating an account ends its sessions at once; the owner can reset its two-step sign-in.
r=await owner('admin-user-save',{id:opId,email:'op@gostore.mn',name:'Operator',role:'operator',active:false,reset_totp:true});assert.equal(r.status,200);
assert.equal((await operator('dashboard')).status,401);assert.equal((await second('dashboard')).status,401);
const relog=client();await relog('session');assert.equal((await relog('login',{email:'op@gostore.mn',password:'operator-password-1'})).status,401);
r=await owner('admin-user-save',{id:opId,email:'op@gostore.mn',name:'Operator',role:'operator',active:true});assert.equal(r.users.find(u=>u.id===opId).totp,false);
assert.equal((await relog('login',{email:'op@gostore.mn',password:'operator-password-1'})).status,200,'Reactivated without two-step sign-in');
// A role change applies to the next request.
await owner('admin-user-save',{id:viewerId,email:'v@gostore.mn',name:'Viewer',role:'operator',active:true});
assert.equal((await fresh('dashboard')).status,401,'Role changes end existing sessions');
audit=await owner('admin-audit');assert.ok(audit.rows.some(a=>a.action==='login-failed'));
console.log('admin-accounts ok');
