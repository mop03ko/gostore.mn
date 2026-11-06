const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<html><body><form><input name="phone" value="99112233"><button type="button" data-verify-phone>Утас баталгаажуулах</button></form></body></html>');
  await page.addStyleTag({path:'phone-verification.css'});
  await page.evaluate(()=>{window.mode='PENDING';window.calls=[];window.toast=()=>{};window.shopApi=async(action,payload)=>{window.calls.push({action,payload});if(action==='phone-verification-config')return {enabled:true};if(action==='phone-verification-start')return {challenge:'c',phone:'99112233',text:'GOStore TEST',smsUri:'sms:144773?body=GOStore%20TEST',displayInstruction:'<img src=x onerror=alert(1)>',remainingSeconds:window.ttl||300};if(window.mode==='ERROR')throw Error('Network');return {sessionStatus:window.mode};};});
  await page.addScriptTag({path:'phone-verification.js'});
  const start=()=>page.evaluate(()=>{window.result='waiting';window.verifyPhone('99112233').then(r=>window.result=r);});
  await start();await page.locator('[data-sms]:not([hidden])').waitFor();
  assert.equal(await page.locator('[data-instruction] img').count(),0,'Instruction is text, not HTML');
  assert.equal(await page.locator('[data-sms-link]').getAttribute('href'),'sms:144773?body=GOStore%20TEST');
  assert.equal(await page.evaluate(()=>window.verifyPhone('88112233')),false,'No concurrent UI flow');
  await page.waitForTimeout(3200);assert.equal(await page.evaluate(()=>window.result),'waiting','Pending cannot succeed');
  await page.evaluate(()=>window.mode='VERIFIED');await page.waitForFunction(()=>window.result===true);assert.equal(await page.locator('dialog').count(),0);
  await start();await page.locator('[data-cancel]').click();assert.equal(await page.evaluate(()=>window.result),false,'Cancellation');
  await page.evaluate(()=>{window.mode='ERROR';window.ttl=4;});await start();await page.waitForFunction(()=>window.result===false,{},{timeout:7000});
  await page.evaluate(()=>{window.mode='EXPIRED';window.ttl=300;});await start();await page.waitForFunction(()=>window.result===false,{},{timeout:6000});
  await page.evaluate(()=>{window.mode='VERIFIED';window.ttl=300;});await page.locator('[data-verify-phone]').click();await page.waitForFunction(()=>document.querySelector('[data-verify-phone]').textContent==='Утас баталгаажлаа');
  await page.locator('input').fill('88112233');assert.equal(await page.locator('[data-verify-phone]').textContent(),'Утас баталгаажуулах');
  console.log('PASS verifyPhone UI: instruction escaping, SMS link, pending/verified, expiry, errors, cancellation, reentry, changed phone.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});