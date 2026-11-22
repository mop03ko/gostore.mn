const { chromium } = require("../tmp/tooling/node_modules/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("../gostoremn/node_modules/typescript");

const base = process.env.EXPO_TEST_URL || "http://localhost:8094";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const tariff = {version: 3, small_weight_limit_kg: 70, small_volume_limit_m3: 1, small_step_kg: 0.5, small_step_mnt: 1000, large_per_m3_cny: 390, large_per_tonne_cny: 1300};

// Exercise the same small/large thresholds and rounding cases as PHP and the web calculator.
const source = fs.readFileSync("gostoremn/src/lib/cargo-tariff.ts", "utf8");
const tariffModule = { exports: {} };
new Function("exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(tariffModule.exports);
const { estimateCargo, cargoNumber } = tariffModule.exports;
for (const { w, v, amount, basis, category } of require("./cargo-tariff-cases.json")) {
  assert.deepEqual(estimateCargo(w, v, tariff, 550), { amount, basis, category });
}
assert.equal(cargoNumber("1,2"), 1.2);
for (const invalid of ["", "1,2,3", "1e2", "-1", "0x10"]) assert.ok(Number.isNaN(cargoNumber(invalid)));
assert.equal(estimateCargo(1, 0, tariff, 550), null);

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage(), errors = [], calls = [];
    page.on("pageerror", e => errors.push(e.message));
    page.setDefaultTimeout(30000);
    const owner = {id: "cargo-ui", name: "Туршилт", phone: "99112233", pin_enabled: true, email_login: false, email: "", address: ""};
    const pickup = {location: "ulaanbaatar", city: "Улаанбаатар", name: "Улаанбаатар агуулах", address: "Туршилтын хаяг", phone: "99112233", hours: "09:00–18:00"};
    const delivery = {name: "Эрээн агуулах", cargo_id: "GO12345678", recipient: "GO12345678 GOStore", phone: "13000000000", address: "二连浩特市 测试仓库 GO12345678号", label: "收件人: GO12345678 GOStore\n手机号: 13000000000\n地址: 二连浩特市 测试仓库 GO12345678号"};
    let customer = null, orders = [], addressFailures = 0;
    const cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS"};
    await context.route("https://gostore.mn/api/mobile.php**", async route => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const action = new URL(request.url()).searchParams.get("action");
      const body = request.postData() ? request.postDataJSON() : {};
      calls.push(action);
      const json = { csrf: "cargo-ui" };
      let status = 200;
      if (action === "customer-pin-login") { customer = owner; json.customer = customer; }
      else if (action === "customer-me") json.customer = customer;
      else if (action === "catalog") Object.assign(json, { customer, shipping: { cny_rate: 550, cargo_tariff: tariff, pickup_locations: [pickup] } });
      else if (action === "customer-self-cargo") {
        assert.equal(customer, owner, "Guests never request private cargo information");
        if (addressFailures++ === 0) { status = 503; json.error = "Туршилтын алдаа"; }
        else Object.assign(json, { delivery, orders });
      } else if (action === "customer-self-cargo-create") {
        assert.equal(body.pickup_location, pickup.location);
        assert.equal(body.number, "YT1234567890");
        assert.match(body.request_key, /^[a-f0-9-]{36}$/);
        const order = { id: "GS-TEST123", title: body.title, status: "confirmed", cargo_id: delivery.cargo_id, warehouse: { label: delivery.label }, inbound: { numbers: [{ no: body.number, company: "" }] } };
        orders = [order]; json.order = order;
      } else Object.assign(json, { products: [], orders: [], notifications: [], more: false });
      await route.fulfill({ status, json, headers: cors });
    });

    await page.goto(base + "/categories", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Карго", { exact: true }).click();
    await page.waitForURL("**/cargo");
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Cargo fits " + width);
      const tabs = page.getByRole("tab");
      assert.equal(await tabs.count(), 6);
      for (const box of await Promise.all((await tabs.all()).map(t => t.boundingBox()))) assert.ok(box && box.width >= 44);
    }
    const button = name => page.getByRole("button", { name, exact: true });
    const field = label => page.getByLabel(label, { exact: true });
    await button("Нэвтрэх / Бүртгүүлэх").waitFor();
    assert.ok(!calls.includes("customer-self-cargo"));
    await field("Нийт жин (кг)").fill("1,2");
    for (const label of ["Урт (см)", "Өргөн (см)", "Өндөр (см)"]) await field(label).fill("10");
    await page.getByText("≈ 3,000 ₮", { exact: true }).waitFor();
    await button("Эзлэхүүн (м³)").click();
    await field("Нийт эзлэхүүн (м³)").fill("2");
    await page.getByText("≈ 429,000 ₮", { exact: true }).waitFor();
    await button("Нэвтрэх / Бүртгүүлэх").click();
    await field("Утасны дугаар").fill(owner.phone);
    await field("4 оронтой PIN").fill("1234");
    await button("PIN-ээр нэвтрэх").click();
    await page.waitForURL("**/cargo");
    await page.getByText("Туршилтын алдаа", { exact: true }).waitFor();
    await button("Дахин оролдох").click();
    await page.getByText(delivery.cargo_id, { exact: true }).waitFor();
    for (const [label, value] of [
      ["Таны карго ID хуулах", delivery.cargo_id], ["Хүлээн авагч хуулах", delivery.recipient],
      ["Утасны дугаар хуулах", delivery.phone], ["Хаяг хуулах", delivery.address], ["Бүгдийг хуулах", delivery.label],
    ]) {
      await button(label).click();
      await page.waitForFunction(async expected => await navigator.clipboard.readText() === expected, value);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    fs.mkdirSync("output/mobile-cargo", { recursive: true });
    await page.evaluate(() => document.querySelector('[role="tablist"]')?.scrollIntoView());
    await page.screenshot({ path: "output/mobile-cargo/address.png" });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.getByText("≈ 429,000 ₮", { exact: true }).waitFor();
    await page.getByText("Карго тооцоолуур", { exact: true }).filter({ visible: true }).evaluate(el => el.parentElement.parentElement.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: "output/mobile-cargo/calculator-dark.png" });
    await page.getByRole("button", { name: /^Авах салбар: / }).click();
    await page.getByTestId("warehouse-option-ulaanbaatar").click();
    await page.getByTestId("warehouse-confirm").click();
    await button("Ачаа бүртгэх").click();
    await page.waitForURL("**/self-cargo?view=register");
    await field("Барааны нэр").fill("Test parcel");
    await field("Хятадын хүргэлтийн дугаар (байгаа бол)").fill("YT1234567890");
    await button("Ачаа бүртгэх").click();
    await page.waitForURL("**/self-cargo?view=shipments");
    await page.getByText("GS-TEST123 · Test parcel", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS Cargo: six compact tabs, guest privacy, tariff parity, login return, address retry, five clipboard actions, pickup selection, registration and shipment list.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
