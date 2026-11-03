'use strict';
// Labels contain internal GB codes. Camera scanning also reads GS and incoming carrier barcodes.
function batchQr(id,label=false){
  if(!/^GB-[A-Z0-9-]{1,45}$/.test(id))return '';
  const qr=qrcode(0,'M');qr.addData(id,'Alphanumeric');qr.make();
  // Whole printer dots per module at XP-420B's 203 dpi; retain a four-module quiet zone.
  const dots=Math.floor(60*203/25.4/(qr.getModuleCount()+8));
  const mm=((qr.getModuleCount()+8)*dots*25.4/203).toFixed(4);
  const size=label?'style="width:'+mm+'mm;height:'+mm+'mm" ':'';
  return qr.createSvgTag({cellSize:6,margin:24,scalable:true}).replace('<svg ','<svg '+size+'class="batch-qr-code" role="img" aria-label="'+id+'" ' );
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
  if(!/^(?:G[BS]-[A-Z0-9-]{1,45}|[A-Z0-9-]{6,40})$/.test(id)||(!/^G[BS]-/.test(id)&&cityRole()!=='erenhot')){qrError('qrInvalid');return false;}
  stopBatchScanner();$('#qr-scanner').close();
  $('#scan-code').value=id;try{await openWarehouseCode(id);}catch(e){toast(e.message);}
  return true;
}
function decodeQrSource(source,width,height,maxSide=960){
  const scale=Math.min(1,maxSide/Math.max(width,height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  return jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data||'';
}
let warehouseBarcodeReader=null;
function decodeWarehouseBarcode(source,width,height,maxSide=1280){
  if(!window.ZXing)return decodeQrSource(source,width,height,maxSide);
  if(!warehouseBarcodeReader){
    const hints=new Map();hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.CODE_128,ZXing.BarcodeFormat.CODE_39,ZXing.BarcodeFormat.ITF,ZXing.BarcodeFormat.CODABAR,ZXing.BarcodeFormat.EAN_13,ZXing.BarcodeFormat.EAN_8,ZXing.BarcodeFormat.UPC_A,ZXing.BarcodeFormat.QR_CODE]);hints.set(ZXing.DecodeHintType.TRY_HARDER,true);
    warehouseBarcodeReader=new ZXing.MultiFormatReader();warehouseBarcodeReader.setHints(hints);
  }
  const scale=Math.min(1,maxSide/Math.max(width,height)),canvas=document.createElement('canvas');
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  // Try both orientations, including a label photographed sideways.
  for(const rotated of [false,true]){
    canvas.width=rotated?h:w;canvas.height=rotated?w:h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(rotated){ctx.translate(h,0);ctx.rotate(Math.PI/2);}ctx.drawImage(source,0,0,w,h);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,gray=new Uint8ClampedArray(canvas.width*canvas.height);
    for(let i=0,j=0;i<pixels.length;i+=4,j++)gray[j]=(pixels[i]+2*pixels[i+1]+pixels[i+2])/4;
    try{return warehouseBarcodeReader.decodeWithState(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(gray,canvas.width,canvas.height)))).getText();}
    catch(e){if(!(e instanceof ZXing.NotFoundException||e instanceof ZXing.ChecksumException||e instanceof ZXing.FormatException))throw e;}
    finally{warehouseBarcodeReader.reset();}
  }
  return '';
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
      try{if(video.readyState>=2&&video.videoWidth){const value=decodeWarehouseBarcode(video,video.videoWidth,video.videoHeight);if(value&&await acceptBatchQr(value))return;}}
      catch{stopBatchScanner();qrError('qrReadError');return;}
      if(request===batchScanSequence)batchScanTimer=setTimeout(scan,300);
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
    const value=decodeWarehouseBarcode(picture,picture.width,picture.height,2000);
    if(value)await acceptBatchQr(value);else qrError('qrNotFound');
  }catch{if(request===batchScanSequence)qrError('qrReadError');}
  finally{picture?.close();e.target.value='';}
});
window.addEventListener('pagehide',stopBatchScanner);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopBatchScanner();});
