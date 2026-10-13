import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){let cookie='',csrf='';return async(action,body,badCsrf=false)=>{const r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json','X-CSRF-Token':badCsrf?'bad':csrf}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const j=await r.json();if(j.csrf)csrf=j.csrf;return {status:r.status,...j};};}
const admin=client(),other=client(),shop=client(),wh=client(),anon=client(),auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));
for(const c of [admin,other]){await c('session');assert.equal((await c('login',auth)).status,200);}
await anon('session');await shop('catalog');await wh('warehouse-session');
for(const action of ['admin-password-change','product-delete','warehouse-profile-save']){
 assert.equal((await anon(action,{})).status,401);assert.equal((await wh(action,{})).status,403);assert.equal((await admin(action,{},true)).status,403);
}
const before=(await admin('dashboard')).warehouse_profiles;
const erenhot={...before.erenhot,name:'Erenhot test',address:'Erenhot test address',phone:'18047981132',hours:'09:00–18:00'};
assert.equal((await admin('warehouse-profile-save',erenhot)).status,200);
assert.deepEqual((await admin('dashboard')).warehouse_profiles.ulaanbaatar,before.ulaanbaatar);
const ub={...before.ulaanbaatar,name:'UB test',address:'UB test address',phone:'99112233',hours:'10:00–19:00'};
assert.equal((await admin('warehouse-profile-save',ub)).status,200);
assert.equal((await admin('warehouse-profile-save',{...ub,location:'invalid'})).status,400);
assert.equal((await admin('warehouse-profile-save',{...ub,phone:'<script>'})).status,400);
const dashboard=await admin('dashboard');assert.equal(dashboard.shipping.warehouse_address,erenhot.address);
const {warehouse_address,warehouse_phone,warehouse_contact_phone,...rates}=dashboard.shipping;
assert.equal((await admin('shipping-save',rates)).status,200);
assert.equal((await admin('dashboard')).shipping.warehouse_address,erenhot.address,'Rate save preserves address');
const product={id:'management-test',name:'Original item',description:'Test item',category:'home',type:'china',image:'chair',price:15000,stock:1,active:true,demo:true,variants:['Standard']};
assert.equal((await admin('product-save',product)).status,200);
const token=crypto.randomUUID().replaceAll('-','').repeat(2);
let created=await shop('order-create',{type:'cart',title:'Test order',family_name:'Test',customer:'Customer',phone:'99112233',notes:'',token,items:[{id:product.id,qty:1,variant:'Standard'}]});
assert.equal(created.status,201);const id=created.order.id;
assert.equal(created.order.warehouse.address,erenhot.address);
assert.equal((await admin('warehouse-profile-save',{...erenhot,address:'Changed destination'})).status,200);
assert.equal((await shop('order-get',{id,token})).order.warehouse.address,erenhot.address,'Old destination snapshot preserved');
assert.equal((await admin('product-save',{...product,name:'Edited item',price:20000})).status,200);
assert.equal((await shop('order-get',{id,token})).order.items[0].price,15000,'Old price snapshot preserved');
assert.equal((await admin('product-delete',{id:product.id})).status,400);
assert.equal((await admin('product-delete',{id:product.id,confirm_id:product.id})).status,200);
assert.ok(!(await shop('catalog')).products.some(p=>p.id===product.id));assert.ok(!(await admin('dashboard')).products.some(p=>p.id===product.id));
assert.equal((await admin('product-save',product)).status,409,'Stale editor cannot restore deleted product');
const existing=await shop('order-get',{id,token});assert.equal(existing.order.items[0].name,product.name,'Deletion preserves order snapshot');
assert.equal((await shop('order-create',{type:'cart',title:'Test order',family_name:'Test',customer:'Customer',phone:'99112233',token:crypto.randomUUID().replaceAll('-','').repeat(2),items:[{id:product.id,qty:1,variant:'Standard'}]})).status,400);
const change={current_password:auth.password,new_password:'New-admin-test-2026!',password_confirm:'New-admin-test-2026!'};
assert.equal((await admin('admin-password-change',{...change,current_password:'Wrong'})).status,422);
assert.equal((await admin('admin-password-change',{...change,password_confirm:'different'})).status,400);
assert.equal((await admin('admin-password-change',{...change,new_password:'short',password_confirm:'short'})).status,400);
assert.equal((await admin('admin-password-change',change)).status,200);
assert.equal((await admin('dashboard')).status,200,'Current session retained');
assert.equal((await other('session')).authenticated,false);assert.equal((await other('dashboard')).status,401,'Other session revoked');
assert.equal((await other('login',auth)).status,401,'Old password rejected');
assert.equal((await other('login',{email:auth.email,password:change.new_password})).status,200);
assert.equal((await other('admin-password-change',{current_password:change.new_password,new_password:auth.password,password_confirm:auth.password})).status,200);
console.log('PASS: admin/CSRF isolation, password validation and rotation, other-session revocation, independent warehouse profiles, unchanged shipping/order snapshots, product edit/delete, no resurrection, preserved order history.');
