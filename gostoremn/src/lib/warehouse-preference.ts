import type { PickupLocation, Shipping } from "./types";

export const warehousePreferenceKey = "gostore-pickup-warehouse-v1";
export function readWarehousePreference(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value?.version === 1 && typeof value.location === "string" && /^(ulaanbaatar|wh-[a-f0-9]{12})$/.test(value.location) ? value.location : null;
  } catch { return null; }
}
export function pickupLocations(shipping: Shipping | null): PickupLocation[] {
  return shipping?.pickup_locations ?? (shipping?.pickup ? [{ ...shipping.pickup, city: "Улаанбаатар", location: "ulaanbaatar" }] : []);
}

// City reference points, NOT warehouse pins or driving distances. Sources: Wikidata
// Q23430, Q2084833, Q943290, checked 2026-11-15. See docs/warehouse-preference.md.
const cities: Record<string, [number, number]> = {
  "Улаанбаатар": [47 + 55 / 60 + 16.9 / 3600, 106 + 54 / 60 + 19.87 / 3600],
  "Замын-Үүд": [43 + 43 / 60 + 5 / 3600, 111 + 54 / 60 + 22 / 3600],
  "Сайншанд": [44 + 53 / 60 + 30 / 3600, 110 + 8 / 60 + 12 / 3600],
};
export type Position = { coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number; mocked?: boolean };
function distanceKm(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180;
  const h = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((d - b) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function recommendWarehouse(locations: PickupLocation[], position: Position, now = Date.now()): PickupLocation | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (![latitude, longitude, position.timestamp].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || position.mocked) return null;
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10000 || now - position.timestamp > 120000 || position.timestamp > now + 10000) return null;
  const ranked = locations.flatMap((location) => {
    const point = cities[location.city];
    return point ? [{ location, km: distanceKm(latitude, longitude, ...point) }] : [];
  }).sort((a, b) => a.km - b.km);
  if (!ranked.length || ranked[0].km > 150) return null;
  // Don't choose between ambiguous cities or multiple branches without confirmed pins.
  if (ranked[1] && ranked[1].km - ranked[0].km <= 10 + 2 * accuracy / 1000) return null;
  return ranked[0].location;
}
