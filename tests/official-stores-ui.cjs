const { chromium } = require('../tmp/tooling/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage(), calls = [], errors = [];
    let failDirectory = false;
    const store = { id: '71955116', name: 'NIKE官方旗舰店', display_name: 'Nike Official Store', logo: '/assets/brands/nike.svg' };
    const products = prices => prices.map(price => ({ id: 'tb-' + (700000000000 + price), name: 'Product ' + price, official_shop_id: store.id, approx_mnt: price }));
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://www.googletagmanager.com/**', r => r.abort());
    await page.route('**/api/index.php**', async route => {
      const url = new URL(route.request().url()); let data = {};
      try { data = route.request().postDataJSON() || {}; } catch {}
      const p = Object.assign(Object.fromEntries(url.searchParams), data);
      if (p.action === 'supplier-official-stores') return route.fulfill(failDirectory ? { status: 503, json: { error: 'Temporary error' } } : { json: { ok: true, stores: [{ ...store, products: products([300, 100]) }], incomplete: false, cache_ttl: 0 } });
      if (p.action !== 'supplier-search') return route.continue();
      calls.push(p);
      await route.fulfill({ json: { ok: true, products: products(Number(p.page) === 2 ? [200, 500] : [300, 100]), more: Number(p.page) === 1, page: Number(p.page), store, cache_ttl: 0, shipping: { cny_rate: 500 } } });
    });
    const names = () => page.locator('#supplier-grid h3').allTextContents();
    await page.goto('http://127.0.0.1:8091/brands/nike');
    await page.locator('.official-store-row').waitFor();
    assert.equal(new URL(page.url()).pathname, '/official-stores');
    assert.equal(await page.locator('#brands').count(), 0);
    assert.equal(await page.locator('#catalog').isVisible(), false);
    assert.equal(calls.length, 0, 'Directory must not trigger global product search');
    assert.match(await page.locator('.official-store-products a').first().getAttribute('href'), /shop=71955116/);
    await page.locator('.official-store-heading a').click();
    await page.locator('#supplier-grid .supplier-card').first().waitFor();
    assert.equal(calls[0].shop, store.id); assert.equal(calls[0].sort, '-price');
    await page.locator('[data-supplier-more]').click();
    await page.waitForFunction(() => document.querySelectorAll('#supplier-grid .supplier-card').length === 4);
    assert.deepEqual(await names(), ['Product 500', 'Product 300', 'Product 200', 'Product 100']);
    await page.locator('#supplier-sort').selectOption('price');
    await page.waitForFunction(() => document.querySelector('#supplier-grid h3')?.textContent === 'Product 100');
    await page.locator('#supplier-search [name=price_min]').fill('100');
    await page.locator('#supplier-search').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => new URLSearchParams(location.search).get('price_min') === '100');
    assert.equal(new URL(page.url()).searchParams.get('shop'), store.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:8091/official-stores');
    await page.locator('.official-store-row').waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page overflows');
    failDirectory = true;
    await page.reload(); await page.locator('[data-stores-retry]').waitFor();
    failDirectory = false;
    await page.locator('[data-stores-retry]').click(); await page.locator('.official-store-row').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS official directory, legacy redirect, strict shop context, sorting, price filter, mobile layout, error retry');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
