const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process'),{chromium}=require('../tmp/tooling/node_modules/playwright');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'tmp','taoworld-web-'+Date.now()),php=path.join(root,'tmp/tooling/php/php.exe');
fs.mkdirSync(path.join(fixture,'server'),{recursive:true});fs.mkdirSync(path.join(fixture,'api/taoworld'),{recursive:true});fs.mkdirSync(path.join(fixture,'scripts'),{recursive:true});
for(const file of fs.readdirSync(path.join(root,'server')))if(!file.includes('.local.')&&/\.(php|json)$/.test(file))fs.copyFileSync(path.join(root,'server',file),path.join(fixture,'server',file));
for(const file of ['api/index.php','api/taoworld/connect.php','api/taoworld/callback.php','scripts/router.php'])fs.copyFileSync(path.join(root,file),path.join(fixture,file));
fs.writeFileSync(path.join(fixture,'server/taoworld.local.php'),"<?php return ['app_key'=>'123456','app_secret'=>'PRIVATE-SENTINEL-SECRET','callback_url'=>'https://gostore.mn/api/taoworld/callback.php'];");
fs.writeFileSync(path.join(fixture,'server/taoworld-http.php'),"<?php function taoworld_http(string $path,array $params):array { return ['access_token'=>'PRIVATE-SENTINEL-ACCESS','refresh_token'=>'PRIVATE-SENTINEL-REFRESH','expires_in'=>3600,'refresh_expires_in'=>7200,'account_id'=>'123']; }");
const hash=spawnSync(php,[],{input:"<?php echo password_hash('fixture-login-password',PASSWORD_BCRYPT);",encoding:'utf8'});assert.equal(hash.status,0);
const env={...process.env,GOSTORE_DATA_DIR:path.join(fixture,'data'),GOSTORE_ADMIN_HASH:hash.stdout.trim(),GOSTORE_DISABLE_SUPPLIER_NETWORK:'1',GOSTORE_DISABLE_QPAY:'1'};
const args=['-d','extension_dir='+path.join(root,'tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring','-d','extension=curl'];
(async()=>{
 const net=require('node:net'),socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const base='http://127.0.0.1:'+port,server=spawn(php,[...args,'-S','127.0.0.1:'+port,'scripts/router.php'],{cwd:fixture,env,windowsHide:true,stdio:['ignore','ignore','pipe']});let logs='';server.stderr.on('data',d=>logs+=d);
 let browser;
 try{
  for(let i=0;i<40;i++){try{await fetch(base+'/api/taoworld/connect.php');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let r=await page.goto(base+'/api/taoworld/connect.php');assert.equal(r.status(),401);assert.doesNotMatch(await page.content(),/PRIVATE-SENTINEL/);
  const session=await(await ctx.request.get(base+'/api/index.php?action=session')).json();
  r=await ctx.request.post(base+'/api/index.php?action=login',{headers:{'X-CSRF-Token':session.csrf},data:{email:'admin@gostore.mn',password:'fixture-login-password'}});assert.equal(r.status(),200);
  await page.goto(base+'/api/taoworld/connect.php');await page.getByRole('button',{name:'TaoWorld дансаа холбох',exact:true}).waitFor();
  r=await ctx.request.post(base+'/api/taoworld/connect.php',{form:{action:'authorize',csrf:'wrong'},maxRedirects:0});assert.equal(r.status(),403);
  const csrf=await page.locator('[name=csrf]').first().inputValue();
  r=await ctx.request.post(base+'/api/taoworld/connect.php',{form:{action:'authorize',csrf},maxRedirects:0});assert.equal(r.status(),303);const auth=new URL(r.headers().location);assert.equal(auth.origin,'https://api.taobao.global');assert.equal(auth.searchParams.get('redirect_uri'),'https://gostore.mn/api/taoworld/callback.php');assert.ok(!auth.href.includes('PRIVATE-SENTINEL'));
  const state=auth.searchParams.get('state');const other=await browser.newContext();await other.request.get(base+'/api/taoworld/callback.php?state='+state+'&code=synthetic');assert.ok(!fs.existsSync(path.join(fixture,'data/taoworld/auth.json')),'Different browser cannot authorize');await other.close();
  r=await ctx.request.get(base+'/api/taoworld/callback.php?state='+state+'&code=synthetic',{maxRedirects:0});assert.equal(r.status(),303);assert.equal(r.headers().location,'/api/taoworld/connect.php');assert.equal(r.headers()['referrer-policy'],'no-referrer');
  await page.goto(base+'/api/taoworld/connect.php');assert.match(await page.locator('main').innerText(),/холбогдсон/);assert.doesNotMatch(await page.content(),/PRIVATE-SENTINEL/);assert.match((await page.request.get(base+'/api/taoworld/connect.php')).headers()['cache-control'],/no-store/);
  const saved=fs.readFileSync(path.join(fixture,'data/taoworld/auth.json'),'utf8');await ctx.request.get(base+'/api/taoworld/callback.php?state='+state+'&code=synthetic');assert.equal(fs.readFileSync(path.join(fixture,'data/taoworld/auth.json'),'utf8'),saved,'Replay does not change tokens');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(fixture,'connected.png')});assert.deepEqual(errors,[]);assert.ok(!/PHP (Warning|Fatal|Parse)/.test(logs));
  console.log('PASS: admin/CSRF gates, provider redirect, cross-session/replay denial, clean callback redirect, private token persistence, redacted mobile UI.');console.log('Screenshot: '+path.join(fixture,'connected.png'));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
