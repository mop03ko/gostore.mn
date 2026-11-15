// Original, non-looping three-note notification chime. No external audio assets.
const fs=require('node:fs'),path=require('node:path');
const rate=32000,seconds=1.45,samples=Math.round(rate*seconds),wav=Buffer.alloc(44+samples*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);
wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
for(let i=0;i<samples;i++){
 const t=i/rate;let value=0;
 for(const [start,hz] of [[0,659.25],[.28,830.61],[.56,987.77]]){
  const d=t-start;if(d<0||d>.85)continue;
  const envelope=Math.min(1,d/.015)*Math.exp(-d*5)*Math.min(1,(.85-d)/.08);
  value+=envelope*(Math.sin(2*Math.PI*hz*d)+.16*Math.sin(4*Math.PI*hz*d))*.30;
 }
 wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value))*28000),44+i*2);
}
const dir=path.join(__dirname,'res/raw');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'warehouse_order.wav'),wav);
console.log('Generated 1.45s mono PCM warehouse chime ('+wav.length+' bytes).');
