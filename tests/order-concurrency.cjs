const {spawn}=require('node:child_process'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const {seedSupplier}=require('./supplier-fixture.cjs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const php=path.resolve('tmp/tooling/php/php.exe'),args=['-d','extension_dir='+path.resolve('tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring','-d','extension=curl'];
async function client(url){const r=await fetch(url+'/api/index.php?action=catalog'),s=await r.json(),cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');return b=>fetch(url+'/api/index.php?action=order-create',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':s.csrf},body:JSON.stringify(b)});}
(async()=>{
 const data=process.env.GOSTORE_DATA_DIR;seedSupplier(data,0);
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const other='http://127.0.0.1:'+port,server=spawn(php,[...args,'-S','127.0.0.1:'+port,'scripts/router.php'],{env:process.env,windowsHide:true,stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',d=>logs+=d);
 let holder;try{
  let ready=false;for(let i=0;i<30;i++){try{if((await fetch(other+'/api/index.php?action=customer-me')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  const [first,second]=await Promise.all([client(base),client(other)]);
  const worker=path.join(data,'hold-supplier-lock.php');fs.writeFileSync(worker,"<?php $f=fopen(getenv('GOSTORE_DATA_DIR').'/supplier-cache/request.lock','c');flock($f,LOCK_EX);echo 'ready';fflush(STDOUT);fgets(STDIN);flock($f,LOCK_UN);fclose($f);");
  holder=spawn(php,[worker],{env:process.env,windowsHide:true,stdio:['pipe','pipe','pipe']});await new Promise((resolve,reject)=>{holder.stdout.once('data',resolve);holder.once('error',reject);holder.once('exit',code=>{if(code)reject(Error('Lock helper failed'));});});
  const body={type:'supplier',token:crypto.randomBytes(32).toString('hex'),product_id:'abb-123456789',sku:'blue',qty:2,title:'Race',customer:'Test',family_name:'Test',phone:'99112233'};
  // Both sessions enter supplier validation before either can insert the order.
  let finished=0;const pending=[first(body),second(body)].map(p=>p.then(r=>{finished++;return r;}));await new Promise(r=>setTimeout(r,1000));assert.equal(finished,0,'Both requests wait for provider validation');
  seedSupplier(data);holder.stdin.end('\n');const responses=await Promise.all(pending),orders=await Promise.all(responses.map(r=>r.json()));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);assert.equal(orders[0].order.id,orders[1].order.id,'Concurrent requests return one order');assert.ok(!/PHP (Warning|Fatal|Parse)/.test(logs),logs);
  console.log('PASS: simultaneous requests from different sessions return one order, with 201/200 responses.');
 }finally{if(holder&&!holder.killed)holder.kill();const stopped=new Promise(r=>server.once('exit',r));server.kill();await stopped;}
})().catch(e=>{console.error(e);process.exitCode=1;});
