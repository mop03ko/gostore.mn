const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE,data=process.env.GOSTORE_DATA_DIR;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(data);
// Uptime probe: no session cookie, no caching, database reachable, newest daily backup age in hours.
(async()=>{
 const get=async()=>{const r=await fetch(base+'/api/index.php?action=health');return {r,body:await r.json()};};
 let {r,body}=await get();assert.equal(r.status,200);assert.equal(body.ok,true);assert.equal(body.backup_age_hours,null);
 assert.equal(r.headers.get('set-cookie'),null,'Health check must not open a session');assert.match(r.headers.get('cache-control')||'',/no-store/);
 const dir=path.join(data,'backups','daily');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'gostore-20261107-000000.sqlite.gz');fs.writeFileSync(file,'x');const t=new Date(Date.now()-5*3600e3);fs.utimesSync(file,t,t);
 ({body}=await get());assert.ok(body.backup_age_hours>=4.9&&body.backup_age_hours<=5.1,'Backup age '+body.backup_age_hours);
 console.log('PASS health API: no session, no-store, database check, newest backup age.');
})().catch(e=>{console.error(e);process.exitCode=1;});
