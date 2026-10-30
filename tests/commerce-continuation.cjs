// Exercise guest buy-now -> login -> quote without a browser, network or order creation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const events={},modalEvents={},storage=new Map(),calls=[];let view={title:'',html:''};
const modal={open:false,addEventListener:(n,fn)=>modalEvents[n]=fn,querySelector:()=>null};
const intro={textContent:''},button={disabled:false},error={textContent:''};
const document={documentElement:{classList:{toggle(){},contains:()=>false}},querySelector:s=>s==='#modal'?modal:s.includes('modal-intro')?intro:null,querySelectorAll:()=>[],addEventListener:(n,fn)=>(events[n]??=[]).push(fn)};
const storeServer={customer:null,ready:true,shipping:{cny_rate:550}};
const ctx={document,storeServer,crypto:crypto.webcrypto,console,Event:class{},setTimeout,clearTimeout,icon:()=>'',esc:v=>String(v??''),money:n=>String(n),toast(){},updateCounts(){},requestFields:()=>'',pickupHtml:()=>'',qpayEnabled:false,FormData:class{constructor(f){return Object.entries(f.values)}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},openModal:(title,html)=>{view={title,html};modal.open=true;},closeModal:()=>{modal.open=false;modalEvents.close?.();},$:()=>null};
ctx.window=ctx;ctx.addEventListener=()=>{};ctx.dispatchEvent=()=>{};ctx.catalogReady=Promise.resolve();
ctx.shopApi=async(action,payload)=>{calls.push({action,payload});if(action==='customer-me')return {customer:null};if(action==='customer-login')return {customer:{name:'Test',email:'test@example.com',address:''}};if(action==='checkout-quote')return {quote:{total:11000,vendors:1,domestic_later:true,payment_window_hours:24,breakdown:{goods_mnt:11000,domestic_mnt:0,service_mnt:0}}};throw Error('Unexpected action '+action);};
vm.createContext(ctx);for(const file of ['commerce-ui.js','account.js','checkout.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);
(async()=>{
 const p={id:'tb-123456789',name:'Test pack',min_qty:1,step:1},v={id:'blue',label:'Blue pack of 5',cny:10,stock:20};
 await ctx.taobaoCart.buyNow(p,v,2);assert.ok(view.html.includes('customer-login-form'));assert.equal(calls.filter(c=>c.action==='checkout-quote').length,0);
 const form={id:'customer-login-form',values:{email:'test@example.com',password:'synthetic'},querySelector:s=>s.includes('submit')?button:error};
 for(const listener of events.submit)await listener({target:form,preventDefault(){}});
 assert.ok(view.html.includes('taobao-checkout-form'),'Login automatically resumes checkout');
 const quote=calls.find(c=>c.action==='checkout-quote');assert.equal(JSON.stringify(quote.payload.items),JSON.stringify([{id:p.id,sku:'blue',qty:2}]),'Exact SKU quantity is preserved; pack text never multiplies it');
 assert.equal(calls.some(c=>c.action==='order-create'),false,'Resuming does not place an order');
 ctx.customerAccount.user=null;await ctx.taobaoCart.buyNow(p,v,3);ctx.closeModal();
 const count=calls.filter(c=>c.action==='checkout-quote').length;
 // Closing the sign-in dialog clears its continuation.
 ctx.customerAccount.open=async()=>{};
 ctx.profileForm=()=>{};
 for(const listener of events.submit)await listener({target:form,preventDefault(){}});
 assert.equal(calls.filter(c=>c.action==='checkout-quote').length,count,'Dismissed buy-now must not resume on a later login');
 console.log('PASS commerce continuation: guest gating, automatic login return, exact SKU/quantity, no implicit order, dismiss cancels continuation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
