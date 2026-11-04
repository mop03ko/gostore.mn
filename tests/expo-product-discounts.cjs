const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('../gostoremn/node_modules/typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('gostoremn/src/lib/product-offers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Date,Number,Math});
const {productSavings,percentLabel}=exportsObject,now=1000,offers={expires:1100,coupon_mnt:8000,coupon_base_mnt:10000,coupon_percent:20},p={sellable:true,mnt:10000,offers,card_discount:{expires:1100,current_mnt:10000,was_mnt:20000,percent:50}};
let r=productSavings(p,10000,undefined,now);assert.equal(r.sale.percent,50);assert.equal(r.coupon.percent,20);assert.equal(p.mnt,10000);
assert.equal(productSavings(p,9000,undefined,now).sale,null);assert.equal(productSavings(p,9000,undefined,now).coupon,null);
for(const item of [{...p,sellable:false},{...p,price_status:'unavailable'}]){r=productSavings(item,10000,undefined,now);assert.equal(r.sale,null);assert.equal(r.coupon,null);}
for(const amount of [undefined,null,0,-1,Infinity,NaN]){r=productSavings(p,amount,undefined,now);assert.equal(r.sale,null);assert.equal(r.coupon,null);}
for(const changes of [{coupon_base_mnt:undefined},{coupon_base_mnt:9000},{coupon_mnt:10000},{coupon_mnt:0},{coupon_mnt:-1},{coupon_mnt:NaN},{expires:1000}])assert.equal(productSavings({...p,offers:{...offers,...changes}},10000,undefined,now).coupon,null);
assert.equal(productSavings({...p,offers:{...offers,coupon_percent:undefined}},10000,undefined,now).coupon.percent,20);
assert.equal(productSavings(p,10000,null,now).sale,null,'Explicit SKU with no sale must not inherit product sale');
assert.equal(productSavings(p,10000,undefined,1100).sale,null);assert.equal(productSavings(p,10000,undefined,1100).coupon,null);
assert.equal(percentLabel(productSavings({...p,offers:{...offers,coupon_mnt:9999,coupon_percent:0}},10000,undefined,now).coupon.percent),'<1%');
console.log('PASS native discounts: same-price sale/coupon validation, expiry, SKU overrides, unavailable stock, invalid amounts, source pairing and conditional percentages.');
