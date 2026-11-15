const fs=require('node:fs'),path=require('node:path');
// Reuse the approved GOStore vector mark; keep all symbol geometry editable.
const root=process.env.GOSTORE_ROOT||path.resolve(__dirname,'..');
const output=path.resolve(process.argv[2]||path.join(root,'output/app-icons'));fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(path.join(root,'assets/favicon.svg'),'utf8');
const paths=[...source.matchAll(/<path[^>]*d="([^"]+)"[^>]*\/>/g)].map(m=>m[1]);
if(paths.length!==2)throw Error('Expected the two approved Go logo paths');
const go=(x,y,w,h,fill)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="12 28 88 55" fill="${fill}">${paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`;
const icons={
 admin:{bg:'#262261',name:'GOStore Admin',detail:'Дэлгүүрийн удирдлага',content:`<path d="M512 176c88 58 168 83 256 102v225c0 153-101 267-256 345-155-78-256-192-256-345V278c88-19 168-44 256-102Z" fill="none" stroke="#fff" stroke-width="36" stroke-linejoin="round"/>${go(306,343,412,258,'#fff')}<path d="m445 675 47 47 92-100" fill="none" stroke="#F5681C" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>`},
 warehouse:{bg:'#087F83',name:'GOStore Warehouse',detail:'УБ · Эрээн агуулах',content:`<path d="m206 380 306-192 306 192M246 364v434h532V364" fill="none" stroke="#fff" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/><rect x="304" y="437" width="416" height="361" rx="26" fill="#fff"/><path d="M488 437h48v90l-24-13-24 13Z" fill="#F5681C"/>${go(348,551,328,205,'#087F83')}`}
};
const svg=(icon,mode='full')=>`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mode==='full'?`<rect width="1024" height="1024" fill="${icon.bg}"/>`:''}<g${mode==='full'?'':' transform="translate(512 512) scale(.75) translate(-512 -512)"'}>${mode==='mono'?icon.content.replaceAll(/#[0-9a-f]{6}\b/gi,'#ffffff'):icon.content}</g></svg>`;
for(const [id,icon] of Object.entries(icons))fs.writeFileSync(path.join(output,id+'.svg'),svg(icon));
fs.writeFileSync(path.join(output,'warehouse-adaptive.svg'),svg(icons.warehouse,'adaptive'));
fs.writeFileSync(path.join(output,'warehouse-monochrome.svg'),svg(icons.warehouse,'mono'));
// Preserve the consumer icon exactly; include it only as a comparison in previews.
fs.copyFileSync(path.join(root,'gostoremn/assets/images/gostore-icon.png'),path.join(output,'shop.png'));
const previewIcons={shop:{name:'GOStore',detail:'Хэрэглэгчийн апп · хэвээр'},...icons};
const preview=`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f2f2f7;font-family:'Segoe UI',sans-serif;color:#262261;padding:54px;width:1200px}h1{font-size:34px;margin:0 0 8px;letter-spacing:-1px}p{color:#72728b;margin:0 0 34px;font-size:17px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}.card{background:#fff;border:1px solid #e5e5ee;border-radius:28px;padding:30px 24px;text-align:center}.large{width:250px;height:250px;border-radius:56px;display:block;margin:0 auto 22px;box-shadow:0 12px 24px #26226116}h2{font-size:23px;margin:0 0 7px}.caption{font-size:16px;color:#72728b}.small{display:flex;align-items:center;justify-content:center;gap:24px;margin-top:29px}.small img{border-radius:22%;width:60px;height:60px}.small img:last-child{width:40px;height:40px}.dark{background:#171723;color:#fff;border-radius:24px;margin-top:32px;padding:25px;display:flex;align-items:center;justify-content:space-around}.dark img{width:62px;height:62px;border-radius:14px}.dark span{display:flex;align-items:center;gap:17px;font-size:17px}</style></head><body><h1>GOStore · App icons</h1><p>Нэг брэнд. Гурван ялгарах дүрс.</p><div class="grid">${Object.entries(previewIcons).map(([id,v])=>`<section class="card"><img class="large" src="${id}.png"><h2>${v.name}</h2><div class="caption">${v.detail}</div><div class="small"><img src="${id}.png"><img src="${id}.png"></div></section>`).join('')}</div><div class="dark">${Object.entries(previewIcons).map(([id,v])=>`<span><img src="${id}.png">${v.name}</span>`).join('')}</div></body></html>`;
fs.writeFileSync(path.join(output,'preview.html'),preview);
(async()=>{let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(root,'tmp/tooling/node_modules/playwright')));}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{const page=await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1});
for(const id of ['admin','warehouse','warehouse-adaptive','warehouse-monochrome']){await page.setContent(`<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${fs.readFileSync(path.join(output,id+'.svg'),'utf8')}`);await page.screenshot({path:path.join(output,id+'.png'),omitBackground:id.includes('-')});}
await page.setViewportSize({width:1200,height:820});await page.goto(require('url').pathToFileURL(path.join(output,'preview.html')).href);await page.screenshot({path:path.join(output,'preview.png'),fullPage:true});
console.log('Generated editable SVGs, 1024px PNGs, adaptive layers and preview: '+output);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
