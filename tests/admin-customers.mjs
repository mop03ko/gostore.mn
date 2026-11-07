import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){const jar=new Map();let csrf='';return async(action,body,badCsrf=false)=>{
 const r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json','X-CSRF-Token':badCsrf?'bad':csrf}:{})},body:body?JSON.stringify(body):undefined});
 for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
 const text=await r.text(),data=JSON.parse(text);if(data.csrf)csrf=data.csrf;return{...data,status:r.status,text};
};}
const seed=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','tests/phone-auth-fixtures.php'],{encoding:'utf8',windowsHide:true});assert.equal(seed.status,0,seed.stdout+seed.stderr);
const auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')),admin=client(),anon=client(),alice=client(),bob=client(),shopper=client();
await admin('session');assert.equal((await admin('login',auth)).status,200);await anon('session');
const suffix=crypto.randomBytes(5).toString('hex'),password='Admin customers '+suffix,aliceEmail=`alice-${suffix}@example.test`,bobEmail=`bob-${suffix}@example.test`;
await alice('customer-me');assert.equal((await alice('customer-register',{email:aliceEmail,name:'Болор Эрдэнэ',phone:'88112233',password,password_confirm:password})).status,201);
await bob('customer-me');assert.equal((await bob('customer-register',{email:bobEmail,name:'Bob Tester',password,password_confirm:password})).status,201);

assert.equal((await anon('admin-customers')).status,401);
assert.equal((await alice('admin-customers')).status,401,'Customer session is not an admin session');
assert.equal((await anon('admin-customer-save',{})).status,401);
assert.equal((await admin('admin-customer-save',{},true)).status,403,'CSRF required');
assert.equal((await fetch(base+'/api/mobile.php?action=admin-customers')).status,404,'Not on the mobile API allowlist');

let list=await admin('admin-customers');assert.equal(list.status,200);
assert.ok(!/password_hash|pin_hash|auth_version|token_hash/.test(list.text),'No credentials exposed');
const byEmail=(l,email)=>l.customers.find(c=>c.email===email);
const a=byEmail(list,aliceEmail),bobId=byEmail(list,bobEmail).id,pin=list.customers.find(c=>c.id==='pin-fixture');
assert.equal(a.login,'email');assert.equal(a.phone,'88112233');assert.equal(a.orders,0);assert.equal(a.last_order,null);
assert.equal(pin.login,'phone');assert.equal(pin.email,'');assert.equal(pin.login_phone,'99112233');
assert.equal(list.total,list.stats.active);assert.ok(list.stats.phone>=1&&list.stats.email>=2&&list.stats.week>=3);
const before=list.stats;

const search=async(q,filter='active')=>(await admin('admin-customers&'+new URLSearchParams({q,filter}))).customers.map(c=>c.id);
assert.deepEqual(await search('болор эрд'),[a.id],'Cyrillic search ignores case');
assert.deepEqual(await search('БОЛОР'),[a.id]);
assert.deepEqual(await search('alice-'+suffix),[a.id]);
assert.deepEqual(await search('8811 22'),[a.id],'Phone digit search');
assert.ok((await search('99112233')).includes('pin-fixture'),'Login phone search');
assert.ok((await search('','phone')).includes('pin-fixture'));assert.ok(!(await search('','phone')).includes(a.id));
assert.ok((await search('','email')).includes(a.id));assert.ok(!(await search('','email')).includes('pin-fixture'));
assert.equal((await admin('admin-customers&filter=bogus')).status,400);
assert.equal((await admin('admin-customers&offset=-1')).status,400);
assert.equal((await admin('admin-customers&q[]=x')).status,400);
const beyond=await admin('admin-customers&offset=1000');assert.equal(beyond.customers.length,0);assert.equal(beyond.more,false);

const product=(await shopper('catalog')).products.find(p=>p.type==='local');assert.ok(product,'Local product fixture');
const order=await alice('order-create',{type:'cart',items:[{id:product.id,variant:product.variants[0],qty:1}],token:crypto.randomBytes(32).toString('hex'),title:'Admin customer test',customer:'Болор',phone:'88112233',notes:'',require_account:true});
assert.equal(order.status,201);
assert.equal((await alice('customer-address-save',{label:'Гэр',recipient:'Болор',phone:'88112233',address:'СБД 1 хороо',is_default:true})).status,200);
const detail=await admin('admin-customer&id='+a.id);assert.equal(detail.status,200);
assert.equal(detail.customer.orders,1);assert.ok(detail.customer.last_order);assert.equal(detail.orders[0].id,order.order.id);assert.equal(detail.orders[0].title,'Admin customer test');
assert.deepEqual(detail.addresses,[{label:'Гэр',recipient:'Болор',phone:'88112233',address:'СБД 1 хороо',is_default:true}]);
assert.ok(!/token_hash|internal_note|password_hash|callback_token/.test(detail.text),'Detail omits secrets');
assert.equal((await admin('admin-customer&id=missing')).status,404);

