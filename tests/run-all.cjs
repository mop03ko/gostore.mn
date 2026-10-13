// Run all checks locally, with disposable data and provider network access disabled.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),php=path.join(root,'tmp/tooling/php/php.exe'),node=process.execPath;
const phpArgs=['-d','extension_dir='+path.join(root,'tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring','-d','extension=curl','-d','extension=gd'];
let failures=0;
function run(command,args,label){const r=spawnSync(command,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});if(r.status!==0){failures++;console.error('FAIL '+label+'\n'+(r.stdout||'')+(r.stderr||r.error||''));}else if(r.stdout)process.stdout.write(r.stdout);}
const listing=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});if(listing.status!==0)throw Error('Cannot list project files');
const files=[...new Set([...listing.stdout.split('\0'),...fs.readdirSync(__dirname).map(f=>'tests/'+f)])].filter(f=>/\.(php|js|mjs|cjs)$/.test(f));
for(const file of files){const result=spawnSync(file.endsWith('.php')?php:node,file.endsWith('.php')?['-l',file]:['--check',file],{cwd:root,encoding:'utf8',windowsHide:true});if(result.status!==0){failures++;console.error('FAIL syntax '+file+'\n'+result.stdout+result.stderr);}}
console.log('Syntax checked '+files.length+' PHP/JavaScript files.');
for(const test of ['qpay','qpay-flow','freight-payment','shipping','ot-operator','configure-admin'])run(php,[...phpArgs,'tests/'+test+'.php'],test);
for(const test of ['api','customers','supplier','warehouse','warehouse-batches','logistics','admin-management','ot-operator','audit','order-concurrency','product-page-ui','admin-management-ui','ot-operator-ui','logistics-ui'])run(node,['tests/run-logistics.cjs',test],test);
console.log(failures?'FAILED: '+failures+' check(s).':'PASS: all 20 suites and source syntax checks.');process.exitCode=failures?1:0;
