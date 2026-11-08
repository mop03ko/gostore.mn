import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {uploadReceipt} from './warehouse-photo.mjs';
// Ulaanbaatar one-step flow (2026-11-09): early freight bill for pickup orders when they leave Erenhot, batch receipt
// without per-order photos (partial with automatic "missing" issue), one-step sorting with the bill, waiting flags
// and phone search, counter handover of several orders, courier runs, daily reminders and admin refunds.
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){const jar=new Map();let csrf='';return async(action,body)=>{const form=body instanceof FormData,r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'X-CSRF-Token':csrf,...(!form?{'Content-Type':'application/json'}:{})}:{})},body:body?(form?body:JSON.stringify(body)):undefined});for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;return{...d,status:r.status};};}
const fixture=(...args)=>{const r=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','-d','extension=mbstring','tests/warehouse-ub-fixture.php',...args.map(String)],{encoding:'utf8',env:process.env});assert.equal(r.status,0,r.stderr+r.stdout);return r.stdout.trim();};
const admin=client(),cn=client(),ub=client(),owner=client();await admin('session');await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));
for(const [location,c] of [['erenhot',cn],['ulaanbaatar',ub]]){const login={location,email:location+'-ub-flow@example.test',password:'Warehouse-ub-flow-2026',enabled:true};await admin('warehouse-account-save',login);await c('warehouse-session');await c('warehouse-login',login);}
const [A,B,C,D,E]=['GS-TEST-050','GS-TEST-051','GS-TEST-052','GS-TEST-053','GS-TEST-054'];fixture('setup');
await owner('catalog');const password='Ub-flow-customer-2026';assert.equal((await owner('customer-register',{email:crypto.randomBytes(5).toString('hex')+'@example.test',name:'Ану',phone:'99115050',password,password_confirm:password})).status,201);
const token=n=>crypto.createHash('sha256').update('warehouse-fixture-'+n).digest('hex');
for(const [id,n] of [[A,50],[B,51]])assert.equal((await owner('customer-claim-order',{id,token:token(n)})).status,200);
const mine=async id=>(await owner('order-get',{id})).order,notices=async()=>(await owner('customer-notifications')).notifications;
const order=async(c,id)=>(await c('warehouse-order&id='+id)).order;

// Erenhot: receive with freight, pack by scan-out and dispatch. Pickup checkout orders leave with their final bill.
for(const id of [A,B,C,D,E]){await uploadReceipt(cn,id);const o=await order(cn,id);const r=await cn('warehouse-receive',{id,expected_status:o.status,expected_version:o.logistics.version,weight_kg:2,volume_input:'dimensions',length_cm:10,width_cm:10,height_cm:10,pieces:2,checked:true});assert.equal(r.status,200,JSON.stringify(r));}
let r=await cn('warehouse-outbound-pack',{token:crypto.randomBytes(32).toString('hex'),order_ids:[A,B,C,D,E],codes:[A,B,C,D,E]});assert.equal(r.status,200,JSON.stringify(r));let batch=r.batch;
r=await cn('warehouse-batch-dispatch',{id:batch.id,expected_version:batch.version,checked:true});assert.equal(r.status,200,JSON.stringify(r));batch=r.batch;
let a=await mine(A);const cargo=(await order(ub,A)).logistics.transport.amount_mnt;
assert.equal(a.cargo.billing.finalized,true,'Early bill for a pickup order');assert.equal(a.cargo.billing.due,cargo,'Only the freight is due');assert.equal(a.cargo.billing.total,99000+cargo);
assert.ok((await notices()).some(n=>n.order_id===A&&n.kind==='settlement'&&/Замын-Үүд рүү явж байна.*Тээврийн үлдэгдэл/.test(n.message)),'One message: on the way, pay the freight now');
assert.equal((await order(ub,C)).settlement,null,'Delivery orders are billed in Ulaanbaatar');assert.equal((await order(ub,D)).settlement,null,'Unknown Taobao domestic cost is billed in Ulaanbaatar');
fixture('pay',A);a=await mine(A);assert.equal(a.cargo.billing.due,0);assert.equal(a.cargo.pickup_code,undefined,'No code before it is ready');

// Batch receipt: every order scanned, or the explicit partial confirmation; no per-order photo is needed.
for(const id of [A,B,C,D])batch=(await ub('warehouse-batch-scan',{id:batch.id,expected_version:batch.version,order_id:id})).batch;
assert.equal((await ub('warehouse-batch-receive',{id:batch.id,expected_version:batch.version})).status,409,'Unscanned order needs the partial confirmation');
assert.equal((await ub('warehouse-batch-receive',{id:batch.id,expected_version:batch.version,partial:'yes'})).status,409);
r=await ub('warehouse-batch-receive',{id:batch.id,expected_version:batch.version,partial:true});assert.equal(r.status,200,JSON.stringify(r));batch=r.batch;
assert.equal(batch.status,'received');assert.ok(batch.orders.every(o=>o.status==='ulaanbaatar_unsorted'));
let e=await order(ub,E);const missing=e.logistics.issues.find(i=>i.state==='open');assert.equal(missing.kind,'missing');assert.match(missing.note,new RegExp(batch.id));

