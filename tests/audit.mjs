import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
function client(){const cookies=new Map();let csrf='';return async(action,body)=>{const multipart=body instanceof FormData,r=await fetch(base+'/api/index.php?action='+action,{method:body?'POST':'GET',headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(body?{'X-CSRF-Token':csrf,...(multipart?{}:{'Content-Type':'application/json'})}:{})},body:body?(multipart?body:JSON.stringify(body)):undefined});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));}const data=await r.json();if(data.csrf)csrf=data.csrf;return {status:r.status,...data};};}
const shop=client(),admin=client();await shop('catalog');await admin('session');const auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));assert.equal((await admin('login',auth)).status,200);
const product={id:'audit-stock',name:'Stock test',description:'Test only',category:'bags',type:'local',image:'backpack',price:100,stock:10,active:true,demo:false,variants:['Blue','Red']};assert.equal((await admin('product-save',product)).status,200);
const request=items=>({type:'cart',token:crypto.randomBytes(32).toString('hex'),title:'Audit',customer:'Test',phone:'99112233',items});
for(const items of [[null],['bad'],[{id:[],variant:'Blue',qty:1}],{row:{id:product.id,variant:'Blue',qty:1}}])assert.equal((await shop('order-create',request(items))).status,400,'Malformed carts return a validation error');
for(const second of ['Blue','Red'])assert.equal((await shop('order-create',request([{id:product.id,variant:'Blue',qty:6},{id:product.id,variant:second,qty:6}]))).status,400,'Total stock includes duplicate rows and all variants');
const created=await shop('order-create',request([{id:product.id,variant:'Blue',qty:4},{id:product.id,variant:'Red',qty:6}]));assert.equal(created.status,201);assert.equal(created.order.subtotal,1000);
const wide=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=D:/Gostore.mn/tmp/tooling/php/ext','-d','extension=gd'],{input:'<?php $im=imagecreatetruecolor(4000,1);imagepng($im);',encoding:null});assert.equal(wide.status,0);
const form=new FormData();form.append('image',new Blob([wide.stdout],{type:'image/png'}),'wide.png');const upload=await admin('image-upload',form);assert.equal(upload.status,200,'Extreme aspect ratios retain at least one pixel');fs.unlinkSync('assets/'+upload.image+'.jpg');
assert.equal((await admin('admin-password-change',{current_password:auth.password,new_password:'long-test\0password',password_confirm:'long-test\0password'})).status,400);
assert.equal((await admin('warehouse-account-save',{location:'erenhot',email:'test@example.test',password:'long-test\0password',enabled:true})).status,400);
console.log('PASS audit: malformed carts, cumulative stock across rows/variants, correct total, extreme image resize, invalid password rejection.');
