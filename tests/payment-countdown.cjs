const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('store-server.js','utf8');
const code=source.slice(source.indexOf('function watchOrderPayment'),source.indexOf("document.addEventListener('click',async e=>",source.indexOf('function watchOrderPayment')));
(async()=>{
 let now=1000000,tick,removed=0,calls=0,refreshed=0,cleared=false;
 class Clock extends Date {static now(){return now;}}
 const label={isConnected:true,textContent:''};
 const context={Date:Clock,document:{querySelector:()=>({id:'modal',open:true,querySelector:()=>label,querySelectorAll:()=>[{remove(){removed++;}}]})},setInterval:fn=>(tick=fn,1),clearInterval:()=>{cleared=true;},savedRequests:()=>[],shopApi:async(action,b)=>{assert.equal(action,'order-get');assert.equal(b.id,'GS-TEST');calls++;return {order:{paid:false,status:'cancelled'}};},viewServerOrder:()=>{refreshed++;}};
 vm.createContext(context);vm.runInContext(code,context);
 context.watchOrderPayment({id:'GS-TEST',payment_due:new Date(now+900000).toISOString()});
 assert.match(label.textContent,/15:00/);assert.equal(calls,0);
 now+=899000;tick();assert.match(label.textContent,/0:01/);assert.equal(calls,0);
 now+=1000;tick();await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(refreshed,1);assert.ok(removed);
 tick();await new Promise(r=>setImmediate(r));assert.equal(calls,1,'Repeated timer ticks must not hammer QPay');
 label.isConnected=false;tick();assert.ok(cleared,'Detached dialogs must stop ticking');
 const cargo=fs.readFileSync('cargo.js','utf8');
 const settled=vm.runInNewContext(cargo.match(/const cargoPaymentSettled=(.*);/)[1]);
 assert.equal(settled({paid:false,status:'cancelled'},'initial'),false,'Timeout must never show payment success or emit a purchase event');
 assert.equal(settled({paid:true,status:'confirmed'},'initial'),true);
 assert.equal(settled({cargo:{billing:{finalized:true,due:100}}},'freight'),false);
 assert.equal(settled({cargo:{billing:{finalized:true,due:0}}},'freight'),true);
 console.log('PASS payment countdown: stored deadline, boundary, hide QR, server reconciliation, single request, cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