// One-step sorting: photo, version, shelf and checks; an issued freight invoice fixes the pickup method and the bill.
const sort=async(id,extra={})=>{const o=await order(ub,id);return ub('warehouse-sort',{id,expected_status:o.status,expected_version:o.logistics.version,shelf:'A-01',method:'pickup',contact_phone:o.contact.phone,address:'',checked:true,...extra});};
assert.equal((await sort(A)).status,409,'Receipt photo required');await uploadReceipt(ub,A);
assert.equal((await sort(A,{checked:false})).status,400);assert.equal((await sort(A,{shelf:''})).status,400);
assert.equal((await sort(A,{expected_version:0})).status,409,'Stale version');
assert.equal((await sort(A,{method:'delivery',address:'Хан-Уул'})).status,409,'Paid early bill keeps pickup');
assert.equal((await cn('warehouse-sort',{id:A})).status,403);
let before=(await notices()).length;r=await sort(A);assert.equal(r.status,200,JSON.stringify(r));let o=r.order;
assert.equal(o.status,'ready_pickup');assert.equal(o.logistics.shelf,'A-01');assert.equal(o.settlement.early,true,'Early bill kept');assert.equal(o.billing.due,0);
let list=await notices();assert.equal(list.length,before+1,'One customer message for sorting');assert.match(list[0].message,/авахад бэлэн\. Авах код/);
a=await mine(A);assert.match(a.cargo.pickup_code,/^\d{8}$/);const codeA=a.cargo.pickup_code;
await uploadReceipt(ub,B);before=(await notices()).length;o=(await sort(B,{shelf:'A-02'})).order;assert.equal(o.status,'ready_pickup');assert.equal(o.billing.due,cargo);assert.deepEqual(o.flags,{unpaid:cargo});
list=await notices();assert.equal(list.length,before+1);assert.match(list[0].message,new RegExp('Үлдэгдэл '+cargo.toLocaleString('en-US')+'₮ төлөөд'));
await uploadReceipt(ub,C);assert.equal((await sort(C,{method:'delivery',address:''})).status,400,'Delivery needs an address');
o=(await sort(C,{method:'delivery',address:'Хан-Уул, 3-р хороо',delivery_mnt:5000,shelf:'D-01'})).order;assert.equal(o.status,'ready_delivery');assert.equal(o.settlement.breakdown.delivery_mnt,5000);assert.equal(o.billing.due,cargo+5000);
await uploadReceipt(ub,D);assert.equal((await sort(D)).status,400,'Unknown domestic cost must be entered');
o=(await sort(D,{domestic_mnt:3000,shelf:'B-07'})).order;assert.equal(o.settlement.breakdown.domestic_mnt,3000);assert.equal(o.billing.due,cargo+3000);
await uploadReceipt(ub,E);assert.equal((await sort(E)).status,409,'Open missing issue blocks sorting');

// Waiting flags, counts and phone search.
let rows=await ub('warehouse-orders&status=unpaid');assert.equal(rows.counts.unpaid,3);assert.deepEqual(rows.orders.map(x=>x.id).sort(),[B,C,D]);
fixture('age',D,4);rows=await ub('warehouse-orders&status=stale');assert.equal(rows.counts.stale,1);assert.deepEqual(rows.orders.map(x=>x.id),[D]);assert.equal(rows.orders[0].flags.stale,4);
assert.deepEqual((await ub('warehouse-orders&q='+encodeURIComponent('9911 5050'))).orders.map(x=>x.id).sort(),[A,B],'Phone search ignores spaces');
assert.deepEqual((await ub('warehouse-orders&q=B-07')).orders.map(x=>x.id),[D],'Shelf search');

// Counter lookup: phone, pickup code (verifies its order, brings the same customer's other orders) or order code.
assert.equal((await cn('warehouse-handover-lookup&q=99115050')).status,403);
assert.equal((await ub('warehouse-handover-lookup&q=123')).status,400);
assert.equal((await ub('warehouse-handover-lookup&q=70000000')).status,404);
let look=(await ub('warehouse-handover-lookup&q=99115050')).orders;assert.deepEqual(look.map(x=>[x.id,x.reason,x.verified,x.shelf]).sort(),[[A,'',false,'A-01'],[B,'unpaid',false,'A-02']]);
look=(await ub('warehouse-handover-lookup&q='+codeA)).orders;assert.deepEqual(look.map(x=>[x.id,x.verified]).sort(),[[A,true],[B,false]]);
assert.equal((await ub('warehouse-handover-lookup&q='+C)).orders[0].reason,'delivery');

