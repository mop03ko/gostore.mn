const {spawn,spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),php=path.join(root,'tmp/tooling/php/php.exe'),node=process.execPath;
const args=['-d','extension_dir='+path.join(root,'tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring','-d','extension=curl','-d','extension=gd'];
async function run(test){
  const data=path.join(root,'tmp/warehouse-test-'+crypto.randomBytes(8).toString('hex'));fs.mkdirSync(data,{recursive:true});
  const hash=spawnSync(php,[],{cwd:root,input:"<?php $b=json_decode(file_get_contents('tmp/admin-preview.json'),true);echo password_hash($b['password'],PASSWORD_BCRYPT);",encoding:'utf8'});if(hash.status!==0)throw Error('Test credential setup failed');
  const env={...process.env,GOSTORE_DATA_DIR:data,GOSTORE_DISABLE_QPAY:'1',GOSTORE_ADMIN_HASH:hash.stdout.trim(),GOSTORE_LOCAL_PRODUCTS_ENABLED:['api','customers'].includes(test)?'1':'0'};
  const seed=spawnSync(php,[...args,'tests/warehouse-fixtures.php'],{cwd:root,env,encoding:'utf8'});if(seed.status)throw Error(seed.stderr||seed.stdout);
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  const server=spawn(php,[...args,'-S','127.0.0.1:'+port,'scripts/router.php'],{cwd:root,env,windowsHide:true,stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',d=>logs+=d);
  try{
    const base='http://127.0.0.1:'+port;let ready=false;for(let i=0;i<30;i++){try{if((await fetch(base+'/api/index.php?action=customer-me')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Server startup failed');
    await new Promise((resolve,reject)=>{const child=spawn(node,['tests/'+test+(test.endsWith('-ui')?'.cjs':'.mjs')],{cwd:root,env:{...env,TEST_BASE:base},windowsHide:true,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(test+' failed')));});
    if(/PHP (Warning|Fatal|Parse)/.test(logs))throw Error('PHP diagnostics: '+logs.split('\n').filter(l=>/PHP (Warning|Fatal|Parse)/.test(l)).join('\n'));
  }finally{const stopped=new Promise(r=>server.once('exit',r));server.kill();await stopped;fs.writeFileSync(path.join(data,'server.log'),logs);}
}
(async()=>{for(const t of process.argv.slice(2).length?process.argv.slice(2):['warehouse-batches','logistics'])await run(t);})().catch(e=>{console.error(e.message);process.exitCode=1;});
