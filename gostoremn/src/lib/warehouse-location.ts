import type { Position } from "./warehouse-preference";

export class WarehouseLocationError extends Error {
  constructor(message: string, public settings = false) { super(message); }
}
type LocationApi = Pick<typeof import("expo-location"), "getForegroundPermissionsAsync" | "requestForegroundPermissionsAsync" | "hasServicesEnabledAsync" | "getCurrentPositionAsync" | "Accuracy">;
export async function locateForWarehouse(load: () => Promise<LocationApi> = () => import("expo-location")): Promise<Position> {
  // Loaded only after a deliberate tap, never at startup or in background.
  const location = await load();
  let permission = await location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new WarehouseLocationError("Байршлын зөвшөөрөлгүй байна. Агуулахаа гараар сонгож болно.", !permission.canAskAgain);
  if (!await location.hasServicesEnabledAsync()) throw new WarehouseLocationError("Утасны байршил тогтоох үйлчилгээ унтраалттай байна. Агуулахаа гараар сонгоорой.", true);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced, mayShowUserSettingsDialog: false }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new WarehouseLocationError("Байршил тодорхойлох хугацаа дууслаа. Дахин оролдох эсвэл гараар сонгоно уу.")), 20000); }),
    ]);
  } finally { clearTimeout(timer); }
}
