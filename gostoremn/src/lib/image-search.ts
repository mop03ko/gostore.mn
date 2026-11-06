import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { api } from "./api";

// The upload stays private to the request; only the server's search token enters navigation.
export async function uploadSearchPhoto(asset: { uri: string; width: number; height: number }) {
  const resized = await manipulateAsync(asset.uri,
    [{ resize: asset.width >= asset.height ? { width: 800 } : { height: 800 } }],
    { compress: 0.8, format: SaveFormat.JPEG });
  const form = new FormData();
  if (process.env.EXPO_OS === "web") {
    form.append("image", await (await fetch(resized.uri)).blob(), "search.jpg");
  } else {
    form.append("image", { uri: resized.uri, type: "image/jpeg", name: "search.jpg" } as unknown as Blob);
  }
  const result = await api<{ image: string }>("supplier-image-upload", form);
  if (!result.image) throw Error("Зургийг боловсруулж чадсангүй. Дахин оролдоно уу.");
  return result.image;
}
