// Never send route IDs, query strings, search terms or customer data to Analytics.
const screens: Record<string, string> = {
  index: "home", categories: "categories", search: "search", cart: "cart", account: "account",
  "product/[id]": "product", "brand/[id]": "brand", "reviews/[id]": "reviews",
  "order/[id]": "order", orders: "orders", checkout: "checkout", addresses: "addresses",
  notifications: "notifications", login: "login", "email-login": "login",
  "delete-account": "delete_account", help: "help", brands: "brands", "official-stores": "brands",
};
export function analyticsScreen(segments: readonly string[]): string | null {
  const key = segments.filter(s => !s.startsWith("(")).join("/") || "index";
  return screens[key] || null;
}
