import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "./shop-ui";
import { Button, colors } from "./ui";

export function MenuRow({ icon, title, subtitle, onPress, danger = false, expanded }: {
  icon: IconName; title: string; subtitle?: string; onPress: () => void; danger?: boolean; expanded?: boolean;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded }}
    style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
    <View style={[styles.icon, danger && { backgroundColor: "#fff1ef" }]}>
      <Icon name={icon} size={21} color={danger ? "#b33128" : "#514b72"} />
    </View>
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={[styles.title, danger && { color: "#b33128" }]}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    <View style={expanded ? { transform: [{ rotate: "90deg" }] } : undefined}><Icon name="chevron" size={17} color="#91919c" /></View>
  </Pressable>;
}
export function EmptyState({ icon, title, description, action, onPress }: {
  icon: IconName; title: string; description: string; action: string; onPress: () => void;
}) {
  return <View style={styles.empty}>
    <View style={styles.illustration}><Icon name={icon} size={38} color="#b54417" /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
    <View style={{ alignSelf: "stretch", marginTop: 6 }}><Button title={action} onPress={onPress} /></View>
  </View>;
}
const styles = StyleSheet.create({
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f3f8" },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink },
  subtitle: { fontSize: 12, lineHeight: 17, color: colors.muted },
  empty: { padding: 24, paddingVertical: 32, borderRadius: 22, backgroundColor: "white", alignItems: "center", gap: 12 },
  illustration: { width: 84, height: 84, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#fff1e8", marginBottom: 6 },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", color: colors.ink },
  description: { fontSize: 14, lineHeight: 22, textAlign: "center", color: colors.muted },
});
