import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {uploadReceipt} from './warehouse-photo.mjs';
// Erenhot shortcuts: parcel check-in, one-step receipt with freight, scan-to-dispatch (waybill/GS scan → GB batch),
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
// The last parcel clears the automatic shortfall; receiving again approves the freight. Packing waits for the scan-out.
r=await cn('warehouse-parcel-arrive',{id:A,number:'SF1000000000002'});assert.equal(r.order.parcels.arrived,2);assert.ok(r.order.logistics.issues.every(i=>i.state==='resolved'),'Automatic shortfall resolved');
r=await receive(A,{weight_kg:2});assert.equal(r.status,200,JSON.stringify(r));o=r.order;assert.ok(o.logistics.transport.confirmed_at);assert.equal(o.logistics.transport.amount_mnt,4000,"2 kg at 2000₮/kg");assert.equal(o.batch_id,undefined,'No automatic batch');
r=await receive(A,{weight_kg:1});assert.equal(r.status,200,'Re-measuring works until the order is packed');assert.equal(r.order.logistics.measurement.weight_kg,1);assert.ok(r.order.logistics.transport.amount_mnt<4000,'Freight follows the new weight');

// A manual (legacy) draft batch still works.
await uploadReceipt(cn,D);assert.equal((await cn('warehouse-order-update',{id:D,status:'erenhot',expected_status:'confirmed'})).status,200);
const manual=(await cn('warehouse-batch-create',{token:crypto.randomBytes(32).toString('hex'),order_ids:[D],note:'Manual'})).batch;assert.equal(manual.status,'draft');
// An order without known parcels is received in one step and is packed by its GS label.
await uploadReceipt(cn,B);r=await receive(B);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.order.batch_id,undefined);assert.deepEqual(r.order.parcels,{list:[],total:0,arrived:0,missing:[]});
// Wrong piece count: partial receipt opens an "extra" issue that blocks the scan-out until resolved.
await uploadReceipt(cn,C);r=await receive(C,{pieces:3,partial:true});assert.equal(r.status,200);issue=r.order.logistics.issues.find(i=>i.state==='open');assert.equal(issue.kind,'extra');assert.match(issue.note,/3/);assert.equal(r.order.batch_id,undefined);

// Scan-out lookup: a courier waybill or a GS label finds the order and says whether it can be packed.
let look=await cn('warehouse-outbound-lookup&code=sf1000000000001');assert.equal(look.status,200,JSON.stringify(look));assert.equal(look.code,'SF1000000000001');
assert.deepEqual(look.orders.map(x=>[x.id,x.number,x.reason,x.pieces,x.destination]),[[A,'SF1000000000001','',2,'ulaanbaatar']]);assert.deepEqual(look.orders[0].parcels,['SF1000000000001','SF1000000000002']);assert.ok(look.orders[0].destination_name);
look=await cn('warehouse-outbound-lookup&code='+B);assert.deepEqual(look.orders.map(x=>[x.id,x.number,x.reason]),[[B,null,'']]);
assert.equal((await cn('warehouse-outbound-lookup&code='+C)).orders[0].reason,'issue');
assert.equal((await cn('warehouse-outbound-lookup&code='+D)).orders[0].reason,'packed');
assert.equal((await cn('warehouse-outbound-lookup&code=SF0000000000000')).status,404);
assert.equal((await cn('warehouse-outbound-lookup&code=bad!')).status,400);
assert.equal((await ub('warehouse-outbound-lookup&code='+B)).status,403);

