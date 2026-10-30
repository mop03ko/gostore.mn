import { Image } from "expo-image";
import { Pressable, Text, View, type ColorValue } from "react-native";
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
  const stroke = typeof color==='string'?color:colors.ink;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
  return (
    <Image
      source={{ uri: "data:image/svg+xml;utf8," + encodeURIComponent(svg) }}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
    />
  );
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
