const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('../gostoremn/node_modules/typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('gostoremn/src/lib/eleven-sale.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Date,Set});
const {elevenSaleActive,elevenSaleProducts}=exportsObject;
for(const [date,active] of [['2026-10-31T15:59:59Z',false],['2026-10-31T16:00:00Z',true],['2026-11-11T15:59:59Z',true],['2026-11-11T16:00:00Z',false],['2026-12-01T00:00:00Z',false]])assert.equal(elevenSaleActive(Date.parse(date)),active,date);
const now=Date.parse('2026-11-02T00:00:00Z'),expires=now/1000+300;
const p={id:'tb-123456',mnt:10000,sellable:true,card_discount:{expires,current_mnt:10000,was_mnt:20000,percent:50}};
// Older cached responses may still carry coupon fields; neither they nor named promotions qualify.
const coupon={...p,id:'tb-123457',card_discount:null,offers:{expires,coupon_mnt:8000,promotions:[]}},promotion={...p,id:'tb-123460',card_discount:null,offers:{expires,promotions:[{name:'Conditional'}]}};
assert.deepEqual(elevenSaleProducts([p,p,coupon,promotion,{...p,sellable:false},{...p,id:'tb-123458',card_discount:{...p.card_discount,current_mnt:9000}}],now).map(x=>x.id),['tb-123456'],'Only real price cuts qualify');
assert.equal(elevenSaleProducts([p,coupon],expires*1000).length,0);
assert.equal(elevenSaleProducts(Array.from({length:12},(_,i)=>({...p,id:'tb-'+(123456+i)})),now).length,8);
// The admin campaign setting: extended through an Ulaanbaatar date, ended early, or auto (date rule).
const {elevenCampaign}=exportsObject,on={mode:'on',until:'2026-11-25',active:true};
assert.equal(elevenSaleActive(Date.parse('2026-11-20T04:00:00Z'),on),true,'Extended after the 11th');
assert.equal(elevenSaleActive(Date.parse('2026-11-25T15:59:59Z'),on),true,'Through the last Ulaanbaatar day');
assert.equal(elevenSaleActive(Date.parse('2026-11-25T16:00:00Z'),on),false,'Ends after the last day');
assert.equal(elevenSaleActive(Date.parse('2026-11-05T04:00:00Z'),{mode:'off',until:null,active:false}),false,'Ended early');
assert.equal(elevenSaleActive(Date.parse('2026-11-05T04:00:00Z'),{mode:'auto',until:null,active:null}),true,'Auto keeps the date rule');
assert.equal(elevenSaleActive(Date.parse('2026-11-20T04:00:00Z'),null),false,'No setting: date rule');
assert.equal(JSON.stringify(elevenCampaign({eleven:{mode:'on',until:'2026-11-25',active:true}})),JSON.stringify(on));
assert.equal(JSON.stringify(elevenCampaign({eleven:{mode:'on',until:'25 Nov',active:true}})),JSON.stringify({mode:'on',until:null,active:true}));
for(const bad of [null,{},{eleven:{mode:'later'}},'x'])assert.equal(elevenCampaign(bad),null);
console.log('PASS app sale: Ulaanbaatar date boundaries, admin extension/early end, real price reductions only (no coupons or conditional promotions), expiry, deduplication, eight-card limit.');
