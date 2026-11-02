const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const title='Baizhi Loose-Leaf Notebook, High-Quality and Comfortable to Hold, Detachable Square Notebook — '+('LongSupplierProductName'.repeat(8));let first;
 await page.route('**/api/index.php?action=dashboard',async route=>{const r=await route.fetch(),data=await r.json();data.orders=data.orders.slice(0,8).map((o,i)=>({...o,title:i===0?title:'Cabinet Storage Box for Organizing Miscellaneous Items and Snacks, Transparent Storage Basket, Desktop Collection',customer:i===0?'Бат-Эрдэнэ Мөнхцэцэг':'Test Customer '+i,phone:'99112233',amount:i===0?98456880:54978,paid:i%2===0,status:i===0?'erenhot_ready':i%2===0?'confirmed':'new'}));first=data.orders[0].id;await route.fulfill({response:r,json:data});});
 await page.goto(base+'/admin/');await page.locator('[name=email]').fill(auth.email);await page.locator('[name=password]').fill(auth.password);await page.locator('#login-form button').click();await page.locator('#app').waitFor({state:'visible'});await page.locator('nav [data-page=orders]').click();
 assert.equal(await page.locator('.orders-table tbody tr').count(),8);
 for(const width of [1815,1440,1280,1100,1050,900,768,760,390,320]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page fits '+width);
  assert.ok(await page.locator('.orders-table-wrap').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No hidden order columns at '+width);
  const row=page.locator('.orders-table tbody tr').first();
  assert.ok(await row.evaluate(e=>[...e.querySelectorAll('td,button,.tag')].every(c=>{const r=c.getBoundingClientRect(),p=e.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1;})),'Cells and action fit row '+width);
  assert.ok(await row.locator('.order-title').evaluate(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)*2+1),'Long title stays compact '+width);
  if([1440,390].includes(width))await page.screenshot({path:'tmp/admin-orders-'+width+'.png',fullPage:false});
 }
 await page.locator('#list-search').fill(first);assert.equal(await page.locator('.orders-table tbody tr').count(),1);await page.locator('[data-order="'+first+'"]').click();await page.locator('#editor').waitFor({state:'visible'});assert.ok((await page.locator('#editor-body').innerText()).includes(title),'Full title remains available in details');await page.locator('#close-editor').click();
 await page.locator('#list-search').fill('');await page.locator('#status-filter').selectOption('erenhot_ready');assert.equal(await page.locator('.orders-table tbody tr').count(),1);await page.locator('#status-filter').selectOption('all');await page.locator('#list-search').fill('no-matching-order');assert.equal(await page.locator('.empty').count(),1);await page.locator('#list-search').fill('');
 await page.locator('[data-refresh]').click();await page.locator('.orders-table tbody tr').first().waitFor();assert.equal(await page.locator('.orders-table tbody tr').count(),8);assert.deepEqual(errors,[]);
 console.log('PASS admin orders: long/unbroken names, all columns/actions fit 320–1815 px, compact titles, full details, search, status filter, empty state and refresh.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
