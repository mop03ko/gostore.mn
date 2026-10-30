const { chromium } = require('../tmp/tooling/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.EXPO_TEST_URL || 'http://localhost:8086';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#f3eee7"/><rect x="110" y="70" width="180" height="270" rx="45" fill="#79644b"/></svg>');
const product = id => ({ id, name: id === 'tb-123456' ? 'Everyday Travel Backpack with Multiple Compartments and Adjustable Shoulder Straps' : 'Compact Travel Organizer', image, images: [image], mnt: 25000, cny: 50, min_qty: 1, step: 1, sellable: true, vendor_name: 'Travel Shop', shop_rating: id === 'tb-123456' ? 4.8 : null,
  variants: [{ id: 'black', label: 'Black / Large', cny: 50, stock: 10 }], attributes: Array.from({ length: 8 }, (_, i) => ({ name: i === 0 ? 'Material' : 'Specification ' + i, value: i === 0 ? 'Canvas' : 'Value ' + i })) });
(async () => {
  fs.mkdirSync('output/mobile-product', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(90000);
    const errors = [], calls = []; let failRecommendations = true;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://gostore.mn/api/mobile.php**', async route => {
      const url = new URL(route.request().url()), action = url.searchParams.get('action'); calls.push(action);
      let data = { csrf: 'fixture' }, status = 200;
      if (action === 'customer-me') data.customer = null;
      else if (action === 'catalog') Object.assign(data, { customer: null, shipping: { cny_rate: 500 }, qpay: true });
      else if (action === 'supplier-product') data.product = product(url.searchParams.get('id'));
      else if (action === 'supplier-recommend') {
        if (failRecommendations) { status = 503; data.error = 'Recommendation fixture error'; }
        else data.products = [product('tb-123456'), product('tb-654321'), product('tb-654321'), ...Array.from({ length: 12 }, (_, i) => ({ ...product('tb-' + (700000 + i)), name: 'Suggested item ' + i }))];
      } else throw Error('Unexpected API call: ' + action);
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(base + '/product/tb-123456');
    await page.getByRole('button', { name: 'Барааны нэрийг дэлгэрүүлэх', exact: true }).waitFor();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width);
      const tabs = await page.getByRole('tab', { name: 'Тойм', exact: true }).boundingBox();
      assert.ok(tabs && tabs.y >= 40 && tabs.y < 160, 'Section navigation sits below the header');
    }
    await page.screenshot({ path: 'output/mobile-product/overview.png' });
    await page.getByRole('tab', { name: 'Үнэлгээ', exact: true }).click();
    await page.getByText('Дэлгүүрийн үнэлгээ', { exact: true }).waitFor();
    await page.waitForTimeout(400);
    assert.ok(await page.getByTestId('product-reviews').innerText().then(t => t.includes('4.8') && t.includes('одоогоор харуулах боломжгүй')));
    await page.screenshot({ path: 'output/mobile-product/reviews.png' });
    await page.getByRole('tab', { name: 'Үзүүлэлт', exact: true }).click();
    assert.ok(await page.getByTestId('product-fact').count() <= 4);
    await page.getByRole('button', { name: 'Бүх үзүүлэлтийг дэлгэрүүлэх', exact: true }).click();
    assert.equal(await page.getByTestId('product-fact').count(), 8);
    await page.getByRole('button', { name: 'Бүх үзүүлэлтийг дэлгэрүүлэх', exact: true }).click();
    assert.ok(await page.getByTestId('product-fact').count() <= 4);
    await page.screenshot({ path: 'output/mobile-product/specifications.png' });
    await page.getByRole('tab', { name: 'Санал болгох', exact: true }).click();
    await page.getByTestId('product-recommendations').getByText('Recommendation fixture error').waitFor();
    failRecommendations = false;
    await page.getByTestId('product-recommendations').getByRole('button', { name: 'Дахин оролдох', exact: true }).click();
    await page.getByTestId('product-recommendations').getByRole('button', { name: 'Compact Travel Organizer', exact: true }).waitFor();
    assert.equal(await page.getByTestId('product-recommendations').getByRole('button').count(), 12, 'Recommendations exclude current product, deduplicate and cap cards');
    await page.getByRole('tab', { name: 'Санал болгох', exact: true }).click();
    await page.waitForTimeout(500);
    const recommendedHeading = await page.getByText('Танд санал болгох', { exact: true }).boundingBox();
    assert.ok(recommendedHeading && recommendedHeading.y >= 100 && recommendedHeading.y < 180, 'Recommendation jump aligns the section below the fixed tabs');
    await page.screenshot({ path: 'output/mobile-product/recommendations.png' });
    await page.getByTestId('product-recommendations').getByRole('button', { name: 'Compact Travel Organizer', exact: true }).click();
    await page.waitForURL('**/product/tb-654321');
    await page.getByRole('button', { name: 'Барааны нэрийг дэлгэрүүлэх', exact: true }).filter({ hasText: 'Compact Travel Organizer' }).waitFor();
    await page.getByRole('tab', { name: 'Үнэлгээ', exact: true }).click();
    assert.ok(!(await page.getByTestId('product-reviews').last().innerText()).includes('Дэлгүүрийн үнэлгээ'), 'Missing seller rating is never fabricated');
    await page.getByRole('button', { name: 'Сагсанд нэмэх', exact: true }).click();
    await page.getByRole('button', { name: 'Black / Large · ¥50', exact: true }).click();
    const add = page.getByRole('button', { name: 'Сагсанд нэмэх', exact: true }).last();
    await add.click();
    await page.getByText('Сагсанд нэмэгдлээ ✓', { exact: true }).waitFor();
    assert.ok(!calls.some(a => /order-create|invoice|payment/.test(a)), 'No purchases or payments');
    assert.deepEqual(errors, []);
    console.log('PASS product tabs, compact/expanded facts, truthful rating, recommendation retry/navigation/deduplication, SKU cart flow and 3 widths');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
