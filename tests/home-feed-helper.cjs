// The home page lists verified discounts only (supplier-deals). The local test server has no TaoWorld catalog, so
// that request answers 503 and the home page shows no product cards; a suite's own supplier-search mock is not asked
// either. Suites that are about something else (cards, product pages, cart, navigation, layout) call this helper:
// the deals request is answered from the all-products search feed as the page itself would fetch it, so a mock the
// suite installed, or the fixture server, supplies the products. Every product gets a valid price cut, because the
// home page keeps only products with one. tests/home-deals-ui.cjs covers the real deals behaviour.
//   await require('./home-feed-helper.cjs')(page);          // one page or context, before page.goto
//   require('./home-feed-helper.cjs').everyPage(browser);   // every page and context the suite opens
const homeFeed=module.exports=async target=>{
 await target.route('**/api/index.php?action=supplier-deals*',async route=>{
  const number=Number(new URL(route.request().url()).searchParams.get('page'))||1;
  // Fetched inside the page so that the suite's own routes see it, like the search request the home page used to make.
  const result=await route.request().frame().evaluate(async page=>{const r=await fetch('/api/index.php?action=supplier-search&q=__all__&page='+page,{credentials:'omit'});return {status:r.status,body:await r.json().catch(()=>null)};},number);
  if(result.status!==200||!result.body)return route.fulfill({status:result.status||503,json:result.body||{error:'Unavailable'}});
  const expires=Math.floor(Date.now()/1000)+3600;
  result.body.products=(result.body.products||[]).map(p=>{const amount=Number(p.mnt||p.approx_mnt);return amount>0?{...p,card_discount:{was_mnt:amount*2,current_mnt:amount,percent:50,expires}}:p;});
  await route.fulfill({json:result.body});
 });
};
// Routes a suite registers later for the same request still win, as Playwright asks the newest matching route first.
// The first visit also opens the «choose your pickup warehouse» reminder, a modal dialog that covers the page.
// These suites are not about it (tests/warehouse-preference-ui.cjs is), so it is marked as already shown.
module.exports.everyPage=browser=>{for(const method of ['newPage','newContext']){const open=browser[method].bind(browser);browser[method]=async options=>{const target=await open(options);await homeFeed(target);await target.addInitScript(()=>{try{sessionStorage.setItem('gostore-warehouse-reminded-v1','1');}catch{}});return target;};}return browser;};
