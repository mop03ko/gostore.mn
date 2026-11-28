const {chromium}=require('../tmp/tooling/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const base=process.env.TEST_BASE;
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const seed=spawnSync('tmp/tooling/php/php.exe',['-d','extension_dir=tmp/tooling/php/ext','-d','extension=pdo_sqlite','-d','extension=mbstring','tests/admin-workspace-fixture.php'],{encoding:'utf8',windowsHide:true});
assert.equal(seed.status,0,seed.stdout+seed.stderr);
const credential=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8'));
const apiRoot=base+'/api/index.php?action=';
function connection(request){
  let csrf='';
  return async(action,body,status=200)=>{
    const response=await request.fetch(apiRoot+action,{method:body?'POST':'GET',headers:body?{'X-CSRF-Token':csrf}:{},data:body});
    const raw=await response.text();
    assert.match(response.headers()['content-type']||'',/application\/json/,action+' '+raw.slice(0,650));
    const json=JSON.parse(raw);if(json.csrf)csrf=json.csrf;
    assert.equal(response.status(),status,action+' '+JSON.stringify(json).slice(0,350));
    return json;
  };
}
async function run(){
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const ctx=await browser.newContext();
    const call=connection(ctx.request);
    await call('admin-workspace',undefined,401);
    await call('session');await call('login',credential);
    const historic=await call('admin-workspace&q=GS-WORKSPACE-OLD');
    assert.equal(historic.rows[0].id,'GS-WORKSPACE-OLD');
    const orders=await call('admin-workspace&page=2');
    assert.equal(orders.rows.length,25);assert.ok(orders.total>1000);
    const search=await call('admin-workspace&view=orders&from=2025-01-01&to=2025-01-01');
    assert.equal(search.total,1);
    const due=await call('admin-workspace&view=tasks&filter=balance');
    assert.ok(due.rows.some(order=>order.id==='GS-WORKSPACE-DUE'));
    const reviewer={email:'workspace-view@example.test',name:'Workspace viewer',role:'viewer',active:true,password:'Viewer-access-demo-2026!'};
    await call('admin-user-save',reviewer);
    const other=await browser.newContext(),limited=connection(other.request);
    await limited('session');await limited('login',{email:reviewer.email,password:reviewer.password});
    await limited('admin-workspace',undefined,403);
    await limited('admin-workspace-assign',{id:'GS-WORKSPACE-DUE',task:'balance',assignee:'owner'},403);
    await other.close();
    await call('admin-workspace-assign',{id:'GS-WORKSPACE-DUE',task:'balance',assignee:'owner'});
    assert.equal((await call('admin-workspace&view=tasks&q=GS-WORKSPACE-DUE')).rows[0].assignee,'owner');
    const freight='GS-WORKSPACE-DUE';
    const page=await ctx.newPage();
    await page.setViewportSize({width:390,height:844});
    page.setDefaultTimeout(25000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/admin/#overview');
    try{await page.locator('.tabbar [data-order-home]').click();}
    catch(error){throw Error(`${error.message}\nBoot: ${await page.locator('#admin-boot-error').textContent()}\nBrowser errors: ${errors.join(', ')}`,{cause:error});}
    await page.waitForURL('**/#work');
    const work=page.locator('#admin-workspace');
    const nav=work.getByRole('navigation',{name:'Захиалгын ажлын хэсгийн цэс'});
    try{await nav.getByRole('button',{name:'Захиалгууд',exact:true}).waitFor();}
    catch(error){throw Error(`${error.message}\nBrowser errors: ${errors.join(', ')}`,{cause:error});}
    assert.equal(await page.locator('#admin-sidebar-nav [data-order-home]').count(),1);
    await page.locator('.admin-view-switch').getByRole('button',{name:'Нарийвчилсан жагсаалт →'}).click();
    await page.waitForURL('**/#orders');
    await page.goBack();
    await page.waitForURL('**/#work');
    await page.locator('.tabbar [data-cmdk-open]').click();
    await page.locator('#cmdk-input').fill('GS-WORKSPACE-OLD');
    await page.getByRole('option',{name:/GS-WORKSPACE-OLD/}).click();
    await page.locator('#editor').waitFor({state:'visible'});
    assert.equal(await page.locator('#editor-title').textContent(),'GS-WORKSPACE-OLD');
    await page.locator('#close-editor').click();
    await work.getByRole('textbox',{name:'Захиалга хайх'}).fill('GS-WORKSPACE-OLD');
    await work.getByRole('button',{name:'GS-WORKSPACE-OLD',exact:true}).click();
    const drawer=page.getByRole('dialog',{name:'GS-WORKSPACE-OLD'});
    await drawer.getByText('Архивын захиалга').waitFor();
    await drawer.locator('.ant-drawer-close').click();
    await nav.getByRole('button',{name:'Төлбөр тулгах',exact:true}).click();
    await work.getByRole('textbox',{name:'Захиалгын GS код'}).fill(freight);
    await work.getByRole('button',{name:'Захиалга нээх',exact:true}).click();
    await work.getByLabel('Гүйлгээний лавлагаа').fill('STMT-TEST-4500');
    const saved=page.waitForResponse(r=>r.url().includes('action=admin-order-freight-receipt'));
    await work.getByRole('button',{name:/Гадуур төлсөн.*бүртгэх/}).click();
    assert.equal((await saved).status(),201);
    assert.equal((await call('admin-workspace&id='+freight)).billing.due,0);
    await call('admin-order-freight-receipt',{id:'GS-WORKSPACE-DUE2',amount:4500,reference:'stmt-test-4500'},409);
    await call('admin-workspace-qpay',{id:freight},409);
    const id='GS-WORKSPACE-SPLIT';
    const first=await call('admin-workspace&id='+id);
    const request={id,numbers:['SF100000002'],reason:'Ирсэн илгээмжийг салгах',checked:true,expected_version:first.version,expected_status:first.order.status,token:randomBytes(32).toString('hex')};
    await call('admin-workspace-split',request,409);
    await call('admin-workspace-arrive',{id,number:'SF100000002'});
    const updated=await call('admin-workspace&id='+id);
    const part=await call('admin-workspace-split',{...request,expected_version:updated.version},201);
    assert.equal(part.shipments.length,2);assert.ok(part.new_part);
    const linked=await call('admin-workspace&id='+part.new_part);
    assert.equal(linked.parent_id,id);assert.equal(linked.order.amount,0);
    const batchRequest={id:'GS-WORKSPACE-BATCH',token:randomBytes(32).toString('hex')};
    const created=await call('admin-workspace-batch',batchRequest,201);
    assert.equal((await call('admin-workspace-batch',batchRequest)).batch.id,created.batch.id);
    assert.equal((await call('admin-workspace&id='+batchRequest.id)).batch_id,created.batch.id);
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:900});
      await nav.getByRole('button',{name:'Захиалгууд',exact:true}).click();
      await work.getByRole('button',{name:'GS-WORKSPACE-OLD',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS workspace: archive search and pagination, role gates, persisted assignment, freight duplicate guard, parcel arrival/split, draft batch retry, browser and viewport.');
  }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
