const assert=require('node:assert/strict');
module.exports=async function checkQrFallback(page,qrImage,batch){
  await page.locator('#close-editor').click();
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Test denial','NotAllowedError');};});
  await page.locator('#qr-open').click();
  await page.waitForFunction(()=>document.querySelector('#qr-error').textContent===t('qrCameraDenied'));
  await page.locator('#qr-file').setInputFiles('assets/chair.jpg');
  await page.waitForFunction(()=>document.querySelector('#qr-error').textContent===t('qrNotFound'));
  const invalidImage=await page.evaluate(async()=>{
    const qr=qrcode(0,'M');qr.addData('https://example.invalid/not-a-batch');qr.make();
    const img=new Image();img.src=qr.createDataURL(8,32);await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    canvas.getContext('2d').drawImage(img,0,0);return canvas.toDataURL('image/png').split(',')[1];
  });
  const before=page.url();
  await page.locator('#qr-file').setInputFiles({name:'other-qr.png',mimeType:'image/png',buffer:Buffer.from(invalidImage,'base64')});
  await page.waitForFunction(()=>document.querySelector('#qr-error').textContent===t('qrInvalid'));
  assert.equal(page.url(),before,'Scanned URLs are never opened');
  assert.equal(await page.locator('#editor').isVisible(),false);
  await page.locator('#qr-file').setInputFiles({name:'batch-qr.png',mimeType:'image/png',buffer:Buffer.from(qrImage.png,'base64')});
  await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(await page.locator('#editor-title').innerText(),batch);
  assert.equal(await page.locator('[data-operation=batch-dispatch]').count(),1,'Reading a draft QR does not dispatch it');
  await page.locator('#close-editor').click();
  // Permission can resolve after the user has already closed the scanner.
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.finishCameraPermission=resolve;});});
  await page.locator('#qr-open').click();await page.waitForFunction(()=>typeof window.finishCameraPermission==='function');
  await page.locator('#qr-close').click();await page.waitForFunction(()=>!document.querySelector('#qr-scanner').open);
  await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=40;canvas.getContext('2d').fillRect(0,0,40,40);window.lateCamera=canvas.captureStream(1);window.finishCameraPermission(window.lateCamera);});
  await page.waitForFunction(()=>window.lateCamera.getTracks().every(t=>t.readyState==='ended'));
  assert.equal(await page.locator('#editor').isVisible(),false,'Late camera grant does not reopen a closed scanner');
  await page.locator('#scan-code').fill(batch);await page.locator('#scan-form button').click();
  await page.locator('#editor').waitFor({state:'visible'});
};
