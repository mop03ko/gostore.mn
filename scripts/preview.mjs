import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
 try{
  const route=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const name=route==='/'?'index.html':route.slice(1);
  const file=path.resolve(root,name);
  if(!['index.html','styles.css','script.js','store-server.js','account.js','supplier.js','assets/fonts/fonts.css','assets/fonts/arimo-variable.ttf'].includes(name)&&!(name.startsWith('assets/')&&/\.(jpg|png|webp|svg)$/.test(name)&&file.startsWith(path.join(root,'assets')+path.sep))){res.writeHead(404);res.end('Not found');return;}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(3000,'127.0.0.1',()=>console.log('GOStore preview: http://127.0.0.1:3000'));
