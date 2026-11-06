const ORIGIN = "https://gostore.mn";
function trusted(url) {
  try {
    const u = new URL(url);
    return u.origin === ORIGIN && !u.username && !u.password;
  } catch {
    return false;
  }
}
function panel(url, variant) {
  if (!trusted(url)) return false;
  const u = new URL(url);
  return variant === "admin"
    ? ["/admin/", "/admin/index.html"].includes(u.pathname)
    : ["/warehouse/ulaanbaatar/", "/warehouse/ulaanbaatar"].includes(
        u.pathname,
      );
}
function photo(url, variant) {
  if (!trusted(url) || variant !== "warehouse") return false;
  const u = new URL(url);
  return (
    u.pathname === "/api/index.php" &&
    ["warehouse-photo", "warehouse-exception-photo"].includes(
      u.searchParams.get("action"),
    )
  );
}
function scan(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  return /^(GS|GB)-[A-Z0-9-]{3,45}$/.test(v) ? v : null;
}
function external(url) {
  try {
    const u = new URL(url);
    return (
      ["https:", "tel:", "mailto:"].includes(u.protocol) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
module.exports = { trusted, panel, photo, scan, external };
