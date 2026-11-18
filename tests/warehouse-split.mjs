import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {uploadReceipt} from './warehouse-photo.mjs';
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){const jar=new Map();let csrf='';return async(action,body)=>{const form=body instanceof FormData,r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'X-CSRF-Token':csrf,...(!form?{'Content-Type':'application/json'}:{})}:{})},body:body?(form?body:JSON.stringify(body)):undefined});for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;return {...d,status:r.status};};}
const admin=client(),cn=client(),ub=client(),guest=client();
await admin('session');await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')));await guest('customer-me');
for(const [location,c] of [['erenhot',cn],['ulaanbaatar',ub]]){const login={location,email:location+'-split@example.test',password:'Warehouse-split-test-2026',enabled:true};assert.equal((await admin('warehouse-account-save',login)).status,200);await c('warehouse-session');assert.equal((await c('warehouse-login',login)).status,200);}
const order=async(id,c=cn)=>(await c('warehouse-order&id='+id)).order;
const raw=async id=>(await admin('admin-order&id='+id)).order;
const token=()=>crypto.randomBytes(32).toString('hex');
const root='GS-TEST-031',waybills=['SF1000000000001','SF1000000000002','SF1000000000003'];
const originalOverview=(await ub('warehouse-orders')).overview;
const split=async(id,extra={},c=cn)=>{const o=await order(id);return c('warehouse-order-split',{id,expected_status:o.status,expected_version:o.logistics.version,mode:'parcels',numbers:[waybills[0]],token:token(),checked:true,reason:'Send arrived portion first',...extra});};
const measure={weight_kg:1,volume_input:'dimensions',length_cm:10,width_cm:10,height_cm:10,pieces:1,checked:true};
const receive=async(id,extra={})=>{const o=await order(id);return cn('warehouse-receive',{id,expected_status:o.status,expected_version:o.logistics.version,...measure,pieces:o.expected_pieces,...extra});};
for(const number of waybills)assert.equal((await cn('warehouse-inbound-add',{id:root,number,company:'SF'})).status,200);
assert.equal((await split(root)).status,409,'Cannot split an unarrived parcel');
await cn('warehouse-parcel-arrive',{id:root,number:waybills[0]});
assert.equal((await split(root,{},ub)).status,403);
assert.equal((await split(root,{checked:false})).status,400);
assert.equal((await split(root,{expected_version:0})).status,409);
assert.equal((await split(root,{numbers:[]})).status,400);
assert.equal((await split(root,{numbers:[waybills[0],waybills[0]]})).status,400);
const before=await raw(root),request=token();let r=await split(root,{token:request});assert.equal(r.status,200,JSON.stringify(r));const first=r.part.id;
assert.equal(r.order.expected_pieces,2);assert.equal(r.part.expected_pieces,1);assert.equal(r.part.shipment_parent,root);assert.equal(r.part.can_split,false);
assert.deepEqual(r.order.parcels.list.map(p=>p.no),waybills.slice(1));assert.deepEqual(r.part.parcels.list.map(p=>p.no),[waybills[0]]);
assert.equal((await split(root,{token:request,expected_version:0})).part.id,first,'Network retry creates no duplicate');
assert.equal((await split(root,{numbers:[waybills[0]]})).status,409,'Moved parcel cannot be split again');
assert.equal((await split(first,{mode:'items',quantities:[1]})).status,409,'Continue splitting only the root remainder');
const after=await raw(root),child=await raw(first);assert.deepEqual(after.supplier,before.supplier);assert.equal(after.amount,before.amount);assert.deepEqual(after.invoice,before.invoice);assert.equal(child.amount,0);assert.equal(child.paid,false);for(const key of ['invoice','purchase','quote','refunds','callback_token'])assert.equal(child[key],undefined,key+' must not be copied');
assert.equal((await admin('order-update',{id:first,amount:99000,status:'confirmed'})).status,409,'No second goods bill');
assert.equal((await admin('order-update',{id:root,amount:99000,status:'cancelled'})).status,409);
assert.deepEqual((await cn('warehouse-tracking&number='+waybills[0])).orders.map(x=>x.id),[first],'Courier lookup resolves only the selected part');
assert.deepEqual((await cn('warehouse-outbound-lookup&code='+waybills[0])).orders.map(x=>x.id),[first]);
const guestToken=crypto.createHash('sha256').update('warehouse-fixture-31').digest('hex');
assert.equal((await guest('order-get',{id:first,token:'wrong'})).status,403);
assert.equal((await guest('order-get',{id:first,token:guestToken})).status,200,'Original guest token can read owned parts');
let publicRoot=(await guest('order-get',{id:root,token:guestToken})).order;
assert.equal(publicRoot.shipment_parts.length,2);for(const key of ['shipment_split','shipping_items','logistics','customer','phone','purchase'])assert.equal(publicRoot[key],undefined,key+' private');
// Measure just the selected parcel. It can leave and be sorted while two parcels still wait in China.
assert.equal((await receive(first)).status,409,'Fresh receipt photo is required');await uploadReceipt(cn,first);assert.equal((await receive(first)).status,200);
let batch=(await cn('warehouse-outbound-pack',{token:token(),order_ids:[first],codes:[waybills[0]]})).batch;assert.ok(batch);assert.equal(batch.piece_count,1);
r=await cn('warehouse-batch-dispatch',{id:batch.id,expected_version:batch.version,checked:true});assert.equal(r.status,200,JSON.stringify(r));batch=r.batch;
assert.equal((await order(root)).status,'confirmed');assert.equal((await order(first)).status,'erenhot_dispatched');
r=await ub('warehouse-batch-scan',{id:batch.id,order_id:first,expected_version:batch.version});assert.equal(r.status,200,JSON.stringify(r));batch=r.batch;
r=await ub('warehouse-batch-receive',{id:batch.id,expected_version:batch.version});assert.equal(r.status,200,JSON.stringify(r));
await uploadReceipt(ub,first);let u=await order(first,ub);
r=await ub('warehouse-sort',{id:first,expected_status:u.status,expected_version:u.logistics.version,shelf:'SPLIT-1',method:'pickup',contact_phone:'99112233',address:'',checked:true});assert.equal(r.status,200,JSON.stringify(r));
assert.equal(r.order.billing.breakdown.goods_mnt,0);assert.equal(r.order.billing.total,r.order.logistics.transport.amount_mnt,'Part is billed only its own freight');
assert.equal((await order(root)).status,'confirmed');
// Original order summary includes the first part's progress and is not complete while the remainder waits.
publicRoot=(await guest('order-get',{id:root,token:guestToken})).order;assert.equal(publicRoot.status,'confirmed');assert.equal(publicRoot.shipment_parts.find(p=>p.id===first).status,'ready_pickup');
// A second arrived parcel can be split from the remainder without losing the first one.
await cn('warehouse-parcel-arrive',{id:root,number:waybills[1]});r=await split(root,{numbers:[waybills[1]]});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.order.shipment_parts.length,3);assert.equal(r.order.expected_pieces,1);
const overview=(await ub('warehouse-orders')).overview;assert.deepEqual(overview.ordered,originalOverview.ordered,'Child transport records are not new purchases');assert.equal(overview.ulaanbaatar.parcels,1,'Boxes are not counted as products');
// Item split: quantity is conserved, supplier purchase data and the original payment remain intact.
const itemsRoot='GS-TEST-032';r=await split(itemsRoot,{mode:'items',numbers:[],quantities:[1]});assert.equal(r.status,200,JSON.stringify(r));const itemPart=r.part.id;
assert.equal(r.order.items[0].qty,1);assert.equal(r.part.items[0].qty,1);assert.equal((await raw(itemsRoot)).supplier.qty,2);
assert.equal((await split(itemsRoot,{mode:'items',numbers:[],quantities:[2]})).status,400);
assert.equal((await split(itemsRoot,{mode:'items',numbers:[],quantities:[1]})).status,400,'Cannot leave an empty remainder');
assert.equal((await split(itemsRoot,{mode:'parcels'})).status,409,'Mode is fixed after the first split');
await uploadReceipt(cn,itemPart);assert.equal((await receive(itemPart)).status,200);
batch=(await cn('warehouse-outbound-pack',{token:token(),order_ids:[itemPart],codes:[itemPart]})).batch;assert.ok(batch,'Item parts use their GS label');
assert.equal((await cn('warehouse-inbound-add',{id:itemPart,number:'SF9999999999999'})).status,409);
// Received parent: cancel its old freight approval, preserve the prior receipt in audit and require new photos.
const received='GS-TEST-033';await uploadReceipt(cn,received);assert.equal((await receive(received)).status,200);
r=await split(received,{mode:'items',numbers:[],quantities:[1]});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.order.status,'shipping');assert.equal(r.order.logistics.transport,undefined);assert.deepEqual(r.order.logistics.photos,[]);
assert.equal((await raw(received)).logistics.audit.at(-1).previous_photos.length,1);
assert.equal((await receive(received)).status,409,'Old whole-order photo cannot approve a split remainder');
// Claiming the original order after splitting claims every part; another customer gets no access.
const owner=client(),outsider=client();
for(const c of [owner,outsider]){await c('customer-me');const password='Split-customer-test-2026';assert.equal((await c('customer-register',{email:token().slice(0,12)+'@example.test',name:'Split Customer',phone:'99115050',password,password_confirm:password})).status,201);}
assert.equal((await owner('customer-claim-order',{id:root,token:guestToken})).status,200);
assert.equal((await outsider('order-get',{id:first,token:guestToken})).status,403);
assert.equal((await guest('order-get',{id:first,token:guestToken})).status,403,'A claimed order no longer accepts guest tokens');
assert.equal((await owner('order-get',{id:first})).status,200);
const ownList=(await owner('customer-orders')).orders;assert.equal(ownList.length,3);
assert.equal((await owner('customer-self-cargo')).orders.length,0,'Internal parts are not self-purchased orders');
assert.equal((await owner('customer-self-cargo-tracking',{id:first,number:'SF9999999999998'})).status,404);
assert.equal((await owner('customer-notifications')).notifications.some(n=>n.kind==='shipment_part'&&n.order_id===first),true);
const otherBranch={role:'erenhot',city:'Other Erenhot',name:'Other split warehouse',address:'Test address',phone:'99112233',hours:'09:00-18:00',email:'other-split@example.test',password:'Other-split-test-2026'};
const branch=await admin('warehouse-create',otherBranch);assert.equal(branch.status,201);const other=client();await other('warehouse-session');await other('warehouse-login',{...otherBranch,location:branch.warehouse.location});
assert.equal((await split(root,{},other)).status,404);
// Checkout purchase: two consignments, one goods payment, independent freight and pickup codes.
const fixture=(...args)=>{const p=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','-d','extension=mbstring','tests/warehouse-ub-fixture.php',...args],{encoding:'utf8',env:process.env});assert.equal(p.status,0,p.stderr+p.stdout);};
fixture('setup');const checkout='GS-TEST-050';
assert.equal((await owner('customer-claim-order',{id:checkout,token:crypto.createHash('sha256').update('warehouse-fixture-50').digest('hex')})).status,200);
r=await split(checkout,{mode:'items',numbers:[],quantities:[1]});assert.equal(r.status,200,JSON.stringify(r));const purchasedPart=r.part.id;
assert.ok((await owner('customer-orders')).orders.some(p=>p.id===purchasedPart),'New parts inherit customer ownership');
let freightTotal=0;
for(const partId of [checkout,purchasedPart]){
 await uploadReceipt(cn,partId);
 const cargoMethod=partId===checkout?'weight':'volume';
 assert.equal((await receive(partId,{cargo_method:'invalid'})).status,400);
 const received=await receive(partId,{cargo_method:cargoMethod});assert.equal(received.status,200,JSON.stringify(received));
 assert.equal(received.order.logistics.transport.method,cargoMethod);
 const expectedFreight=received.order.logistics.transport.amount_mnt;
 let b=(await cn('warehouse-outbound-pack',{token:token(),order_ids:[partId],codes:[partId]})).batch;assert.ok(b);
 b=(await cn('warehouse-batch-dispatch',{id:b.id,expected_version:b.version,checked:true})).batch;
 b=(await ub('warehouse-batch-scan',{id:b.id,order_id:partId,expected_version:b.version})).batch;
 assert.equal((await ub('warehouse-batch-receive',{id:b.id,expected_version:b.version})).status,200);
 await uploadReceipt(ub,partId);const p=await order(partId,ub);
 r=await ub('warehouse-sort',{id:partId,expected_status:p.status,expected_version:p.logistics.version,shelf:'SPLIT-2',method:'pickup',contact_phone:'99115050',address:'',checked:true});assert.equal(r.status,200,JSON.stringify(r));
 assert.equal(r.order.logistics.transport.method,cargoMethod);
 assert.equal(r.order.settlement.cargo_method,cargoMethod);
 assert.equal(r.order.settlement.breakdown.cargo_mnt,expectedFreight);
 freightTotal+=r.order.logistics.transport.amount_mnt;
 if(partId===purchasedPart){
  const x=r.order;r=await ub('warehouse-settlement',{id:partId,expected_version:x.logistics.version,cargo_method:cargoMethod,goods_mnt:1,domestic_mnt:0,service_mnt:0,delivery_mnt:0,note:'Test invalid goods charge'});assert.equal(r.status,409,JSON.stringify(r));
 }
 fixture('pay',partId);const own=(await owner('order-get',{id:partId})).order;assert.ok(own.cargo.pickup_code);
 assert.equal((await ub('warehouse-handover',{items:[{id:partId,code:own.cargo.pickup_code}],received_by:'Split Customer'})).status,200);
 if(partId===checkout)assert.notEqual((await owner('order-get',{id:checkout})).order.status,'completed','Completing the root remainder must not complete waiting parts');
}
const done=(await owner('order-get',{id:checkout})).order;assert.equal(done.status,'completed');assert.ok(done.shipment_parts.every(p=>p.status==='completed'));
assert.equal(done.shipment_parts.reduce((sum,p)=>sum+p.billing.total,0),99000+freightTotal,'Goods charged exactly once across all consignments');
assert.equal(done.shipment_parts.reduce((sum,p)=>sum+p.billing.paid,0),99000+freightTotal,'Original payment credited once');
console.log('Warehouse split: parcel/item conservation, isolation, retries, billing, independent dispatch and UB receipt passed.');