// Confirm packing: role, token, list, readiness and complete waybills are enforced; then a GB batch is created, packed and checked.
const packToken=crypto.randomBytes(32).toString('hex');const pack=(body,c=cn,action='warehouse-outbound-pack')=>c(action,{token:packToken,...body});
assert.equal((await pack({order_ids:[A],codes:['SF1000000000001','SF1000000000002']},ub)).status,403);
assert.equal((await pack({token:'x',order_ids:[A],codes:[A]})).status,400);
assert.equal((await pack({order_ids:[A],codes:[]})).status,400);
assert.equal((await pack({order_ids:[A],codes:'SF1000000000001'})).status,400);
assert.equal((await pack({order_ids:[A,B],codes:['SF1000000000001','SF1000000000002']})).status,400,'Every listed order must be scanned');
assert.equal((await pack({order_ids:[A],codes:['SF1000000000001']})).status,409,'Every waybill of the order must be scanned');
assert.match((await pack({order_ids:[A],codes:['SF1000000000001']},cn,'warehouse-outbound-pack&lang=zh')).error,/未扫描齐全/,'Chinese error');
assert.equal((await pack({order_ids:[A,C],codes:['SF1000000000001','SF1000000000002',C]})).status,409,'An open issue blocks packing');
assert.equal((await pack({order_ids:[A,D],codes:['SF1000000000001','SF1000000000002',D]})).status,409,'A batched order cannot be packed again');
assert.equal((await order(A)).batch_id,undefined,'Failed attempts change nothing');
r=await pack({order_ids:[A,B],codes:['sf1000000000001','SF1000000000002',B]});assert.equal(r.status,200,JSON.stringify(r));let batch=r.batch;
assert.match(batch.id,/^GB-[A-F0-9]{6}$/);assert.equal(batch.status,'ready');assert.equal(batch.destination,'ulaanbaatar');assert.deepEqual(batch.orders.map(x=>x.id).sort(),[A,B].sort());
assert.ok(batch.orders.every(x=>x.status==='erenhot_ready'));assert.deepEqual([...batch.scanned].sort(),[A,B].sort(),'Scanned orders are already checked');assert.deepEqual(batch.history.map(h=>h.event),['created','ready']);
assert.equal((await pack({order_ids:[B],codes:[B]})).batch.id,batch.id,'Repeating the same request returns the same batch');
assert.equal((await receive(A)).status,409,'A packed order is not remeasured');
assert.equal((await cn('warehouse-outbound-lookup&code=SF1000000000002')).orders[0].reason,'packed');
assert.equal((await cn('warehouse-orders&status=packed')).counts.packed,3,'Packed: the scanned-out batch and the manual draft');
// Batch records: 备货中 lists packed batches (and the manual draft).
let listed=(await cn('warehouse-batches&status=packed')).batches;assert.deepEqual(listed.map(b=>b.id).sort(),[batch.id,manual.id].sort());assert.equal((await cn('warehouse-orders')).counts.packed_batches,2);
assert.deepEqual((await cn('warehouse-batches&status=shipped')).batches,[]);
// Month filter: lists by the month the code was created (UTC+8, like Erenhot and Ulaanbaatar).
const thisMonth=new Date(Date.now()+8*3600e3).toISOString().slice(0,7);
assert.equal((await cn('warehouse-orders&month=2026-13')).status,400);assert.match((await cn('warehouse-orders&month=bad&lang=zh')).error,/月份格式不正确/);
assert.equal((await cn('warehouse-orders&month=2001-01')).total,0);assert.equal((await cn('warehouse-orders&month=2026-01')).total,(await cn('warehouse-orders')).total,'Fixture orders were created in January 2026');
assert.deepEqual((await cn('warehouse-batches&status=packed&month='+thisMonth)).batches.map(b=>b.id).sort(),[batch.id,manual.id].sort());assert.equal((await cn('warehouse-batches&month=2026-01')).total,0);

