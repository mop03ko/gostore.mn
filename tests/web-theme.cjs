const { chromium } = require('../tmp/tooling/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TEST_BASE || 'http://127.0.0.1:8091';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);

(async () => {
  fs.mkdirSync('output/web-theme', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1440, height: 960 } });
    await context.route('https://www.googletagmanager.com/**', r => r.abort());
    await context.route('https://img.alicdn.com/**', r => r.fulfill({ path: 'assets/backpack.jpg', contentType: 'image/jpeg' }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const button = page.getByRole('button', { name: 'Dark Mode', exact: true });
    async function expectTheme(theme) {
      await page.waitForFunction(t => document.documentElement.dataset.theme === t, theme);
      assert.equal(await button.getAttribute('aria-pressed'), String(theme === 'dark'));
    }
    await page.goto(base);
    await button.waitFor();
    await expectTheme('light');
    await button.click();
    await expectTheme('dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('gostore-theme')), 'dark');
    assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(17, 17, 20)');
    assert.equal(await page.locator('.header').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(29, 31, 37)');
    await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ animations: 'disabled', path: 'output/web-theme/home-desktop.png' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectTheme('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme('dark'); // Explicit choice wins over the device.

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await button.isVisible(), 'Toggle visible at ' + width);
      const rect = await button.boundingBox();
      assert.ok(rect.width >= 44 && rect.height >= 44 && rect.x + rect.width <= width, 'Accessible theme target fits at ' + width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ animations: 'disabled', path: 'output/web-theme/home-mobile.png' });
    for (const [path, name] of [['/v/tb-700111111111', 'product'], ['/cart', 'cart'], ['/account', 'account'], ['/help', 'help']]) {
      await page.goto(base + path);
      await button.waitFor();
      await expectTheme('dark');
      if (name === 'product') await page.locator('#pd-options').waitFor();
      assert.equal(await page.locator('img').first().evaluate(e => getComputedStyle(e).filter), 'none', 'Images keep their real colors');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ animations: 'disabled', path: 'output/web-theme/' + name + '.png' });
    }
    await button.focus();
    await page.keyboard.press('Enter');
    await expectTheme('light');
    await page.reload();
    await expectTheme('light');
    const other = await context.newPage();
    await other.goto(base + '/cart');
    await button.click();
    await other.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await other.close();

    const fresh = await browser.newContext({ colorScheme: 'dark' });
    const freshPage = await fresh.newPage();
    await freshPage.goto(base);
    assert.equal(await freshPage.locator('html').getAttribute('data-theme'), 'dark', 'First visit follows system');
    await freshPage.emulateMedia({ colorScheme: 'light' });
    await freshPage.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await fresh.close();

    const blocked = await browser.newContext({ colorScheme: 'light' });
    await blocked.addInitScript(() => {
      for (const method of ['getItem', 'setItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (key, ...args) {
          if (key === 'gostore-theme') throw new DOMException('Blocked', 'SecurityError');
          return original.call(this, key, ...args);
        };
      }
    });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(base);
    await blockedPage.getByRole('button', { name: 'Dark Mode', exact: true }).click();
    assert.equal(await blockedPage.locator('html').getAttribute('data-theme'), 'dark', 'Toggle works without persistent storage');
    await blocked.close();
    assert.deepEqual(errors, []);
    console.log('PASS: dark/light, persistence, system preference, keyboard, cross-tab sync, blocked storage and storefront routes at three widths');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
