const {chromium}=require('../tmp/tooling/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),register=require('./customer-ui-helper.cjs');
const base=process.env.TEST_BASE;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
// Every storefront screen, including the QPay invoice, must fit 320–1440px without content
// leaving the viewport, a modal, or its own box.
const WIDTHS=[320,360,390,768,1024,1440];
const BANKS=[['qpaywallet','qPay хэтэвч'],['khanbank','Хаан банк'],['statebankmongolia','Төрийн банк 3.0'],['xacbank','Хас банк'],['tdbbank','TDB online'],['socialpay-payment','Голомт банк SocialPay'],['most','MOST money'],['nibank','Үндэсний хөрөнгө оруулалтын банк'],['ckbank','Чингис Хаан банк'],['capitronbank','Капитрон банк'],['bogdbank','Богд банк'],['transbank','Тээвэр хөгжлийн банк'],['mbank','M bank'],['ard','Ard App'],['toki','Toki App'],['arig','Ариг банк'],['monpay','Monpay'],['hipay','Hipay']].map(([s,d])=>({name:d,description:d,logo:'https://qpay.mn/q/logo/'+s+'.png',link:s+'://q?qPay_QRcode=0002010102121531279404962794049600022310027138152045734530349654031005802MN5904TEST6011Ulaanbaatar6304ABCD'}));
const QR=fs.readFileSync('assets/logo.png').toString('base64');
function audit(){
  const W=document.documentElement.clientWidth,H=innerHeight,found=[];
  const name=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.classList.length?'.'+[...el.classList].slice(0,2).join('.'):'')+(el.children.length?'':' "'+(el.textContent||'').trim().slice(0,30)+'"');
  if(document.documentElement.scrollWidth>W+1)found.push('page scrolls sideways: '+document.documentElement.scrollWidth+'px > '+W+'px');
  const modal=document.querySelector('#modal[open]'),box=modal?.getBoundingClientRect();
  if(modal&&(box.right>W+1||box.left<-1))found.push('modal wider than viewport: '+Math.round(box.width)+'px');
  for(const el of document.querySelectorAll('body *')){
    if(el.closest('svg,.icon-library,[hidden]')&&el.tagName!=='svg')continue;
    const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')continue;
    const r=el.getBoundingClientRect();if(r.width<1||r.height<1)continue;
    // Find the nearest ancestor that clips horizontally; content outside it is not visible.
    // Visible span is the intersection with every clipping ancestor (e.g. a thumbnail button inside a scroll row).
    let clip=null,visibleRight=r.right,visibleLeft=r.left;
    for(let p=el.parentElement;p&&p!==document.documentElement;p=p.parentElement){if(/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)){const pr=p.getBoundingClientRect();clip??=p;visibleRight=Math.min(visibleRight,pr.right);visibleLeft=Math.max(visibleLeft,pr.left);}}
    const c=clip?.getBoundingClientRect();
    if(visibleRight>W+1||visibleLeft<-1)found.push('outside viewport: '+name(el)+' ['+Math.round(r.left)+'..'+Math.round(r.right)+']');
    if(modal&&modal.contains(el)&&el!==modal&&(visibleRight>box.right+1||visibleLeft<box.left-1))found.push('outside modal: '+name(el));
    const decorative=!!el.closest('[aria-hidden="true"]');
    // Clipped content: past a hidden/clip edge, or left of any clip edge (scrolling cannot reach it).
    if(clip&&!decorative&&el.tagName!=='IMG'){
      if(r.left<c.left-1&&clip.scrollLeft===0)found.push('cut off on the left (unreachable): '+name(el));
      else if(/(hidden|clip)/.test(getComputedStyle(clip).overflowX)&&r.right>c.right+1)found.push('cut off by '+name(clip)+': '+name(el));
    }
  }
  // Text that leaves its nearest block box (spills over neighbours) or is clipped without an ellipsis.
  // Ranges measure glyphs only, so pseudo-element decorations such as step connectors are ignored.
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(!node.textContent.trim())continue;
    let box=node.parentElement,skip=false;
    for(let p=node.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||/^(absolute|fixed)$/.test(s.position)&&p.matches('.sr-only,.count,[class*=badge]')||p.matches('[aria-hidden="true"],svg,script,style,template,option')){skip=true;break;}}
    while(box&&getComputedStyle(box).display==='inline')box=box.parentElement;
    if(skip||!box)continue;
    const own=node.parentElement.getBoundingClientRect();if(own.width<=1||own.height<=1)continue; // visually hidden accessible label
    const bs=getComputedStyle(box),b=box.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);
    const over=[...range.getClientRects()].some(t=>t.width>0&&(t.right>b.right+2||t.left<b.left-2));if(!over)continue;
    if(/(auto|scroll)/.test(bs.overflowX))continue;
    if(/(hidden|clip)/.test(bs.overflowX)){if(bs.textOverflow!=='ellipsis')found.push('text cut off: '+name(box)+' "'+node.textContent.trim().slice(0,30)+'"');}
    else found.push('text spills: '+name(box)+' "'+node.textContent.trim().slice(0,30)+'"');
  }
  // Phones need 44px targets; wider (often pointer) layouts must still meet WCAG 2.2 AA's 24px.
  const min=W<768?44:24;
  for(const el of document.querySelectorAll('button,a.button,.button')){const cs=getComputedStyle(el),r=el.getBoundingClientRect();if(cs.display!=='none'&&r.width>0&&r.height>0&&(r.height<min-4||r.width<min-4)&&!el.closest('.supplier-card,.pd-thumbnails,footer,.storefront-breadcrumb'))found.push('small touch target: '+name(el)+' '+Math.round(r.width)+'x'+Math.round(r.height));}
  return [...new Set(found)];
}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const report={};let errors=[];try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.route('https://img.alicdn.com/**',r=>r.fulfill({path:'assets/backpack.jpg',contentType:'image/jpeg'}));
 await context.route('https://qpay.mn/**',r=>r.fulfill({path:'assets/favicon.svg',contentType:'image/svg+xml'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const check=async(label,prepare)=>{for(const width of WIDTHS){await page.setViewportSize({width,height:width<768?720:900});if(prepare)await prepare(width);await page.waitForTimeout(250);const found=await page.evaluate(audit);if(found.length)report[label+' @'+width]=found;}};
 const visit=async(path,ready)=>{await page.goto(base+path);await page.locator(ready).first().waitFor();};
 const line=(id,name)=>({id,sku:'555',qty:2,name,image:'https://img.alicdn.com/x.jpg',variant:'Хар / XXL / Урт нэртэй хувилбарын сонголт 2025 оны шинэ загвар',cny:189.5,min_qty:1,step:1,stock:null,vendor_id:'v'+id});

 await visit('/','.supplier-card');await check('home');
 await visit('/?q=bag#catalog','.supplier-card');await check('search');
 await visit('/v/tb-123456789','#pd-options');await check('product');
 await visit('/brands/nike','#brand-storefront');await check('brand');
 await visit('/help','.help-page, main');await check('help');
 await page.evaluate(l=>taobaoCart.save(l),[line('tb-123456789','Тест үүргэвч маш урт нэртэй бараа Taobao-оос'),line('tb-987654321','Second item')]);
 await visit('/cart','.store-cart-unit, main');await check('cart');
 await visit('/account','main');await check('account guest');

 const customer=await register(page,base);
 await visit('/v/tb-123456789','#pd-options');await page.locator('[data-pd-submit]').click();await page.locator('#taobao-checkout-form').waitFor();
 await check('checkout modal');
 await page.locator('#taobao-checkout-form [name=family_name]').fill('Тестийнхэн');
 const created=page.waitForResponse(r=>r.url().includes('action=order-create'));await page.locator('#taobao-checkout-form [type=submit]').click();const order=(await(await created).json()).order;
 await page.locator('#cargo-search').waitFor();await check('order list modal');
 await page.route(/action=order-get/,async route=>{const response=await route.fetch(),body=await response.json();body.order.paid=false;body.order.invoice={state:'ready',qr_image:QR,qr_text:'x',urls:BANKS};await route.fulfill({response,json:body});});
 await page.evaluate(id=>viewServerOrder(id),order.id);await page.locator('#modal .cargo-payment').waitFor();
 await check('QPay invoice modal');
 await page.evaluate(()=>document.querySelector('#modal .cargo-payment').scrollIntoView());await check('QPay invoice modal (banks in view)');
 await page.unroute(/action=order-get/);
 await page.evaluate(o=>cargoPaymentSuccess({...o,paid:true,status:'confirmed',amount:1234567},'initial'),order);await page.locator('#modal .payment-success').waitFor();await check('payment success modal');
 await page.locator('#close-modal').click();
 await page.evaluate(()=>sessionStorage.removeItem('gostore-pending-dismissed'));await visit('/','.supplier-card');await page.locator('.pending-pay').waitFor();await check('pending payment reminder');
 for(const section of ['orders','products','saved','addresses','notifications','profile']){await visit('/account/'+section,'#account-content');await page.waitForTimeout(400);await check('account '+section);}
}finally{await browser.close();}
 for(const [screen,list] of Object.entries(report)){console.log('\n## '+screen);for(const f of list.slice(0,25))console.log('  - '+f);if(list.length>25)console.log('  … '+(list.length-25)+' more');}
 console.log('\nScreens with problems: '+Object.keys(report).length+'; JS errors: '+JSON.stringify(errors));
 if(Object.keys(report).length||errors.length)process.exitCode=1;else console.log('PASS layout audit: all screens fit 320–1440px.');
})().catch(e=>{console.error(e);process.exitCode=1;});
