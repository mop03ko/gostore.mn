import { usePalette } from "@/lib/palette";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  type ScrollViewProps,
} from "react-native";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " ₮";
export function Page({ children, refreshControl }: { children: ReactNode; refreshControl?: ScrollViewProps["refreshControl"] }) {
  const colors = usePalette();
  const inset = useSafeAreaInsets();
  return (
    <ScrollView
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: 12,
        paddingBottom: Math.max(inset.bottom, 16) + 24,
        gap: 12,
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
  const colors = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          padding: 16,
          borderRadius: 12,
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
  const colors = usePalette();
  return (
    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.navy }}>
      {children}
    </Text>
  );
}
export function Copy({ children }: { children: ReactNode }) {
  const colors = usePalette();
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
  const colors = usePalette();
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
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary ? colors.subtle : colors.orange,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: secondary ? colors.ink : colors.onPrimary,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const colors = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
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
            backgroundColor: colors.surface,
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
  const colors = usePalette();
  return message ? (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.dangerSurface,
        padding: 14,
        borderRadius: 12,
        gap: 8,
      }}
    >
      <Text selectable style={{ color: colors.danger, lineHeight: 21 }}>
        {message}
      </Text>
      {retry && <Button title="Дахин оролдох" onPress={retry} secondary />}
    </View>
  ) : null;
}
export function Busy() {
  const colors = usePalette();
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
  const colors = usePalette();
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
