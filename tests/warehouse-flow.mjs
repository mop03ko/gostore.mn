import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {uploadReceipt} from './warehouse-photo.mjs';
// Erenhot shortcuts: parcel check-in, one-step receipt with freight, automatic batches, one-step shipping,
// arrival alerts and item details. Isolated test data only.
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){const jar=new Map();let csrf='';return async(action,body)=>{const form=body instanceof FormData,r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'X-CSRF-Token':csrf,...(!form?{'Content-Type':'application/json'}:{})}:{})},body:body?(form?body:JSON.stringify(body)):undefined});for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;return{...d,status:r.status};};}
const admin=client(),cn=client(),ub=client();await admin('session');await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));
for(const [location,c] of [['erenhot',cn],['ulaanbaatar',ub]]){const login={location,email:location+'-flow@example.test',password:'Warehouse-flow-test-2026',enabled:true};await admin('warehouse-account-save',login);await c('warehouse-session');await c('warehouse-login',login);}
const order=async id=>(await cn('warehouse-order&id='+id)).order;
const measure={weight_kg:1,volume_input:'dimensions',length_cm:10,width_cm:10,height_cm:10,pieces:2,checked:true};
const receive=async(id,extra={})=>{const o=await order(id);return cn('warehouse-receive',{id,expected_status:o.status,expected_version:o.logistics.version,...measure,...extra});};
const [A,B,C,D]=['GS-TEST-031','GS-TEST-032','GS-TEST-033','GS-TEST-034'];

// Parcel check-in: only known numbers, Erenhot only, idempotent.
for(const number of ['SF1000000000001','SF1000000000002'])assert.equal((await cn('warehouse-inbound-add',{id:A,number,company:'顺丰'})).status,200);
assert.equal((await ub('warehouse-parcel-arrive',{id:A,number:'SF1000000000001'})).status,403);
assert.equal((await cn('warehouse-parcel-arrive',{id:A,number:'SF9999999999999'})).status,409,'Unknown number for this order');
assert.equal((await cn('warehouse-parcel-arrive',{id:A,number:'bad number'})).status,400);
let r=await cn('warehouse-parcel-arrive',{id:A,number:'sf1000000000001'});assert.equal(r.status,200);assert.deepEqual([r.order.parcels.arrived,r.order.parcels.total,r.order.parcels.missing],[1,2,['SF1000000000002']]);assert.equal(r.order.status,'confirmed','Arrival is not receipt');
const version=r.order.logistics.version;r=await cn('warehouse-parcel-arrive',{id:A,number:'SF1000000000001'});assert.equal(r.order.logistics.version,version,'Repeated scan changes nothing');
assert.deepEqual((await cn('warehouse-tracking&number=SF1000000000002')).orders[0].parcels.missing,['SF1000000000002'],'Scan lookup shows parcel progress');

// One-step receipt: photo, checks, stale data and the partial confirmation are enforced.
assert.equal((await receive(A,{partial:true})).status,409,'Receipt photo required');await uploadReceipt(cn,A);
assert.equal((await receive(A,{checked:false})).status,400);
assert.equal((await receive(A,{expected_version:0})).status,409,'Stale version rejected');
assert.equal((await receive(A,{expected_status:'erenhot'})).status,409,'Stale status rejected');
assert.equal((await ub('warehouse-receive',{id:A,expected_status:'confirmed',expected_version:0,...measure})).status,403);
r=await receive(A);assert.equal(r.status,409,'A missing parcel needs the partial confirmation');
const zh=await cn('warehouse-receive&lang=zh',{id:A,expected_status:'confirmed',expected_version:(await order(A)).logistics.version,...measure});assert.match(zh.error,/包裹未到齐/,'Chinese error');
assert.equal((await receive(A,{partial:'yes'})).status,400);
r=await receive(A,{partial:true});assert.equal(r.status,200,JSON.stringify(r));let o=r.order;
assert.equal(o.status,'erenhot');assert.equal(o.batch_id,undefined,'Open shortfall keeps it out of a batch');assert.equal(o.logistics.transport.confirmed_at,undefined,'Freight waits for the shortfall');
let issue=o.logistics.issues.find(i=>i.state==='open');assert.equal(issue.kind,'missing');assert.match(issue.note,/SF1000000000002/);assert.equal(o.logistics.measurement.weight_kg,1);
assert.ok(o.history.some(h=>h.status==='erenhot'),'Receipt recorded in history');
// The last parcel clears the automatic shortfall; receiving again approves the freight and batches it.
r=await cn('warehouse-parcel-arrive',{id:A,number:'SF1000000000002'});assert.equal(r.order.parcels.arrived,2);assert.ok(r.order.logistics.issues.every(i=>i.state==='resolved'),'Automatic shortfall resolved');
r=await receive(A,{weight_kg:2});assert.equal(r.status,200,JSON.stringify(r));o=r.order;assert.ok(o.logistics.transport.confirmed_at);assert.equal(o.logistics.transport.amount_mnt,4000,"2 kg at 2000₮/kg");assert.match(o.batch_id,/^GB-[A-F0-9]{6}$/);
let batch=(await cn('warehouse-batch&id='+o.batch_id)).batch;assert.equal(batch.status,'draft');assert.equal(batch.auto,true);assert.deepEqual(batch.orders.map(x=>x.id),[A]);
assert.equal((await receive(A)).status,409,'A batched order is not remeasured');

