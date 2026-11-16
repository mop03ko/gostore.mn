const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<html><body></body></html>');await page.addStyleTag({path:'phone-verification.css'});
  await page.evaluate(()=>{window.calls=[];window.toast=()=>{};window.shopApi=async(action,payload)=>{
   window.calls.push({action,payload});
   if(action==='phone-verification-config')return {enabled:true,sms_otp_enabled:true};
   if(action==='phone-verification-start')return {delivery:'otp',challenge:'c',phone:'99112233',displayInstruction:'Enter code',remainingSeconds:window.ttl||300,deliveryUncertain:true};
   if(payload.code!=='123456')throw Error('Код буруу байна.');return {sessionStatus:'VERIFIED'};
  };});await page.addScriptTag({path:'phone-verification.js'});
  const start=()=>page.evaluate(()=>{window.result='waiting';window.verifyPhone('99112233','reset').then(r=>window.result=r);});
  await start();await page.locator('input[name=code]').waitFor();assert.equal(await page.locator('[data-sms]').isVisible(),false);
  assert.equal(await page.locator('input').getAttribute('autocomplete'),'one-time-code');
  await page.waitForTimeout(3200);assert.equal(await page.evaluate(()=>window.calls.length),2,'No polling/resending OTP');
  assert.deepEqual(await page.evaluate(()=>window.calls[1].payload),{phone:'99112233',purpose:'reset',delivery:'otp'});
  await page.locator('input').fill('000000');await page.locator('button[type=submit]').click();await page.getByRole('status').filter({hasText:'Код буруу'}).waitFor();
  assert.equal(await page.evaluate(()=>window.result),'waiting','Wrong code does not verify');
  await page.locator('input').fill('123456');await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.result.phone==='99112233');
  assert.equal(await page.locator('dialog').count(),0);
  await start();await page.locator('[data-cancel]').click();assert.equal(await page.evaluate(()=>window.result),false);
  await page.evaluate(()=>window.ttl=1);await start();await page.waitForFunction(()=>window.result===false);
  console.log('PASS outbound OTP UI: code field, no SMS composer/polling/resend, wrong/correct codes, cancellation and expiry.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
