// Local Expo web only; API responses are fixtures, never real orders or payments.
const { chromium } = require('../tmp/tooling/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.MOBILE_WEB_BASE || 'http://localhost:8093';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const categories = require('../gostoremn/src/lib/discovery.json');
const expires = Math.floor(Date.now() / 1000) + 3600;
function product(id, name, discount = true) {
  return { id: `tb-${id}`, name, image: categories[id % categories.length].image, mnt: 20000, cny: 40, min_qty: 1, step: 1, variants: [], sellable: true,
    ...(discount ? { card_discount: { current_mnt: 20000, was_mnt: 40000, percent: 50, expires } } : {}) };
}
const deals = Array.from({ length: 8 }, (_, i) => product(123450 + i, `Deal ${i}`));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [], requests = [];
    page.setDefaultTimeout(20000);
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://gostore.mn/assets/category-images/**', route => route.fulfill({ path: 'gostoremn/assets/category-images/' + new URL(route.request().url()).pathname.split('/').pop(), contentType: 'image/webp' }));
    await page.route('**/api/mobile.php?**', async route => {
      const params = new URL(route.request().url()).searchParams, action = params.get('action');
      requests.push({ action, q: params.get('q'), page: params.get('page') });
      let json = { products: [], more: false, orders: [], messages: [], unread: 0, csrf: 'fixture' };
      if (action === 'catalog') json = { customer: null, shipping: { pickup_locations: [], image_search_enabled: true }, csrf: 'fixture' };
      if (action === 'promo-popup') json = { popup: null };
      if (action === 'supplier-deals') json = { products: [...deals, product(987650, 'No discount', false), { ...product(987651, 'Expired deal'), card_discount: { ...deals[0].card_discount, expires: 1 } }], more: false, cache_ttl: 300 };
      if (action === 'supplier-search') {
        const q = params.get('q');
        if (q === categories[0].query) {
          await new Promise(resolve => setTimeout(resolve, 800)); // Race a slower category against a later selection.
          json = { products: [product(887650, 'Home discount'), product(887651, 'Home regular', false)], more: false, cache_ttl: 300 };
        } else if (q === categories[1].query) json = { products: [product(887660, 'Second category discount'), product(887661, 'Second regular', false)], more: false, cache_ttl: 300 };
        else if (q === categories[2].query) json = params.get('page') === '1' ? { products: [product(887670, 'Regular only', false)], more: true } : { products: [product(887671, 'Next page discount')], more: false };
        else if (q === categories[3].query) return route.fulfill({ status: 503, json: { error: 'Fixture unavailable' } });
        else json = { products: [product(887680, 'Searched regular', false)], more: false };
      }
      await route.fulfill({ json });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const tabs = page.getByTestId('home-category-tabs');
    const activePage = page.locator('[data-testid^="home-page-"]:not([aria-hidden="true"])');
    await activePage.getByTestId('home-deal-highlights').waitFor({ timeout: 120000 }).catch(async e => { console.error({ errors, requests, body: (await page.locator('body').innerText()).slice(0,2000) }); throw e; });
    console.log('Home loaded');
    assert.equal(await tabs.getByRole('tab').count(), categories.length + 1);
    assert.equal(await page.getByText('No discount', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Expired deal', { exact: true }).count(), 0);
    assert.equal(requests.filter(r => r.action === 'supplier-deals').length, 1, 'Highlights reuse the one feed request');
    assert.equal(requests.filter(r => ['campaign', 'supplier-recommend', 'supplier-free-shipping'].includes(r.action)).length, 0);
    fs.mkdirSync('output/home-deals', { recursive: true });
    await page.screenshot({ path: 'output/home-deals/light-390.png' });
    const client = await context.newCDPSession(page);
    const carousel = activePage.getByTestId('home-deal-carousel'), carouselBox = await carousel.boundingBox();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 310, y: carouselBox.y + 90 }] });
    for (let i = 1; i <= 8; i++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 310 - 24 * i, y: carouselBox.y + 90 }] }); await page.waitForTimeout(30); }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    assert.ok(await carousel.evaluate(e => e.scrollLeft) > 30, 'Inner carousel scrolls');
    assert.equal(await page.getByTestId('home-category-pager').evaluate(e => e.scrollLeft), 0, 'Inner carousel does not change category');
    assert.equal(requests.filter(r => r.action === 'supplier-search').length, 0, 'No adjacent category prefetch');
    await tabs.getByRole('tab', { name: categories[0].name, exact: true }).click();
    await tabs.getByRole('tab', { name: categories[1].name, exact: true }).click();
    await page.getByRole('button', { name: 'Second category discount', exact: true }).first().waitFor();
    await page.waitForTimeout(1000);
    assert.equal(await page.getByRole('button', { name: 'Home discount', exact: true }).count(), 0, 'Old category cannot overwrite the current category');
    assert.equal(await page.getByText('Second regular', { exact: true }).count(), 0);
    console.log('Category race verified');
    // Touch swipe over the actual list heading, away from horizontal carousels.
    async function swipe(dx, dy = 0, capture = false) {
      const heading = activePage.getByTestId('home-deals-heading');
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const box = await heading.boundingBox();
      const x = dx > 0 ? 70 : 310, y = box.y + 15;
      const pager = page.getByTestId('home-category-pager');
      const beforeX = await pager.evaluate(e => e.scrollLeft);
      const indicator = page.getByTestId('home-tab-indicator');
      const beforeIndicator = await indicator.evaluate(e => getComputedStyle(e).transform);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 8; i++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8 }] }); await page.waitForTimeout(30);
        if (capture && i === 5) {
          const duringX = await pager.evaluate(e => e.scrollLeft);
          assert.ok(Math.abs(duringX - beforeX) > 30 && Math.abs(duringX - beforeX) < 390, 'Page follows the finger before release');
          assert.notEqual(await indicator.evaluate(e => getComputedStyle(e).transform), beforeIndicator, 'Underline moves during the gesture');
          await page.screenshot({ path: 'output/home-deals/pager-mid-drag.png' });
        }
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await swipe(240, 0, true);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="home-category-tabs"] [role="tab"]')[1].getAttribute('aria-selected') === 'true');
    await page.getByRole('button', { name: 'Home discount', exact: true }).first().waitFor();
    await swipe(-240);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="home-category-tabs"] [role="tab"]')[2].getAttribute('aria-selected') === 'true');
    console.log('Both swipe directions verified');
    await swipe(35);
    await page.waitForTimeout(600);
    assert.equal(await tabs.getByRole('tab', { name: categories[1].name, exact: true }).getAttribute('aria-selected'), 'true', 'Short drag snaps back');
    const searches = requests.filter(r => r.action === 'supplier-search').length;
    await swipe(5, -90);
    assert.equal(requests.filter(r => r.action === 'supplier-search').length, searches, 'Vertical scrolling must not switch category');
    await tabs.getByRole('tab', { name: categories[2].name, exact: true }).click();
    await activePage.getByText(/Энэ хуудсанд баталгаажсан хямдрал алга/).waitFor();
    await page.waitForTimeout(400);
    assert.equal(requests.filter(r => r.q === categories[2].query).length, 1, 'No unbounded automatic requests through non-sale pages');
    await page.getByRole('button', { name: 'Дараагийн бараанууд', exact: true }).click();
    await page.getByRole('button', { name: 'Next page discount', exact: true }).first().waitFor();
    await tabs.getByRole('tab', { name: categories[3].name, exact: true }).click();
    await page.getByText('Fixture unavailable', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Next page discount', exact: true }).count(), 0);
    await tabs.getByRole('tab', { name: 'Хямдрал', exact: true }).click();
    await activePage.getByTestId('home-deal-highlights').waitFor();
    assert.equal(requests.filter(r => r.action === 'supplier-deals').length, 1, 'Returning home uses the catalog cache');
    const homeFeed = page.getByTestId('home-feed-0');
    await homeFeed.evaluate(e => { e.scrollTop = 440; });
    await page.waitForTimeout(400);
    const savedOffset = await homeFeed.evaluate(e => e.scrollTop);
    assert.ok(savedOffset > 300);
    for (const category of categories.slice(0, 6)) {
      await tabs.getByRole('tab', { name: category.name, exact: true }).click();
      await page.waitForTimeout(350);
    }
    assert.ok(await page.locator('[data-testid^="home-feed-"]').count() <= 5, 'At most five mounted feeds');
    await tabs.getByRole('tab', { name: 'Хямдрал', exact: true }).click();
    await homeFeed.waitFor();
    await page.waitForTimeout(500);
    assert.ok(Math.abs(await homeFeed.evaluate(e => e.scrollTop) - savedOffset) < 8, 'Evicted category restores scroll position');
    assert.equal(requests.filter(r => r.action === 'supplier-deals').length, 1, 'Restored category retains fetched pages');
    await homeFeed.evaluate(e => { e.scrollTop = 0; });
    await page.waitForTimeout(200);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: 'output/home-deals/dark-390.png' });
    await page.setViewportSize({ width: 320, height: 568 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at 320px');
    await page.screenshot({ path: 'output/home-deals/dark-320.png' });
    await tabs.getByRole('tab', { name: categories[1].name, exact: true }).click();
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(500);
    assert.ok(Math.abs(await page.getByTestId('home-category-pager').evaluate(e => e.scrollLeft) - 860) < 2, 'Resize keeps the selected page aligned');
    await page.getByRole('textbox', { name: 'Бараа хайх', exact: true }).fill('test');
    await page.getByRole('button', { name: 'Хайх', exact: true }).click();
    await page.getByRole('button', { name: 'Searched regular', exact: true }).waitFor();
    assert.equal(await tabs.count(), 0, 'Explicit search remains an unrestricted search');
    assert.deepEqual(errors, []);
    console.log('PASS home pager: finger-follow and indicator, snap-back, left/right touch swipes, nested carousel, vertical scroll, five-feed limit, evicted scroll restoration, lazy/cache/races, discounts, pagination/error, search and resized/dark layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
