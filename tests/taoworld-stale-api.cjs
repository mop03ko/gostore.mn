const {spawnSync}=require('child_process'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const r=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir='+path.resolve('tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring','tests/taoworld-storefront-fixture.php','--stale'],{env:process.env,encoding:'utf8'});assert.equal(r.status,0,r.stderr+r.stdout);const fixture=JSON.parse(r.stdout);
(async()=>{try{
 const url=base+'/api/index.php?action=supplier-search&q=__all__&page=1&limit=50';
 let response=await fetch(url+'&preview=1'),data=await response.json();assert.equal(response.status,200);assert.equal(data.products.length,20);assert.equal(data.partial,true);assert.equal(data.stale,true);assert.equal(data.revalidate,true);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('set-cookie'),null);
 response=await fetch(url);data=await response.json();assert.equal(response.status,200);assert.equal(data.products.length,50);assert.equal(data.partial,false);assert.equal(data.stale,true);const fetched=data.fetched;
 response=await fetch(url+'&refresh=1');assert.ok(response.status>=400,'Revalidation must attempt the disabled upstream instead of accepting stale data');await response.body.cancel();
 response=await fetch(url);data=await response.json();assert.equal(response.status,200);assert.equal(data.fetched,fetched);assert.equal(data.stale,true);assert.equal(data.products.length,50);
 for(const flag of ['preview=2','refresh=oops','preview[]=1']){response=await fetch(url+'&'+flag);assert.equal(response.status,400);await response.body.cancel();}
 response=await fetch(base+'/api/index.php?action=supplier-product&id='+fixture.id);data=await response.json();assert.equal(response.status,200);assert.equal(data.stale,false);assert.equal(data.product.id,fixture.id);
 console.log('PASS native HTTP: string flag validation, 20/50 stale display without auth/cookies, no-store, real revalidation failure, unchanged cache age and independent fresh product details.');
}finally{fs.unlinkSync(path.join('assets/uploads/search',fixture.image+'.jpg'));}})().catch(e=>{console.error(e);process.exitCode=1;});
