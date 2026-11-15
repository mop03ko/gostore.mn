// Run with node tests/run-logistics.cjs admin-review-products (isolated database).
const {chromium}=require('../tmp/tooling/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(process.env.GOSTORE_DATA_DIR.replaceAll('\\','/'),/\/tmp\/warehouse-test-/);
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const customer=await browser.newContext(),cp=await customer.newPage();await require('./customer-ui-helper.cjs')(cp,base);
  execFileSync('tmp/tooling/php/php.exe',['-d','extension_dir='+path.resolve('tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring'],{input:`<?php
   require 'server/bootstrap.php';require 'server/product-reviews.php';reviews_schema();
   $customer=db()->query('SELECT id FROM customers LIMIT 1')->fetchColumn();
   $s=db()->prepare('INSERT INTO product_reviews VALUES (?,?,?,?,?,?,?,?,?)');
   for($i=0;$i<23;$i++)$s->execute(['review-'.$i,'tb-'.(100000000+$i),$i===0?'100% Cotton <img src=x onerror=alert(1)>':str_repeat('Long product title ',20).$i,$customer,($i%5)+1,'Review '.$i,$i===0?'hidden':'visible','2026-11-15T10:00:00+00:00','2026-11-15T10:00:00+00:00']);
   db()->prepare('INSERT INTO product_review_reports VALUES (?,?,?,?)')->execute(['review-0',$customer,'Reported reason','2026-11-15']);
  `});
  const admin=await browser.newContext({viewport:{width:1440,height:1000}}),page=await admin.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const endpoint='/api/index.php?action=reviews-admin&';
  const get=async(q)=>{const r=await admin.request.get(base+endpoint+q);assert.equal(r.status(),200,await r.text());return r.json();};
  const session=await(await admin.request.get(base+'/api/index.php?action=session')).json();
  const login=await admin.request.post(base+'/api/index.php?action=login',{headers:{'X-CSRF-Token':session.csrf},data:JSON.parse(fs.readFileSync('tmp/admin-preview.json'))});assert.equal(login.status(),200);
  let data=await get('view=products');assert.equal(data.total,23);assert.equal(data.products.length,20);assert.equal(data.more,true);assert.equal(data.products[0].hidden,1);assert.equal(data.products[0].reported,1);
  const second=await get('view=products&page=2');assert.equal(second.products.length,3);assert.equal(second.more,false);assert.equal(new Set([...data.products,...second.products].map(p=>p.product)).size,23);
  assert.equal((await get('view=products&page=9999')).page,2);
  assert.equal((await get('view=products&q=%25')).total,1,'SQL wildcard must be literal');
  assert.equal((await get('view=products&q=%27%20OR%201%3D1--')).total,0);
  assert.equal((await get('view=products&status=hidden')).total,1);
  assert.equal((await get('view=products&status=visible')).total,22);
  assert.equal((await get('view=products&status=reported')).total,1);
  assert.equal((await get('product=tb-100000000')).reviews[0].status,'hidden');
  assert.equal((await admin.request.get(base+endpoint+'status=bad')).status(),400);
  assert.equal((await admin.request.get(base+endpoint+'product=bad%2Fid')).status(),400);
  assert.equal((await customer.request.get(base+endpoint+'view=products')).status(),401);
  const guest=await browser.newContext();assert.equal((await guest.request.get(base+endpoint+'view=products')).status(),401);
  // A second customer's review is grouped into the same product, with correct average.
  const cp2=await customer.newPage();await require('./customer-ui-helper.cjs')(cp2,base);
  execFileSync('tmp/tooling/php/php.exe',['-d','extension_dir='+path.resolve('tmp/tooling/php/ext'),'-d','extension=pdo_sqlite','-d','extension=mbstring'],{input:`<?php require 'server/bootstrap.php';$customer=db()->query('SELECT id FROM customers ORDER BY rowid DESC LIMIT 1')->fetchColumn();db()->prepare('INSERT INTO product_reviews VALUES (?,?,?,?,?,?,?,?,?)')->execute(['second-review','tb-100000000','100% Cotton <img src=x onerror=alert(1)>',$customer,5,'Second customer','visible','2026-11-15T11:00:00+00:00','2026-11-15T11:00:00+00:00']);`});
  data=await get('view=products&q=100000000');assert.equal(data.total,1);assert.equal(data.products[0].total,2);assert.equal(data.products[0].average,3);assert.equal(data.counts.reviews,2);
  await page.goto(base+'/admin/#reviews');await page.locator('[data-review-product]').first().waitFor();assert.equal(await page.locator('.admin-review-product img').count(),0,'Title must be escaped');
  assert.equal(await page.locator('.admin-review-product').first().evaluate(el=>getComputedStyle(el).display),'grid','Review stylesheet must load');
  const filter=page.locator('#admin-review-filter');await filter.locator('input').fill('100%');await filter.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-review-product]').length===1);
  await page.locator('[data-review-product]').click();await page.locator('[data-review-moderate]').first().waitFor();assert.equal(await page.locator('[data-review-moderate]').count(),2);
  await page.locator('#admin-review-filter select').selectOption('hidden');await page.locator('#admin-review-filter [type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-review-moderate]').length===1);
  await page.locator('[data-review-moderate]').click();await page.locator('.admin-review-results .empty').waitFor();
  await page.locator('[data-reviews-clear]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-review-moderate]').length===2);
  await page.locator('[data-reviews-view="products"]').click();await page.locator('[data-review-product]').first().waitFor();
  fs.mkdirSync('output/admin-review-products',{recursive:true});await page.screenshot({path:'output/admin-review-products/desktop.png'});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile page must fit viewport');await page.screenshot({path:'output/admin-review-products/mobile.png'});
  assert.deepEqual(errors,[]);console.log('PASS admin review products: grouping/averages, literal search, filters, pagination, guest/customer isolation, escaped titles, drill-down, moderation with active filter, mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
