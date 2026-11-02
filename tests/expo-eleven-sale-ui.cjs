const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.EXPO_TEST_URL||'http://localhost:8095';assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.setDefaultTimeout(45000);
 await page.clock.setFixedTime(new Date('2026-11-02T05:00:00Z'));
 const expires=Date.parse('2026-11-02T05:05:00Z')/1000;
 const p={id:'tb-123456',name:'Хямдарсан бараа',image:'',mnt:10000,cny:20,sellable:true,min_qty:1,step:1,variants:[],offers:{expires,promotions:[]},card_discount:{expires,current_mnt:10000,was_mnt:20000,percent:50}};
 let mode='offers',dealCalls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://gostore.mn/api/mobile.php**',r=>{const u=new URL(r.request().url()),a=u.searchParams.get('action');let data={csrf:'fixture'};
  if(a==='supplier-deals'){dealCalls++;if(mode==='error')return r.fulfill({status:503,json:{error:'unavailable'}});data={products:mode==='empty'?[]:[p,p,{...p,id:'tb-123457',name:'Купонтой бараа',card_discount:null,offers:{expires,coupon_mnt:8000,promotions:[]}},{...p,id:'tb-123458',name:'Хугацаа дууссан',card_discount:{...p.card_discount,expires:1},offers:{expires:1,promotions:[]}},{...p,id:'tb-123459',sellable:false}],more:false,cache_ttl:60};}
  else if(a==='catalog')data={...data,customer:null,shipping:{cny_rate:500}};
  else if(a==='customer-me')data.customer=null;
  else if(a==='supplier-search'||a==='supplier-recommend')data={products:[],more:false};
  else if(a==='supplier-product')data={product:p,shipping:{cny_rate:500}};
  else throw Error('Unexpected API '+a);
  return r.fulfill({json:data});
 });
 await page.goto(base+'/');const shelf=page.getByTestId('eleven-sale');await shelf.getByRole('button',{name:p.name,exact:true}).waitFor();
 assert.equal(await shelf.getByTestId('eleven-sale-item').count(),2);assert.match(await shelf.innerText(),/−50%/);assert.match(await shelf.innerText(),/Купонтой ≈.*нөхцөлтэй/);assert.equal(dealCalls,1);
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});const boxes=await shelf.getByTestId('eleven-sale-item').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));assert.ok(Math.abs(boxes[0].top-boxes[1].top)<2,'Two columns');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+width);}
 fs.mkdirSync('output/eleven-sale',{recursive:true});await page.screenshot({path:'output/eleven-sale/expo-light.png'});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'output/eleven-sale/expo-dark.png'});
 await page.getByRole('tab',{name:'Хямдрал',exact:true}).click();await page.getByText('Хямдрал, купон',{exact:true}).waitFor();assert.equal(dealCalls,1,'Existing deals tab reuses shared cache');
 await shelf.getByRole('button',{name:p.name,exact:true}).click();await page.waitForURL('**/product/tb-123456');
 mode='error';await page.goto(base+'/');await shelf.getByRole('button',{name:'11.11 хямдралыг дахин ачаалах'}).waitFor();mode='offers';await shelf.getByRole('button',{name:'11.11 хямдралыг дахин ачаалах'}).click();await shelf.getByRole('button',{name:p.name,exact:true}).waitFor();
 mode='empty';await page.reload();await shelf.getByText('Одоогоор хүчинтэй хямдралын мэдээлэл олдсонгүй.',{exact:true}).waitFor();
 await page.clock.setFixedTime(new Date('2026-11-11T16:00:00Z'));const callsBefore=dealCalls;await page.reload();await page.getByRole('tab',{name:'Танд зориулсан',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[data-testid=eleven-sale]'));assert.equal(dealCalls,callsBefore,'No seasonal calls after November 11');
 assert.deepEqual(errors,[]);console.log('PASS Expo sale UI: homepage, two columns, valid offers, navigation, shared cache, retry, empty state, season cutoff.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
