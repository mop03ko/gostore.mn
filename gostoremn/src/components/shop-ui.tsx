import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { Platform, Pressable, Text, View, type ColorValue } from "react-native";
import { colors } from "./ui";
const paths = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  camera: "M3 7h4l2-3h6l2 3h4v14H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  cart: "M2 3h3l3 13h11l3-10H6M10 21h.01M18 21h.01",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3",
  box: "m3 7 9-5 9 5v11l-9 5-9-5Zm0 0 9 5 9-5M12 12v11M7 4l10 6",
  chevron: "m9 5 7 7-7 7",
  close: "m5 5 14 14M5 19 19 5",
  check: "m4 12 5 5L20 6",
  message: "M3 3h18v14H9l-6 4Z",
  help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  arrow: "m10 5-7 7 7 7M3 12h19",
  settings: "M3 7h18M3 17h18M8 4v6M16 14v6",
  shirt: "m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0Z",
  dress: "M9 2v5l-5 14h16L15 7V2M9 7h6M9 3c2 2 4 2 6 0",
  pants: "M5 3h14l1 18h-6l-2-11-2 11H4ZM5 7h14M12 3v7",
  keyboard: "M2 6h20v13H2ZM5 10h1m3 0h1m3 0h1m3 0h2M5 13h1m3 0h1m3 0h1m3 0h2M7 16h10",
  mouse: "M5 10a7 7 0 0 1 14 0v5a7 7 0 0 1-14 0ZM12 3v7M5 11h14",
  mirror: "M18 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0M12 14v8M9 5l-1 2",
  hat: "M6 13V9a6 6 0 0 1 12 0v4M6 10h12M2 13h20v5H2Z",
  brush: "m7 13 8-11 4 3-8 10M7 13l4 2c1 5-4 7-8 7 3-2 1-7 4-9Z",
  shoe: "M3 13V5h5l2 6 4 3 7 2v4H3Zm7-2-3 2m6 0-2 2M3 17h18",
  bag: "M4 8h16l1 13H3ZM8 9V6a4 4 0 0 1 8 0v3",
  headphones: "M3 13v-2a9 9 0 0 1 18 0v2M3 12h4v8H3Zm14 0h4v8h-4Z",
  beauty: "M9 10h6v11H9ZM10 10V4l4-2v8M8 21h8",
  child: "M15 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M4 10l8 3 8-3M12 9v7m0 0-5 6m5-6 5 6",
  ball: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2v20M5 5c8 4 8 10 0 14M19 5c-8 4-8 10 0 14",
  toy: "M4 7h16l2 13h-5l-3-4h-4l-3 4H2ZM7 9v5m-2-2h4m7-1h.01m3 2h.01",
  watch: "m8 7 1-5h6l1 5m-8 10 1 5h6l1-5M6 7h12v10H6Zm6 2v3l2 1",
  wallet: "M3 6V3h16v4M3 6h18v15H3Zm18 5h-6v5h6m-3-3h.01",
  glasses: "m2 11 2-6h3m15 6-2-6h-3M2 11h8v6H2Zm12 0h8v6h-8Zm-4 1h4",
  lamp: "m8 3-5 11h18L16 3ZM12 14v7m-5 0h10",
  bed: "M3 5v16m18-13v13M3 17h18M3 9h7v8m0-7h11v7",
  phone: "M6 2h12v20H6ZM10 5h4m-3 14h2",
  bottle: "M9 2h6v5l3 4v11H6V11l3-4Zm-3 12h12",
  truck: "M2 5h12v12H2Zm12 5h4l4 4v3h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  pin: "M19 9c0 5-7 13-7 13S5 14 5 9a7 7 0 1 1 14 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-5 10 3 3 7-7",
  bell: "M5 17V9a7 7 0 0 1 14 0v8l2 2H3Zm4 5h6",
  logout: "M9 3H3v18h6m6-14 5 5-5 5m-7-5h12",
  refresh: "M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5m-4 7a8 8 0 0 0 14 4l3-3m0 5v-5h-5",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
  card: "M2 5h20v14H2ZM2 9h20M6 15h4",
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 24,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue | null;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || colors.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      {...(Platform.OS === "web" ? { "aria-hidden": true as const } : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const })}>
      <Path d={paths[name]} />
    </Svg>
  );
}
export function BrandLogo({ width = 142 }: { width?: number }) {
  return <Image source={require("../../assets/images/gostore-wordmark.png")}
    contentFit="contain" style={{ width, height: width * 324 / 2133 }}
    accessibilityLabel="gostore.mn" accessible />;
}
export function IconButton({
  name,
  label,
  onPress,
  color = colors.ink,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
export function Choice({
  selected,
  label,
  onPress,
  disabled = false,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: selected ? colors.orange : "transparent",
        backgroundColor: selected ? "#fff2e9" : "#f5f5f5",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: selected ? "#b83a00" : colors.ink, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Quantity({
  qty,
  min,
  step,
  max,
  onChange,
  disabled = false,
}: {
  qty: number;
  min: number;
  step: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 8,
      }}
    >
      {[-1, 0, 1].map((d) =>
        d === 0 ? (
          <Text
            key={d}
            selectable
            style={{
              minWidth: 34,
              textAlign: "center",
              fontVariant: ["tabular-nums"],
            }}
          >
            {qty}
          </Text>
        ) : (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={d < 0 ? "Тоо бууруулах" : "Тоо нэмэх"}
            disabled={disabled || qty + d * step < min || qty + d * step > max}
            onPress={() => onChange(qty + d * step)}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              opacity:
                disabled || qty + d * step < min || qty + d * step > max
                  ? 0.3
                  : 1,
            }}
          >
            <Text style={{ fontSize: 21 }}>{d < 0 ? "−" : "+"}</Text>
          </Pressable>
        ),
      )}
    </View>
  );
}
