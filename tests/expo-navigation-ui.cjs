const { chromium } = require('../tmp/tooling/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.EXPO_TEST_URL || 'http://localhost:8086';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
// Local Expo preview only. Every API request is intercepted; no real customer or payment is touched.
(async () => {
  fs.mkdirSync('output/mobile-navigation', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(90000);
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.message); });
    let signedIn = false, failOrders = false;
    const customer = { id: 'ui-test', name: 'Туршилтын хэрэглэгч', email: 'preview@example.test', phone: '99000000', address: '' };
    const calls = [];
    const makeOrder = (id, status, paid) => ({ id, status, paid, amount: 15000, title: 'Travel backpack', created: '2026-10-30T12:00:00Z' });
    await page.route('https://gostore.mn/api/mobile.php**', async route => {
      const url = new URL(route.request().url()), action = url.searchParams.get('action'); calls.push({ action, query: url.searchParams.get('q') });
      let data = { csrf: 'ui-test' }, status = 200;
      if (action === 'customer-login') signedIn = true;
      if (action === 'customer-me') data.customer = signedIn ? customer : null;
      else if (action === 'catalog') Object.assign(data, { customer: signedIn ? customer : null, shipping: { cny_rate: 500, image_search_enabled: true }, qpay: true });
      else if (action === 'customer-login') data.customer = customer;
      else if (action === 'supplier-search') Object.assign(data, { products: [], more: false });
      else if (action === 'customer-orders') {
        if (failOrders) { status = 503; data.error = 'Туршилтын сүлжээний алдаа'; }
        else Object.assign(data, Number(url.searchParams.get('offset')) ? { orders: [makeOrder('GS-OLDER', 'quoted', false)], more: false } : {
          orders: [makeOrder('GS-UNPAID', 'quoted', false), makeOrder('GS-SHIPPING', 'shipping', true), makeOrder('GS-DONE', 'completed', true), makeOrder('GS-CANCELLED', 'cancelled', false)], more: true,
        });
      } else if (action === 'customer-addresses') data.addresses = [];
      else if (action === 'customer-notifications') data.notifications = [];
      else if (action === 'customer-profile') Object.assign(customer, route.request().postDataJSON());
      else throw Error('Unexpected API call: ' + action);
      await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) });
    });
    async function open(path) {
      await Promise.all([page.waitForResponse(r => r.url().includes('mobile.php?action=catalog')), page.goto(base + path)]);
    }
    await open('/categories');
    await page.getByText('Ангиллаар үзэх', { exact: true }).waitFor();
    const profileTabLabel = await page.getByText('Профайл', { exact: true }).boundingBox();
    assert.ok(profileTabLabel && profileTabLabel.y + profileTabLabel.height <= 844, 'Tab labels fit above the bottom edge');
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('tab', { name: 'Гэр ахуй', exact: true }).click();
      await page.getByRole('button', { name: 'Хадгалах хайрцаг', exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No category overflow at ' + width);
      assert.ok(await page.locator('svg path').count() >= 15, 'Native SVG icons render in preview');
    }
    await page.screenshot({ path: 'output/mobile-navigation/categories.png' });
    await page.getByRole('button', { name: 'Хадгалах хайрцаг', exact: true }).click();
    await page.waitForFunction(() => location.pathname === '/');
    await page.getByRole('img', { name: 'gostore.mn' }).waitFor();
    await page.waitForTimeout(400);
    assert.ok(calls.some(c => c.action === 'supplier-search' && c.query === 'Storage box'), 'Mongolian category sends English supplier query');
    await page.screenshot({ path: 'output/mobile-navigation/home.png' });
    assert.equal(await page.getByTestId('home-brand-shelf').count(), 0, 'Search results do not repeat the home discovery sections');
    await page.getByRole('button', { name: 'Нүүр хуудас руу буцах', exact: true }).click();
    await page.getByTestId('home-brand-shelf').getByTestId('brand-logo-nike').waitFor();
    assert.equal(await page.getByTestId('home-brand-shelf').locator('[data-testid^="brand-logo-"]').count(), 12, 'Home shelf contains all website logos');
    await page.screenshot({ path: 'output/mobile-navigation/brand-home.png' });
    await page.getByRole('button', { name: 'Бүх брэндийг үзэх', exact: true }).click();
    await page.getByLabel('Брэндийн нэрээр хайх', { exact: true }).waitFor();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.getByTestId('brand-directory-grid').locator('[data-testid^="brand-logo-"]').count(), 12);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Brand grid fits width ' + width);
    }
    await page.getByRole('tab', { name: 'Технологи', exact: true }).click();
    assert.equal(await page.getByTestId('brand-directory-grid').locator('[data-testid^="brand-logo-"]').count(), 2);
    await page.getByLabel('Брэндийн нэрээр хайх', { exact: true }).fill('missing-brand');
    await page.getByText('Тохирох брэнд олдсонгүй.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Бүх брэндийг харах', exact: true }).click();
    await page.screenshot({ path: 'output/mobile-navigation/brands.png' });
    await page.getByTestId('brand-directory-grid').getByRole('button', { name: 'Nike брэндийн бараа үзэх', exact: true }).click();
    await page.getByTestId('brand-result-heading').getByTestId('brand-logo-nike').waitFor();
    await page.waitForFunction(() => location.pathname === '/');
    await page.waitForTimeout(400);
    assert.ok(calls.some(c => c.action === 'supplier-search' && c.query === 'Nike'), 'Logo opens the correct brand search');
    assert.equal(await page.getByRole('button', { name: 'Бүх брэндийг үзэх', exact: true }).count(), 0, 'Inactive Home discovery is hidden from the active results screen');
    await page.screenshot({ path: 'output/mobile-navigation/brand-results.png' });
    await open('/orders');
    await page.getByText('Захиалга бүрээ нэг дор').waitFor();
    await page.getByRole('button', { name: 'Нэвтрэх / Бүртгүүлэх', exact: true }).click();
    await page.getByLabel('Имэйл', { exact: true }).fill('preview@example.test');
    await page.getByLabel('Нууц үг', { exact: true }).fill('preview-password');
    await page.getByRole('button', { name: 'Нэвтрэх', exact: true }).click();
    await page.getByText('GS-UNPAID', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/orders', 'Login returns to requested orders screen');
    await page.getByRole('tab', { name: 'Төлбөр хүлээж буй', exact: true }).click();
    assert.equal(await page.getByText('GS-CANCELLED', { exact: true }).count(), 0, 'Cancelled unpaid orders are excluded from payment filter');
    await page.getByRole('button', { name: 'Өмнөх захиалгуудыг ачаалах', exact: true }).click();
    await page.getByText('GS-OLDER', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Явцад байгаа', exact: true }).click();
    await page.getByText('GS-SHIPPING', { exact: true }).waitFor();
    assert.equal(await page.getByText('GS-DONE', { exact: true }).count(), 0);
    await page.screenshot({ path: 'output/mobile-navigation/orders.png' });
    failOrders = true;
    await page.getByRole('button', { name: 'Захиалга шинэчлэх', exact: true }).click();
    await page.getByText('Туршилтын сүлжээний алдаа').waitFor();
    failOrders = false;
    await page.getByRole('button', { name: 'Дахин оролдох', exact: true }).click();
    await page.getByText('Туршилтын сүлжээний алдаа').waitFor({ state: 'hidden' });
    await open('/account');
    await page.getByText(customer.name, { exact: true }).waitFor();
    await page.screenshot({ path: 'output/mobile-navigation/profile.png' });
    await page.getByRole('button', { name: 'Хувийн мэдээлэл Нэр, утасны дугаараа шинэчлэх', exact: true }).click();
    await page.getByLabel('Нэр', { exact: true }).fill('Шинэ нэр');
    await page.getByRole('button', { name: 'Өөрчлөлт хадгалах', exact: true }).click();
    await page.getByText('Амжилттай хадгаллаа.').waitFor();
    assert.equal(customer.name, 'Шинэ нэр');
    await page.setViewportSize({ width: 320, height: 600 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Profile fits narrow phone');
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log('PASS: logo/icons, 3 screen widths, categories, login return, order filters/pagination/retry and profile save');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
