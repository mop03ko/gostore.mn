import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export const colors = {
  navy: "#182348",
  orange: "#ed681f",
  ink: "#182331",
  muted: "#617086",
  line: "#e2e7ef",
  bg: "#f6f8fc",
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " ₮";
export function Page({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: 18,
        paddingBottom: Math.max(inset.bottom, 16) + 24,
        gap: 16,
        width: "100%",
        maxWidth: 820,
        alignSelf: "center",
      }}
    >
      {children}
    </ScrollView>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: "white",
          padding: 16,
          borderRadius: 18,
          gap: 12,
          borderWidth: 1,
          borderColor: colors.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontSize: 21, fontWeight: "700", color: colors.navy }}>
      {children}
    </Text>
  );
}
export function Copy({ children }: { children: ReactNode }) {
  return (
    <Text
      selectable
      style={{ fontSize: 14, lineHeight: 22, color: colors.muted }}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary ? "#edf1f8" : colors.orange,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: colors.navy,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#758196"
        {...props}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            color: colors.ink,
            backgroundColor: "white",
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return message ? (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: "#fff0eb",
        padding: 14,
        borderRadius: 12,
        gap: 8,
      }}
    >
      <Text selectable style={{ color: "#9f361b", lineHeight: 21 }}>
        {message}
      </Text>
      {retry && <Button title="Дахин оролдох" onPress={retry} secondary />}
    </View>
  ) : null;
}
export function Busy() {
  return (
    <View style={{ padding: 24 }}>
      <ActivityIndicator
        accessibilityLabel="Ачаалж байна"
        size="large"
        color={colors.orange}
      />
    </View>
  );
}
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}
    >
      <Text style={{ flex: 1, color: colors.muted, lineHeight: 22 }}>
        {label}
      </Text>
      <Text
        selectable
        style={{
          maxWidth: "55%",
          fontWeight: "600",
          textAlign: "right",
          color: colors.ink,
          lineHeight: 22,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
