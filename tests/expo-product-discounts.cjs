const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('../gostoremn/node_modules/typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('gostoremn/src/lib/product-offers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Date,Number,Math});
// Older cached responses may still carry coupon fields; they must never produce savings.
const {productSavings,percentLabel}=exportsObject,now=1000,offers={expires:1100,promotions:[],coupon_mnt:8000,coupon_base_mnt:10000,coupon_percent:20},p={sellable:true,mnt:10000,offers,card_discount:{expires:1100,current_mnt:10000,was_mnt:20000,percent:50}};
let r=productSavings(p,10000,undefined,now);assert.equal(r.sale.percent,50);assert.equal('coupon' in r,false,'No coupon savings');assert.equal(p.mnt,10000);
assert.equal(productSavings({...p,card_discount:null},10000,undefined,now).sale,null,'Coupon-only product has no savings');
assert.equal(productSavings(p,9000,undefined,now).sale,null);
for(const item of [{...p,sellable:false},{...p,price_status:'unavailable'}])assert.equal(productSavings(item,10000,undefined,now).sale,null);
for(const amount of [undefined,null,0,-1,Infinity,NaN])assert.equal(productSavings(p,amount,undefined,now).sale,null);
assert.equal(productSavings(p,10000,null,now).sale,null,'Explicit SKU with no sale must not inherit product sale');
assert.equal(productSavings(p,10000,undefined,1100).sale,null,'Expired sale');
assert.equal(productSavings(p,10000,undefined,now).offers,offers,'Fresh offers are passed through for named promotions');
assert.equal(percentLabel(productSavings({...p,card_discount:{...p.card_discount,was_mnt:10001,percent:0}},10000,undefined,now).sale.percent),'<1%');
console.log('PASS native discounts: real same-price sales only, coupon fields ignored, expiry, SKU overrides, unavailable stock, invalid amounts and sub-1% labels.');
