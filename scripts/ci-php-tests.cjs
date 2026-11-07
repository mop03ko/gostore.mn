'use strict';
// CI (Linux): syntax-check tracked PHP/JavaScript and run every PHP suite tests/run-all.cjs registers,
// using the php on PATH. Browser and HTTP-server suites need Chrome and the Windows tool bundle and
// still run locally through tests/run-all.cjs.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),php=process.env.PHP_BIN||'php';let failures=0;
fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
function run(cmd,args,label,quiet){const started=Date.now(),r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:8<<20});
  if(r.status!==0){failures++;console.error('FAIL '+label+'\n'+(r.stdout||'')+(r.stderr||r.error||''));return;}
  if(!quiet)console.log((r.stdout.trim().split('\n').pop()||'ok '+label).slice(0,240)+' ['+label+', '+((Date.now()-started)/1000).toFixed(1)+'s]');}
const files=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).stdout.split('\0').filter(f=>/\.(php|js|mjs|cjs)$/.test(f));
for(const f of files)run(f.endsWith('.php')?php:process.execPath,f.endsWith('.php')?['-l',f]:['--check',f],'syntax '+f,true);
console.log('Syntax checked '+files.length+' PHP/JavaScript files.');
const runAll=fs.readFileSync(path.join(__dirname,'..','tests','run-all.cjs'),'utf8');
const suites=[...runAll.matchAll(/for\(const test of \[([^\]]*)\]\)run\(php,/g)].flatMap(m=>[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]));
if(suites.length<20)throw Error('Could not read the PHP suite list from tests/run-all.cjs');
for(const s of suites)run(php,['tests/'+s+'.php'],s);
console.log(failures?'FAILED: '+failures+' check(s).':'PASS: '+suites.length+' PHP suites and syntax checks.');process.exitCode=failures?1:0;