const expected={name:a.name,email:a.email,phone:a.phone},newEmail=`alice-new-${suffix}@example.test`;
let saved=await admin('admin-customer-save',{id:a.id,name:'  Болор Админ  ',email:newEmail.toUpperCase(),phone:'99001122',expected});
assert.equal(saved.status,200);assert.equal(saved.customer.name,'Болор Админ');assert.equal(saved.customer.email,newEmail);assert.equal(saved.customer.phone,'99001122');
const me=(await alice('customer-me')).customer;assert.equal(me.name,'Болор Админ');assert.equal(me.email,newEmail,'Customer session kept and sees the edit');
const relogin=client();await relogin('customer-me');
assert.equal((await relogin('customer-login',{email:aliceEmail,password})).status,401,'Old email no longer signs in');
assert.equal((await relogin('customer-login',{email:newEmail,password})).status,200,'New email signs in with the same password');
const current={name:'Болор Админ',email:newEmail,phone:'99001122'};
assert.equal((await admin('admin-customer-save',{id:a.id,name:'Stale',email:newEmail,phone:'99001122',expected})).status,409,'Stale editor rejected');
assert.equal((await admin('admin-customer-save',{id:a.id,name:'X',email:bobEmail.toUpperCase(),phone:'',expected:current})).status,409,'Duplicate email rejected');
assert.equal((await admin('admin-customer-save',{id:a.id,name:'X',email:'not-an-email',phone:'',expected:current})).status,400);
assert.equal((await admin('admin-customer-save',{id:a.id,name:'X',email:'x@phone.gostore.invalid',phone:'',expected:current})).status,400,'Reserved domain rejected');
assert.equal((await admin('admin-customer-save',{id:a.id,name:'Line\nbreak',email:newEmail,phone:'',expected:current})).status,400);
assert.equal((await admin('admin-customer-save',{id:a.id,name:'X',email:newEmail,phone:'<script>',expected:current})).status,400);
assert.equal((await admin('admin-customer-save',{id:a.id,name:'X',email:newEmail,phone:''})).status,400,'Expected values required');
assert.equal((await admin('admin-customer-save',{id:'missing',name:'X',phone:'',expected:current})).status,404);
assert.deepEqual((({name,email,phone})=>({name,email,phone}))((await admin('admin-customer&id='+a.id)).customer),current,'Rejected edits changed nothing');

const pinExpected={name:pin.name,email:'',phone:pin.phone};
assert.equal((await admin('admin-customer-save',{id:'pin-fixture',name:'PIN нэр',phone:'88119999',expected:pinExpected})).status,409,'Login phone locked');
assert.equal((await admin('admin-customer-save',{id:'pin-fixture',name:'PIN нэр',phone:'99112233',email:'pin@example.test',expected:pinExpected})).status,409,'Phone accounts get no email');
saved=await admin('admin-customer-save',{id:'pin-fixture',name:'PIN нэр',phone:'+976 9911-2233',expected:pinExpected});
assert.equal(saved.status,200);assert.equal(saved.customer.name,'PIN нэр');assert.equal(saved.customer.phone,'99112233');assert.equal(saved.customer.login,'phone');assert.equal(saved.customer.email,'');
const pinUser=client();await pinUser('customer-me');const pinLogin=await pinUser('customer-pin-login',{phone:'99112233',pin:'0123'});
assert.equal(pinLogin.status,200,'PIN login unaffected');assert.equal(pinLogin.customer.name,'PIN нэр');

assert.equal((await bob('customer-delete',{password,confirmation:'DELETE'})).status,200);
list=await admin('admin-customers&filter=deleted');const removed=list.customers.find(c=>c.id===bobId);
assert.equal(removed.login,'deleted');assert.equal(removed.email,'');assert.ok(list.customers.every(c=>c.login==='deleted'));
assert.ok(!(await search('')).includes(bobId),'Deleted accounts leave the active list');
const after=(await admin('admin-customers')).stats;assert.equal(after.active,before.active-1);assert.equal(after.deleted,before.deleted+1);
assert.equal((await admin('admin-customer-save',{id:bobId,name:'Restore',phone:'',expected:{name:removed.name,email:'',phone:''}})).status,409,'Deleted accounts are read-only');
console.log('PASS admin customers: admin-only + CSRF, no credentials, Cyrillic/phone search, filters, paging, orders and addresses, email/name/phone edit with re-login, stale and duplicate rejection, locked PIN phone, read-only deleted accounts.');