// A manual draft batch is never filled automatically.
await uploadReceipt(cn,D);assert.equal((await cn('warehouse-order-update',{id:D,status:'erenhot',expected_status:'confirmed'})).status,200);
const manual=(await cn('warehouse-batch-create',{token:crypto.randomBytes(32).toString('hex'),order_ids:[D],note:'Manual'})).batch;assert.equal(manual.auto,false);
// An order without known parcels is received in one step and joins the same automatic batch.
await uploadReceipt(cn,B);r=await receive(B);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.order.batch_id,batch.id);assert.deepEqual(r.order.parcels,{list:[],total:0,arrived:0,missing:[]});
assert.equal((await cn('warehouse-batch&id='+manual.id)).batch.order_count,1,'Manual batch untouched');
// Wrong piece count: partial receipt opens an "extra" issue; once resolved, the right count is approved and batched.
await uploadReceipt(cn,C);r=await receive(C,{pieces:3,partial:true});assert.equal(r.status,200);issue=r.order.logistics.issues.find(i=>i.state==='open');assert.equal(issue.kind,'extra');assert.match(issue.note,/3/);assert.equal(r.order.batch_id,undefined);
assert.equal((await cn('warehouse-issue-resolve',{id:C,expected_version:r.order.logistics.version,issue_id:issue.id,resolution:'Нэг нь өөр захиалгынх'})).status,200);
r=await receive(C);assert.equal(r.status,200);assert.equal(r.order.batch_id,batch.id);
assert.equal((await cn('warehouse-orders&status=packed')).counts.packed,4,'Packed count includes manual and automatic batches');

// One-step shipping: role, scanning and the physical-departure confirmation are required.
batch=(await cn('warehouse-batch&id='+batch.id)).batch;assert.equal(batch.order_count,3);
assert.equal((await ub('warehouse-batch-ship',{id:batch.id,expected_version:batch.version,checked:true})).status,403);
assert.equal((await cn('warehouse-batch-ship',{id:batch.id,expected_version:batch.version,checked:true})).status,409,'Every order must be scanned');
for(const id of [A,B,C])batch=(await cn('warehouse-batch-scan',{id:batch.id,expected_version:batch.version,order_id:id})).batch;
assert.equal((await cn('warehouse-batch-ship',{id:batch.id,expected_version:batch.version})).status,400,'Departure confirmation required');
assert.equal((await cn('warehouse-batch-ship',{id:batch.id,expected_version:batch.version,checked:'true'})).status,400);
r=await cn('warehouse-batch-ship',{id:batch.id,expected_version:batch.version,checked:true});assert.equal(r.status,200,JSON.stringify(r));batch=r.batch;
assert.equal(batch.status,'dispatched');assert.ok(batch.dispatched_at);assert.ok(batch.orders.every(x=>x.status==='erenhot_dispatched'));assert.ok(batch.history.some(h=>h.event==='dispatch'));
assert.ok(!(await order(A)).history.some(h=>h.status==='erenhot_ready'),'Shipping from a draft skips the packed-only state');
assert.equal((await cn('warehouse-batch-ship',{id:batch.id,expected_version:batch.version,checked:true})).status,409,'No repeated dispatch');
assert.equal((await ub('warehouse-batch&id='+batch.id)).status,200,'Ulaanbaatar sees the dispatched batch');
assert.equal((await ub('warehouse-order&id='+A)).order.parcels,undefined,'Parcel check-in stays with Erenhot');

// Arrival alerts: late parcels and courier-delivered parcels that were not scanned.
const seed=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','-d','extension=mbstring','tests/warehouse-flow-fixture.php'],{encoding:'utf8',env:process.env});assert.equal(seed.status,0,seed.stderr+seed.stdout);
let alerts=await cn('warehouse-orders&status=alerts');assert.equal(alerts.counts.alerts,2);assert.deepEqual(alerts.orders.map(x=>x.id).sort(),['GS-TEST-040','GS-TEST-041']);
const late=alerts.orders.find(x=>x.id==='GS-TEST-040').alerts,signed=alerts.orders.find(x=>x.id==='GS-TEST-041').alerts;
assert.deepEqual(late,[{kind:'late',numbers:['YT6000000000001'],days:5}],'Only the overdue parcel is late');assert.deepEqual(signed,[{kind:'signed',numbers:['SF7000000000001']}]);
assert.deepEqual((await order('GS-TEST-042')).alerts,[],'Recent, unsigned parcels raise no alert');
await cn('warehouse-parcel-arrive',{id:'GS-TEST-041',number:'SF7000000000001'});alerts=await cn('warehouse-orders&status=alerts');assert.equal(alerts.counts.alerts,1,'Scanning clears the alert');assert.deepEqual(alerts.orders.map(x=>x.id),['GS-TEST-040']);

// Items show the supplier photo and Chinese title/options to Erenhot.
const item=(await order('GS-TEST-043')).items[0];assert.equal(item.image,'https://img.alicdn.com/imgextra/i1/example.jpg');assert.equal(item.original_name,'双肩包 大容量 旅行');assert.equal(item.original_variant,'颜色: 黑色');assert.equal(item.name,'Тест үүргэвч');
console.log('PASS warehouse flow: parcel check-in, one-step receipt with partial/extra shortfalls, freight approval, automatic batches (manual untouched), one-step shipping, arrival alerts, item photos/Chinese titles, roles, stale data and Chinese errors.');
