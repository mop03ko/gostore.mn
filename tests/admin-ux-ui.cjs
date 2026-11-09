// Admin UX layer: dashboard tasks, order tabs/filters/paging, row-click drawer with summary and section
// links, bulk status change through the in-app confirmation, Ctrl+K search, phone tab bar, no "undefined".
const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
const auth=JSON.parse(fs.readFileSync('tmp/admin-preview.json','utf8')),errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/admin/');await page.locator('[name=email]').fill(auth.email);await page.locator('[name=password]').fill(auth.password);await page.locator('#login-form button').click();await page.locator('#app').waitFor({state:'visible'});

// Dashboard: four figures, the task list, the week chart; menu groups.
assert.equal(await page.locator('.ux-kpis .stat').count(),4);await page.waitForFunction(()=>/\d+ \/ \d+/.test(document.querySelector('#kpi-api')?.textContent||''));
assert.equal(await page.locator('.task-row').count(),4);assert.equal(await page.locator('.ux-dash .xbar').count(),7);
assert.equal(await page.locator('nav .nav-group').count(),4,'Grouped menu');assert.equal(await page.locator('.welcome').count(),0,'The greeting banner is gone');
await page.locator('.task-row[data-task-tab=new]').click();await page.waitForFunction(()=>location.hash==='#orders');
assert.equal(await page.locator('.otab.on').getAttribute('data-otab'),'new','The task opens its tab');

// Tabs, counts, paging and filters over the 56 fixture orders.
await page.locator('[data-otab=all]').click();
assert.equal(Number(await page.locator('[data-otab=all] b').innerText()),56);
assert.equal(await page.locator('.orders-table tbody tr').count(),25,'25 per page');
assert.match(await page.locator('.orders-pager').innerText(),/1–25 \/ 56/);
await page.locator('[data-opage="2"]').click();assert.match(await page.locator('.orders-pager').innerText(),/26–50 \/ 56/);
await page.locator('#date-filter').selectOption('today');assert.equal(await page.locator('.orders-table tbody tr').count(),0);
assert.equal(await page.locator('.empty [data-orders-reset]').count(),1,'Empty state offers a reset');
await page.locator('[data-orders-reset]').click();assert.equal(await page.locator('.orders-table tbody tr').count(),25);
await page.locator('#pay-filter').selectOption('unpaid');assert.equal(Number(await page.locator('[data-otab=all] b').innerText()),0,'Counts follow the filters');
await page.locator('#pay-filter').selectOption('all');
assert.ok(await page.locator('.orders-table .tag.st-paid').count()>0,'Paid orders use the paid colour');

// Row click opens the drawer: summary, actions, section links; no "undefined" for missing quantities.
await page.locator('tr[data-row-order="GS-TEST-001"] .order-customer').click();await page.locator('#editor').waitFor({state:'visible'});
assert.equal(await page.locator('#editor-title').innerText(),'GS-TEST-001');
assert.equal(await page.locator('#editor-summary .tag').first().isVisible(),true);assert.equal(await page.locator('#editor-summary [data-save-order]').count(),1);
assert.ok(await page.locator('#editor-summary [data-jump]').count()>=3,'Section links');
assert.ok(!(await page.locator('#editor-body').innerText()).includes('undefined'),'No undefined values');
const box=await page.locator('#editor').boundingBox();assert.ok(box.x+box.width>=1439&&box.x>600,'Drawer on the right');
await page.locator('#editor-summary [data-jump="#order-form"]').click();
// Smooth scrolling takes a moment; the form must come into view below the sticky summary.
await page.waitForFunction(()=>{const r=document.querySelector('#order-form').getBoundingClientRect(),h=document.querySelector('#editor .dialog-header').getBoundingClientRect();return r.top<innerHeight&&r.top>=h.bottom-2;},null,{timeout:5000});
await page.locator('#close-editor').click();

// Bulk status change through the in-app confirmation.
await page.locator('#list-search').fill('GS-TEST-01');await page.locator('[data-pick="GS-TEST-010"]').check();await page.locator('[data-pick="GS-TEST-011"]').check();
assert.match(await page.locator('.bulk-bar').innerText(),/2 захиалга сонгосон/);
await page.locator('#bulk-status').selectOption('shipping');await page.locator('[data-bulk-apply]').click();
await page.locator('#ui-confirm').waitFor({state:'visible'});assert.match(await page.locator('#ui-confirm').innerText(),/2 захиалгын төлөвийг/);
await page.locator('#ui-confirm button[value=cancel]').click();assert.equal(await page.locator('.bulk-bar').count(),1,'Cancel keeps the selection');
await page.locator('[data-bulk-apply]').click();await page.locator('#ui-confirm button[value=ok]').click();
await page.waitForFunction(()=>/2 захиалгын төлөв шинэчлэгдлээ/.test(document.querySelector('#toast').textContent));
assert.equal(await page.locator('.bulk-bar').count(),0);
await page.locator('#list-search').fill('GS-TEST-010');assert.match(await page.locator('.orders-table tbody tr').first().innerText(),/Хүргэлтэд/);await page.locator('#list-search').fill('');

// Ctrl+K: an order by number, by phone digits, and a page.
await page.keyboard.press('Control+k');await page.locator('#cmdk').waitFor({state:'visible'});
await page.locator('#cmdk-input').fill('GS-TEST-003');await page.locator('.cmdk-item.on').waitFor();assert.match(await page.locator('.cmdk-item.on').innerText(),/GS-TEST-003/);
await page.keyboard.press('Enter');await page.locator('#editor').waitFor({state:'visible'});assert.equal(await page.locator('#editor-title').innerText(),'GS-TEST-003');await page.locator('#close-editor').click();
await page.locator('[data-cmdk-open]').first().click();await page.locator('#cmdk-input').fill('99112');await page.waitForFunction(()=>document.querySelectorAll('#cmdk-results .cmdk-item').length>=8);
await page.locator('#cmdk-input').fill('Тайлан');await page.keyboard.press('Enter');await page.waitForFunction(()=>location.hash==='#reports');

// Phone: the bottom tab bar replaces the scrolling menu; no sideways scroll; full-width drawer.
await page.setViewportSize({width:390,height:844});await page.goto(base+'/admin/#orders');await page.reload();await page.locator('#app').waitFor({state:'visible'});
assert.equal(await page.locator('.tabbar').isVisible(),true);assert.equal(await page.locator('aside nav').isVisible(),false);assert.equal(await page.locator('#mobile-admin-page').isVisible(),true,'Page picker stays');
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No sideways scroll');
await page.locator('.tabbar [data-page=overview]').click();await page.waitForFunction(()=>location.hash==='#overview');assert.equal(await page.locator('.tabbar [data-page=overview]').getAttribute('aria-current'),'page');
await page.locator('.tabbar [data-page=orders]').click();await page.locator('.orders-table tbody tr').first().locator('.order-customer').click();await page.locator('#editor').waitFor({state:'visible'});
const pbox=await page.locator('#editor').boundingBox();assert.ok(pbox.width>=389,'Full-width drawer on phones: '+JSON.stringify(pbox)+' '+await page.locator('#editor').evaluate(e=>{const c=getComputedStyle(e);return [c.width,c.maxWidth,c.marginLeft,c.marginRight,innerWidth].join(',');}));
assert.deepEqual(errors,[]);console.log('admin-ux-ui ok');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
