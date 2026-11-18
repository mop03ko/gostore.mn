import {uploadReceipt,confirmCargo} from './warehouse-photo.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const base=process.env.TEST_BASE||'http://127.0.0.1:3088';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Isolated loopback server required.');
function client(){const jar=new Map();let csrf='';return async(action,body)=>{const form=body instanceof FormData;const r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'X-CSRF-Token':csrf,...(!form?{'Content-Type':'application/json'}:{})}:{})},body:body?(form?body:JSON.stringify(body)):undefined});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}const d=await r.json();if(d.csrf)csrf=d.csrf;return{status:r.status,...d};};}
const admin=client(),cn=client(),ub=client(),guest=client(),other=client();const token=()=>crypto.randomBytes(32).toString('hex');
await admin('session');assert.equal((await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')))).status,200);
for(const [location,c] of [['erenhot',cn],['ulaanbaatar',ub]]){const b={location,email:location+'-batch@example.test',password:'Warehouse-batch-tests-2026',enabled:true};assert.equal((await admin('warehouse-account-save',b)).status,200);await c('warehouse-session');assert.equal((await c('warehouse-login',b)).status,200);}
assert.equal((await other('warehouse-batches')).status,401);await guest('catalog');
const ids=['GS-TEST-001','GS-TEST-002','GS-TEST-003','GS-TEST-004'];
const trackingToken=crypto.createHash('sha256').update('warehouse-fixture-1').digest('hex');
async function checkTracking(status){const response=await guest('order-get',{id:ids[0],token:trackingToken});assert.equal(response.status,200);assert.equal(response.order.id,ids[0]);assert.equal(response.order.status,status);assert.equal(response.order.batch_id,undefined);assert.ok(!JSON.stringify(response.order).includes('GB-'),'Tracking never exposes a batch code');}
for(const id of ids){await uploadReceipt(cn,id);assert.equal((await cn('warehouse-order-update',{id,status:'erenhot',expected_status:'confirmed'})).status,200);}
assert.equal((await cn('warehouse-order-update',{id:ids[0],status:'erenhot_dispatched',expected_status:'erenhot'})).status,403,'Dispatch must use a batch');
assert.equal((await admin('order-update',{id:ids[3],status:'ready_delivery',amount:99000,internal_note:''})).status,409,'Admin cannot create fulfillment state without sorting');
for(const id of ids){const m=await cn('warehouse-measure',{id,expected_version:(await cn('warehouse-order&id='+id)).order.logistics.version,weight_kg:1,length_cm:10,width_cm:10,height_cm:10,pieces:2});assert.equal(m.status,200);await confirmCargo(cn,id);}
async function scanAll(c,b){for(const o of b.orders){const r=await c('warehouse-batch-scan',{id:b.id,expected_version:b.version,order_id:o.id});assert.equal(r.status,200);b=r.batch;}return b;}

let r;
const createBatch=async(ids)=>{const r=await cn('warehouse-batch-create',{token:token(),order_ids:ids,note:'Unpack test'});assert.equal(r.status,201,JSON.stringify(r));return r.batch;};
const ready=async b=>{b=await scanAll(cn,b);const r=await cn('warehouse-batch-ready',{id:b.id,expected_version:b.version});assert.equal(r.status,200,JSON.stringify(r));return r.batch;};
const getOrder=async id=>(await cn('warehouse-order&id='+id)).order;
const raw=async id=>(await admin('admin-order&id='+id)).order;
const unpack=(b,selected,extra={},c=cn)=>c('warehouse-batch-unpack',{id:b.id,expected_version:b.version,order_ids:selected,reason:'Selected wrong shipment',checked:true,...extra});
let b=await ready(await createBatch(ids.slice(0,2)));assert.equal(b.can_unpack,true);
const before=await raw(ids[0]);
assert.equal((await unpack(b,[ids[0]],{},ub)).status,403);
assert.equal((await unpack(b,[ids[0]],{checked:false})).status,400);
assert.equal((await unpack(b,[ids[0]],{reason:''})).status,400);
assert.equal((await unpack(b,[])).status,400);
assert.equal((await unpack(b,[ids[0],ids[0]])).status,400);
assert.equal((await unpack(b,[ids[0],ids[2]])).status,409);
assert.equal((await getOrder(ids[0])).batch_id,b.id,'Invalid selection rolls back whole operation');
const branch={role:'erenhot',city:'Other',name:'Other warehouse',address:'Test',phone:'99112233',hours:'09-18',email:'other-unpack@example.test',password:'Warehouse-unpack-2026'};
const created=await admin('warehouse-create',branch);await other('warehouse-session');await other('warehouse-login',{...branch,location:created.warehouse.location});
assert.equal((await unpack(b,[ids[0]],{},other)).status,404);
const old=b;r=await unpack(b,[ids[0]]);assert.equal(r.status,200,JSON.stringify(r));b=r.batch;
assert.equal(b.status,'draft');assert.equal(b.ready_at,undefined);assert.deepEqual(b.scanned,[]);assert.equal(b.order_count,1);
assert.equal((await unpack(old,[ids[0]])).status,409,'Stale retry does not mutate');
const freed=await getOrder(ids[0]),after=await raw(ids[0]);assert.equal(freed.status,'erenhot');assert.equal(freed.batch_id,undefined);assert.equal(freed.can_split,true);
for(const key of ['amount','paid','invoice','quote'])assert.deepEqual(after[key],before[key],key+' preserved');
for(const key of ['measurement','transport','photos'])assert.deepEqual(after.logistics[key],before.logistics[key],key+' preserved');
assert.equal(after.logistics.audit.at(-1).reason,'Selected wrong shipment');
assert.equal(b.orders[0].status,'erenhot');assert.equal((await cn('warehouse-batch-ship',{id:b.id,expected_version:b.version,checked:true})).status,409,'Must rescan remaining orders');
r=await cn('warehouse-order-split',{id:freed.id,expected_version:freed.logistics.version,expected_status:freed.status,mode:'items',quantities:[1],numbers:[],token:token(),checked:true,reason:'Send one first'});assert.equal(r.status,200,JSON.stringify(r));
r=await unpack(b,[ids[1]]);assert.equal(r.status,200);assert.equal(r.batch.status,'cancelled');assert.equal(r.batch.order_count,0);assert.equal(r.batch.can_unpack,false);
assert.equal((await cn('warehouse-batch-ship',{id:b.id,expected_version:r.batch.version,checked:true})).status,409,'Retired label cannot ship');
b=await ready(await createBatch([ids[1]]));b=(await cn('warehouse-batch-dispatch',{id:b.id,expected_version:b.version,checked:true})).batch;assert.equal(b.can_unpack,false);assert.equal((await unpack(b,[ids[1]])).status,409,'Physically dispatched packages locked');
// Mobile UI: remove a selected order from a ready package; then unpack the remaining draft in full.
b=await ready(await createBatch(ids.slice(2,4)));
const {createRequire}=await import('node:module');const require=createRequire(import.meta.url),{chromium}=require('../tmp/tooling/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 const session=await(await context.request.get(base+'/api/index.php?action=warehouse-session')).json();
 const login=await context.request.post(base+'/api/index.php?action=warehouse-login',{headers:{'X-CSRF-Token':session.csrf},data:{location:'erenhot',email:'erenhot-batch@example.test',password:'Warehouse-batch-tests-2026'}});assert.ok(login.ok());
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/warehouse/');await page.locator('#app').waitFor({state:'visible'});
 await page.evaluate(async id=>showBatch((await api('warehouse-batch&id='+id)).batch),b.id);
 await page.locator('[data-unpack-order="'+ids[2]+'"]').click();let form=page.locator('[data-unpack-form]');
 assert.equal(await form.locator('[name=order_id]:checked').count(),1);
 for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:844});assert.ok(await form.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Fits '+width);}
 await page.setViewportSize({width:390,height:844});await form.locator('[name=reason]').fill('重新分装');await form.locator('[name=checked]').check();
 await page.locator('#editor').screenshot({path:'tmp/warehouse-unpack.png'});
 let saved=page.waitForResponse(r=>r.url().includes('action=warehouse-batch-unpack'));await form.locator('[type=submit]').click();assert.equal((await saved).status(),200);
 await page.locator('[data-unpack-order="'+ids[2]+'"]').waitFor({state:'detached'});
 await page.locator('[data-unpack-panel] summary').click();form=page.locator('[data-unpack-form]');await form.locator('[data-unpack-all]').click();
 await form.locator('[name=reason]').fill('全部重新打包');await form.locator('[name=checked]').check();saved=page.waitForResponse(r=>r.url().includes('action=warehouse-batch-unpack'));await form.locator('[type=submit]').click();assert.equal((await saved).status(),200);
 await page.locator('[data-unpack-form]').waitFor({state:'detached'});assert.match(await page.locator('#editor').innerText(),/作废旧 GB 标签/);assert.deepEqual(errors,[]);
}finally{await browser.close();}
assert.equal((await getOrder(ids[2])).batch_id,undefined);assert.equal((await getOrder(ids[3])).batch_id,undefined);
assert.ok((await createBatch(ids.slice(2,4))).id,'Freed orders can join a new package');
console.log('PASS unpack: ready/draft selection and full unpack, financial/photo preservation, splitting/repacking, stale/foreign/invalid/dispatched guards, Chinese mobile UI.');
