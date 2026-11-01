const { chromium } = require('../tmp/tooling/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage(), calls = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://www.googletagmanager.com/**', r => r.abort());
    await page.route('**/api/index.php**', async route => {
      const url = new URL(route.request().url()); let data = {};
      try { data = route.request().postDataJSON() || {}; } catch {}
      const p = Object.assign(Object.fromEntries(url.searchParams), data);
      if (p.action !== 'supplier-search') return route.continue();
      calls.push(p);
      const prices = p.brand === 'zara' && Number(p.page) === 1 ? [] : Number(p.page) === 2 ? [200, 500] : [300, 100];
      await route.fulfill({ json: { ok: true, products: prices.map(price => ({ id: 'tb-' + (700000000000 + price), name: 'Product ' + price, brand_id: p.brand, approx_mnt: price })), more: Number(p.page) === 1, page: Number(p.page), brand: { id: p.brand, store_name: 'Брэндэд хамаарах бараанууд' }, shipping: { weight_step_kg: 1, weight_step_mnt: 3000, volume_threshold: 1, volume_small_cny: 500, cny_rate: 500 } } });
    });
    const names = () => page.locator('#supplier-grid h3').allTextContents();
    await page.goto('http://127.0.0.1:8091/brands/nike');
    await page.locator('#supplier-grid .supplier-card').first().waitFor();
    assert.equal(calls[0].sort, '-price');
    assert.equal(await page.locator('#supplier-sort').inputValue(), '-price');
    await page.locator('[data-supplier-more]').click();
    await page.waitForFunction(() => document.querySelectorAll('#supplier-grid .supplier-card').length === 4);
    assert.deepEqual(await names(), ['Product 500', 'Product 300', 'Product 200', 'Product 100']);
    await page.locator('#supplier-sort').selectOption('price');
    await page.waitForFunction(() => document.querySelector('#supplier-grid h3')?.textContent === 'Product 100');
    assert.deepEqual(await names(), ['Product 100', 'Product 300']);
    await page.goto('http://127.0.0.1:8091/brands/zara');
    await page.locator('[data-supplier-more]').waitFor();
    assert.equal(await page.locator('#supplier-grid .supplier-card').count(), 0);
    await page.locator('[data-supplier-more]').click();
    await page.locator('#supplier-grid .supplier-card').first().waitFor();
    assert.deepEqual(await names(), ['Product 500', 'Product 200']);
    assert.deepEqual(errors, []);
    console.log('PASS brand price defaults, ascending override, merged-page ordering, empty-page continuation');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
