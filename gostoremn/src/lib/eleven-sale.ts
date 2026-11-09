import type { Product } from "./types";

// Admin setting (Сайтын тохиргоо → 11.11): "auto" keeps the date rule (active is null); "on" extends the
// campaign through `until` (Ulaanbaatar date); "off" ends it early.
export type ElevenCampaign = { mode: "auto" | "on" | "off"; until: string | null; active: boolean | null };

// Campaign visibility follows Ulaanbaatar time, regardless of the phone's timezone.
export function elevenSaleActive(now = Date.now(), campaign?: ElevenCampaign | null): boolean {
  const local = new Date(now + 8 * 60 * 60 * 1000);
  if (campaign && campaign.mode !== "auto" && typeof campaign.active === "boolean") {
    if (!campaign.active || campaign.mode === "off") return false;
    return !campaign.until || local.toISOString().slice(0, 10) <= campaign.until;
  }
  return local.getUTCMonth() === 10 && local.getUTCDate() <= 11;
}

// Reads the public `campaign` response; anything unexpected keeps the date rule.
export function elevenCampaign(value: unknown): ElevenCampaign | null {
  const c = (value as { eleven?: Partial<ElevenCampaign> } | null)?.eleven;
  if (!c || !["auto", "on", "off"].includes(String(c.mode))) return null;
  const until = typeof c.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.until) ? c.until : null;
  return { mode: c.mode as ElevenCampaign["mode"], until, active: typeof c.active === "boolean" ? c.active : null };
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
