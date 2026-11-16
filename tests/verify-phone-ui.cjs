const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage();await page.setContent('<html><body></body></html>');
 await page.evaluate(()=>{window.calls=[];window.shopApi=async(action)=>{window.calls.push(action);if(action==='phone-verification-config')return {enabled:!window.disabled,sms_otp_enabled:!window.disabled};return {challenge:'legacy',remainingSeconds:300,smsUri:'sms:144773?body=old'};};});
 await page.addScriptTag({path:'phone-verification.js'});
 assert.equal(await page.evaluate(()=>window.verifyPhone('99112233')),false,'Legacy responses rejected without opening SMS composer');
 assert.equal(await page.locator('a[href^="sms:"]').count(),0);assert.equal(await page.locator('dialog').count(),0);
 await page.evaluate(()=>{window.disabled=true;window.calls=[];});assert.equal(await page.evaluate(()=>window.verifyPhone('99112233')),false);assert.deepEqual(await page.evaluate(()=>window.calls),['phone-verification-config']);
 console.log('PASS SendSMS-only UI: unavailable service and legacy responses fail safely, no MO composer.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
