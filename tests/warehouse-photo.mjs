import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function confirmCargo(client,id){
  const o=(await client('warehouse-order&id='+id)).order,q=o.logistics.transport;
  const r=await client('warehouse-cargo-confirm',{id,expected_version:o.logistics.version,expected_amount_mnt:q.amount_mnt,checked:true});assert.equal(r.status,200,JSON.stringify(r));return r.order;
}
export async function uploadReceipt(client,id){
  const o=(await client('warehouse-order&id='+id)).order;
  const f=new FormData();f.set('id',id);f.set('expected_version',String(o.logistics.version));
  f.set('location','spoofed-location');f.set('at','2000-01-01');
  f.set('image',new Blob([fs.readFileSync('assets/chair.jpg')],{type:'image/jpeg'}),'receipt.jpg');
  const r=await client('warehouse-photo-upload',f);assert.equal(r.status,200,JSON.stringify(r));
  const photo=r.order.logistics.photos.at(-1);assert.notEqual(photo.location,'spoofed-location');assert.notEqual(photo.at,'2000-01-01');return r.order;
}
