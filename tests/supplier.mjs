// Run against an isolated dev server with a warmed "bag" search and first product cache.
// GOSTORE_DISABLE_SUPPLIER_NETWORK=1 prevents this test spending provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const base=process.env.TEST_BASE||'http://127.0.0.1:3000';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Loopback only.');
function client(){let cookie='',csrf='';return async(action,body)=>{const r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const j=await r.json();if(j.csrf)csrf=j.csrf;return {status:r.status,...j};};}
const shop=client(),admin=client();await shop('catalog');await admin('session');
assert.equal((await admin('login',JSON.parse(fs.readFileSync('tmp/admin-preview.json')))).status,200);
const settings=(await admin('dashboard')).shipping;
assert.equal((await shop('shipping-save',settings)).status,403);
await shop('catalog');assert.equal((await shop('supplier-product',{id:'https://evil.test'})).status,400);
const search=await shop('supplier-search',{q:'bag',page:1,sort:'default'});assert.equal(search.status,200);assert.ok(search.products.length>0);assert.equal(search.shipping.cny_rate,550);
const d=await shop('supplier-product',{id:search.products[0].id});assert.equal(d.status,200);assert.ok(d.cache_ttl>0&&d.cache_ttl<=3600);assert.ok(search.cache_ttl>0&&search.cache_ttl<=3600);
const p=d.product,v=p.variants.find(v=>v.cny&&v.stock>=p.min_qty);
const b={type:'supplier',token:crypto.randomBytes(32).toString('hex'),product_id:p.id,sku:v.id,qty:p.min_qty,title:'Tampered title',customer:'Тамир',family_name:'Бат',phone:'99112233',notes:'',price:1,amount:1,unit_cny:1};
assert.equal((await shop('order-create',{...b,sku:'fake'})).status,409);
assert.equal((await shop('order-create',{...b,family_name:''})).status,400);
const order=(await shop('order-create',b)).order;assert.equal(order.warehouse.recipient,'Бат Тамир / '+order.id);assert.equal(order.warehouse.phone,'18047981132');assert.equal(order.warehouse.contact_phone,'99889815');assert.ok(order.warehouse.label.includes(order.id));assert.equal(order.supplier.unit_cny,v.cny);assert.equal(order.amount,0);assert.notEqual(order.title,b.title);
assert.equal((await shop('order-create',b)).order.id,order.id);
assert.equal((await admin('shipping-save',{...settings,cny_rate:-1})).status,400);
const inputs={goods_cny:10,domestic_cny:2,cargo_method:'weight',cargo_measure:0.501};
const quote=await admin('order-update',{id:order.id,status:'quoted',amount:1,internal_note:'',quote_inputs:inputs});assert.equal(quote.order.amount,9600);assert.equal(quote.order.quote.breakdown.cargo_mnt,3000);
await admin('shipping-save',{...settings,cny_rate:600,warehouse_address:'Changed address'});await shop('catalog');
const stable=await shop('order-get',{id:order.id,token:b.token});assert.equal(stable.order.warehouse.address,order.warehouse.address);assert.notEqual(stable.order.warehouse.address,'Changed address');assert.equal(stable.order.amount,9600);assert.equal(stable.order.quote.rates.cny_rate,550);
await admin('shipping-save',settings);
const routed=await admin('order-update',{id:order.id,status:'zamyn_uud',amount:9600,internal_note:''});assert.equal(routed.order.history.at(-1).status,'zamyn_uud');
await admin('logout',{});
console.log('PASS: supplier cache, SKU/server prices, idempotency, settings auth, quote arithmetic, immutable rate snapshot, route history.');
