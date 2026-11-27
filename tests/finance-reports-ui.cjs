'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('../tmp/tooling/node_modules/playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({reducedMotion:"reduce",viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<html lang="mn"><body><main id="content" style="padding:20px;max-width:1300px;margin:auto"></main><dialog id="editor"><div class="dialog-header"><h2 id="editor-title"></h2></div><div id="editor-body"></div></dialog></body></html>');
   await page.addStyleTag({path:path.join(root,'admin/admin.css')});await page.addStyleTag({path:path.join(root,'admin/finance-reports.css')});
   await page.addScriptTag({content:`const data={admin:{role:'owner'}};const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const money=n=>Number(n).toLocaleString('en-US')+' ₮';function modal(t,h){$('#editor-title').textContent=t;$('#editor-body').innerHTML=h;if(!$('#editor').open)$('#editor').showModal();}function toast(t){window.lastToast=t;}function render(){window.rendered=true;}async function api(action,body){if(body){window.saved=body;return {ok:true};}return action.startsWith('admin-finance-batch')?window.sampleBatch:window.sampleOrder;}`});
   await page.addScriptTag({path:path.join(root,'admin/finance-reports.js')});
   await page.evaluate(()=>{
    window.sampleOrder={id:'GS-A',day:'2026-11-02',status:'confirmed',part:false,initial:100000,balance:20000,extra_cargo:0,gross:120000,refund:0,net:120000,cargo:20000,supplier_cny:120,quoted_cost:60000,actual_cost:null,fx:null,transport_cost:null,other_cost:null,profit:null,missing:['Юань авсан бодит ханш','Бодит тээврийн зардал'],entry:{version:0,actual_cny_rate:null,supplier_refund_cny:0,transport_cost_mnt:null,other_cost_mnt:null,extra_cargo_mnt:0,payment_date:'',note:'',complete:false}};
    window.sampleReport={finance:{...sampleOrder,missing:{cargo:0,supplier_cny:0,actual_cost:1,fx:1,transport_cost:1,other_cost:1,profit:1},complete_orders:0,row_count:1,paid_orders:1,shipment_parts:0,rows:[sampleOrder]}};$('#content').innerHTML=FinanceReports.render(sampleReport);
   });
   assert.equal(await page.locator('.finance-card').count(),9);
   assert.equal(await page.locator('.finance-card.pending strong').textContent(),'—');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile must not overflow beyond the contained table');
   await page.screenshot({path:path.join(root,'tmp/finance-report-'+width+'.png'),fullPage:true});
   await page.locator('[data-finance-edit="GS-A"]').click();
   assert.equal(await page.locator('[name="actual_cny_rate"]').inputValue(),'');
   await page.locator('[name="actual_cny_rate"]').fill('480');await page.locator('[name="transport_cost_mnt"]').fill('10000');await page.locator('[name="other_cost_mnt"]').fill('0');await page.locator('[name="extra_cargo_mnt"]').fill('5000');await page.locator('[name="payment_date"]').fill('2026-11-05');await page.locator('[name="note"]').fill('Receipt 123');await page.locator('[name="complete"]').check();await page.locator('#finance-form button').click();
   await page.waitForFunction(()=>window.saved&&window.rendered);
   const saved=await page.evaluate(()=>window.saved);assert.equal(saved.actual_cny_rate,480);assert.equal(saved.extra_cargo_mnt,5000);assert.equal(saved.other_cost_mnt,0);assert.equal(saved.version,0);assert.equal(saved.complete,true);
   await page.evaluate(()=>{window.sampleBatch={id:'GB-TEST',status:'dispatched',batch_version:3,members:[{id:'GS-A',weight_kg:1,volume_m3:null,manual_cost:null},{id:'GS-B',weight_kg:2,volume_m3:null,manual_cost:null}],entry:{version:0,amount_mnt:null,paid_date:'',note:'',allocations:{}}};});
   await page.locator('[data-finance-batch=""]').click();await page.locator('#finance-batch-find [name=id]').fill('GB-TEST');await page.locator('#finance-batch-find button').click();await page.locator('#finance-batch-form').waitFor({timeout:5000}).catch(async e=>{throw Error(e.message+' | '+await page.evaluate(()=>document.body.innerText.slice(-1500))+' | '+errors.join(','));});
   await page.locator('#finance-batch-form [name=amount_mnt]').fill('100001');await page.locator('[data-finance-distribute="volume_m3"]').click();assert.match(await page.locator('#finance-batch-form p.error').textContent(),/хэмжилт бүрэн биш/);
   await page.locator('[data-finance-distribute="weight_kg"]').click();assert.equal(await page.locator('[data-finance-allocation="GS-A"]').inputValue(),'33334');assert.equal(await page.locator('[data-finance-allocation="GS-B"]').inputValue(),'66667');
   await page.locator('#finance-batch-form [name=paid_date]').fill('2026-11-28');await page.locator('#finance-batch-form [name=note]').fill('Carrier 001');await page.locator('#finance-batch-form [name=confirmed]').check();
   await page.locator('#finance-batch-form [name=note]').fill('Carrier 002');assert.equal(await page.locator('#finance-batch-form [name=confirmed]').isChecked(),false);await page.locator('#finance-batch-form [name=confirmed]').check();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Batch editor mobile overflow');await page.screenshot({path:path.join(root,'tmp/finance-batch-'+width+'.png'),fullPage:true});
   await page.locator('#finance-batch-form button[type=submit]').click();await page.waitForFunction(()=>window.saved?.id==='GB-TEST');const batchSave=await page.evaluate(()=>window.saved);assert.equal(batchSave.amount_mnt,100001);assert.deepEqual(batchSave.allocations,{'GS-A':33334,'GS-B':66667});assert.equal(batchSave.batch_version,3);
   await page.evaluate(()=>{data.admin.role='viewer';$('#content').innerHTML=FinanceReports.render(sampleReport);});assert.equal(await page.locator('[data-finance-edit]').count(),0);assert.equal(await page.locator('[data-finance-batch]').count(),0);
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS finance UI: responsive cards, missing costs, numeric save, explicit zero, owner controls and no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