// Handover: every order needs its code; all or nothing.
assert.equal((await ub('warehouse-handover',{items:[{id:A,code:'00000000'}],received_by:'Ану'})).status,403,'Wrong code');
assert.equal((await ub('warehouse-handover',{items:[{id:A,code:codeA},{id:B,code:'00000000'}],received_by:'Ану'})).status,409,'Unpaid order blocks the whole handover');
assert.equal((await order(ub,A)).status,'ready_pickup','Nothing handed over');
assert.equal((await ub('warehouse-handover',{items:[],received_by:'Ану'})).status,400);
fixture('pay',B);const codeB=(await mine(B)).cargo.pickup_code;assert.match(codeB,/^\d{8}$/);
r=await ub('warehouse-handover',{items:[{id:A,code:codeA},{id:B,code:codeB}],received_by:'Ану'});assert.equal(r.status,200,JSON.stringify(r));
assert.deepEqual(r.orders.map(x=>x.status),['completed','completed']);assert.equal((await mine(A)).cargo.pickup_code,undefined,'Codes are single use');
assert.equal((await ub('warehouse-handover',{items:[{id:A,code:codeA}],received_by:'Ану'})).status,409);

// Courier runs: only paid, issue-free delivery orders; recent couriers are offered next time.
let run=await ub('warehouse-delivery-list');assert.deepEqual(run.orders.map(x=>[x.id,x.ready,x.reason,x.address]),[[C,false,'unpaid','Хан-Уул, 3-р хороо']]);
assert.equal((await ub('warehouse-delivery-dispatch',{ids:[C],courier_name:'Бат',courier_phone:'95001122'})).status,409,'Unpaid delivery cannot leave');
fixture('pay',C);assert.equal((await ub('warehouse-delivery-dispatch',{ids:[C],courier_name:'Бат',courier_phone:'abc'})).status,400);
assert.equal((await ub('warehouse-delivery-dispatch',{ids:[C,C],courier_name:'Бат',courier_phone:'95001122'})).status,400);
r=await ub('warehouse-delivery-dispatch',{ids:[C],courier_name:'Бат',courier_phone:'95001122'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.orders[0].status,'out_for_delivery');assert.equal(r.orders[0].fulfillment.courier_name,'Бат');
run=await ub('warehouse-delivery-list');assert.deepEqual(run.orders,[]);assert.deepEqual(run.couriers,[{name:'Бат',phone:'95001122'}]);
assert.equal((await cn('warehouse-delivery-list')).status,403);

// Daily reminders: once at 2 days and once at 5 days after sorting (D waits for payment and collection).
const now=Math.floor(Date.now()/1000);assert.equal(fixture('remind',now),'1');assert.equal(fixture('remind',now),'0','No repeat');assert.equal(fixture('remind',now+2*86400),'1','Second reminder at 5 days');
const reminders=(await admin('admin-order&id='+D)).order;assert.deepEqual(reminders.reminders,[2,5]);

// Refund: a bill reduced after payment shows the refund due; handover waits until the admin records it.
fixture('pay',D);o=await order(ub,D);const q=o.logistics.transport;
r=await ub('warehouse-settlement',{id:D,expected_version:o.logistics.version,goods_mnt:80000,domestic_mnt:3000,service_mnt:9000,delivery_mnt:0,cargo_method:q.method,note:'Нэг бараа гэмтсэн'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.order.billing.refund_due,10000);
o=r.order;assert.equal((await ub('warehouse-settlement',{id:D,expected_version:o.logistics.version,goods_mnt:95000,domestic_mnt:3000,service_mnt:9000,delivery_mnt:0,cargo_method:q.method,note:''})).status,409,'A paid bill cannot go up');
assert.equal((await ub('warehouse-handover-lookup&q='+D)).orders[0].reason,'refund');
assert.equal((await admin('order-refund',{id:D,amount:10001,note:'Хаан банк'})).status,409);assert.ok([401,403].includes((await ub('order-refund',{id:D,amount:10000,note:'x'})).status),'Warehouse cannot record refunds');
r=await admin('order-refund',{id:D,amount:10000,note:'Хаан банк · гүйлгээ 123'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.order.billing.refund_due,0);assert.equal(r.order.billing.refunded,10000);
assert.equal((await ub('warehouse-handover-lookup&q='+D)).orders[0].reason,'','Ready after the refund');
console.log('PASS Ulaanbaatar flow: early freight bill for pickup orders (delivery and unknown domestic cost excluded), one-message notices, batch receipt without photos and partial with missing issue, one-step sorting (photo, version, shelf, locked method, delivery fee, domestic cost), unpaid/stale flags, phone/shelf search, counter lookup by phone/code/order, all-or-nothing multi-order handover with single-use codes, courier runs with recent couriers, daily reminders, admin refunds and roles.');
