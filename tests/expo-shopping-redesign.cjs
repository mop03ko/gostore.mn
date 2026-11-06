const { chromium } = require('../tmp/tooling/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.EXPO_TEST_URL || 'http://localhost:8086';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
// All commerce responses are fixtures. Camera uses Chromium's synthetic video device.
(async () => {
  fs.mkdirSync('output/shopping-redesign', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(90000);
    const errors = [], calls = []; let signedIn = true, imageEnabled = true, rejectUpload = false;
    page.on('pageerror', e => errors.push(e.message));
    const customer = { id: 'design-fixture', name: 'Номин', email: 'preview@example.test', phone: '99000000', address: '' };
    const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#eeeaf6"/><rect x="100" y="110" width="200" height="220" rx="32" fill="#262261"/><path d="M150 110V80Q200 10 250 80V110" fill="none" stroke="#f16522" stroke-width="18"/></svg>');
    const products = Array.from({ length: 6 }, (_, i) => ({ id: 'tb-' + (810000 + i), name: 'Travel bag ' + i, image: photo, approx_mnt: 25000 + i * 1000, cny: 50, min_qty: 1, step: 1, variants: [] }));
    const line = { id: 'tb-810000', sku: 'blue', name: 'Travel bag 0', image: photo, variant: 'Хөх · Стандарт', qty: 1, cny: 50, min_qty: 1, step: 1, stock: 10 };
    await page.addInitScript(line => { if (!localStorage.getItem('qa-cart-seeded')) { localStorage.setItem('gostore-cart-design-fixture', JSON.stringify([line])); localStorage.setItem('qa-cart-seeded', '1'); } }, line);
    await page.route('https://gostore.mn/api/mobile.php**', route => {
      const u = new URL(route.request().url()), action = u.searchParams.get('action'); calls.push({ action, image: u.searchParams.get('image'), q: u.searchParams.get('q') });
      let data = { csrf: 'fixture' }, status = 200;
      if (action === 'catalog') Object.assign(data, { customer: signedIn ? customer : null, shipping: { cny_rate: 500, image_search_enabled: imageEnabled }, qpay: false });
      else if (action === 'customer-me') data.customer = signedIn ? customer : null;
      else if (action === 'supplier-search') Object.assign(data, { products, more: false });
      else if (action === 'supplier-deals') Object.assign(data, { products: [], more: false });
      else if (action === 'supplier-free-shipping') Object.assign(data, { products: [], status: 'unavailable' });
      else if (action === 'supplier-image-upload') { if (rejectUpload) { status = 503; data.error = 'Туршилтын зураг илгээх алдаа'; } else data.image = 'fixture-image-token'; }
      else if (action === 'customer-orders') Object.assign(data, { orders: [
        { id: 'GS-UNPAID', status: 'quoted', paid: false, amount: 25000, title: 'Unpaid bag', created: '2026-11-01T10:00:00Z' },
        { id: 'GS-ACTIVE', status: 'erenhot', paid: true, amount: 25000, title: 'Shipping bag', created: '2026-11-01T10:00:00Z' },
      ], more: false });
      else if (action === 'customer-addresses') data.addresses = [];
      else if (action === 'customer-notifications') data.notifications = [];
      else throw Error('Unexpected API mutation or request: ' + action);
      return route.fulfill({ status, json: data });
    });
    async function open(route) { await page.goto(base + route); }
    async function fits(name) {
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' fits ' + width);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: 'output/shopping-redesign/' + name + '.png' });
    }
    await open('/'); await page.getByRole('button', { name: 'Тухтай гэр', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Travel bag 0', exact: true }).waitFor();
    await page.waitForFunction(() => { const imgs = [...document.images]; return imgs.length > 8 && imgs.every(i => i.complete && i.naturalWidth > 0); });
    await fits('home');
    const tabbar = page.getByRole('tablist').last();
    assert.equal(await tabbar.getByRole('tab').count(), 5, 'Five customer tabs; orders remain reachable from account');
    await open('/categories'); await page.getByTestId('category-products').getByText('Travel bag 0', { exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="category-photo-grid"] img')].every(i => i.complete && i.naturalWidth > 0));
    await fits('categories');
    assert.equal(await page.getByTestId('category-photo-grid').getByRole('button').count(), 9);
    await page.getByRole('tab', { name: 'Гэр ахуй', exact: true }).click();
    await page.getByRole('button', { name: 'Хадгалах хайрцаг', exact: true }).click();
    await page.getByTestId('brand-result-heading').getByText('storage box', { exact: true }).waitFor();
    assert.ok(calls.some(c => c.q === 'storage box'));
    await open('/account'); await page.getByTestId('account-hero').getByText('Номин', { exact: true }).waitFor(); await fits('account');
    await page.getByRole('button', { name: 'Төлбөр хүлээж буй захиалга', exact: true }).click();
    await page.getByText('GS-UNPAID', { exact: true }).waitFor({ timeout: 30000 }).catch(async e => {
      console.error('Order shortcut failure:', page.url(), await page.locator('body').innerText(), errors, calls.slice(-6));
      await page.screenshot({ path: 'output/shopping-redesign/order-failure.png' }); throw e;
    });
    assert.equal(await page.getByText('GS-ACTIVE', { exact: true }).count(), 0, 'Account shortcut selects the correct order filter');
    await open('/cart'); await page.getByText('Хөх · Стандарт', { exact: true }).waitFor(); await fits('cart');
    await page.getByRole('button', { name: 'Тоо нэмэх', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('gostore-cart-design-fixture'))[0].qty === 2);
    await page.getByRole('button', { name: 'Хасах', exact: true }).click();
    await page.getByText('Сагс тань хоосон байна', { exact: true }).waitFor();
    await open('/search');
    await page.waitForFunction(() => document.querySelector('video') || [...document.querySelectorAll('[role="button"]')].some(e => e.textContent === 'Камер нээх'));
    await fits('search-permission');
    const permissionButton = page.getByRole('button', { name: 'Камер нээх', exact: true });
    if (await permissionButton.isVisible()) await permissionButton.click();
    await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState >= 2; });
    await fits('search-camera');
    rejectUpload = true;
    await page.getByRole('button', { name: 'Зураг авч хайх', exact: true }).click();
    await page.getByText('Туршилтын зураг илгээх алдаа', { exact: true }).waitFor();
    rejectUpload = false;
    await page.getByRole('button', { name: 'Зураг авч хайх', exact: true }).click();
    await page.getByText('Зургаар хайсан бараа', { exact: true }).waitFor();
    assert.ok(calls.some(c => c.action === 'supplier-search' && c.image === 'fixture-image-token'));
    assert.equal(await page.locator('video').count(), 0, 'Camera unmounts when search loses focus');
    await open('/search'); await page.getByRole('tab', { name: 'НЭРЭЭР', exact: true }).click();
    await page.getByLabel('Хайх барааны нэр', { exact: true }).fill('winter boots');
    await page.getByRole('button', { name: 'Хайх', exact: true }).click();
    await page.getByTestId('brand-result-heading').getByText('winter boots', { exact: true }).waitFor();
    signedIn = false; imageEnabled = false;
    await open('/account'); await page.getByRole('button', { name: 'Нэвтрэх / Бүртгүүлэх', exact: true }).waitFor(); await fits('account-guest');
    await open('/search'); await page.getByLabel('Хайх барааны нэр', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Зураг авч хайх', exact: true }).count(), 0);
    await page.emulateMedia({ colorScheme: 'dark' }); await fits('search-dark');
    assert.ok(!calls.some(c => /order-create|invoice|payment/.test(c.action)));
    assert.deepEqual(errors, []);
    console.log('PASS customer redesign: 5 tabs, 320–430px layout, categories, order filter, cart quantity/removal, camera permission/capture/upload failure/retry/result/unmount, text search, guest/disabled/dark states; no purchases.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
