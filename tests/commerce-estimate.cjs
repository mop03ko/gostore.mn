// Customer estimates must match checkout rounding without replacing server validation.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const ctx={window:{},document:{addEventListener(){}},money:n=>String(n)};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../commerce-ui.js'),'utf8'),ctx);
const ui=ctx.window.commerceUI,s={cny_rate:550,service_percent:5,service_fee_mnt:1000,domestic_default_cny:10};
const items=[{id:'tb-111111',vendor_id:'a',cny:10,qty:2},{id:'tb-222222',vendor_id:'a',cny:12.5,qty:1}];
let q=ui.estimate(items,s);assert.equal(q.goods,17875);assert.equal(q.service,1894);assert.equal(q.domestic,5500);assert.equal(q.total,25269);
q=ui.estimate([...items,{id:'tb-333333',vendor_id:'b',cny:1,qty:1}],s);assert.equal(q.domestic,11000);
q=ui.estimate(items,{...s,domestic_default_cny:0});assert.equal(q.domesticLater,true);assert.equal(q.total,19769);
q=ui.estimate(items.map(({vendor_id,...i})=>i),s);assert.equal(q.domestic,null);assert.equal(q.total,null,'Old carts must not guess seller count');
assert.equal(ui.estimate(items,{...s,cny_rate:0}),null);assert.equal(ui.estimate([{cny:0,qty:1}],s),null);
q=ui.estimate([{id:'tb-444444',vendor_id:'a',cny:.01,qty:3}],{...s,service_percent:0,service_fee_mnt:0,domestic_default_cny:0});assert.equal(q.total,17,'Round the full goods amount like the server');
assert.ok(ui.paymentText({...s,domestic_default_cny:0}).includes('Дараа: Хятад доторх хүргэлт'));
assert.ok(!ui.paymentText(s).includes('Дараа: Хятад доторх хүргэлт'));
q=ui.estimate(items,{...s,catalog_provider:'taoworld'});assert.equal(q.domestic,null);assert.equal(q.total,null);assert.equal(q.domesticLater,false,'Native shipping must be quoted before payment');
assert.ok(!ui.paymentText({...s,catalog_provider:'taoworld',domestic_default_cny:0}).includes('Дараа: Хятад доторх хүргэлт'));
assert.ok(!ui.unit.includes('ширхэг'),'SKU quantity must not pretend to be individual pieces');
console.log('PASS commerce estimates: seller grouping, service fee, later domestic fee, old carts, rounding, payment copy and SKU units.');
