import { Platform, useWindowDimensions } from "react-native";

// Window width is in dp, so Android's display size setting is accounted for.
export function useCompactAndroid() {
  const { width } = useWindowDimensions();
  return Platform.OS === "android" && width < 600;
}
