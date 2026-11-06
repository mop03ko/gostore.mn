import { useColorScheme } from "@/hooks/use-color-scheme";

const light = {
  dark: false, navy: "#262261", ink: "#24233b", orange: "#f16522",
  muted: "#737373", line: "#ededed", bg: "#f5f5f5", surface: "#ffffff",
  subtle: "#f3f3f5", accentSurface: "#fff0e7", accentText: "#ad3c10",
  successSurface: "#eaf6ef", success: "#276444", dangerSurface: "#fff0eb",
  danger: "#9f361b", onPrimary: "#171717",
};
export type Palette = typeof light;
const dark: Palette = {
  dark: true, navy: "#eeeaff", ink: "#f4f4f5", orange: "#f16522",
  muted: "#b1b1ba", line: "#37373e", bg: "#111114", surface: "#1d1d22",
  subtle: "#292930", accentSurface: "#39271f", accentText: "#ffad83",
  successSurface: "#18372b", success: "#85dbac", dangerSurface: "#3b2423",
  danger: "#ffa496", onPrimary: "#171717",
};
// Subscribe in each rendered component: theme changes also update memoized screens.
export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}
