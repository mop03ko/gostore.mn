import type { Product } from "./types";

// Campaign visibility follows Ulaanbaatar time, regardless of the phone's timezone.
export function elevenSaleActive(now = Date.now()): boolean {
  const local = new Date(now + 8 * 60 * 60 * 1000);
  return local.getUTCMonth() === 10 && local.getUTCDate() <= 11;
}

export function elevenSaleProducts(rows: Product[], now = Date.now()): Product[] {
  const seen = new Set<string>();
  return rows.filter(p => {
    if (!p || !/^tb-\d{5,20}$/.test(p.id) || p.sellable === false || seen.has(p.id)) return false;
    // Only a real price cut for the shown price qualifies; coupons and conditional promotions do not.
    const amount = p.mnt || p.approx_mnt || 0, discount = p.card_discount;
    const sale = discount && discount.expires * 1000 > now && discount.current_mnt === amount && discount.was_mnt > amount;
    if (amount <= 0 || !sale) return false;
    seen.add(p.id);
    return true;
  }).slice(0, 8);
}
