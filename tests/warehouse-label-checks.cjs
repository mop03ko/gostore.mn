const assert=require('node:assert/strict');
function dimensions(pdf){const text=pdf.toString('latin1');assert.equal((text.match(/\/Type\s*\/Page\b/g)||[]).length,1,'Exactly one label page');const box=text.match(/\/MediaBox\s*\[([\d.\s]+)\]/);assert.ok(box,'PDF page dimensions');return box[1].trim().split(/\s+/).map(Number).slice(2);}
module.exports=async(page,batch)=>{
 const before=await page.evaluate(()=>JSON.stringify(currentBatch));
 await page.locator('[data-print-batch]').click();
 assert.equal(await page.locator('#print-area table').count(),0,'Manifest must not spill onto labels');
 await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
 const label=page.locator('.shipping-label');
 const size=await label.boundingBox();assert.ok(Math.abs(size.width-100*96/25.4)<1);assert.ok(Math.abs(size.height-150*96/25.4)<1);
 assert.ok(await label.evaluate(el=>[...el.children].every(c=>c.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom-10)),'All label contents stay inside safe area');
 assert.equal(await page.locator('#editor').isVisible(),false,'Dialog excluded from printing');
 const pdf=await page.pdf({path:'tmp/xp420b-label.pdf',preferCSSPageSize:true,displayHeaderFooter:false,printBackground:true});
 const [w,h]=dimensions(pdf);assert.ok(Math.abs(w-100*72/25.4)<1);assert.ok(Math.abs(h-150*72/25.4)<1);
 await label.screenshot({path:'tmp/xp420b-label.png'});
 const decoded=await page.evaluate(async()=>{const svg=document.querySelector('.shipping-label svg'),img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.outerHTML);await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=Math.round(parseFloat(svg.style.width)*203/25.4);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return decodeQrSource(canvas,canvas.width,canvas.height);});assert.equal(decoded,batch,'QR decodes at actual 203 dpi label size');
 await page.emulateMedia({media:'screen'});
 await page.locator('[data-print-batch]').click();assert.equal(await page.evaluate(()=>JSON.stringify(currentBatch)),before,'Printing and reprinting cannot change shipment state');
 await page.locator('[data-print-manifest]').click();await page.emulateMedia({media:'print'});const manifest=await page.pdf({preferCSSPageSize:true});const [mw,mh]=dimensions(manifest);assert.ok(Math.abs(mw-210*72/25.4)<1);assert.ok(Math.abs(mh-297*72/25.4)<1,'Manifest uses A4 after label printing');
 await page.emulateMedia({media:'screen'});await page.evaluate(()=>{activeLogisticsOrder=currentBatch.orders[0];printOrder();});assert.equal(await page.locator('#print-area').getAttribute('data-format'),null,'Order labels do not inherit batch label size');
 console.log('PASS XP-420B: one 100x150 mm page, 203 dpi QR decode, safe inset, reprint without status change, A4/order print isolation.');
};
