'use strict';
// The QR contains only the internal GB identifier. Reading it never confirms receipt.
function batchQr(id){
  if(!/^GB-[A-Z0-9-]{1,45}$/.test(id))return '';
  const qr=qrcode(0,'M');qr.addData(id,'Alphanumeric');qr.make();
  return qr.createSvgTag({cellSize:6,margin:24,scalable:true}).replace('<svg ','<svg class="batch-qr-code" role="img" aria-label="'+id+'" ' );
}
let batchCamera=null,batchScanTimer=null,batchScanSequence=0;
function stopBatchScanner(){
  ++batchScanSequence;clearTimeout(batchScanTimer);batchScanTimer=null;
  if(batchCamera)batchCamera.getTracks().forEach(track=>track.stop());batchCamera=null;
  const video=$('#qr-video');video.pause();video.srcObject=null;
}
function qrError(key){$('#qr-error').textContent=t(key);}
async function acceptBatchQr(value){
  const id=String(value||'').trim().toUpperCase();
  if(!/^GB-[A-Z0-9-]{1,45}$/.test(id)){qrError('qrInvalid');return false;}
  stopBatchScanner();$('#qr-scanner').close();
  try{await openBatch(id);}catch(e){toast(e.message);}
  return true;
}
function decodeQrSource(source,width,height,maxSide=960){
  const scale=Math.min(1,maxSide/Math.max(width,height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  return jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data||'';
}
async function startBatchCamera(){
  stopBatchScanner();const request=batchScanSequence,video=$('#qr-video');qrError('');
  if(!navigator.mediaDevices?.getUserMedia){qrError('qrCameraUnavailable');return;}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    if(request!==batchScanSequence||!$('#qr-scanner').open){stream.getTracks().forEach(track=>track.stop());return;}
    batchCamera=stream;video.srcObject=stream;await video.play();
    const scan=async()=>{
      if(request!==batchScanSequence||!$('#qr-scanner').open)return;
      try{if(video.readyState>=2&&video.videoWidth){const value=decodeQrSource(video,video.videoWidth,video.videoHeight);if(value&&await acceptBatchQr(value))return;}}
      catch{stopBatchScanner();qrError('qrReadError');return;}
      if(request===batchScanSequence)batchScanTimer=setTimeout(scan,200);
    };
    scan();
  }catch(e){if(request!==batchScanSequence)return;stopBatchScanner();qrError(e.name==='NotAllowedError'?'qrCameraDenied':'qrCameraUnavailable');}
}
$('#qr-open').addEventListener('click',()=>{
  $('#qr-file').value='';qrError('');$('#qr-scanner').showModal();startBatchCamera();
});
$('#qr-restart').addEventListener('click',startBatchCamera);
$('#qr-close').addEventListener('click',()=>$('#qr-scanner').close());
$('#qr-scanner').addEventListener('close',stopBatchScanner);
$('#qr-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;stopBatchScanner();const request=batchScanSequence;qrError('');
  let picture;
  try{
    if(file.size>20*1024*1024)throw Error('Image too large');
    picture=await createImageBitmap(file);
    if(request!==batchScanSequence||!$('#qr-scanner').open)return;
    const value=decodeQrSource(picture,picture.width,picture.height,1600);
    if(value)await acceptBatchQr(value);else qrError('qrNotFound');
  }catch{if(request===batchScanSequence)qrError('qrReadError');}
  finally{picture?.close();e.target.value='';}
});
window.addEventListener('pagehide',stopBatchScanner);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopBatchScanner();});