// Dispatch the GB batch: role and the physical-departure confirmation are required.
assert.equal((await ub('warehouse-batch-dispatch',{id:batch.id,expected_version:batch.version,checked:true})).status,403);
assert.equal((await cn('warehouse-batch-dispatch',{id:batch.id,expected_version:batch.version})).status,400,'Departure confirmation required');
// Reopening returns it to a draft; a courier waybill then checks its order like the GS label does.
r=await cn('warehouse-batch-reopen',{id:batch.id,expected_version:batch.version});assert.equal(r.status,200,JSON.stringify(r));batch=r.batch;assert.equal(batch.status,'draft');assert.deepEqual(batch.scanned,[]);
assert.equal((await cn('warehouse-batch-scan',{id:batch.id,expected_version:batch.version,order_id:'SF9999999999999'})).status,409,'Unknown waybill');
batch=(await cn('warehouse-batch-scan',{id:batch.id,expected_version:batch.version,order_id:'SF1000000000002'})).batch;assert.deepEqual(batch.scanned,[A],'Waybill checks its order');
assert.equal((await cn('warehouse-batch-ship',{id:batch.id,expected_version:batch.version,checked:true})).status,409,'Every order must be scanned');
batch=(await cn('warehouse-batch-scan',{id:batch.id,expected_version:batch.version,order_id:B})).batch;
r=await cn('warehouse-batch-ship',{id:batch.id,expected_version:batch.version,checked:true});assert.equal(r.status,200,JSON.stringify(r));batch=r.batch;
assert.equal(batch.status,'dispatched');assert.ok(batch.dispatched_at);assert.ok(batch.orders.every(x=>x.status==='erenhot_dispatched'));assert.ok(batch.history.some(h=>h.event==='dispatch'));
assert.equal((await cn('warehouse-batch-ship',{id:batch.id,expected_version:batch.version,checked:true})).status,409,'No repeated dispatch');
// C: once the issue is resolved and the freight approved, its GS label packs it and the GB batch is dispatched.
assert.equal((await cn('warehouse-issue-resolve',{id:C,expected_version:(await order(C)).logistics.version,issue_id:issue.id,resolution:'Нэг нь өөр захиалгынх'})).status,200);
r=await receive(C);assert.equal(r.status,200);assert.equal(r.order.batch_id,undefined);
r=await cn('warehouse-outbound-pack',{token:crypto.randomBytes(32).toString('hex'),order_ids:[C],codes:[C.toLowerCase()]});assert.equal(r.status,200,JSON.stringify(r));const gb=r.batch;
r=await cn('warehouse-batch-dispatch',{id:gb.id,expected_version:gb.version,checked:true});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.batch.status,'dispatched');assert.equal(r.batch.orders[0].status,'erenhot_dispatched');
assert.ok((await order(C)).history.some(h=>h.status==='erenhot_ready'),'Packed before it left');
assert.equal((await ub('warehouse-batch&id='+gb.id)).status,200,'Ulaanbaatar sees the dispatched batch');
// 已发货 lists the dispatched batches.
assert.deepEqual((await cn('warehouse-batches&status=shipped')).batches.map(b=>b.id).sort(),[batch.id,gb.id].sort());assert.equal((await cn('warehouse-orders')).counts.shipped_batches,2);assert.equal((await cn('warehouse-orders')).counts.packed_batches,1,'Only the manual draft is left');
assert.equal((await ub('warehouse-order&id='+A)).order.parcels,undefined,'Parcel check-in stays with Erenhot');

// Arrival alerts: late parcels and courier-delivered parcels that were not scanned.
const seed=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','-d','extension=mbstring','tests/warehouse-flow-fixture.php'],{encoding:'utf8',env:process.env});assert.equal(seed.status,0,seed.stderr+seed.stdout);
let alerts=await cn('warehouse-orders&status=alerts');assert.equal(alerts.counts.alerts,2);assert.deepEqual(alerts.orders.map(x=>x.id).sort(),['GS-TEST-040','GS-TEST-041']);
const late=alerts.orders.find(x=>x.id==='GS-TEST-040').alerts,signed=alerts.orders.find(x=>x.id==='GS-TEST-041').alerts;
assert.deepEqual(late,[{kind:'late',numbers:['YT6000000000001'],days:5}],'Only the overdue parcel is late');assert.deepEqual(signed,[{kind:'signed',numbers:['SF7000000000001']}]);
assert.deepEqual((await order('GS-TEST-042')).alerts,[],'Recent, unsigned parcels raise no alert');
assert.equal((await cn('warehouse-outbound-lookup&code=ZT8000000000001')).orders[0].reason,'not_received','A parcel still on the way cannot be packed');
await cn('warehouse-parcel-arrive',{id:'GS-TEST-041',number:'SF7000000000001'});alerts=await cn('warehouse-orders&status=alerts');assert.equal(alerts.counts.alerts,1,'Scanning clears the alert');assert.deepEqual(alerts.orders.map(x=>x.id),['GS-TEST-040']);

// Items show the supplier photo and Chinese title/options to Erenhot.
const item=(await order('GS-TEST-043')).items[0];assert.equal(item.image,'https://img.alicdn.com/imgextra/i1/example.jpg');assert.equal(item.original_name,'双肩包 大容量 旅行');assert.equal(item.original_variant,'颜色: 黑色');assert.equal(item.name,'Тест үүргэвч');
console.log('PASS warehouse flow: parcel check-in, one-step receipt with partial/extra shortfalls, freight approval, scan-out lookup and GB packing (waybills complete, issues block, idempotent), dispatch, waybill batch scan, arrival alerts, item photos/Chinese titles, roles, stale data and Chinese errors.');
