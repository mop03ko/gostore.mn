const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync('order-tracking.js','utf8'),context);const t=context.window.OrderTracking;
const at='2026-11-01T00:00:00Z',later='2026-11-02T00:00:00Z';
const make=status=>({status,history:[{status:'confirmed',at},{status,at}],updated:later,warehouse_names:{erenhot:'Эрээн А',ulaanbaatar:'УБ Б'}});
for(const status of ['new','reviewing','quoted','confirmed','shipping','erenhot','erenhot_ready','erenhot_dispatched','zamyn_uud','ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery','out_for_delivery','completed','cancelled']){
 const s=t.state(make(status));assert.ok(s.location&&s.next&&s.label,status);assert.equal(s.at,at,'An unrelated edit must not change movement time');assert.ok(t.html(make(status)).includes('tracking-location'));
}
assert.equal(t.state(make('erenhot_ready')).location,'Эрээн А');assert.equal(t.state(make('erenhot_ready')).stage,1);
assert.equal(t.state(make('erenhot_dispatched')).location,'Эрээн А → Замын-Үүд');assert.equal(t.state(make('erenhot_dispatched')).stage,2);
for(const status of ['ulaanbaatar_unsorted','ulaanbaatar','ready_pickup','ready_delivery'])assert.equal(t.state(make(status)).location,'УБ Б');
const inbound={status:'TaoWorld: shipped',checked_at:later};assert.equal(t.state({...make('confirmed'),inbound}).location,'Нийлүүлэгч → Эрээн А');assert.equal(t.state({...make('confirmed'),inbound}).at,later);
for(const status of ['erenhot','erenhot_ready','erenhot_dispatched','ulaanbaatar','completed','cancelled'])assert.equal(t.state({...make(status),inbound}).supplier,false,'Supplier data cannot rewind warehouse movement');
assert.equal(t.state({status:'erenhot',updated:later}).at,null);assert.equal(t.state({status:'unknown'}).stage,null);assert.equal(t.progress({status:'cancelled'}),'');assert.equal(t.progress({status:'unknown'}),'');
assert.equal((t.progress({status:'ulaanbaatar',history:[]}).match(/class="done"/g)||[]).length,0,'Missing events must not be fabricated');
assert.equal(t.date(at),'2026-11-01 08:00');assert.ok(t.date('invalid').includes('бүртгэгдээгүй'));
const chinese=t.html({status:'erenhot_ready',warehouse_names:{erenhot:'Эрээн агуулах',ulaanbaatar:'Улаанбаатар агуулах'}} ,{lang:'zh'});assert.ok(chinese.includes('二连仓库'));assert.ok(!/[\u0400-\u04ff]/.test(chinese));
const output=t.html({...make('erenhot'),warehouse_names:{erenhot:'<img src=x onerror=alert(1)>'},batch_id:'GB-PRIVATE',internal_note:'PRIVATE NOTE',inbound:{raw:'PRIVATE RAW'}});
assert.ok(output.includes('&lt;img'));assert.ok(!output.includes('<img'));assert.ok(!output.includes('PRIVATE'));assert.ok(!t.html(make('erenhot'),{history:false}).includes('tracking-history'));
console.log('PASS tracking: stages, ready vs dispatched, custom warehouses, supplier precedence, time/source, missing history, Chinese, escaped names and private-field exclusion.');
