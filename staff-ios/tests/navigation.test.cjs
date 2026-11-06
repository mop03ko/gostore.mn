const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  n = require("../lib/navigation.cjs"),
  variants = require("../variants.cjs");
test("each app stays in its own authenticated panel", () => {
  assert.ok(n.panel(variants.admin.startUrl, "admin"));
  assert.ok(n.panel(variants.warehouse.startUrl, "warehouse"));
  assert.ok(!n.panel(variants.admin.startUrl, "warehouse"));
  assert.ok(!n.panel("https://gostore.mn/warehouse/erenhot/", "warehouse"));
  assert.ok(!n.panel("https://gostore.mn/warehouse/", "warehouse"));
});
test("hostile origins and protocols cannot enter a panel", () => {
  for (const u of [
    "http://gostore.mn/admin/",
    "https://gostore.mn.evil.test/admin/",
    "https://evil.test@gostore.mn/admin/",
    "https://gostore.mn:444/admin/",
    "file:///admin/",
    "javascript:alert(1)",
  ])
    assert.ok(!n.panel(u, "admin"), u);
});
test("scanner accepts codes, never executable payloads", () => {
  assert.equal(n.scan(" gs-33b639 "), "GS-33B639");
  assert.equal(n.scan("GB-261113-ABCDEF"), "GB-261113-ABCDEF");
  for (const c of [
    "https://evil.test",
    "GS-<script>",
    "javascript:alert(1)",
    "",
  ])
    assert.equal(n.scan(c), null);
});
test("only permitted photo routes can open in warehouse", () => {
  assert.ok(
    n.photo(
      "https://gostore.mn/api/index.php?action=warehouse-photo&id=GS-123",
      "warehouse",
    ),
  );
  assert.ok(
    !n.photo("https://gostore.mn/api/index.php?action=dashboard", "warehouse"),
  );
  assert.ok(!n.external("javascript:alert(1)"));
  assert.ok(!n.external("file:///etc/passwd"));
});
test("variant identity never falls back silently", () => {
  const old = process.env.APP_VARIANT;
  try {
    delete process.env.APP_VARIANT;
    assert.throws(() => require("../app.config.js")());
    const ids = new Set();
    for (const v of ["admin", "warehouse"]) {
      process.env.APP_VARIANT = v;
      ids.add(require("../app.config.js")().ios.bundleIdentifier);
    }
    assert.equal(ids.size, 2);
  } finally {
    if (old === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = old;
  }
});
