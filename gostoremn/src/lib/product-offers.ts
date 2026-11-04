import type { Discount, Product } from "./types";

export function productSavings(product: Product, amount: number | null | undefined, discount: Discount | null | undefined = product.card_discount, now = Date.now() / 1000) {
  const available = product.sellable !== false && product.price_status !== "unavailable" && typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  const sale = available && discount && Number.isFinite(discount.expires) && discount.expires > now && discount.current_mnt === amount && Number.isFinite(discount.was_mnt) && discount.was_mnt > amount ? {
    ...discount, percent: validPercent(discount.percent) ? discount.percent : percentOff(discount.was_mnt, amount),
  } : null;
  const offers = available && product.offers && Number.isFinite(product.offers.expires) && product.offers.expires > now ? product.offers : null;
  const coupon = typeof amount === "number" && offers && offers.coupon_base_mnt === amount && typeof offers.coupon_mnt === "number" && Number.isFinite(offers.coupon_mnt) && offers.coupon_mnt > 0 && offers.coupon_mnt < amount ? {
    amount: offers.coupon_mnt, expires: offers.expires,
    percent: validPercent(offers.coupon_percent) ? offers.coupon_percent : percentOff(amount, offers.coupon_mnt),
  } : null;
  return { sale, coupon, offers };
}
function validPercent(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 100; }
function percentOff(base: number, current: number) { return Math.floor(Number(((base - current) / base * 100).toFixed(8))); }
export function percentLabel(percent: number) { return percent > 0 ? "−" + percent + "%" : "<1%"; }
