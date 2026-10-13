const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const s=await(await context.request.get(base+'/api/index.php?action=session')).json();
assert.ok((await context.request.post(base+'/api/index.php?action=login',{headers:{'X-CSRF-Token':s.csrf},data:JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'))})).ok());
let state={configured:false,verified:false,purchasing_enabled:false},failCheck=false;
await page.route('**/api/index.php?action=*',async route=>{
 const action=new URL(route.request().url()).searchParams.get('action');
 if(action==='dashboard'){const response=await route.fetch(),data=await response.json();data.ot_operator=state;return route.fulfill({json:data});}
 if(!action.startsWith('ot-operator-'))return route.continue();
 if(action==='ot-operator-connect'){const b=route.request().postDataJSON();assert.equal(b.password,' ui test password ');state={...state,configured:true,login:b.login};}
 if(action==='ot-operator-check'){if(failCheck){state.verified=false;return route.fulfill({status:422,json:{error:'OT session expired'}});}state={...state,verified:true,business_logic:true,autopurchase:true,buyer_count:1,checked_at:new Date().toISOString()};}
 if(action==='ot-operator-authorize')return route.fulfill({json:{url:'https://login.1688.com/test'}});
 if(action==='ot-operator-disconnect')state={configured:false,verified:false};
 return route.fulfill({json:{ot_operator:state}});
});
await page.goto(base+'/admin/');await page.locator('#app').waitFor({state:'visible'});await page.locator('nav [data-page=integrations]').click();
let f=page.locator('#ot-operator-form');await f.locator('[name=login]').fill('test-operator');await f.locator('[name=password]').fill(' ui test password ');await f.locator('button').click();
await page.locator('[data-ot-action=check]').waitFor();assert.equal(await page.locator('#ot-operator-form [name=password]').inputValue(),'');
await page.locator('[data-ot-action=check]').click();await page.getByText('Холболт шалгагдсан',{exact:true}).waitFor();
await page.locator('[data-ot-action=authorize]').click();assert.equal(await page.locator('#ot-operator-result a').getAttribute('href'),'https://login.1688.com/test');
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.screenshot({path:'tmp/ot-operator-mobile.png',fullPage:true});
failCheck=true;await page.locator('[data-ot-action=check]').click();await page.getByText('OT session expired',{exact:true}).waitFor();assert.equal(await page.getByText('Холболт шалгагдсан',{exact:true}).count(),0);
await page.locator('[data-ot-action=disconnect]').click();await page.getByText('Оператор нэвтрээгүй',{exact:true}).waitFor();assert.equal(await page.locator('[data-ot-action=check]').count(),0);
assert.deepEqual(errors,[]);console.log('PASS: operator form, password clearing, verified status, buyer authorization link, failure state, disconnect, mobile overflow and JS errors. OT responses mocked.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
