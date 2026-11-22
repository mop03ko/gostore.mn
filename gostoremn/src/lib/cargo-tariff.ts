export type CargoTariff = {
  small_weight_limit_kg: number;
  small_volume_limit_m3: number;
  large_per_m3_cny: number;
  large_per_tonne_cny: number;
} & (
  | { version: 2; light_limit_kg: number; light_mnt: number; small_per_kg_mnt: number }
  | { version: 3; small_step_kg: number; small_step_mnt: number }
);

export function cargoNumber(value: string) {
  const decimal = value.trim().replace(",", ".");
  return /^(?:\d+\.?\d*|\.\d+)$/.test(decimal) ? Number(decimal) : NaN;
}

// Match server/cargo-tariff.php and the public web calculator's automatic estimate.
export function estimateCargo(weight: number, volume: number, tariff?: CargoTariff, rate?: number) {
  if (!tariff || !rate || ![weight, volume, rate].every(Number.isFinite) ||
      rate <= 0 || weight < 0.001 || weight > 10000 || volume <= 0 || volume > 1000) return null;
  const base = [tariff.small_weight_limit_kg, tariff.small_volume_limit_m3, tariff.large_per_m3_cny, tariff.large_per_tonne_cny];
  const small = tariff.version === 3
    ? [tariff.small_step_kg, tariff.small_step_mnt]
    : tariff.version === 2 ? [tariff.light_limit_kg, tariff.light_mnt, tariff.small_per_kg_mnt] : [];
  if (!small.length || [...base, ...small].some(n => !Number.isFinite(n) || n <= 0)) return null;

  const large = weight >= tariff.small_weight_limit_kg || volume > tariff.small_volume_limit_m3;
  let basis: "weight" | "volume" | "light" = "weight";
  let raw: number;
  if (large) {
    const byWeight = weight * tariff.large_per_tonne_cny / 1000;
    const byVolume = volume * tariff.large_per_m3_cny;
    basis = byWeight >= byVolume ? "weight" : "volume";
    raw = Math.max(byWeight, byVolume) * rate;
  } else if (tariff.version === 3) {
    const steps = Math.max(1, Math.ceil(Number((weight / tariff.small_step_kg).toFixed(8))));
    raw = steps * tariff.small_step_mnt;
  } else {
    basis = weight <= tariff.light_limit_kg ? "light" : "weight";
    raw = basis === "light" ? tariff.light_mnt : weight * tariff.small_per_kg_mnt;
  }
  const amount = Math.ceil(Number(raw.toFixed(8)));
  return amount <= 100_000_000 ? { amount, category: large ? "large" : "small", basis } : null;
}
