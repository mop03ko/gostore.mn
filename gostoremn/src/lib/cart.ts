import type { CartLine, Product, Variant } from "./types";
export function addLine(
  cart: CartLine[],
  product: Product,
  variant: Variant,
  qty: number,
): CartLine[] {
  if (
    product.sellable === false ||
    variant.cny === null ||
    !Number.isFinite(variant.cny) ||
    variant.cny <= 0 ||
    !Number.isInteger(qty) ||
    qty < product.min_qty ||
    (qty - product.min_qty) % product.step !== 0
  )
    throw Error("Хувилбар, тоо ширхэгээ шалгана уу.");
  const old = cart.find((i) => i.id === product.id && i.sku === variant.id),
    total = (old?.qty || 0) + qty;
  if (variant.stock === null || total > Math.min(variant.stock, 9999))
    throw Error("Үлдэгдэл хүрэлцэхгүй эсвэл баталгаажаагүй байна.");
  if ((total - product.min_qty) % product.step !== 0)
    throw Error("Нийт тоо багцын алхамтай таарахгүй байна.");
  if (!old && cart.length >= 30)
    throw Error("Сагсанд 30 хүртэл хувилбар нэмнэ.");
  const line: CartLine = {
    id: product.id,
    sku: variant.id,
    name: product.name,
    image: variant.image || product.image,
    variant: variant.label,
    qty: total,
    cny: variant.cny,
    min_qty: product.min_qty,
    step: product.step,
    stock: variant.stock,
  };
  return old ? cart.map((i) => (i === old ? line : i)) : [...cart, line];
}
export function validCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(
      (i) =>
        i &&
        /^tb-\d{5,20}$/.test(i.id) &&
        typeof i.sku === "string" &&
        typeof i.name === "string" &&
        typeof i.variant === "string" &&
        typeof i.image === "string" &&
        (i.stock === null || (Number.isInteger(i.stock) && i.stock >= 0)) &&
        Number.isFinite(i.cny) &&
        i.cny > 0 &&
        Number.isInteger(i.qty) &&
        i.qty > 0 &&
        i.qty <= 9999 &&
        Number.isInteger(i.min_qty) &&
        i.min_qty > 0 &&
        Number.isInteger(i.step) &&
        i.step > 0 &&
        i.qty >= i.min_qty &&
        (i.qty - i.min_qty) % i.step === 0,
    )
    .filter((i) => {
      const key = i.id + "|" + i.sku;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
}
export const selection = (cart: CartLine[]) =>
  cart.map(({ id, sku, qty }) => ({ id, sku, qty }));
export const bankLink = (value: string) =>
  /^(https|qpaywallet|khanbank|statebankmongolia|xacbank|tdbbank|socialpay-payment|most|nibank|ckbank|capitronbank|bogdbank|transbank|mbank|ard|toki|arig|monpay|hipay|tdbwallet|sono|payon|tino|pass):\/\//i.test(
    value,
  )
    ? value
    : null;
