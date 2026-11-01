import { usePalette, type Palette } from "@/lib/palette";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "./shop-ui";
import { Button } from "./ui";

export function MenuRow({ icon, title, subtitle, onPress, danger = false, expanded }: {
  icon: IconName; title: string; subtitle?: string; onPress: () => void; danger?: boolean; expanded?: boolean;
}) {
  const colors = usePalette();
  const styles = createStyles(colors);
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded }}
    style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
    <View style={[styles.icon, danger && { backgroundColor: colors.dangerSurface }]}>
      <Icon name={icon} size={21} color={danger ? colors.danger : colors.muted} />
    </View>
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={[styles.title, danger && { color: colors.danger }]}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    <View style={expanded ? { transform: [{ rotate: "90deg" }] } : undefined}><Icon name="chevron" size={17} color={colors.muted} /></View>
  </Pressable>;
}
export function EmptyState({ icon, title, description, action, onPress }: {
  icon: IconName; title: string; description: string; action: string; onPress: () => void;
}) {
  const colors = usePalette();
  const styles = createStyles(colors);
  return <View style={styles.empty}>
    <View style={styles.illustration}><Icon name={icon} size={38} color={colors.accentText} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
    <View style={{ alignSelf: "stretch", marginTop: 6 }}><Button title={action} onPress={onPress} /></View>
  </View>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.subtle },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink },
  subtitle: { fontSize: 12, lineHeight: 17, color: colors.muted },
  empty: { padding: 24, paddingVertical: 32, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", gap: 12 },
  illustration: { width: 84, height: 84, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSurface, marginBottom: 6 },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", color: colors.ink },
  description: { fontSize: 14, lineHeight: 22, textAlign: "center", color: colors.muted },
});
